// app/dashboard/[mailboxId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMailboxMessages, syncMailbox } from "@/actions/mailbox.actions";

interface Message {
  id: string;
  messageId: string;
  from: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: Date;
  hasAttachments: boolean;
}

export default function MailboxDetailPage() {
  const params = useParams();
  const router = useRouter();
  const mailboxId = params.mailboxId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Cargar mensajes al montar la página
  useEffect(() => {
    if (mailboxId) {
      loadMessages();
    }
  }, [mailboxId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getMailboxMessages(mailboxId);
      if (result.success) {
        setMessages(result.data || []);
      } else {
        setError(result.error || "Error al cargar los mensajes");
      }
    } catch {
      setError("Error inesperado al cargar los mensajes");
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar SOLO este buzón (descargar mensajes nuevos)
  const handleSyncThisMailbox = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      setError(null);
      const result = await syncMailbox(mailboxId);
      if (result.success) {
        setSyncMessage(`✅ ${result.saved} mensaje(s) nuevo(s) guardado(s)`);
        await loadMessages(); // Recargar la lista
      } else {
        setError(result.error || "Error al sincronizar este buzón");
      }
    } catch {
      setError("Error inesperado al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Barra superior con botón de volver y sincronizar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            ← Volver al Dashboard
          </button>
          <button
            onClick={handleSyncThisMailbox}
            disabled={syncing}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {syncing ? (
              <>
                <span className="animate-spin">⏳</span> Sincronizando...
              </>
            ) : (
              "🔄 Refrescar este buzón"
            )}
          </button>
        </div>

        {/* Mensajes de estado */}
        {syncMessage && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded-lg border border-blue-300">
            {syncMessage}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg border border-red-300">
            ❌ {error}
          </div>
        )}

        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          📨 Mensajes recibidos
          <span className="text-sm font-normal text-gray-400">
            ({messages.length} mensaje{messages.length !== 1 ? "s" : ""})
          </span>
        </h1>

        {/* Contenido: loading, vacío o lista de mensajes */}
        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-500">Cargando mensajes...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
            <p className="text-lg">📭 No hay mensajes en este buzón.</p>
            <p className="text-sm mt-2">
              Envía un correo a esta dirección o haz clic en "Refrescar este buzón".
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="bg-white rounded-lg shadow-md p-6 border border-gray-100 hover:shadow-lg transition"
              >
                {/* Cabecera del mensaje */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-lg">
                      {msg.subject || "Sin asunto"}
                    </h3>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">De:</span> {msg.from}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {formatDate(msg.receivedAt)}
                    </span>
                    {msg.hasAttachments && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                        📎 Adjunto
                      </span>
                    )}
                  </div>
                </div>

                {/* Cuerpo del mensaje */}
                <div className="mt-3 p-4 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700 max-h-96 overflow-y-auto">
                  {msg.bodyText ? (
                    <div className="whitespace-pre-wrap">{msg.bodyText}</div>
                  ) : msg.bodyHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: msg.bodyHtml }} />
                  ) : (
                    <span className="text-gray-400">(Sin contenido visible)</span>
                  )}
                </div>

                {/* TODO: Aquí añadiremos la descarga de adjuntos en el siguiente paso */}
                {msg.hasAttachments && (
                  <div className="mt-3 text-sm text-gray-500 border-t border-gray-100 pt-3">
                    📎 Este mensaje tiene archivos adjuntos (próximamente: descarga).
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}