import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public static assets and next internal routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const sessionToken = request.cookies.get("trace_session")?.value;

  // If trying to access protected /app routes without a session cookie, redirect to /login
  if (pathname.startsWith("/app") && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If trying to access protected /api routes without a session cookie, return 401 JSON
  if (
    pathname.startsWith("/api") &&
    !pathname.startsWith("/api/auth/login") &&
    !pathname.startsWith("/api/auth/signup") &&
    !sessionToken
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect authenticated user away from login/signup to mission control (/app)
  if ((pathname === "/login" || pathname === "/signup") && sessionToken) {
    const appUrl = new URL("/app", request.url);
    return NextResponse.redirect(appUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
