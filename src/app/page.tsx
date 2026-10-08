import Link from "next/link";

export default function Home() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_28rem] xl:grid-cols-[minmax(0,1fr)_32rem]">
      <section
        aria-label="Boreal"
        className="relative flex min-h-[44vh] items-center justify-center overflow-hidden bg-[#0b0618] lg:min-h-screen"
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
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-white shadow-2xl shadow-purple-900/50 backdrop-blur-md sm:h-24 sm:w-24">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 48 }}
              aria-hidden="true"
            >
              mark_email_unread
            </span>
          </span>
          <p className="mt-6 text-5xl font-semibold tracking-tight text-white sm:text-7xl">
            Boreal
          </p>
          <p className="mt-3 text-sm uppercase tracking-[0.3em] text-purple-200/70">
            Tu gestor de confianza
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#f5f6f7] px-6 py-14 sm:px-10">
        <div className="rise-in w-full max-w-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Inicio
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Bienvenido a <span className="text-purple-700">Boreal</span>
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Administra tus correos temporales de forma fácil y rápida.
          </p>
          <div className="mt-8 space-y-3">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm shadow-purple-900/20 transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/25"
            >
              Iniciar sesión
              <span
                className="material-symbols-outlined text-[18px]"
                aria-hidden="true"
              >
                arrow_forward
              </span>
            </Link>
            {/* <Link
              href="/register"
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-purple-300 hover:text-purple-700"
            >
              Registrarse
            </Link> */}
          </div>
        </div>
      </section>
    </main>
  );
}
