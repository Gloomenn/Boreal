// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// El secreto debe ser el mismo que usas en lib/auth.ts
const JWT_SECRET = process.env.JWT_SECRET || "Z9w9XjrJbLomSAGeCoisnp2AlaxZHEUPp5kSTFhHUyY=";

export async function middleware(request: NextRequest) {
  // 1. Obtener la cookie de sesión
  const sessionCookie = request.cookies.get("session")?.value;
  
  // 2. Detectar en qué ruta está el usuario
  const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isOnLogin = request.nextUrl.pathname.startsWith("/login");
  const isOnRegister = request.nextUrl.pathname.startsWith("/register");

  // 3. Si intenta entrar a dashboard sin sesión → redirigir a login
  if (isOnDashboard && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 4. Si tiene sesión y trata de ir a login o register → redirigir a dashboard
  if ((isOnLogin || isOnRegister) && sessionCookie) {
    try {
      // Verificar que el token sea válido (no haya expirado o esté manipulado)
      const secret = new TextEncoder().encode(JWT_SECRET);
      await jwtVerify(sessionCookie, secret);
      
      // Si es válido, lo mandamos al dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch {
      // Si el token es inválido, dejamos que vaya a login (sin redirigir)
      return NextResponse.next();
    }
  }

  // 5. Si está en cualquier otra ruta, permitir el acceso normalmente
  return NextResponse.next();
}

// Configurar en qué rutas se ejecuta el middleware
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};