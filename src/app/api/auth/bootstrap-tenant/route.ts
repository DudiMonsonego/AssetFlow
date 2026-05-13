/**
 * POST /api/auth/bootstrap-tenant
 *
 * Idempotently ensures that the authenticated user has an `organizations` row
 * and an `owner` `profiles` row.  Safe to call multiple times.
 *
 * This endpoint uses the Supabase admin client (SERVICE_ROLE_KEY) so it
 * bypasses Row Level Security entirely — no custom SQL functions required.
 * It is the reliable fallback for profile/org creation, regardless of
 * whether the setup_new_tenant PostgreSQL function has been applied.
 *
 * Authentication:
 *   The caller must send a valid Supabase JWT in the Authorization header:
 *     Authorization: Bearer <access_token>
 *
 * Request body (optional):
 *   { email?: string }   — used to derive a default org name when one is not
 *                          already known (e.g. email.split("@")[0]).
 *
 * Response:
 *   200  { status: "created" | "exists" }
 *   401  { error: "..." }
 *   500  { error: "..." }
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // ── 1. Authenticate ────────────────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  const admin = createAdminClient();
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(authHeader.slice(7));

  if (authError || !user) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  // ── 2. Check if profile already exists (idempotency guard) ────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingProfile } = await (admin as any)
    .from("profiles")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .maybeSingle() as { data: { id: string; organization_id: string } | null };

  if (existingProfile) {
    return NextResponse.json({ status: "exists" });
  }

  // ── 3. Parse optional body for org name hint ──────────────────────────────
  let email = user.email ?? "";
  try {
    const body = await request.json() as { email?: string };
    if (body.email) email = body.email;
  } catch {
    // Body is optional.
  }

  const defaultOrgName = email.split("@")[0] || "My Organization";

  // ── 4. Create the organization ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newOrg, error: orgError } = await (admin as any)
    .from("organizations")
    .insert({ name: defaultOrgName })
    .select("id")
    .single() as { data: { id: string } | null; error: { message: string } | null };

  if (orgError || !newOrg) {
    console.error("[bootstrap-tenant] Failed to create organization:", orgError?.message);
    return NextResponse.json(
      { error: "Failed to create organization: " + (orgError?.message ?? "unknown") },
      { status: 500 }
    );
  }

  // ── 5. Create the owner profile ───────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (admin as any)
    .from("profiles")
    .insert({
      user_id:         user.id,
      organization_id: newOrg.id,
      role:            "owner",
      full_name:       null,
    }) as { error: { message: string } | null };

  if (profileError) {
    console.error("[bootstrap-tenant] Failed to create profile:", profileError.message);
    // Clean up the orphaned org row to keep things consistent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("organizations").delete().eq("id", newOrg.id);
    return NextResponse.json(
      { error: "Failed to create profile: " + profileError.message },
      { status: 500 }
    );
  }

  console.log(
    `[bootstrap-tenant] Created org ${newOrg.id} and owner profile for user ${user.id}`
  );

  return NextResponse.json({ status: "created" });
}
