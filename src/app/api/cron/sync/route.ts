// app/api/cron/sync/route.ts
import { NextRequest } from "next/server";
import { syncAllMailboxes } from "@/actions/mailbox.actions";

// 🔐 Clave secreta para proteger el endpoint (ponla en .env.local)
const CRON_SECRET =
  process.env.CRON_SECRET ||
  "72c228084bdead2e67c891fd1f9cb33e968c2324d7a7f08249b6179506abb1576cbd0064676c50378bc7aa3c477e2fa3e2395b5b15f92714f934c12b81d04215";

export async function GET(request: NextRequest) {
  // 1. Verificar que la petición venga con la clave secreta
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  try {
    // 2. Ejecutar la sincronización de todos los buzones
    const result = await syncAllMailboxes();

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: result.message,
          details: result.details,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch (error: any) {
    console.error("Error en cron sync:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
