// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          🚀 Gestor de Trámites
        </h1>
        <p className="text-gray-600 mb-6">
          Administra tus correos temporales de forma fácil y rápida
        </p>
        <div className="space-x-4">
          <Link
            href="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/register"
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
          >
            Registrarse
          </Link>
        </div>
      </div>
    </main>
  );
}