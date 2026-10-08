"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createTemporaryMailbox,
  getMyMailboxes,
  syncAllMailboxes,
  deleteMailbox,
} from "@/actions/mailbox.actions";
import { logoutAction } from "@/actions/auth.actions";

interface Message {
  id: string;
  subject: string | null;
  from: string;
  receivedAt: Date;
  bodyText: string | null;
}

interface Mailbox {
  id: string;
  emailAddress: string;
  aliasName: string | null;
  status: string;
  createdAt: Date;
  messages: Message[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [aliasName, setAliasName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMailboxes = useCallback(async () => {
    const result = await getMyMailboxes();
    if (!result.success) {
      throw new Error(result.error || "Error al cargar los correos");
    }
    return result.data || [];
  }, []);

  const loadMailboxes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setMailboxes(await fetchMailboxes());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Error inesperado al cargar los datos",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchMailboxes]);

  useEffect(() => {
    let cancelled = false;
    void fetchMailboxes()
      .then((data) => {
        if (!cancelled) setMailboxes(data);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Error inesperado al cargar los datos",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchMailboxes]);

  const handleCopyEmail = async (mailboxId: string, email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedId(mailboxId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("No se pudo copiar el correo al portapapeles");
    }
  };

  const handleCreateMailbox = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!aliasName.trim()) {
      setError("Por favor, escribe un nombre para el trámite");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccessMessage(null);
      const result = await createTemporaryMailbox(aliasName.trim());
      if (result.success && result.mailbox) {
        setSuccessMessage(`Correo creado: ${result.mailbox.emailAddress}`);
        setAliasName("");
        await loadMailboxes();
      } else {
        setError(result.error || "Error al crear el correo");
      }
    } catch {
      setError("Error inesperado al crear el correo");
    } finally {
      setCreating(false);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      setError(null);
      const result = await syncAllMailboxes();
      if (result.success) {
        setSyncMessage(result.message || "Sincronización completada");
        await loadMailboxes();
      } else {
        setError(result.error || "Error al sincronizar");
      }
    } catch {
      setError("Error inesperado al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteMailbox = async (
    mailboxId: string,
    mailboxAlias: string | null,
  ) => {
    if (
      !confirm(
        `¿Estás seguro de que quieres eliminar el buzón "${mailboxAlias || "Sin nombre"}"?`,
      )
    ) {
      return;
    }
    try {
      setDeletingId(mailboxId);
      setError(null);
      setSuccessMessage(null);
      const result = await deleteMailbox(mailboxId);
      if (result.success) {
        setSuccessMessage(result.message || "Buzón eliminado");
        await loadMailboxes();
      } else {
        setError(result.error || "Error al eliminar el buzón");
      }
    } catch {
      setError("Error inesperado al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    await logoutAction();
  };

  return (
    <div className="min-h-screen bg-[#f5f6f7] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            aria-label="Boreal, inicio del dashboard"
            className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-700 text-white">
              <span className="material-symbols-outlined" aria-hidden="true">
                mark_email_unread
              </span>
            </span>
            <span className="text-xl font-semibold tracking-tight text-purple-700">
              Boreal
            </span>
          </Link>

          <nav
            aria-label="Navegación principal"
            className="flex items-center gap-2 sm:gap-3"
          >
            <div className="group relative">
              <button
                type="button"
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
              >
                <span
                  className="material-symbols-outlined text-[19px]"
                  aria-hidden="true"
                >
                  grid_view
                </span>
                <span className="hidden sm:inline">Herramientas</span>
                <span
                  className="material-symbols-outlined text-base"
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>
              <div
                role="menu"
                aria-label="Herramientas"
                className="invisible absolute right-0 top-full z-20 w-56 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              >
                <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10">
                  <Link
                    href="/dashboard/herramientas/calculador-de-corte"
                    role="menuitem"
                    className="block rounded-lg px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    Calculador de corte
                  </Link>
                  <Link
                    href="/dashboard/herramientas/calculador-de-rfc"
                    role="menuitem"
                    className="block rounded-lg px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    Calculador de RFC
                  </Link>
                  <Link
                    href="https://generador-csfconidcif.onrender.com/"
                    role="menuitem"
                    target="_blank"
                    className="block rounded-lg px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    RFC+IDCIF
                    <span className="text-xs text-slate-500">
                      {" "}
                      (link externo)
                    </span>
                  </Link>
                </div>
              </div>
            </div>
            <span className="h-6 w-px bg-slate-200" aria-hidden="true" />
            <button
              onClick={handleLogout}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            >
              Cerrar sesión
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div className="mb-9">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Espacio de trabajo
          </p>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.15rem]">
                Tus correos temporales
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Crea y organiza buzones para mantener cada trámite en su lugar.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-600 shadow-sm">
              <span
                className="h-2 w-2 rounded-full bg-purple-600"
                aria-hidden="true"
              />
              {mailboxes.length} {mailboxes.length === 1 ? "buzón" : "buzones"}
            </div>
          </div>
        </div>

        {(successMessage || error || syncMessage) && (
          <div className="mb-6 space-y-3" aria-live="polite">
            {successMessage && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
                <span
                  className="material-symbols-outlined text-[20px]"
                  aria-hidden="true"
                >
                  check_circle
                </span>
                <p>{successMessage}</p>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-900"
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  aria-hidden="true"
                >
                  error
                </span>
                <p>{error}</p>
              </div>
            )}
            {syncMessage && (
              <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3.5 text-sm text-sky-900">
                <span
                  className="material-symbols-outlined text-[20px]"
                  aria-hidden="true"
                >
                  sync
                </span>
                <p>{syncMessage}</p>
              </div>
            )}
          </div>
        )}

        <section
          aria-labelledby="create-mailbox-heading"
          className="mb-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.025] sm:p-7"
        >
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <span className="material-symbols-outlined" aria-hidden="true">
                add
              </span>
            </span>
            <div>
              <h2
                id="create-mailbox-heading"
                className="text-base font-semibold text-slate-900"
              >
                Crear correo temporal
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Asigna una etiqueta para identificar fácilmente el trámite.
              </p>
            </div>
          </div>
          <form
            onSubmit={handleCreateMailbox}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="mailbox-alias" className="sr-only">
              Etiqueta del trámite
            </label>
            <input
              id="mailbox-alias"
              type="text"
              value={aliasName}
              onChange={(event) => setAliasName(event.target.value)}
              placeholder="Por ejemplo: CURP, RFC o trámite de licencia"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-purple-600 focus:ring-4 focus:ring-purple-600/10 disabled:bg-slate-50"
              disabled={creating}
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className="material-symbols-outlined text-[19px]"
                aria-hidden="true"
              >
                {creating ? "progress_activity" : "add"}
              </span>
              {creating ? "Creando correo..." : "Crear correo"}
            </button>
          </form>
        </section>

        <section aria-labelledby="mailboxes-heading">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2
                id="mailboxes-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Mis buzones
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {mailboxes.length}
                </span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Accede a los mensajes y administra cada dirección.
              </p>
            </div>
            <button
              onClick={handleSyncAll}
              disabled={syncing || loading || mailboxes.length === 0}
              className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/10 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${syncing ? "animate-spin" : ""}`}
                aria-hidden="true"
              >
                sync
              </span>
              {syncing ? "Comprobando..." : "Comprobar nuevos correos"}
            </button>
          </div>

          {loading ? (
            <div className="space-y-3" aria-label="Cargando buzones">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 rounded bg-slate-100" />
                      <div className="h-3 w-56 max-w-full rounded bg-slate-100" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : mailboxes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <span
                  className="material-symbols-outlined text-[25px]"
                  aria-hidden="true"
                >
                  mark_email_unread
                </span>
              </span>
              <h3 className="text-base font-semibold text-slate-900">
                Todavía no tienes buzones
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Crea tu primer correo temporal desde el formulario para empezar
                a recibir mensajes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mailboxes.map((mailbox) => (
                <article
                  key={mailbox.id}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.025] transition hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/[0.04] sm:p-6"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                        <span
                          className="material-symbols-outlined"
                          aria-hidden="true"
                        >
                          alternate_email
                        </span>
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <h3 className="truncate text-base font-semibold text-slate-900">
                          {mailbox.aliasName || "Sin nombre"}
                        </h3>
                        <div className="mt-1.5 flex min-w-0 items-center gap-2">
                          <p className="truncate font-mono text-sm text-slate-600">
                            {mailbox.emailAddress}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyEmail(mailbox.id, mailbox.emailAddress)
                            }
                            aria-label={
                              copiedId === mailbox.id
                                ? "Correo copiado"
                                : `Copiar ${mailbox.emailAddress}`
                            }
                            title={
                              copiedId === mailbox.id
                                ? "Copiado"
                                : "Copiar correo"
                            }
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-purple-50 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                          >
                            <span
                              className="material-symbols-outlined text-[17px]"
                              aria-hidden="true"
                            >
                              {copiedId === mailbox.id
                                ? "check"
                                : "content_copy"}
                            </span>
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          Creado el{" "}
                          {new Date(mailbox.createdAt).toLocaleDateString(
                            "es-MX",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            },
                          )}
                          {mailbox.messages.length > 0 && (
                            <span>
                              {" "}
                              <span aria-hidden="true">·</span> Último mensaje{" "}
                              {new Date(
                                mailbox.messages[0].receivedAt,
                              ).toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 pt-4 sm:border-0 sm:pt-0">
                      <button
                        onClick={() => router.push(`/dashboard/${mailbox.id}`)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/20 sm:flex-none"
                      >
                        Ver mensajes
                        <span
                          className="material-symbols-outlined text-[18px]"
                          aria-hidden="true"
                        >
                          arrow_forward
                        </span>
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteMailbox(mailbox.id, mailbox.aliasName)
                        }
                        disabled={deletingId === mailbox.id}
                        aria-label={`Eliminar buzón ${mailbox.aliasName || mailbox.emailAddress}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span
                          className="material-symbols-outlined text-[19px]"
                          aria-hidden="true"
                        >
                          {deletingId === mailbox.id
                            ? "progress_activity"
                            : "delete"}
                        </span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
