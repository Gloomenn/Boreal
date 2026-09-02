// app/api/download/[mailboxId]/[messageId]/route.ts
import { NextRequest } from "next/server";
import { downloadAttachment } from "@/actions/mailbox.actions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mailboxId: string; messageId: string }> }
) {
  try {
    const { mailboxId, messageId } = await params;
    const response = await downloadAttachment(messageId, mailboxId);
    
    // Si la respuesta es un Response con error, lo devolvemos tal cual
    if (response instanceof Response) {
      return response;
    }
    
    // Si no, devolvemos un error genérico
    return new Response("Error al descargar el archivo", { status: 500 });
  } catch (error: any) {
    console.error("Error en API download:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}