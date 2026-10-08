"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { logoutAction } from "@/actions/auth.actions";
import { calculateRfc } from "@/lib/rfc";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-purple-600 focus:ring-4 focus:ring-purple-600/10";

export default function RfcCalculatorPage() {
  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const rfc = useMemo(
    () =>
      calculateRfc({
        nombres,
        apellidoPaterno,
        apellidoMaterno,
        fechaNacimiento,
      }),
    [nombres, apellidoPaterno, apellidoMaterno, fechaNacimiento],
  );

  const copyRfc = async () => {
    if (!rfc) return;
    try {
      await navigator.clipboard.writeText(rfc);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
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
            aria-label="Navegación de usuario"
            className="flex items-center gap-2 sm:gap-3"
          >
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
            >
              <span
                className="material-symbols-outlined text-[18px]"
                aria-hidden="true"
              >
                arrow_back
              </span>
              <span className="hidden sm:inline">Volver al dashboard</span>
              <span className="sm:hidden">Volver</span>
            </Link>
            <span className="h-6 w-px bg-slate-200" aria-hidden="true" />
            <button
              type="button"
              onClick={logoutAction}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            >
              Cerrar sesión
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Herramientas
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.15rem]">
            Calculador de RFC
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Calcula una propuesta de RFC para persona física con nombre y fecha
            de nacimiento.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section
            aria-labelledby="personal-data-heading"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]"
          >
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    person
                  </span>
                </span>
                <div>
                  <h2
                    id="personal-data-heading"
                    className="text-base font-semibold text-slate-900"
                  >
                    Datos personales
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Completa la información para generar el cálculo.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
                <label
                  htmlFor="nombres"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Nombre(s)
                </label>
                <input
                  id="nombres"
                  type="text"
                  value={nombres}
                  onChange={(event) => setNombres(event.target.value)}
                  placeholder="Ej. María Fernanda"
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="paterno"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Apellido paterno
                </label>
                <input
                  id="paterno"
                  type="text"
                  value={apellidoPaterno}
                  onChange={(event) => setApellidoPaterno(event.target.value)}
                  placeholder="Apellido paterno"
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="materno"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Apellido materno
                </label>
                <input
                  id="materno"
                  type="text"
                  value={apellidoMaterno}
                  onChange={(event) => setApellidoMaterno(event.target.value)}
                  placeholder="Apellido materno"
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="fecha"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Fecha de nacimiento
                </label>
                <input
                  id="fecha"
                  type="date"
                  value={fechaNacimiento}
                  onChange={(event) => setFechaNacimiento(event.target.value)}
                  className={`${inputClass} [color-scheme:light]`}
                />
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.025] lg:sticky lg:top-24 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <span className="material-symbols-outlined" aria-hidden="true">
                  badge
                </span>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  RFC calculado
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Resultado preliminar
                </p>
              </div>
            </div>

            <div
              className="flex min-h-20 items-center justify-center rounded-xl border border-purple-100 bg-purple-50/70 px-3 py-5"
              aria-live="polite"
            >
              <output
                aria-label="RFC calculado"
                className="break-all text-center font-mono text-2xl font-semibold tracking-[0.14em] text-purple-800 sm:text-[1.7rem]"
              >
                {rfc ?? "—"}
              </output>
            </div>

            <button
              type="button"
              onClick={copyRfc}
              disabled={!rfc}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                className="material-symbols-outlined text-[18px]"
                aria-hidden="true"
              >
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copiado al portapapeles" : "Copiar RFC"}
            </button>

            {copyError && (
              <p role="alert" className="mt-2 text-sm text-rose-700">
                No se pudo copiar el RFC. Puedes seleccionarlo y copiarlo
                manualmente.
              </p>
            )}

            <div className="mt-5 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <span
                className="material-symbols-outlined mt-0.5 shrink-0 text-[18px] text-amber-700"
                aria-hidden="true"
              >
                info
              </span>
              <p className="text-xs leading-5 text-amber-900">
                La homoclave y el dígito verificador se estiman con un algoritmo
                público. Verifica el resultado en el portal oficial del SAT
                antes de usarlo en un trámite.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
