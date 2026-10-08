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
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-purple-400">Herramientas</p>
          <h1 className="mt-1 text-3xl font-bold text-white">
            Calculador de corte
          </h1>
          <p className="mt-2 text-neutral-400">
            Ingresa el precio y la cantidad de cada trámite para calcular el
            total del corte.
          </p>
        </div>

        <section
          aria-labelledby="calculator-title"
          className="overflow-hidden rounded-lg border border-stone-800 bg-stone-950 shadow-md"
        >
          <h2 id="calculator-title" className="sr-only">
            Trámites del corte
          </h2>
          <div className="hidden grid-cols-[minmax(0,1fr)_10rem_10rem_9rem] gap-4 border-b border-stone-800 px-6 py-3 text-sm font-medium text-neutral-400 md:grid">
            <span>Trámite</span>
            <span>Precio</span>
            <span>Cantidad</span>
            <span className="text-right">Subtotal</span>
          </div>

          <div className="divide-y divide-stone-800">
            {totals.map(({ procedure, subtotal }) => (
              <div
                key={procedure}
                className="grid gap-3 px-6 py-5 md:grid-cols-[minmax(0,1fr)_10rem_10rem_9rem] md:items-center md:gap-4"
              >
                <label
                  htmlFor={`${procedure}-price`}
                  className="font-medium text-neutral-100"
                >
                  {procedure}
                </label>
                <div>
                  <label
                    htmlFor={`${procedure}-price`}
                    className="mb-1 block text-xs text-neutral-400 md:hidden"
                  >
                    Precio
                  </label>
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
                    className="w-full rounded-md border border-stone-700 bg-black px-3 py-2 text-white outline-none transition placeholder:text-neutral-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${procedure}-quantity`}
                    className="mb-1 block text-xs text-neutral-400 md:hidden"
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
                    className="w-full rounded-md border border-stone-700 bg-black px-3 py-2 text-white outline-none transition placeholder:text-neutral-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <output className="text-right font-medium text-white">
                  {currencyFormatter.format(subtotal)}
                </output>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-stone-900 px-6 py-5">
            <span className="text-lg font-semibold text-white">Total</span>
            <output className="text-2xl font-bold text-purple-400">
              {currencyFormatter.format(total)}
            </output>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-stone-800 bg-stone-950 p-6 shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Resumen para enviar
            </h2>
            <button
              type="button"
              onClick={copySummary}
              disabled={!summary}
              className="rounded-md border border-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? "¡Copiado!" : "Copiar"}
            </button>
          </div>
          <textarea
            readOnly
            value={summary}
            rows={Math.max(4, summary.split("\n").length + 1)}
            placeholder="Agrega trámites para generar el resumen..."
            className="w-full resize-none rounded-md border border-stone-700 bg-black px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-neutral-600 focus:border-purple-500"
          />
        </section>
      </main>
    </div>
  );
}
