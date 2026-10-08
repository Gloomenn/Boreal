// app/dashboard/[mailboxId]/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMailboxMessages,
  syncMailbox,
  deleteMailbox,
} from "@/actions/mailbox.actions";

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

interface MailboxInfo {
  aliasName: string | null;
  emailAddress: string;
}

export default function MailboxDetailPage() {
  const params = useParams();
  const router = useRouter();
  const mailboxId = params.mailboxId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [mailbox, setMailbox] = useState<MailboxInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMailboxData = useCallback(async () => {
    const result = await getMailboxMessages(mailboxId);
    if (!result.success) {
      throw new Error(result.error || "Error al cargar los mensajes");
    }
    if (!result.data) {
      throw new Error("No se pudieron cargar los datos del buzón");
    }
    return result.data;
  }, [mailboxId]);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setMailbox(null);
      setMessages([]);
      const data = await fetchMailboxData();
      setMailbox(data.mailbox);
      setMessages(data.messages);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Error inesperado al cargar los mensajes",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchMailboxData]);

  useEffect(() => {
    let cancelled = false;
    if (mailboxId) {
      void fetchMailboxData()
        .then((data) => {
          if (!cancelled) {
            setMailbox(data.mailbox);
            setMessages(data.messages);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Error inesperado al cargar los mensajes",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [fetchMailboxData, mailboxId]);

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

  const handleDeleteThisMailbox = async () => {
    if (
      !confirm(
        `¿Estás seguro de que quieres eliminar este buzón y todos sus mensajes?`,
      )
    ) {
      return;
    }
    try {
      setDeleting(true);
      const result = await deleteMailbox(mailboxId);
      if (result.success) {
        router.push("/dashboard"); // Redirige al Dashboard
      } else {
        setError(result.error || "Error al eliminar");
      }
    } catch {
      setError("Error inesperado al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  // app/dashboard/[mailboxId]/page.tsx

  const handleDownload = async (messageId: string) => {
    try {
      const response = await fetch(`/api/download/${mailboxId}/${messageId}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Error al descargar");
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      let fileName = "adjunto.pdf";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) fileName = match[1];
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (downloadError: unknown) {
      const message =
        downloadError instanceof Error
          ? downloadError.message
          : "Error desconocido";
      setError("Error al descargar el archivo: " + message);
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
    <div className="min-h-screen bg-[#f5f6f7] px-4 py-6 text-slate-900 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              arrow_back
            </span>
            Volver a mis buzones
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncThisMailbox}
              disabled={syncing || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-purple-300 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${syncing ? "animate-spin" : ""}`}
                aria-hidden="true"
              >
                sync
              </span>
              <span className="hidden sm:inline">
                {syncing ? "Sincronizando..." : "Comprobar correo"}
              </span>
              <span className="sm:hidden">{syncing ? "Sincronizando..." : "Actualizar"}</span>
            </button>
            <button
              onClick={handleDeleteThisMailbox}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                delete
              </span>
              <span className="hidden sm:inline">
                {deleting ? "Eliminando..." : "Eliminar buzón"}
              </span>
            </button>
          </div>
        </div>

        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Bandeja de entrada
          </p>
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.15rem]">
                {mailbox?.aliasName || "Mensajes recibidos"}
              </h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Revisa los mensajes que llegaron a este correo temporal.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-purple-600" aria-hidden="true" />
              {messages.length} {messages.length === 1 ? "mensaje" : "mensajes"}
            </span>
          </div>
        </div>

        {(syncMessage || error) && (
          <div className="mb-6 space-y-3" aria-live="polite">
            {syncMessage && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  check_circle
                </span>
                <p>{syncMessage.replace(/^✅\s*/, "")}</p>
              </div>
            )}
            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-900">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  error
                </span>
                <p>{error}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="min-w-0">
            {loading ? (
              <div className="space-y-3" aria-label="Cargando mensajes">
                {[1, 2].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
                  >
                    <div className="mb-4 h-4 w-48 rounded bg-slate-100" />
                    <div className="mb-6 h-3 w-32 rounded bg-slate-100" />
                    <div className="space-y-2">
                      <div className="h-3 w-full rounded bg-slate-100" />
                      <div className="h-3 w-4/5 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                  <span className="material-symbols-outlined text-[25px]" aria-hidden="true">
                    drafts
                  </span>
                </span>
                <h2 className="text-base font-semibold text-slate-900">
                  Aún no hay mensajes
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Los mensajes que envíen a este correo aparecerán aquí. Puedes
                  comprobar si llegaron correos nuevos en cualquier momento.
                </p>
                <button
                  onClick={handleSyncThisMailbox}
                  disabled={syncing}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-purple-300 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${syncing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  >
                    sync
                  </span>
                  {syncing ? "Comprobando..." : "Comprobar correo"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <article
                    key={msg.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025] transition hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            mail
                          </span>
                        </span>
                        <div className="min-w-0">
                          <h2 className="break-words text-base font-semibold text-slate-900">
                            {msg.subject || "Sin asunto"}
                          </h2>
                          <p className="mt-1 break-all text-sm text-slate-500">
                            <span className="font-medium text-slate-700">De </span>
                            {msg.from}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
                        <time
                          dateTime={new Date(msg.receivedAt).toISOString()}
                          className="text-xs text-slate-500"
                        >
                          {formatDate(msg.receivedAt)}
                        </time>
                        {msg.hasAttachments && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-800">
                            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                              attach_file
                            </span>
                            Adjunto
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-5 py-5 sm:px-6">
                      {msg.bodyHtml ? (
                        <div>
                          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Contenido del mensaje
                          </p>
                          <div
                            className="prose prose-sm max-w-none overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 [&_img]:max-w-full"
                            dangerouslySetInnerHTML={{
                              __html: msg.bodyHtml.replace(
                                /<img[^>]+src="http:/g,
                                '<img src="http:',
                              ),
                            }}
                          />
                        </div>
                      ) : msg.bodyText ? (
                        <div>
                          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Texto del mensaje
                          </p>
                          <div className="max-h-96 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
                            {msg.bodyText}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm italic text-slate-400">
                          Este mensaje no tiene contenido visible.
                        </p>
                      )}

                    {msg.hasAttachments && (
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <button
                          onClick={() => handleDownload(msg.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/10"
                        >
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                            download
                          </span>
                          Descargar adjunto
                        </button>
                      </div>
                    )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.025] lg:sticky lg:top-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <span className="material-symbols-outlined" aria-hidden="true">
                  inbox
                </span>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Detalles del buzón
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Información de este trámite
                </p>
              </div>
            </div>
            <dl className="divide-y divide-slate-100">
              <div className="py-4 first:pt-0">
                <dt className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                  Etiqueta del trámite
                </dt>
                <dd className="break-words text-sm font-medium text-slate-900">
                  {mailbox
                    ? mailbox.aliasName || "Sin etiqueta"
                    : loading
                      ? "Cargando..."
                      : "No disponible"}
                </dd>
              </div>
              <div className="py-4 last:pb-0">
                <dt className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                  Correo temporal
                </dt>
                <dd className="break-all font-mono text-sm leading-6 text-purple-800">
                  {mailbox
                    ? mailbox.emailAddress
                    : loading
                      ? "Cargando..."
                      : "No disponible"}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </div>
  );
}
