// actions/mailbox.actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/actions/auth.actions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendTelegramNotification } from "@/lib/notifications";
import {
  authenticateMailTmMailbox,
  createMailTmMailbox,
  deleteMailTmMailbox,
  downloadMailTmAttachment,
  getMailTmMessage,
  isMailTmMailbox,
  listMailTmMessages,
  type MailTmMessage,
} from "@/lib/mailtm";

// ============================================================
//  1. CREAR CORREO TEMPORAL
// ============================================================

export async function createTemporaryMailbox(aliasName: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      redirect("/login");
    }

    const inbox = await createMailTmMailbox();
    let newMailbox;
    try {
      newMailbox = await prisma.mailbox.create({
        data: {
          aliasName,
          emailAddress: inbox.emailAddress,
          apiToken: inbox.accountToken,
          userId: user.id,
          status: "active",
        },
      });
    } catch (databaseError) {
      try {
        await deleteMailTmMailbox(inbox.emailAddress, inbox.accountToken);
      } catch (cleanupError) {
        console.error("No se pudo limpiar el buzón Mail.tm recién creado:", cleanupError);
      }
      throw databaseError;
    }

    revalidatePath("/dashboard");
    return { success: true, mailbox: newMailbox };
  } catch (error: unknown) {
    console.error("❌ Error creando mailbox:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al crear el correo",
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
  } catch (error: unknown) {
    console.error("❌ Error obteniendo mailboxes:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
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
      select: {
        aliasName: true,
        emailAddress: true,
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

    return {
      success: true,
      data: {
        mailbox,
        messages,
      },
    };
  } catch (error: unknown) {
    console.error("❌ Error obteniendo mensajes:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

// ============================================================
//  4. SINCRONIZAR UN CORREO
// ============================================================

// Sincroniza un mailbox sin verificar sesión de usuario (usado por el cron y por syncMailbox).
export async function syncMailboxInternal(mailboxId: string) {
  try {
    const mailbox = await prisma.mailbox.findFirst({
      where: {
        id: mailboxId,
        status: "active",
      },
    });

    if (!mailbox) {
      return { success: false, error: "Correo no encontrado o no autorizado" };
    }

    if (!isMailTmMailbox(mailbox.apiToken)) {
      return {
        success: false,
        error:
          "Este buzón fue creado con MailSlurp y no se puede migrar. Crea un buzón nuevo con Mail.tm; conserva este si necesitas consultar los mensajes ya guardados.",
      };
    }

    console.log("📡 Sincronizando buzón Mail.tm:", mailbox.emailAddress);
    const { accessToken, messages: emails } = await listMailTmMessages(
      mailbox.emailAddress,
      mailbox.apiToken,
    );

    if (emails.length === 0) {
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
      const emailId =
        emailSummary.id ||
        (typeof emailSummary["@id"] === "string"
          ? emailSummary["@id"].split("/").filter(Boolean).at(-1)
          : undefined);

      if (!emailId) {
        throw new Error("Mail.tm devolvió un mensaje sin identificador.");
      }

      const existing = await prisma.message.findUnique({
        where: { messageId: emailId },
      });

      // Si el mensaje ya existe y no está vacío, lo omitimos.
      // Si el mensaje existía pero quedó guardado como "Sin contenido" o sin HTML, lo re-procesamos para actualizarlo.
      const isExistingEmpty =
        existing &&
        (!existing.bodyText ||
          existing.bodyText === "Sin contenido" ||
          !existing.bodyHtml);

      if (!existing || isExistingEmpty) {
        const fullEmail: MailTmMessage = await getMailTmMessage(
          accessToken,
          emailId,
        );

        const htmlBody = Array.isArray(fullEmail.html)
          ? fullEmail.html.join("")
          : typeof fullEmail.html === "string"
            ? fullEmail.html
            : "";
        const bodyText =
          fullEmail.text ||
          fullEmail.intro ||
          htmlBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        const bodyHtml =
          htmlBody ||
          bodyText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/\n/g, "<br>");

        console.log(
          `📝 Contenido extraído: ${bodyText.length} caracteres de texto, ${bodyHtml.length} caracteres de HTML`,
        );

        let from = "Desconocido";
        if (fullEmail.from) {
          if (typeof fullEmail.from === "string") {
            from = fullEmail.from;
          } else {
            from =
              fullEmail.from.address ||
              fullEmail.from.name ||
              "Desconocido";
          }
        }

        const hasAttachments =
          fullEmail.hasAttachments === true ||
          (Array.isArray(fullEmail.attachments) &&
            fullEmail.attachments.length > 0);
        const subject = fullEmail.subject || emailSummary.subject || "Sin asunto";

        if (existing) {
          // Actualizar mensaje previamente incompleto
          await prisma.message.update({
            where: { id: existing.id },
            data: {
              from,
              subject,
              bodyText: bodyText || "Sin contenido",
              bodyHtml,
              hasAttachments,
            },
          });
          savedCount++;
        } else {
          // Crear nuevo mensaje
          await prisma.message.create({
            data: {
              mailboxId: mailbox.id,
              messageId: emailId,
              from,
              subject,
              bodyText: bodyText || "Sin contenido",
              bodyHtml,
              hasAttachments,
              receivedAt: new Date(fullEmail.createdAt || Date.now()),
            },
          });

          // Notificación por Telegram para mensajes nuevos
          try {
            const appUrl =
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const notificationMessage = `
📨 <b>Nuevo correo recibido</b>
📌 <b>De:</b> ${from}
📎 <b>Asunto:</b> ${subject}
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
  } catch (error: unknown) {
    console.error("❌ Error sincronizando mailbox:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

// Versión pública usada desde el dashboard: valida que el mailbox pertenezca al usuario logueado.
export async function syncMailbox(mailboxId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, userId: user.id, status: "active" },
    select: { id: true },
  });

  if (!mailbox) {
    return { success: false, error: "Correo no encontrado o no autorizado" };
  }

  return syncMailboxInternal(mailboxId);
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

    const results: Array<{
      email: string;
      success: boolean;
      saved?: number;
      total?: number;
      mailbox?: string;
      error?: string;
    }> = [];
    for (const mailbox of mailboxes) {
      const result = await syncMailboxInternal(mailbox.id);
      results.push({ email: mailbox.emailAddress, ...result });
    }

    const totalSaved = results.reduce((sum, result) => sum + (result.saved || 0), 0);
    const totalErrors = results.filter((result) => !result.success).length;

    revalidatePath("/dashboard");

    return {
      success: true,
      message:
        totalErrors === 0
          ? `Sincronización completada. ${totalSaved} mensajes nuevos guardados.`
          : `Sincronización completada con ${totalErrors} error(es). Los buzones MailSlurp no se pueden migrar; crea buzones nuevos y conserva los antiguos si necesitas consultar su historial.`,
      details: results,
      errors: totalErrors,
    };
  } catch (error: unknown) {
    console.error("❌ Error sincronizando todos los mailboxes:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

export async function syncAllMailboxes() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    return await syncAllMailboxesInternal();
  } catch (error: unknown) {
    console.error("❌ Error sincronizando todos los mailboxes:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
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

    if (!isMailTmMailbox(mailbox.apiToken)) {
      return new Response(
        "Los adjuntos de este buzón MailSlurp ya no están disponibles en la integración actual.",
        { status: 409 },
      );
    }

    const accessToken = await authenticateMailTmMailbox(
      mailbox.emailAddress,
      mailbox.apiToken,
    );
    const fullEmail = await getMailTmMessage(accessToken, message.messageId);

    if (
      !Array.isArray(fullEmail.attachments) ||
      fullEmail.attachments.length === 0
    ) {
      return new Response("Este mensaje no tiene adjuntos", { status: 404 });
    }

    const attachment = await downloadMailTmAttachment(
      accessToken,
      message.messageId,
      fullEmail.attachments[0],
    );
    const safeFilename = attachment.filename.replace(/[\r\n"\\]/g, "_");

    return new Response(attachment.content, {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
        "Content-Type": attachment.contentType,
      },
    });
  } catch (error: unknown) {
    console.error("❌ Error descargando adjunto:", error);
    return new Response(
      `Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
      { status: 500 },
    );
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

    const isMailTm = isMailTmMailbox(mailbox.apiToken);
    if (isMailTm) {
      await deleteMailTmMailbox(mailbox.emailAddress, mailbox.apiToken);
    } else {
      console.warn(
        `El buzón antiguo ${mailbox.emailAddress} no puede eliminarse en MailSlurp desde esta versión.`,
      );
    }

    await prisma.mailbox.delete({
      where: { id: mailboxId },
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      message: isMailTm
        ? "Buzón eliminado correctamente"
        : "Buzón y mensajes locales eliminados. El buzón anterior de MailSlurp puede seguir existiendo en ese servicio.",
    };
  } catch (error: unknown) {
    console.error("❌ Error eliminando buzón:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
