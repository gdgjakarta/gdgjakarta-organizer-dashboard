import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "auth_token";
const LOGIN_PATH = "/auth/organizer/login";

/**
 * Routes that require authentication.
 * Any path starting with these prefixes is protected.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/chat", "/mail"];

/**
 * Routes accessible only when NOT authenticated.
 * Authenticated users visiting these will be redirected to the dashboard.
 */
const AUTH_PREFIXES = ["/auth"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const isAuthenticated = Boolean(token);

  // Redirect bare root "/" based on auth state
  if (pathname === "/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard/admin", request.url));
    }
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  // Protected route: not authenticated → redirect to login with callbackUrl
  if (isProtected(pathname) && !isAuthenticated) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth page: already authenticated → redirect to dashboard
  if (isAuthPage(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Run middleware on all routes except:
   * - Next.js internal routes (_next/*)
   * - Static files (favicon, images, etc.)
   * - API routes
   */
  matcher: ["/((?!_next/static|_next/image|favicon/favicon.ico|api/).*)"],
};
