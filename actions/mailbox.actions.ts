// actions/mailbox.actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/actions/auth.actions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendTelegramNotification } from "@/lib/notifications";

// ============================================================
//  CONFIGURACIÓN - MAILSLURP (con any para evitar errores de tipos)
// ============================================================

// Import dinámico para evitar problemas de tipos en tiempo de compilación
const { MailSlurp } = require("mailslurp-client");

const mailslurp = new MailSlurp({
  apiKey: process.env.MAILSLURP_API_KEY || "",
});

// ============================================================
//  1. CREAR CORREO TEMPORAL
// ============================================================

export async function createTemporaryMailbox(aliasName: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      redirect("/login");
    }

    // Crear un inbox temporal en MailSlurp
    const inbox = await mailslurp.createInboxWithOptions({
      expiresIn: 60 * 60 * 1000,
      description: `Buzón para: ${aliasName}`,
    });

    const fullEmail = inbox.emailAddress;
    const inboxId = inbox.id;

    console.log("📧 Correo creado con MailSlurp:", fullEmail);

    const newMailbox = await prisma.mailbox.create({
      data: {
        aliasName: aliasName,
        emailAddress: fullEmail,
        apiToken: inboxId,
        userId: user.id,
        status: "active",
      },
    });

    revalidatePath("/dashboard");
    return { success: true, mailbox: newMailbox };
  } catch (error: any) {
    console.error("❌ Error creando mailbox:", error);
    return {
      success: false,
      error: error.message || "Error desconocido al crear el correo",
    };
  }
}

// ============================================================
//  2. LISTAR CORREOS DEL USUARIO
// ============================================================

