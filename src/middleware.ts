/**
 * Next.js Edge Middleware — Session Refresh & Route Protection
 *
 * Runs on every request that matches the `config.matcher` pattern.
 * Responsibilities:
 *   1. Refresh the Supabase session cookie so Server Components always
 *      receive a valid, non-expired JWT.
 *   2. Redirect unauthenticated visitors away from protected routes.
 *   3. Redirect already-authenticated users away from auth pages.
 *
 * Protected routes (require a valid session):
 *   /dashboard/**  — main application shell
 *   /assets/**     — asset management
 *   /maintenance/** — maintenance logs
 *   /organization/**— org settings
 *   /team/**       — member management
 *   /settings/**   — user settings
 *
 * Public routes (redirect to /dashboard when already logged in):
 *   /login
 *   /signup
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

/**
 * Matcher configuration.
 *
 * Excludes:
 *   - Next.js internal paths (_next/static, _next/image)
 *   - Static asset files (.svg, .png, .jpg, etc.)
 *   - favicon.ico
 *
 * Everything else — including API routes — passes through so the session
 * is refreshed on every server request. Route Handlers that don't need an
 * authenticated user (e.g. public webhooks) should handle their own auth.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
