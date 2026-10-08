"use client";

import { loginUser } from "@/actions/auth.actions";
import { useState } from "react";
import Link from "next/link";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-purple-600 focus:outline-none focus:ring-4 focus:ring-purple-600/15";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setPending(true);
    try {
      const result = await loginUser(formData);
      if (result?.error) {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_28rem] xl:grid-cols-[minmax(0,1fr)_32rem]">
      <section
        aria-label="Boreal"
        className="relative flex min-h-[30vh] items-center justify-center overflow-hidden bg-[#0b0618] lg:min-h-screen"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,#2e1065_0%,#0b0618_60%)]" />
        <div className="star-field" aria-hidden="true" />
        <div aria-hidden="true">
          <div className="aurora-band aurora-a left-[-10%] top-[18%] h-40 w-[80%] bg-purple-600/50" />
          <div className="aurora-band aurora-b right-[-12%] top-[34%] h-44 w-[75%] bg-fuchsia-500/30" />
          <div className="aurora-band aurora-c left-[8%] top-[52%] h-32 w-[70%] bg-violet-400/30" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0b0618] to-transparent" />

        <div className="rise-in relative flex flex-col items-center px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-white shadow-2xl shadow-purple-900/50 backdrop-blur-md sm:h-24 sm:w-24">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 40 }}
              aria-hidden="true"
            >
              mark_email_unread
            </span>
          </span>
          <p className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-7xl">
            Boreal
          </p>
          <p className="mt-3 hidden text-sm uppercase tracking-[0.3em] text-purple-200/70 sm:block">
            Tu gestor de confianza
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#f5f6f7] px-6 py-12 sm:px-10">
        <div className="rise-in w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-purple-700"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              aria-hidden="true"
            >
              arrow_back
            </span>
            Volver
          </Link>

          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Acceso
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Ingresa tus credenciales para administrar tus buzones.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form action={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Correo electrónico
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autoComplete="email"
                className={inputClass}
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autoComplete="current-password"
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-purple-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm shadow-purple-900/20 transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {/* <p className="mt-6 text-center text-sm text-slate-600">
            ¿No tienes cuenta?{" "}
            <Link
              href="/register"
              className="font-medium text-purple-700 hover:underline"
            >
              Regístrate
            </Link>
          </p> */}
        </div>
      </section>
    </main>
  );
}
