/**
 * PATCH /api/profile/update
 *
 * Updates the authenticated user's own profile fields.
 * Currently supports: full_name
 *
 * The update is scoped to the calling user's profile row only —
 * users cannot modify other members' profiles through this endpoint.
 *
 * Request body: { full_name: string }
 * Response:     { full_name: string | null }
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest) {
  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user }, error: authError } =
    await admin.auth.getUser(authHeader.slice(7));

  if (authError || !user) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let fullName: string | null;
  try {
    const body = await request.json() as { full_name?: string };
    const trimmed = body.full_name?.trim() ?? "";
    fullName = trimmed.length > 0 ? trimmed : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (fullName !== null && fullName.length > 120) {
    return NextResponse.json(
      { error: "Display name must be 120 characters or fewer." },
      { status: 400 }
    );
  }

  // ── 3. Update the caller's own profile row ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = (await (admin as any)
    .from("profiles")
    .update({ full_name: fullName })
    .eq("user_id", user.id)
    .select("full_name")
    .single()) as {
    data: { full_name: string | null } | null;
    error: { message: string } | null;
  };

  if (updateError) {
    console.error("[profile/update] DB error:", updateError.message);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Profile not found. Please ensure your account is fully set up." },
      { status: 404 }
    );
  }

  return NextResponse.json({ full_name: updated.full_name });
}
