// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTemporaryMailbox, getMyMailboxes, syncAllMailboxes } from "@/actions/mailbox.actions";
import { logoutAction } from "@/actions/auth.actions";

// Tipos (coinciden con Prisma)
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

  useEffect(() => {
    loadMailboxes();
  }, []);

  const loadMailboxes = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getMyMailboxes();
      if (result.success) {
        setMailboxes(result.data || []);
      } else {
        setError(result.error || "Error al cargar los correos");
      }
    } catch {
      setError("Error inesperado al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMailbox = async () => {
    if (!aliasName.trim()) {
      setError("Por favor, escribe un nombre para el trámite");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccessMessage(null);
      const result = await createTemporaryMailbox(aliasName);
      if (result.success && result.mailbox) {
        setSuccessMessage(`✅ Correo creado: ${result.mailbox.emailAddress}`);
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

  // ✅ AHORA usa la importación estática (no la dinámica)
  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      setError(null);
      const result = await syncAllMailboxes(); // <-- Usa la importación de arriba
      if (result.success) {
        setSyncMessage(`✅ ${result.message}`);
        await loadMailboxes(); // Recarga la lista para mostrar los mensajes nuevos
      } else {
        setError(result.error || "Error al sincronizar");
      }
    } catch (err) {
      setError("Error inesperado al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await logoutAction();
  };

  

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">📬 Gestor de Trámites</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition font-medium"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mensajes de éxito / error generales */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg border border-green-300">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">
            ❌ {error}
          </div>
        )}
        {syncMessage && (
          <div className="mb-6 p-4 bg-blue-100 text-blue-700 rounded-lg border border-blue-300">
            {syncMessage}
          </div>
        )}

        {/* Formulario de creación */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">🆕 Crear nuevo correo temporal</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={aliasName}
              onChange={(e) => setAliasName(e.target.value)}
              placeholder="Ej: Trámite del coche, Banco..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              disabled={creating}
            />
            <button
              onClick={handleCreateMailbox}
              disabled={creating}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {creating ? "⏳ Creando..." : "🚀 Crear Correo"}
            </button>
          </div>
        </div>

        {/* Lista de correos con botón de sincronización */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-700">
            📧 Mis correos temporales ({mailboxes.length})
          </h2>
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {syncing ? (
              <>
                <span className="animate-spin">⏳</span> Sincronizando...
              </>
            ) : (
              "🔄 Comprobar nuevos correos"
            )}
          </button>
        </div>

        {/* Lista de correos */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-md">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            Cargando...
          </div>
        ) : mailboxes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
            <p className="text-lg">📭 No tienes correos temporales aún.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {mailboxes.map((mailbox) => (
              <div
                key={mailbox.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition border border-gray-100"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {mailbox.aliasName || "Sin nombre"}
                    </h3>
                    <p className="text-sm text-gray-600 font-mono">
                      {mailbox.emailAddress}
                    </p>
                    <p className="text-xs text-gray-400">
                      Creado: {mailbox.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/${mailbox.id}`)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Ver mensajes →
                  </button>
                </div>
                {/* Resumen de mensajes */}
                {mailbox.messages.length > 0 && (
                  <div className="mt-3 text-sm text-gray-500 border-t border-gray-100 pt-2">
                    📥 {mailbox.messages.length} mensaje(s). Último:{" "}
                    {mailbox.messages[0].receivedAt.toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}