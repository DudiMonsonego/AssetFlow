/**
 * Supabase Admin Client — SERVER ONLY.
 *
 * Uses the SERVICE_ROLE_KEY which bypasses Row Level Security entirely.
 * This client must NEVER be instantiated in browser code or passed to the
 * client side. Import it only in:
 *   - Route Handlers  (app/api/[...]/route.ts)
 *   - Server Actions
 *   - Server-side scripts / migrations
 *
 * autoRefreshToken and persistSession are disabled because this client is
 * stateless and short-lived within a single request.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Returns an admin-level Supabase client that bypasses RLS.
 *
 * @throws {Error} When required server-side environment variables are absent.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing server-side Supabase environment variables.\n" +
        "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      // Do not auto-refresh — this client is ephemeral per request.
      autoRefreshToken: false,
      // Do not persist session to localStorage/cookies — server-side only.
      persistSession: false,
    },
  });
}