export async function getMyMailboxes() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const mailboxes = await prisma.mailbox.findMany({
      where: {
        userId: user.id,
        status: "active",
      },
      include: {
        messages: {
          orderBy: {
            receivedAt: "desc",
          },
          take: 5,
          select: {
            id: true,
            subject: true,
            from: true,
            receivedAt: true,
            bodyText: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, data: mailboxes };
  } catch (error: any) {
    console.error("❌ Error obteniendo mailboxes:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================
//  3. OBTENER MENSAJES DE UN CORREO
// ============================================================

export async function getMailboxMessages(mailboxId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const mailbox = await prisma.mailbox.findFirst({
      where: {
        id: mailboxId,
        userId: user.id,
      },
    });

    if (!mailbox) {
      return { success: false, error: "Correo no encontrado o no autorizado" };
    }

    const messages = await prisma.message.findMany({
      where: {
        mailboxId: mailboxId,
      },
      orderBy: {
        receivedAt: "desc",
      },
    });

    return { success: true, data: messages };
  } catch (error: any) {
    console.error("❌ Error obteniendo mensajes:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================
//  4. SINCRONIZAR UN CORREO
// ============================================================

export async function syncMailbox(mailboxId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const mailbox = await prisma.mailbox.findFirst({
      where: {
        id: mailboxId,
        userId: user.id,
        status: "active",
      },
    });

    if (!mailbox) {
      return { success: false, error: "Correo no encontrado o no autorizado" };
    }

    const inboxId = mailbox.apiToken;
    console.log("📡 Sincronizando inbox:", inboxId);

    let emails: any[] = [];

    // Intentar obtener los emails con el SDK de MailSlurp
    try {
      emails = await mailslurp.getEmails(inboxId);
      console.log("✅ mailslurp.getEmails(inboxId) funcionó");
    } catch (error1) {
      console.warn("⚠️ Falló mailslurp.getEmails(inboxId):", error1);
      try {
        const response = await fetch(
          `https://api.mailslurp.com/inboxes/${inboxId}/emails`,
          {
            headers: {
              "x-api-key": process.env.MAILSLURP_API_KEY || "",
            },
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        emails = data.content || data || [];
        console.log("✅ Llamada directa a la API funcionó");
      } catch (error2) {
        console.error("❌ Falló la sincronización:", error2);
        throw new Error(
          "No se pudo obtener la lista de emails. Revisa la API Key de MailSlurp.",
        );
      }
    }

    if (!emails || emails.length === 0) {
      console.log("📭 No hay mensajes nuevos en este buzón");
      return {
        success: true,
        saved: 0,
        total: 0,
        mailbox: mailbox.emailAddress,
      };
    }

    console.log(
      `📨 Encontrados ${emails.length} mensajes en ${mailbox.emailAddress}`,
    );

    let savedCount = 0;

    for (const emailSummary of emails) {
      const existing = await prisma.message.findUnique({
        where: { messageId: emailSummary.id },
      });

      // Si el mensaje ya existe y no está vacío, lo omitimos.
      // Si el mensaje existía pero quedó guardado como "Sin contenido" o sin HTML, lo re-procesamos para actualizarlo.
      const isExistingEmpty =
        existing &&
        (!existing.bodyText ||
          existing.bodyText === "Sin contenido" ||
          !existing.bodyHtml);

      if (!existing || isExistingEmpty) {
        let fullEmail: any = null;

        // Obtener el email completo usando el SDK de MailSlurp
        try {
          fullEmail = await mailslurp.getEmail(emailSummary.id);
        } catch (getError) {
          console.warn("⚠️ Error al obtener detalle del email:", getError);
        }

        if (!fullEmail) {
          console.error(
            `❌ Error al obtener detalle del email ${emailSummary.id}`,
          );
          continue;
        }

        // 🔥 EXTRACCIÓN MEJORADA DEL CONTENIDO
        let bodyText = "";
        let bodyHtml = "";

        const rawBody =
          typeof fullEmail.body === "string" ? fullEmail.body : "";
        const isHtml =
          fullEmail.isHTML === true || /<[a-z][\s\S]*>/i.test(rawBody);

        if (isHtml) {
          bodyHtml =
            rawBody ||
            (typeof fullEmail.html === "string" ? fullEmail.html : "");
          bodyText =
            fullEmail.textExcerpt ||
            fullEmail.bodyExcerpt ||
            bodyHtml
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
        } else {
          bodyText =
            rawBody ||
            fullEmail.textBody ||
            fullEmail.text ||
            fullEmail.bodyExcerpt ||
            "";
          bodyHtml =
            (typeof fullEmail.html === "string" ? fullEmail.html : "") ||
            (bodyText ? bodyText.replace(/\n/g, "<br>") : "");
        }

        // Respaldos si alguno sigue vacío
        if (!bodyHtml && bodyText) {
          bodyHtml = bodyText.replace(/\n/g, "<br>");
        }
        if (!bodyText && bodyHtml) {
          bodyText = bodyHtml
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }

        console.log(
          `📝 Contenido extraído: ${bodyText.length} caracteres de texto, ${bodyHtml.length} caracteres de HTML`,
        );

        // Obtener el remitente
        let from = "Desconocido";
        if (fullEmail.from) {
          if (typeof fullEmail.from === "string") {
            from = fullEmail.from;
          } else if (fullEmail.from.address) {
            from = fullEmail.from.address;
          } else if (fullEmail.from.emailAddress) {
            from = fullEmail.from.emailAddress;
          }
        } else if (emailSummary.from) {
          if (typeof emailSummary.from === "string") {
            from = emailSummary.from;
          } else if (emailSummary.from.address) {
            from = emailSummary.from.address;
          }
        }

        // Verificar si tiene adjuntos
        const hasAttachments =
          Array.isArray(fullEmail.attachments) &&
          fullEmail.attachments.length > 0;

        if (existing) {
          // Actualizar mensaje previamente incompleto
          await prisma.message.update({
            where: { id: existing.id },
            data: {
              from: from || "Desconocido",
              subject:
                fullEmail.subject || emailSummary.subject || "Sin asunto",
              bodyText: bodyText || "Sin contenido",
              bodyHtml: bodyHtml || bodyText || "",
              hasAttachments: hasAttachments,
            },
          });
          savedCount++;
        } else {
          // Crear nuevo mensaje
          await prisma.message.create({
            data: {
              mailboxId: mailbox.id,
              messageId: fullEmail.id || emailSummary.id,
              from: from || "Desconocido",
              subject:
                fullEmail.subject || emailSummary.subject || "Sin asunto",
              bodyText: bodyText || "Sin contenido",
              bodyHtml: bodyHtml || bodyText || "",
              hasAttachments: hasAttachments,
              receivedAt: new Date(
                fullEmail.createdAt || emailSummary.createdAt || Date.now(),
              ),
            },
          });

          // Notificación por Telegram para mensajes nuevos
          try {
            const appUrl =
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const notificationMessage = `
📨 <b>Nuevo correo recibido</b>
📌 <b>De:</b> ${from || "Desconocido"}
📎 <b>Asunto:</b> ${fullEmail.subject || emailSummary.subject || "Sin asunto"}
${hasAttachments ? "📎 <b>Adjuntos:</b> Sí" : ""}
📝 <b>Contenido:</b> ${(bodyText || "").substring(0, 200)}${(bodyText || "").length > 200 ? "..." : ""}
🔗 <a href="${appUrl}/dashboard/${mailboxId}">Ver en la aplicación</a>`;

            await sendTelegramNotification(notificationMessage);
          } catch (notifError) {
            console.warn("Error enviando notificación:", notifError);
          }

          savedCount++;
        }
      }
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${mailboxId}`);

    return {
      success: true,
      saved: savedCount,
      total: emails.length,
      mailbox: mailbox.emailAddress,
    };
  } catch (error: any) {
    console.error("❌ Error sincronizando mailbox:", error);
    return { success: false, error: error.message };
  }
}
// ============================================================
//  5. SINCRONIZAR TODOS LOS CORREOS
// ============================================================

export async function syncAllMailboxesInternal() {
  try {
    const mailboxes = await prisma.mailbox.findMany({
      where: {
        status: "active",
      },
      select: {
        id: true,
        emailAddress: true,
      },
    });

    if (mailboxes.length === 0) {
      return { success: true, message: "No hay correos para sincronizar" };
    }

    const results = await Promise.all(
      mailboxes.map(async (mb: { id: string; emailAddress: string }) => {
        const result = await syncMailbox(mb.id);
        return {
          email: mb.emailAddress,
          ...result,
        };
      }),
    );

    const totalSaved = results.reduce(
      (sum: number, r: any) => sum + (r.saved || 0),
      0,
    );
    const totalErrors = results.filter((r: any) => !r.success).length;

    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Sincronización completada. ${totalSaved} mensajes nuevos guardados.`,
      details: results,
      errors: totalErrors,
    };
  } catch (error: any) {
    console.error("❌ Error sincronizando todos los mailboxes:", error);
    return { success: false, error: error.message };
  }
}

export async function syncAllMailboxes() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    return await syncAllMailboxesInternal();
  } catch (error: any) {
    console.error("❌ Error sincronizando todos los mailboxes:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================
//  6. DESCARGAR ADJUNTO
// ============================================================

export async function downloadAttachment(messageId: string, mailboxId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response("No autenticado", { status: 401 });
    }

    const mailbox = await prisma.mailbox.findFirst({
      where: {
        id: mailboxId,
        userId: user.id,
        status: "active",
      },
    });

    if (!mailbox) {
      return new Response("Buzón no encontrado o no autorizado", {
        status: 404,
      });
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        mailboxId: mailboxId,
      },
    });

    if (!message) {
      return new Response("Mensaje no encontrado", { status: 404 });
    }

    // Obtener el email completo usando el SDK de MailSlurp
    const fullEmail = await mailslurp.getEmail(message.messageId);

    if (
      !fullEmail ||
      !Array.isArray(fullEmail.attachments) ||
      fullEmail.attachments.length === 0
    ) {
      return new Response("Este mensaje no tiene adjuntos", { status: 404 });
    }

    const attachmentId = fullEmail.attachments[0];

    let fileName = "adjunto.pdf";
    let contentType = "application/octet-stream";

    try {
      const meta = await mailslurp.emailController.getAttachmentMetaData({
        attachmentId,
        emailId: message.messageId,
      });
      if (meta?.name) fileName = meta.name;
      if (meta?.contentType) contentType = meta.contentType;
    } catch (metaErr) {
      console.warn("⚠️ No se pudo obtener metadatos del adjunto:", metaErr);
    }

    const downloadDto =
      await mailslurp.emailController.downloadAttachmentBase64({
        attachmentId,
        emailId: message.messageId,
      });

    if (!downloadDto || !downloadDto.base64FileContents) {
      return new Response("Error al descargar el contenido del adjunto", {
        status: 500,
      });
    }

    const fileBuffer = Buffer.from(downloadDto.base64FileContents, "base64");

    return new Response(fileBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Type": downloadDto.contentType || contentType,
      },
    });
  } catch (error: any) {
    console.error("❌ Error descargando adjunto:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// ============================================================
//  7. ELIMINAR BUZÓN
// ============================================================

export async function deleteMailbox(mailboxId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const mailbox = await prisma.mailbox.findFirst({
      where: {
        id: mailboxId,
        userId: user.id,
      },
    });

    if (!mailbox) {
      return { success: false, error: "Correo no encontrado o no autorizado" };
    }

    try {
      const inboxId = mailbox.apiToken;
      await mailslurp.deleteInbox(inboxId);
      console.log(`🗑️ Inbox eliminado de MailSlurp: ${mailbox.emailAddress}`);
    } catch (deleteError) {
      console.error(
        "Error eliminando de MailSlurp (continuando localmente):",
        deleteError,
      );
    }

    await prisma.mailbox.delete({
      where: { id: mailboxId },
    });

    revalidatePath("/dashboard");
    return { success: true, message: "Buzón eliminado correctamente" };
  } catch (error: any) {
    console.error("❌ Error eliminando buzón:", error);
    return { success: false, error: error.message };
  }
}
