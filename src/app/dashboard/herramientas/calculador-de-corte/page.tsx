"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { logoutAction } from "@/actions/auth.actions";

const procedures = [
  "RFC + IDCIF",
  "RFC con CURP",
  "Actas",
  "NSS",
  "CFE",
  "Citas SAT",
  "Trámite personalizado",
];

interface ProcedureValues {
  price: string;
  quantity: string;
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function parsePrice(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function parseQuantity(value: string) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
}

export default function CutCalculatorPage() {
  const [values, setValues] = useState<Record<string, ProcedureValues>>(() =>
    Object.fromEntries(
      procedures.map((procedure) => [
        procedure,
        { price: "", quantity: "" },
      ]),
    ),
  );

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const totals = useMemo(
    () =>
      procedures.map((procedure) => {
        const { price, quantity } = values[procedure];
        return {
          procedure,
          subtotal: parsePrice(price) * parseQuantity(quantity),
        };
      }),
    [values],
  );

  const total = totals.reduce((sum, item) => sum + item.subtotal, 0);
  const procedureCount = totals.filter((item) => item.subtotal > 0).length;

  const summary = useMemo(() => {
    const lines = procedures
      .filter((procedure) => parseQuantity(values[procedure].quantity) > 0)
      .map(
        (procedure) =>
          `${procedure}: ${parseQuantity(values[procedure].quantity)}`,
      );
    if (lines.length === 0) return "";
    const formattedTotal = Number.isInteger(total)
      ? `$${total}`
      : `$${total.toFixed(2)}`;
    return `${lines.join("\n")}\n\nTotal = ${formattedTotal}`;
  }, [values, total]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  const updateValue = (
    procedure: string,
    field: keyof ProcedureValues,
    value: string,
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      [procedure]: {
        ...currentValues[procedure],
        [field]: value,
      },
    }));
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
          <nav aria-label="Navegación de usuario" className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
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
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.15rem]">
                Calculador de corte
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Registra precios y cantidades para obtener el total y preparar
                un resumen para compartir.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-600 shadow-sm">
              <span className="material-symbols-outlined text-[17px] text-purple-700" aria-hidden="true">
                receipt_long
              </span>
              {procedureCount} {procedureCount === 1 ? "trámite" : "trámites"} con importe
            </div>
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section
            aria-labelledby="calculator-title"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]"
          >
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    calculate
                  </span>
                </span>
                <div>
                  <h2 id="calculator-title" className="text-base font-semibold text-slate-900">
                    Trámites del corte
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    El subtotal se calcula automáticamente.
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden grid-cols-[minmax(0,1fr)_8rem_8rem_8rem] gap-4 bg-slate-50/80 px-6 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-400 md:grid">
              <span>Trámite</span>
              <span>Precio</span>
              <span>Cantidad</span>
              <span className="text-right">Subtotal</span>
            </div>

            <div className="divide-y divide-slate-100">
              {totals.map(({ procedure, subtotal }, index) => (
                <div
                  key={procedure}
                  className="grid gap-3 px-5 py-4 transition hover:bg-slate-50/60 md:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem] md:items-center md:gap-4 md:px-6"
                >
                  <div className="flex items-center gap-3 md:min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <label
                      htmlFor={`${procedure}-price`}
                      className="font-medium text-slate-800"
                    >
                      {procedure}
                    </label>
                  </div>
                  <div>
                    <label
                      htmlFor={`${procedure}-price`}
                      className="mb-1 block text-xs font-medium text-slate-500 md:hidden"
                    >
                      Precio por trámite
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                        $
                      </span>
                      <input
                        id={`${procedure}-price`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={values[procedure].price}
                        onChange={(event) =>
                          updateValue(procedure, "price", event.target.value)
                        }
                        placeholder="0.00"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-7 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-purple-600 focus:ring-4 focus:ring-purple-600/10"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor={`${procedure}-quantity`}
                      className="mb-1 block text-xs font-medium text-slate-500 md:hidden"
                    >
                      Cantidad
                    </label>
                    <input
                      id={`${procedure}-quantity`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={values[procedure].quantity}
                      onChange={(event) =>
                        updateValue(procedure, "quantity", event.target.value)
                      }
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-purple-600 focus:ring-4 focus:ring-purple-600/10"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 md:justify-end md:border-0 md:pt-0">
                    <span className="text-xs font-medium text-slate-500 md:hidden">
                      Subtotal
                    </span>
                    <output className="text-sm font-semibold tabular-nums text-slate-800">
                      {currencyFormatter.format(subtotal)}
                    </output>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-purple-100 bg-purple-50/70 px-5 py-5 sm:px-6">
              <div>
                <p className="text-sm font-semibold text-slate-900">Total del corte</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Suma de los trámites registrados
                </p>
              </div>
              <output className="text-2xl font-semibold tracking-tight tabular-nums text-purple-800 sm:text-3xl">
                {currencyFormatter.format(total)}
              </output>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.025] lg:sticky lg:top-24 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Resumen para enviar
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Copia el detalle de cantidades y el total.
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <span className="material-symbols-outlined" aria-hidden="true">
                  content_paste
                </span>
              </span>
            </div>
            <label htmlFor="cut-summary" className="sr-only">
              Resumen del corte
            </label>
            <textarea
              id="cut-summary"
              readOnly
              value={summary}
              rows={Math.max(5, summary.split("\n").length + 1)}
              placeholder="Agrega cantidades para generar el resumen..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 font-mono text-sm leading-6 text-slate-700 outline-none placeholder:font-sans placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={copySummary}
              disabled={!summary}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copiado al portapapeles" : "Copiar resumen"}
            </button>
            {copyError && (
              <p role="alert" className="mt-2 text-sm text-rose-700">
                No se pudo copiar el resumen. Puedes seleccionarlo y copiarlo manualmente.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
