// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-black ">
      <div className="text-center ">
        <h1 className="text-6xl font-bold text-white mt-2 mb-10 hover:scale-105 transition-transform duration-300">
          Bienvenido a <span className="text-purple-600">Boreal</span>
        </h1>
        <p className="text-gray-600 mb-6">
          Administra tus correos temporales de forma fácil y rápida
        </p>
        <div className="space-x-4">
          <Link
            href="/login"
            className="transition-all duration-300 ease-in-out bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-800 hover:border-1 "
          >
            Iniciar Sesión
          </Link>
          {/* <Link
            href="/register"
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-400 active:bg-white-600 transition"
          >
            Registrarse
          </Link> */}
        </div>
      </div>
    </main>
  );
}
