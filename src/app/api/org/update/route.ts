/**
 * PATCH /api/org/update
 *
 * Updates the name of the authenticated user's organization.
 * Only users with the "owner" or "admin" role may make changes.
 *
 * Request body: { name: string }
 * Response:     { name: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ProfileRow {
  organization_id: string;
  role:            string;
}

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
  let name: string;
  try {
    const body = await request.json() as { name?: string };
    name = body.name?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Organization name cannot be empty." }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or fewer." }, { status: 400 });
  }

  // ── 3. Check the caller's role ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (admin as any)
    .from("profiles")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .single()) as { data: ProfileRow | null };

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  if (!["owner", "admin"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can update the organization name." },
      { status: 403 }
    );
  }

  // ── 4. Apply the update ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = (await (admin as any)
    .from("organizations")
    .update({ name })
    .eq("id", profile.organization_id)
    .select("name")
    .single()) as { data: { name: string } | null; error: { message: string } | null };

  if (updateError) {
    console.error("[org/update] DB error:", updateError.message);
    return NextResponse.json({ error: "Failed to update organization name." }, { status: 500 });
  }

  return NextResponse.json({ name: updated?.name ?? name });
}
