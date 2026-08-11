// actions/mailbox.actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/actions/auth.actions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
      throw new Error(`mail.tm error: ${errorData.detail || "Error desconocido"}`);
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