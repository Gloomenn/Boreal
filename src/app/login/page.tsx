"use client";

import { loginUser } from "@/actions/auth.actions";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    const result = await loginUser(formData);
    if (result?.error) {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Iniciar Sesión</h1>
        
        {/* Mostrar errores */}
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm border border-red-300">
            {error}
          </div>
        )}
        
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="tu@email.com"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition duration-200 font-medium"
          >
            Entrar
          </button>
        </form>
        
        <p className="text-center text-sm mt-4 text-gray-600">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="text-blue-600 hover:underline font-medium">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}