import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { hasTeamOperationalAccess, isExecutiveOrganizer } from "@/lib/auth-roles";

const AUTH_COOKIE = "auth_token";
const ROLE_COOKIE = "auth_role";
const LOGIN_PATH = "/auth/login";

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

/**
 * Routes strictly restricted to Executive Organizers (Lead / Co-Organizer / Googler).
 * Core Team, Check-in Staff, and Members are redirected to /dashboard/member.
 */
const EXECUTIVE_ORGANIZER_ONLY_PREFIXES = [
  "/dashboard/organizer",
  "/dashboard/email-manager",
  "/dashboard/members",
  "/dashboard/referrals",
  "/dashboard/partnership",
  "/dashboard/crm",
  "/dashboard/roles",
  "/dashboard/links",
  "/dashboard/maintenance",
];

/**
 * Operational routes accessible by Executive Organizers, Core Team, and Staff.
 * Community Members are redirected to /dashboard/member.
 */
const TEAM_OPERATIONAL_PREFIXES = ["/dashboard/events"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isExecutiveOrganizerOnly(pathname: string): boolean {
  return EXECUTIVE_ORGANIZER_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isTeamOperational(pathname: string): boolean {
  return TEAM_OPERATIONAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept or redirect Server Actions or non-GET requests away from handlers
  if (request.method !== "GET" || request.headers.has("next-action")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value;
  const isAuthenticated = Boolean(token);
  const isExecutive = isExecutiveOrganizer(role);
  const isTeam = hasTeamOperationalAccess(role);

  // Protected route: not authenticated → redirect to unified login with callbackUrl
  if (isProtected(pathname) && !isAuthenticated) {
    console.log(`[Middleware] Unauthenticated access to protected route "${pathname}". Redirecting to /auth/login`);
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Handle root /dashboard redirect based on role
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    const target = isExecutive ? "/dashboard/organizer" : "/dashboard/member";
    console.log(`[Middleware] Root /dashboard accessed. Redirecting (role="${role}") to ${target}`);
    return NextResponse.redirect(new URL(target, request.url));
  }

  // RBAC for protected organizer and team routes
  if (isProtected(pathname) && isAuthenticated) {
    if (isExecutiveOrganizerOnly(pathname) && !isExecutive) {
      console.warn(
        `[Middleware] RBAC Guard: Non-organizer (role="${role}") attempted access to executive-only route "${pathname}". Redirecting to /dashboard/member`,
      );
      return NextResponse.redirect(new URL("/dashboard/member", request.url));
    }

    if (isTeamOperational(pathname) && !isTeam) {
      console.warn(
        `[Middleware] RBAC Guard: Member (role="${role}") attempted access to operational route "${pathname}". Redirecting to /dashboard/member`,
      );
      return NextResponse.redirect(new URL("/dashboard/member", request.url));
    }
  }

  // Auth page: already authenticated → redirect to appropriate dashboard
  if (isAuthPage(pathname) && isAuthenticated) {
    const target = isExecutive ? "/dashboard/organizer" : "/dashboard/member";
    console.log(`[Middleware] Authenticated user on auth page "${pathname}". Redirecting to ${target}`);
    return NextResponse.redirect(new URL(target, request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
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
