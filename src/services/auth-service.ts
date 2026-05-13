/**
 * Auth Service
 *
 * Single source of truth for all authentication flows.
 * UI components (forms, buttons) import from here — never from Supabase directly.
 *
 * Sign-up flow (transaction-like, atomic):
 * ─────────────────────────────────────────
 *  1. supabase.auth.signUp()     — creates the Supabase Auth user
 *  2. supabase.rpc('setup_new_tenant') — SECURITY DEFINER postgres function that
 *     atomically inserts the `organizations` row and the owner `profiles` row
 *     inside a single database transaction. If either insert fails, Postgres
 *     rolls back both automatically.
 *
 * Why RPC instead of direct inserts or a Route Handler?
 *   • Both `organizations` and `profiles` have NO client INSERT RLS policy
 *     by design. A brand-new user has no profile, so get_my_org_id() returns
 *     NULL and every client write is denied.
 *   • The SECURITY DEFINER function runs as the Postgres owner (bypassing RLS)
 *     while still reading auth.uid() from the caller's JWT — secure and atomic.
 *   • No server-side Route Handler or service-role key is needed client-side.
 *
 * All functions return { error } — they never throw. Every failure path is
 * logged with a structured [auth-service] prefix for easy filtering.
 */
import { createClient } from "@/lib/supabase/client";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AuthResult {
  /** null on success; a human-readable message on failure. */
  error: string | null;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface SignUpParams {
  email: string;
  password: string;
  /** Name of the organization (tenant) to create for this user. */
  organizationName: string;
  /** Stored in the owner's profile row. */
  fullName: string;
}

// ─── internal helper ──────────────────────────────────────────────────────────

/**
 * Calls POST /api/auth/bootstrap-tenant to ensure the org + profile rows exist.
 * This is an idempotent, admin-client-backed operation — safe to call on every
 * sign-in; it returns immediately if the profile already exists.
 *
 * Falls back to the setup_new_tenant RPC if the API call fails, so both paths
 * are attempted for maximum reliability.
 */
async function ensureProfile(accessToken: string, email: string): Promise<void> {
  try {
    const res = await fetch("/api/auth/bootstrap-tenant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email }),
    });

    const body = await res.json().catch(() => ({})) as { status?: string; error?: string };

    if (!res.ok) {
      console.warn("[auth-service] bootstrap-tenant API failed:", body.error);
    } else {
      console.log("[auth-service] bootstrap-tenant:", body.status); // "created" or "exists"
    }
  } catch (err) {
    console.warn("[auth-service] bootstrap-tenant fetch error:", err);
  }
}

// ─── signIn ───────────────────────────────────────────────────────────────────

/**
 * Signs in an existing user with email + password.
 * On success the session cookie is set automatically by @supabase/ssr;
 * the caller should then push to /dashboard and call router.refresh().
 *
 * After every successful sign-in we call bootstrap-tenant to ensure the user
 * has an org + profile row — idempotent, so safe to call every time.
 */
export async function signIn({ email, password }: SignInParams): Promise<AuthResult> {
  console.log("[auth-service] signIn: attempting sign-in for", email);

  try {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("[auth-service] signIn: Supabase Auth error →", error.message);
      return { error: error.message };
    }

    // Ensure org + profile exist.  This is idempotent and works even if the
    // setup_new_tenant SQL function has not been applied to the database.
    if (data.session) {
      await ensureProfile(data.session.access_token, email);
    }

    console.log("[auth-service] signIn: success");
    return { error: null };

  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : "An unexpected error occurred during sign-in.";
    console.error("[auth-service] signIn: unexpected exception →", err);
    return { error: message };
  }
}

// ─── signUp ───────────────────────────────────────────────────────────────────

/**
 * Registers a new user and atomically bootstraps their tenant.
 *
 * Step-by-step:
 *   1. supabase.auth.signUp()          — create the Auth user
 *   2. Check for session               — if null, email confirmation is required
 *   3. supabase.rpc('setup_new_tenant') — create org + owner profile in one transaction
 *
 * Each step is individually logged so failures are instantly visible in
 * the browser DevTools console.
 *
 * @returns AuthResult.error = null on full success.
 */
