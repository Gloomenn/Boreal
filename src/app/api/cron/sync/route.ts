// app/api/cron/sync/route.ts
import { NextRequest } from "next/server";
import { syncAllMailboxesInternal } from "@/actions/mailbox.actions";

export async function GET(request: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) {
    console.error("🔒 [CRON] CRON_SECRET no está configurado en el entorno");
    return new Response("Configuración inválida", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");

  // Verificar el header Authorization
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn("🔒 [CRON] No autorizado");
    return new Response("No autorizado", { status: 401 });
  }

  try {
    console.log("🔄 [CRON] Ejecutando sincronización...");
    // Usamos la versión "Internal": no depende de la cookie de sesión del usuario,
    // ya que esta ruta la invoca Vercel Cron sin contexto de navegador.
    const result = await syncAllMailboxesInternal();

    if (result.success) {
      console.log("✅ [CRON] Sincronización completada:", result.message);
      return new Response(
        JSON.stringify({
          success: true,
          message: result.message,
          details: result.details,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } else {
      console.error("❌ [CRON] Error en sincronización:", result.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch (error: any) {
    console.error("❌ [CRON] Error en cron sync:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
