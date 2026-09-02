// actions/mailbox.actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/actions/auth.actions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendTelegramNotification } from "@/lib/notifications";

// --- 1. Función auxiliar para obtener el dominio de mail.tm ---
async function getMailDomain() {
  const res = await fetch("https://api.mail.tm/domains");
  const data = await res.json();
  // Tomamos el primer dominio activo (suele ser "@cliente.mail.tm")
  return data["hydra:member"][0].domain;
}

// --- 2. Crear un nuevo correo temporal ---
export async function createTemporaryMailbox(aliasName: string) {
  try {
    // Verificar que el usuario esté autenticado
    const user = await getCurrentUser();
    if (!user) {
      redirect("/login");
    }

    // Obtener dominio y generar email aleatorio
    const domain = await getMailDomain();
    const randomUser = `tramite_${Math.random().toString(36).substring(2, 10)}`;
    const fullEmail = `${randomUser}@${domain}`;
    const password = `Temp${Math.random().toString(36).substring(2, 10)}!`;

    // 1. Llamar a mail.tm para CREAR la cuenta
    const createRes = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: fullEmail,
        password: password,
      }),
    });

    if (!createRes.ok) {
      const errorData = await createRes.json();
      throw new Error(
        `mail.tm error: ${errorData.detail || "Error desconocido"}`,
      );
    }

    // 2. Iniciar sesión en mail.tm para obtener el TOKEN
    const loginRes = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: fullEmail,
        password: password,
      }),
    });

    const loginData = await loginRes.json();
    const token = loginData.token;

    // 3. Guardar en NUESTRA base de datos (SQLite)
    const newMailbox = await prisma.mailbox.create({
      data: {
        aliasName: aliasName,
        emailAddress: fullEmail,
        apiToken: token,
        userId: user.id,
        status: "active",
      },
    });

    // Revalidamos la ruta para que el frontend se actualice
    revalidatePath("/dashboard");

    return { success: true, mailbox: newMailbox };
  } catch (error: any) {
    console.error("Error creando mailbox:", error);
    return { success: false, error: error.message };
  }
}

// --- 3. Obtener TODOS los correos del usuario autenticado ---
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
          take: 5, // Solo los 5 últimos para no saturar la vista
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
    console.error("Error obteniendo mailboxes:", error);
    return { success: false, error: error.message };
  }
}

// --- 4. Obtener los mensajes de un correo específico ---
export async function getMailboxMessages(mailboxId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    // Verificar que el mailbox pertenezca al usuario (seguridad)
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
    console.error("Error obteniendo mensajes:", error);
    return { success: false, error: error.message };
  }
}

// actions/mailbox.actions.ts

// --- Sincronizar un mailbox específico (descargar mensajes de mail.tm) ---

// actions/mailbox.actions.ts

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

    // Obtener la lista de mensajes (resumen)
    const listResponse = await fetch("https://api.mail.tm/messages", {
      headers: {
        Authorization: `Bearer ${mailbox.apiToken}`,
      },
    });

    if (!listResponse.ok) {
      throw new Error(`Error al obtener mensajes: ${listResponse.statusText}`);
    }

    const data = await listResponse.json();
    const messages = data["hydra:member"] || [];

    let savedCount = 0;

    for (const msgSummary of messages) {
      const existing = await prisma.message.findUnique({
        where: { messageId: msgSummary.id },
      });

      if (!existing) {
        // Obtener el detalle completo del mensaje
        const detailResponse = await fetch(
          `https://api.mail.tm/messages/${msgSummary.id}`,
          {
            headers: {
              Authorization: `Bearer ${mailbox.apiToken}`,
            },
          },
        );

        if (!detailResponse.ok) {
          console.error(
            `Error al obtener detalle del mensaje ${msgSummary.id}:`,
            detailResponse.statusText,
          );
          // Guardar al menos el resumen (sin detalle completo)
          await prisma.message.create({
            data: {
              mailboxId: mailbox.id,
              messageId: msgSummary.id,
              from: msgSummary.from?.address || "Desconocido",
              subject: msgSummary.subject || "Sin asunto",
              bodyText: msgSummary.text || msgSummary.intro || "",
              bodyHtml:
                typeof msgSummary.html === "string" ? msgSummary.html : null,
              hasAttachments: !!(
                msgSummary.attachments && msgSummary.attachments.length > 0
              ),
              receivedAt: new Date(msgSummary.createdAt),
            },
          });

          savedCount++;
          continue;
        }

        const msgDetail = await detailResponse.json();

        // 🔥 1. Asegurar que bodyHtml sea string o null (no array)
        let htmlContent: string | null = null;
        if (msgDetail.html) {
          if (Array.isArray(msgDetail.html)) {
            // Si es array, unirlo en un solo string
            htmlContent = msgDetail.html.join("");
          } else if (typeof msgDetail.html === "string") {
            htmlContent = msgDetail.html;
          }
        }

        // 🔥 2. Determinar si tiene adjuntos correctamente
        const hasAttachments = !!(
          msgDetail.attachments && msgDetail.attachments.length > 0
        );

        // Guardar el mensaje completo
        await prisma.message.create({
          data: {
            mailboxId: mailbox.id,
            messageId: msgDetail.id,
            from: msgDetail.from?.address || "Desconocido",
            subject: msgDetail.subject || "Sin asunto",
            bodyText: msgDetail.text || msgDetail.intro || "",
            bodyHtml: htmlContent,
            hasAttachments: hasAttachments,
            receivedAt: new Date(msgDetail.createdAt),
          },
        });

        // 🔔 ENVIAR NOTIFICACIÓN
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const notificationMessage = `
          📨 <b>Nuevo correo recibido</b>
          📌 <b>De:</b> ${msgDetail.from?.address || "Desconocido"}
          📎 <b>Asunto:</b> ${msgDetail.subject || "Sin asunto"}
          📝 <b>Resumen:</b> ${(msgDetail.text || msgDetail.intro || "").substring(0, 150)}${(msgDetail.text || "").length > 150 ? "..." : ""}
          🔗 <a href="${appUrl}/dashboard/${mailboxId}">Ver en la aplicación</a>
          `;
        await sendTelegramNotification(notificationMessage);
        savedCount++;
      }
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${mailboxId}`);

    return {
      success: true,
      saved: savedCount,
      total: messages.length,
      mailbox: mailbox.emailAddress,
    };
  } catch (error: any) {
    console.error("Error sincronizando mailbox:", error);
    return { success: false, error: error.message };
  }
}

// --- Sincronizar TODOS los mailboxes del usuario autenticado ---
export async function syncAllMailboxes() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    // Obtener todos los mailboxes activos del usuario
    const mailboxes = await prisma.mailbox.findMany({
      where: {
        userId: user.id,
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

    // Sincronizar cada mailbox en paralelo (para ser más rápido)
    const results = await Promise.all(
      mailboxes.map(async (mb) => {
        const result = await syncMailbox(mb.id);
        return {
          email: mb.emailAddress,
          ...result,
        };
      }),
    );

    const totalSaved = results.reduce((sum, r) => sum + (r.saved || 0), 0);
    const totalErrors = results.filter((r) => !r.success).length;

    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Sincronización completada. ${totalSaved} mensajes nuevos guardados.`,
      details: results,
      errors: totalErrors,
    };
  } catch (error: any) {
    console.error("Error sincronizando todos los mailboxes:", error);
    return { success: false, error: error.message };
  }
}