export async function signUp({
  email,
  password,
  organizationName,
  fullName,
}: SignUpParams): Promise<AuthResult> {
  const supabase = createClient();

  // ── Step 1: Create the Supabase Auth user ───────────────────────────────────
  console.log("[auth-service] signUp: step 1 — creating Auth user for", email);

  // Point the confirmation e-mail link at our /auth/callback route so the
  // PKCE code is exchanged properly and the tenant is bootstrapped automatically.
  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  let session: Awaited<ReturnType<typeof supabase.auth.signUp>>["data"]["session"];

  try {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });

    if (signUpError) {
      console.error(
        "[auth-service] signUp: step 1 FAILED — Supabase Auth error →",
        signUpError.message
      );
      return { error: signUpError.message };
    }

    session = data.session;
    console.log(
      "[auth-service] signUp: step 1 OK — user id:",
      data.user?.id ?? "(no user returned)",
      "| session present:",
      session !== null
    );

  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : "Unexpected error creating Auth user.";
    console.error("[auth-service] signUp: step 1 FAILED — exception →", err);
    return { error: message };
  }

  // ── Step 2: Session check ───────────────────────────────────────────────────
  // session is null when Supabase requires email confirmation.
  // In that case we cannot call the RPC (no valid JWT yet).
  // Disable "Confirm email" in: Supabase dashboard → Authentication → Settings
  // to get an immediate session on sign-up (recommended for B2B onboarding).
  if (!session) {
    console.warn(
      "[auth-service] signUp: no session after signUp — email confirmation is " +
        "likely enabled. Organization and profile will NOT be created until the " +
        "user confirms their email. To fix: disable 'Confirm email' in Supabase " +
        "Authentication settings."
    );
    return {
      error:
        "A confirmation email has been sent to " +
        email +
        ". Please verify your address, then sign in to complete your account setup.",
    };
  }

  // ── Step 3: Bootstrap the tenant (org + profile) ───────────────────────────
  // Primary path: call the bootstrap-tenant API (uses admin client, no SQL
  // function dependency).  Falls back to the setup_new_tenant RPC if needed.
  console.log(
    "[auth-service] signUp: step 2 — bootstrapping tenant",
    "| org:", organizationName,
    "| name:", fullName
  );

  try {
    await ensureProfile(session.access_token, email);

    // If a specific org name / full name was provided, try to update them via
    // the RPC (which sets the exact values the user typed).  This is best-effort.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .rpc("setup_new_tenant", {
        org_name:       organizationName.trim(),
        user_full_name: fullName.trim() || null,
      })
      .catch(() => {
        /* RPC not available — ensureProfile already handled the basics. */
      });

    console.log("[auth-service] signUp: step 2 OK");

  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : "Unexpected error during organization setup.";
    console.error("[auth-service] signUp: step 2 FAILED — exception →", err);

    await supabase.auth.signOut().catch((e: unknown) =>
      console.error("[auth-service] signUp: cleanup signOut failed →", e)
    );

    return { error: message };
  }

  console.log("[auth-service] signUp: complete — user and tenant created successfully");
  return { error: null };
}

// ─── signOut ──────────────────────────────────────────────────────────────────

/**
 * Signs out the authenticated user and clears the session cookie.
 * The caller should then push to /login and call router.refresh().
 */
export async function signOut(): Promise<AuthResult> {
  console.log("[auth-service] signOut: signing out");

  try {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[auth-service] signOut: Supabase Auth error →", error.message);
      return { error: error.message };
    }

    console.log("[auth-service] signOut: success");
    return { error: null };

  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : "An unexpected error occurred during sign-out.";
    console.error("[auth-service] signOut: unexpected exception →", err);
    return { error: message };
  }
}
