"use client";

/**
 * LoginForm
 *
 * Standard email/password sign-in plus an optional "Try Demo" button for
 * recruiters and reviewers.
 *
 * ── Demo / Guest Access ──────────────────────────────────────────────────────
 * The demo button signs in with a pre-created, read-only demo account whose
 * credentials are stored in:
 *   NEXT_PUBLIC_DEMO_EMAIL
 *   NEXT_PUBLIC_DEMO_PASSWORD
 *
 * This deliberately showcases Supabase Row Level Security (RLS):
 *   • The demo user belongs to a dedicated "Demo Organization" tenant.
 *   • They can only see data from that tenant — other organizations' assets,
 *     maintenance logs, and profiles are completely invisible to them, even
 *     though they share the same database tables.
 *   • The isolation is enforced at the PostgreSQL level via the
 *     get_my_org_id() helper function and per-table RLS policies, not in
 *     application code — so it cannot be bypassed client-side.
 *
 * When both env vars are absent the demo button is hidden entirely, so there
 * is no risk of exposing demo credentials in production environments that
 * haven't configured them.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/services/auth-service";
import { Button } from "@/components/ui/button";
import { Eye, Loader2, LogIn, ShieldCheck } from "lucide-react";

// ─── Demo credentials (set in .env.local) ────────────────────────────────────
// NEXT_PUBLIC_ prefix is required so Next.js exposes them to the browser bundle.
// Both must be set for the demo button to appear.
const DEMO_EMAIL    = process.env.NEXT_PUBLIC_DEMO_EMAIL    ?? "";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";
const DEMO_ENABLED  = Boolean(DEMO_EMAIL && DEMO_PASSWORD);

// ─── Shared input style ───────────────────────────────────────────────────────

const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
  "ring-offset-background placeholder:text-muted-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

// ─── Component ────────────────────────────────────────────────────────────────

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);

  // Two independent loading states so the buttons don't interfere.
  const [loading, setLoading]         = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // ── Regular sign-in ────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await signIn({ email, password });

    if (authError) {
      setError(authError);
      setLoading(false);
      return;
    }

    // Refresh server components so the layout picks up the new session.
    router.push("/dashboard");
    router.refresh();
  }

  // ── Demo / Guest sign-in ───────────────────────────────────────────────────
  //
  // Signs in with the pre-configured demo account.  Because this account is a
  // real Supabase Auth user, Supabase RLS applies exactly as it would for any
  // other user — the demo viewer can only read their own organization's data.
  // This makes it a live, realistic demonstration of multi-tenant data isolation.

  async function handleGuestLogin() {
    setError(null);
    setDemoLoading(true);

    const { error: authError } = await signIn({
      email:    DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (authError) {
      setError(
        "Demo login failed. The demo account may not be set up yet. " +
        "Please ask the administrator to create it in Supabase."
      );
      setDemoLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const anyLoading = loading || demoLoading;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Standard login form ─────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Work Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={anyLoading}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={anyLoading}
            className={INPUT_CLASS}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={anyLoading}>
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <LogIn className="h-4 w-4" />}
          {loading ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      {/* ── Demo access section (hidden when env vars are absent) ────────────── */}
      {DEMO_ENABLED && (
        <>
          {/* Visual divider */}
          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-dashed" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              or
            </span>
            <div className="flex-1 border-t border-dashed" />
          </div>

          {/* Demo button — visually distinct: amber outline style */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={anyLoading}
              className={
                "flex w-full items-center justify-center gap-2 rounded-md border-2 " +
                "border-amber-400 bg-amber-50 px-4 py-2.5 text-sm font-semibold " +
                "text-amber-800 transition-colors " +
                "hover:bg-amber-100 hover:border-amber-500 " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 " +
                "disabled:cursor-not-allowed disabled:opacity-50 " +
                "dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-600 " +
                "dark:hover:bg-amber-950/50"
              }
            >
              {demoLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Eye className="h-4 w-4" />}
              {demoLoading ? "Loading demo…" : "Try Demo — Guest Access"}
            </button>

            {/* RLS explanation note shown beneath the button */}
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/20">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                <span className="font-semibold">Live RLS demo</span> — this account
                belongs to a sandboxed organization. All data is isolated at the
                PostgreSQL level via Row Level Security. You will only see demo data,
                never other tenants&apos; records.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
