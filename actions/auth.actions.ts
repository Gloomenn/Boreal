// actions/auth.actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const JWT_SECRET = process.env.JWT_SECRET || "Z9w9XjrJbLomSAGeCoisnp2AlaxZHEUPp5kSTFhHUyY=";

// --- Crear sesión (token JWT en cookie HTTP-Only) ---
export async function createSession(userId: string, email: string) {
  const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "7d" });
  
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 días
    path: "/",
  });
}

// --- Obtener el usuario actual desde la cookie ---
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, createdAt: true },
    });
    return user;
  } catch (error) {
    return null;
  }
}

// --- Cerrar sesión ---
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/login");
}

// --- Registro ---
export async function registerUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!email || !password) {
    return { error: "Todos los campos son obligatorios" };
  }
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres" };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden" };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "Este email ya está registrado" };
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  await createSession(user.id, user.email);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// --- Login ---
export async function loginUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return { error: "Credenciales incorrectas" };
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return { error: "Credenciales incorrectas" };
  }

  await createSession(user.id, user.email);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}