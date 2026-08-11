// lib/auth.ts
import bcrypt from "bcryptjs";

// Hashear contraseña
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

// Verificar contraseña
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}