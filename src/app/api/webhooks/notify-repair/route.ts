/**
 * POST /api/webhooks/notify-repair
 *
 * Internal endpoint called by the assets UI when an asset's status is
 * changed to "in_maintenance". Verifies the caller's JWT, resolves the
 * organization name, then delegates to webhook-service.sendAssetRepairWebhook.
 *
 * Security: requires a valid Supabase access_token in the Authorization header.
 *
 * Request body:
 *   { assetId: string; assetName: string; serialNumber: string }
 *
 * Response:
 *   { delivered: boolean }
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAssetRepairWebhook } from "@/services/webhook-service";

interface NotifyRepairBody {
  assetId:      string;
  assetName:    string;
  serialNumber: string;
}

interface ProfileRow {
  organization_id: string;
}

interface OrgRow {
  name: string;
}

export async function POST(request: NextRequest) {
  // ── 1. Verify the Bearer token ────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);
  const admin = createAdminClient();

  const { data: { user }, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  // ── 2. Parse the request body ─────────────────────────────────────────────
  let body: NotifyRepairBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { assetId, assetName, serialNumber } = body;
  if (!assetId || !assetName || !serialNumber) {
    return NextResponse.json({ error: "assetId, assetName and serialNumber are required." }, { status: 400 });
  }

  // ── 3. Resolve the organization name ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (admin as any)
    .from("profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .single()) as { data: ProfileRow | null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = profile
    ? ((await (admin as any)
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id)
        .single()) as { data: OrgRow | null })
    : { data: null };

  const organizationName = org?.name ?? "Unknown Organization";

  // ── 4. Fire the webhook (non-blocking — errors are logged, not thrown) ────
  await sendAssetRepairWebhook({
    event_timestamp: new Date().toISOString(),
    event_type:      "asset.status_changed",
    asset: {
      id:            assetId,
      name:          assetName,
      serial_number: serialNumber,
      new_status:    "in_maintenance",
    },
    organization: {
      name: organizationName,
    },
  });

  return NextResponse.json({ delivered: true });
}
