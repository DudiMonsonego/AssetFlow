/**
 * GET /auth/callback
 *
 * This route handles the Supabase PKCE code exchange for:
 *   • Email confirmation after sign-up
 *   • Magic-link sign-in (if ever enabled)
 *
 * Without this route, clicking the confirmation e-mail just dumps the user at
 * /?code=... with no session, because the middleware's updateSession does NOT
 * exchange the PKCE code — it only refreshes existing sessions.
 *
 * Flow:
 *   1. User clicks confirmation link in their inbox.
 *   2. Supabase redirects to  <origin>/auth/callback?code=<pkce-code>
 *   3. This handler exchanges the code for a session (sets cookies).
 *   4. It then calls the bootstrap-tenant API to ensure org + profile exist.
 *   5. Redirect to /dashboard.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    // No code — redirect to login so the user can try again.
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Exchange the PKCE code for a real session.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("[auth/callback] Code exchange failed:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
  }

  // Bootstrap the tenant (creates org + profile if they don't exist yet).
  // We call our own API endpoint so it runs with the admin client and is
  // independent of whether the setup_new_tenant SQL function was applied.
  try {
    await fetch(`${origin}/api/auth/bootstrap-tenant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({
        email: data.session.user.email ?? "",
      }),
    });
  } catch (err) {
    // Non-fatal — user is authenticated; they can still use the app.
    console.error("[auth/callback] bootstrap-tenant call failed:", err);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