//descargar
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

    // Obtener detalles del mensaje desde mail.tm
    const detailResponse = await fetch(
      `https://api.mail.tm/messages/${message.messageId}`,
      {
        headers: {
          Authorization: `Bearer ${mailbox.apiToken}`,
        },
      },
    );

    if (!detailResponse.ok) {
      return new Response("Error al obtener detalles del mensaje", {
        status: 500,
      });
    }

    const msgDetail = await detailResponse.json();
    const attachments = msgDetail.attachments || [];

    if (attachments.length === 0) {
      return new Response("Este mensaje no tiene adjuntos", { status: 404 });
    }

    const attachment = attachments[0];

    // 🔥 CORRECCIÓN: Construir URL absoluta si es relativa
    const baseUrl = "https://api.mail.tm";
    const fileUrl = attachment.downloadUrl.startsWith("http")
      ? attachment.downloadUrl
      : `${baseUrl}${attachment.downloadUrl}`;

    const fileResponse = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${mailbox.apiToken}`,
      },
    });

    if (!fileResponse.ok) {
      return new Response("Error al descargar el archivo", { status: 500 });
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const fileName = attachment.filename || "adjunto.pdf";

    return new Response(fileBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": attachment.contentType || "application/octet-stream",
      },
    });
  } catch (error: any) {
    console.error("Error descargando adjunto:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// actions/mailbox.actions.ts

// --- Eliminar un buzón completo ---
export async function deleteMailbox(mailboxId: string) {
  try {
    // 1. Verificar autenticación
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    // 2. Verificar que el mailbox pertenezca al usuario
    const mailbox = await prisma.mailbox.findFirst({
      where: {
        id: mailboxId,
        userId: user.id,
      },
    });

    if (!mailbox) {
      return { success: false, error: "Correo no encontrado o no autorizado" };
    }

    // 3. (Opcional) Intentar eliminar la cuenta en mail.tm
    try {
      // Obtener el ID de la cuenta desde el endpoint /me
      const meResponse = await fetch("https://api.mail.tm/me", {
        headers: {
          Authorization: `Bearer ${mailbox.apiToken}`,
        },
      });

      if (meResponse.ok) {
        const meData = await meResponse.json();
        const accountId = meData.id;

        if (accountId) {
          // Eliminar la cuenta en mail.tm
          await fetch(`https://api.mail.tm/accounts/${accountId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${mailbox.apiToken}`,
            },
          });
        }
      }
    } catch (mailTmError) {
      // Si falla la eliminación en mail.tm, solo lo registramos
      // y continuamos con la eliminación local (el correo temporal caducará solo)
      console.error(
        "Error eliminando de mail.tm (continuando localmente):",
        mailTmError,
      );
    }

    // 4. Eliminar de la base de datos local (Prisma eliminará los mensajes en cascada)
    await prisma.mailbox.delete({
      where: { id: mailboxId },
    });

    // 5. Revalidar rutas para actualizar la UI
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${mailboxId}`);

    return { success: true, message: "Buzón eliminado correctamente" };
  } catch (error: any) {
    console.error("Error eliminando buzón:", error);
    return { success: false, error: error.message };
  }
}
