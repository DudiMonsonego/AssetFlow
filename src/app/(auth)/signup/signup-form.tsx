"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/services/auth-service";
import { Button } from "@/components/ui/button";
import { Loader2, MailCheck } from "lucide-react";

const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
  "ring-offset-background placeholder:text-muted-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Sign-up form — calls auth-service.signUp() which:
 *   1. Creates the Supabase Auth user.
 *   2. Calls POST /api/auth/bootstrap-tenant to atomically create the
 *      organization and owner profile using the admin client (bypasses RLS).
 *   3. If email confirmation is enabled, shows a "check your inbox" screen
 *      and the bootstrap runs after the user confirms via /auth/callback.
 *
 * The form never calls Supabase directly — it only talks to the auth service.
 */
export function SignupForm() {
  const router = useRouter();

  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName]                 = useState("");
  const [email, setEmail]                       = useState("");
  const [password, setPassword]                 = useState("");
  const [error, setError]                       = useState<string | null>(null);
  const [loading, setLoading]                   = useState(false);

  // Shown when Supabase requires email confirmation before the session is live.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await signUp({
      email,
      password,
      organizationName,
      fullName,
    });

    setLoading(false);

    if (authError) {
      // The auth service returns a specific message when email confirmation
      // is required — show a friendly UI instead of treating it as an error.
      if (authError.toLowerCase().includes("confirmation email")) {
        setAwaitingConfirmation(true);
        return;
      }

      setError(authError);
      return;
    }

    // Refresh server components so the dashboard layout can fetch the new session.
    router.push("/dashboard");
    router.refresh();
  }

  // ── Email-confirmation waiting state ────────────────────────────────────────
  if (awaitingConfirmation) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-7 w-7" />
        </div>
        <div>
          <p className="text-sm font-medium">Check your inbox</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account, then return here to sign in.
          </p>
        </div>
      </div>
    );
  }

  // ── Normal sign-up form ─────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="org-name" className="text-sm font-medium">
          Organization Name
        </label>
        <input
          id="org-name"
          type="text"
          required
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          placeholder="Acme Corp"
          className={INPUT_CLASS}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="full-name" className="text-sm font-medium">
          Your Full Name
        </label>
        <input
          id="full-name"
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Smith"
          className={INPUT_CLASS}
        />
      </div>

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
          placeholder="jane@acme.com"
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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
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

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Create Organization
      </Button>
    </form>
  );
}
