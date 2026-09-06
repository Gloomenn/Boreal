// lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Verificar que la URL de la base de datos esté configurada
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL no está configurada en las variables de entorno",
  );
}

// Crear el adaptador para PostgreSQL
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// Singleton para evitar múltiples conexiones en desarrollo
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
