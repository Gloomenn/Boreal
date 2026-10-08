"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { logoutAction } from "@/actions/auth.actions";
import { calculateRfc } from "@/lib/rfc";

const inputClass =
  "w-full rounded-md border border-stone-700 bg-black px-3 py-2 text-white outline-none transition placeholder:text-neutral-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500";

export default function RfcCalculatorPage() {
  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [copied, setCopied] = useState(false);

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
    await navigator.clipboard.writeText(rfc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 bg-stone-950 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="text-3xl font-sans font-bold text-purple-600"
          >
            Boreal
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-white border border-purple-600 rounded-md transition hover:bg-purple-900"
            >
              Volver al dashboard
            </Link>
            <button
              type="button"
              onClick={logoutAction}
              className="px-4 py-2 text-sm font-medium text-white border border-red-600 rounded-md transition hover:bg-red-900"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-purple-400">Herramientas</p>
          <h1 className="mt-1 text-3xl font-bold text-white">
            Calculador de RFC
          </h1>
          <p className="mt-2 text-neutral-400">
            Persona física: ingresa los datos para calcular el RFC de 13
            caracteres.
          </p>
        </div>

        <section className="grid gap-5 rounded-lg border border-stone-800 bg-stone-950 p-6 shadow-md sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="nombres"
              className="mb-1 block text-sm font-medium text-neutral-100"
            >
              Nombre(s)
            </label>
            <input
              id="nombres"
              type="text"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              placeholder="Ej: María Fernanda"
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="paterno"
              className="mb-1 block text-sm font-medium text-neutral-100"
            >
              Apellido paterno
            </label>
            <input
              id="paterno"
              type="text"
              value={apellidoPaterno}
              onChange={(e) => setApellidoPaterno(e.target.value)}
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="materno"
              className="mb-1 block text-sm font-medium text-neutral-100"
            >
              Apellido materno
            </label>
            <input
              id="materno"
              type="text"
              value={apellidoMaterno}
              onChange={(e) => setApellidoMaterno(e.target.value)}
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="fecha"
              className="mb-1 block text-sm font-medium text-neutral-100"
            >
              Fecha de nacimiento
            </label>
            <input
              id="fecha"
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-stone-800 bg-stone-950 p-6 shadow-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-neutral-400">
                RFC calculado
              </h2>
              <output className="mt-1 block font-mono text-3xl font-bold tracking-widest text-purple-400">
                {rfc ?? "—"}
              </output>
            </div>
            <button
              type="button"
              onClick={copyRfc}
              disabled={!rfc}
              className="rounded-md border border-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? "¡Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            La homoclave y el dígito verificador se calculan con el algoritmo
            público del SAT; verifica el resultado en el portal oficial antes
            de usarlo en un trámite.
          </p>
        </section>
      </main>
    </div>
  );
}
