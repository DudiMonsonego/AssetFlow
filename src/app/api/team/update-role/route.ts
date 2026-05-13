/**
 * PATCH /api/team/update-role
 *
 * Changes a team member's role. Only an owner can call this endpoint.
 * The owner cannot change their own role.
 *
 * Request body: { profileId: string; role: string }
 * Response:     { profileId: string; role: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ROLES = ["owner", "admin", "technician", "viewer"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

interface ProfileRow {
  id:              string;
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
  let profileId: string;
  let role: AllowedRole;

  try {
    const body = await request.json() as { profileId?: string; role?: string };
    profileId = body.profileId?.trim() ?? "";
    role      = (body.role?.trim() ?? "") as AllowedRole;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!profileId || !role) {
    return NextResponse.json({ error: "profileId and role are required." }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `Role must be one of: ${ALLOWED_ROLES.join(", ")}.` },
      { status: 400 }
    );
  }

  // ── 3. Fetch the caller's profile ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerProfile } = (await (admin as any)
    .from("profiles")
    .select("id, organization_id, role")
    .eq("user_id", user.id)
    .single()) as { data: ProfileRow | null };

  if (!callerProfile) {
    return NextResponse.json({ error: "Caller profile not found." }, { status: 404 });
  }
  if (callerProfile.role !== "owner") {
    return NextResponse.json({ error: "Only owners can change member roles." }, { status: 403 });
  }

  // ── 4. Guard: cannot change own role ──────────────────────────────────────
  if (callerProfile.id === profileId) {
    return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
  }

  // ── 5. Ensure the target profile belongs to the same organization ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: targetProfile } = (await (admin as any)
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", profileId)
    .single()) as { data: ProfileRow | null };

  if (!targetProfile) {
    return NextResponse.json({ error: "Target profile not found." }, { status: 404 });
  }
  if (targetProfile.organization_id !== callerProfile.organization_id) {
    return NextResponse.json({ error: "Cannot modify a member outside your organization." }, { status: 403 });
  }

  // ── 6. Apply the role change ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = (await (admin as any)
    .from("profiles")
    .update({ role })
    .eq("id", profileId)) as { error: { message: string } | null };

  if (updateError) {
    console.error("[team/update-role] DB error:", updateError.message);
    return NextResponse.json({ error: "Failed to update role." }, { status: 500 });
  }

  return NextResponse.json({ profileId, role });
}
