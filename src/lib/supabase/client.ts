/**
 * Browser-side Supabase client.
 *
 * Usage: import in "use client" components only.
 * For Server Components / Route Handlers, use @/lib/supabase/server instead.
 *
 * Environment variables are validated at call-time so missing config surfaces
 * immediately as a clear error rather than a cryptic network failure.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Creates and returns a Supabase browser client typed against the project
 * Database schema. A new instance is created on every call; wrap it in a
 * React ref or module-level variable if you need a singleton.
 *
 * @throws {Error} When the required public environment variables are missing.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables.\n" +
        "Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "are set in your .env.local file. See .env.local.example for reference."
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
