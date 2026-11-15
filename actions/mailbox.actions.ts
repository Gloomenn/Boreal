// actions/mailbox.actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/actions/auth.actions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendTelegramNotification } from "@/lib/notifications";
import {
  createMailSlurpMailbox,
  getMailSlurpClient,
  getMailSlurpInboxId,
} from "@/lib/mailslurp";
import {
  authenticateMailTmMailbox,
  deleteMailTmMailbox,
  downloadMailTmAttachment,
  getMailTmMessage,
  isMailTmMailbox,
  listMailTmMessages,
  type MailTmMessage,
} from "@/lib/mailtm";
import type { Email, EmailPreview } from "mailslurp-client";

// ============================================================
//  1. CREAR CORREO TEMPORAL
// ============================================================

export async function createTemporaryMailbox(aliasName: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      redirect("/login");
    }

    const inbox = await createMailSlurpMailbox(aliasName);
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
        const mailslurp = getMailSlurpClient();
        await mailslurp.deleteInbox(getMailSlurpInboxId(inbox.accountToken));
      } catch (cleanupError) {
        console.error(
          "No se pudo limpiar el buzón MailSlurp recién creado:",
          cleanupError,
        );
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

    const isMailTm = isMailTmMailbox(mailbox.apiToken);
    let accessToken: string | undefined;
    let mailslurp: ReturnType<typeof getMailSlurpClient> | undefined;
    let emails: Array<MailTmMessage | EmailPreview>;

    if (isMailTm) {
      console.log("📡 Sincronizando buzón Mail.tm:", mailbox.emailAddress);
      const result = await listMailTmMessages(
        mailbox.emailAddress,
        mailbox.apiToken,
      );
      accessToken = result.accessToken;
      emails = result.messages;
    } else {
      console.log("📡 Sincronizando buzón MailSlurp:", mailbox.emailAddress);
      mailslurp = getMailSlurpClient();
      emails = await mailslurp.getEmails(
        getMailSlurpInboxId(mailbox.apiToken),
      );
    }

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
      const emailId = isMailTm
        ? emailSummary.id ||
          (typeof (emailSummary as MailTmMessage)["@id"] === "string"
            ? (emailSummary as MailTmMessage)["@id"]
                ?.split("/")
                .filter(Boolean)
                .at(-1)
            : undefined)
        : (emailSummary as EmailPreview).id;

      if (!emailId) {
        throw new Error(
          `${isMailTm ? "Mail.tm" : "MailSlurp"} devolvió un mensaje sin identificador.`,
        );
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
        let fullEmail: MailTmMessage | Email;
        if (isMailTm) {
          if (!accessToken) {
            throw new Error("No se pudo autenticar el buzón Mail.tm.");
          }
          fullEmail = await getMailTmMessage(
            accessToken,
            emailId,
            mailbox.apiToken,
          );
        } else {
          if (!mailslurp) {
            throw new Error("No se pudo inicializar el cliente de MailSlurp.");
          }
          fullEmail = await mailslurp.getEmail(emailId);
        }
        let bodyText: string;
        let bodyHtml: string;
        let from: string;
        let hasAttachments: boolean;
        let subject: string;
        let receivedAt: Date;

        if (isMailTm) {
          const mailTmEmail = fullEmail as MailTmMessage;
          const htmlBody = Array.isArray(mailTmEmail.html)
            ? mailTmEmail.html.join("")
            : typeof mailTmEmail.html === "string"
              ? mailTmEmail.html
              : "";
          bodyText =
            mailTmEmail.text ||
            mailTmEmail.intro ||
            htmlBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          bodyHtml =
            htmlBody ||
            bodyText
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#39;")
              .replace(/\n/g, "<br>");
          if (typeof mailTmEmail.from === "string") {
            from = mailTmEmail.from;
          } else {
            from =
              mailTmEmail.from?.address ||
              mailTmEmail.from?.name ||
              "Desconocido";
          }
          hasAttachments =
            mailTmEmail.hasAttachments === true ||
            (Array.isArray(mailTmEmail.attachments) &&
              mailTmEmail.attachments.length > 0);
          subject = mailTmEmail.subject || emailSummary.subject || "Sin asunto";
          receivedAt = new Date(mailTmEmail.createdAt || Date.now());
        } else {
          const mailSlurpEmail = fullEmail as Email;
          const body = mailSlurpEmail.body || mailSlurpEmail.textExcerpt || "";
          bodyText = mailSlurpEmail.isHTML
            ? body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
            : body;
          bodyHtml = mailSlurpEmail.isHTML
            ? body
            : body
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;")
                .replace(/\n/g, "<br>");
          from = mailSlurpEmail.from || "Desconocido";
          hasAttachments = Boolean(mailSlurpEmail.attachments?.length);
          subject = mailSlurpEmail.subject || emailSummary.subject || "Sin asunto";
          receivedAt = new Date(mailSlurpEmail.createdAt.getTime());
        }

        console.log(
          `📝 Contenido extraído: ${bodyText.length} caracteres de texto, ${bodyHtml.length} caracteres de HTML`,
        );

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
              receivedAt,
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
          : `Sincronización completada con ${totalErrors} error(es). Revisa el detalle de cada buzón para identificar el proveedor y el error.`,
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

    let content: Buffer;
    let contentType: string;
    let filename: string;

    if (isMailTmMailbox(mailbox.apiToken)) {
      const accessToken = await authenticateMailTmMailbox(
        mailbox.emailAddress,
        mailbox.apiToken,
      );
      const fullEmail = await getMailTmMessage(
        accessToken,
        message.messageId,
        mailbox.apiToken,
      );
      const mailTmAttachment = fullEmail.attachments?.[0];

      if (!mailTmAttachment) {
        return new Response("Este mensaje no tiene adjuntos", { status: 404 });
      }

      const attachment = await downloadMailTmAttachment(
        accessToken,
        message.messageId,
        mailTmAttachment,
        mailbox.apiToken,
      );
      content = attachment.content;
      contentType = attachment.contentType;
      filename = attachment.filename;
    } else {
      const mailslurp = getMailSlurpClient();
      const email = await mailslurp.getEmail(message.messageId);
      const attachmentId = email.attachments?.[0];
      if (!attachmentId) {
        return new Response("Este mensaje no tiene adjuntos", { status: 404 });
      }

      const metadata = await mailslurp.emailController.getAttachmentMetaData({
        attachmentId,
        emailId: message.messageId,
      });
      const downloaded =
        await mailslurp.emailController.downloadAttachmentBase64({
          attachmentId,
          emailId: message.messageId,
        });
      content = Buffer.from(downloaded.base64FileContents, "base64");
      contentType = metadata.contentType || downloaded.contentType;
      filename = metadata.name || "adjunto";
    }

    const safeFilename = filename.replace(/[\r\n"\\]/g, "_");

    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
        "Content-Type": contentType,
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
      const mailslurp = getMailSlurpClient();
      await mailslurp.deleteInbox(
        getMailSlurpInboxId(mailbox.apiToken),
      );
    }

    await prisma.mailbox.delete({
      where: { id: mailboxId },
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      message: "Buzón eliminado correctamente",
    };
  } catch (error: unknown) {
    console.error("❌ Error eliminando buzón:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
