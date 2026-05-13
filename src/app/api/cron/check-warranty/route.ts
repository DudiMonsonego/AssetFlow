/**
 * POST /api/cron/check-warranty
 *
 * Scans the `assets` table for items whose `warranty_expiry` falls within
 * the next 30 days and creates a "Warranty Warning" maintenance log for
 * each one that doesn't already have a recent warning.
 *
 * Designed to be called once per day. Scheduled via vercel.json:
 *   { "crons": [{ "path": "/api/cron/check-warranty", "schedule": "0 8 * * *" }] }
 *
 * Security:
 *   Accepts two forms of authorization (checked in order):
 *   1. Vercel Cron runner — sends the header "x-vercel-cron: 1" automatically
 *      when the VERCEL_CRON_SECRET env var is set in the Vercel project.
 *   2. Manual / CI call — Authorization: Bearer <CRON_SECRET>
 *   Set CRON_SECRET in your .env.local and Vercel environment variables.
 *
 * Idempotency:
 *   Before creating a log, the handler checks whether a "Warranty Warning"
 *   log already exists for the same asset within the last 7 days.
 *   If one is found the asset is skipped, so running the cron multiple
 *   times per day produces no duplicate records.
 *
 * Response:
 *   { processed: number; skipped: number; created: number; errors: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface AssetRow {
  id: string;
  organization_id: string;
  model_name: string;
  serial_number: string;
  warranty_expiry: string;
}

interface LogRow {
  id: string;
}

export async function POST(request: NextRequest) {
  // ── 1. Verify the caller is authorized ───────────────────────────────────
  // Vercel Cron runner sends "x-vercel-cron: 1" when VERCEL_CRON_SECRET is set.
  // Manual/CI callers use Authorization: Bearer <CRON_SECRET>.
  const cronSecret      = process.env.CRON_SECRET;
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const authHeader       = request.headers.get("Authorization");

  const isVercelCron    = vercelCronHeader === "1";
  const isBearerValid   = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !isBearerValid) {
    console.warn("[check-warranty] Unauthorized request rejected.");
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Set up date range ──────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayStr    = today.toISOString().split("T")[0];
  const in30DaysStr = in30Days.toISOString();
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  const admin = createAdminClient();

  // ── 3. Find assets with warranties expiring within 30 days ───────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assets, error: assetsError } = (await (admin as any)
    .from("assets")
    .select("id, organization_id, model_name, serial_number, warranty_expiry")
    .gte("warranty_expiry", todayStr)
    .lte("warranty_expiry", in30DaysStr)
    .not("status", "eq", "retired")
    .not("status", "eq", "disposed")) as {
    data: AssetRow[] | null;
    error: { message: string } | null;
  };

  if (assetsError) {
    console.error("[check-warranty] Failed to fetch assets:", assetsError.message);
    return NextResponse.json(
      { error: "Failed to query assets." },
      { status: 500 }
    );
  }

  const targets = assets ?? [];
  console.log(`[check-warranty] Found ${targets.length} assets with expiring warranties.`);

  // ── 4. Process each asset ─────────────────────────────────────────────────
  const results = { processed: targets.length, skipped: 0, created: 0, errors: [] as string[] };

  for (const asset of targets) {
    try {
      // Idempotency: check for an existing warning log in the past 7 days.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingLog } = (await (admin as any)
        .from("maintenance_logs")
        .select("id")
        .eq("asset_id", asset.id)
        .gte("service_date", sevenDaysAgoStr)
        .ilike("description", "Warranty Warning%")
        .maybeSingle()) as { data: LogRow | null };

      if (existingLog) {
        console.log(`[check-warranty] Skipping asset ${asset.id} — warning already sent.`);
        results.skipped++;
        continue;
      }

      // Calculate days until expiry for the log description.
      const expiryDate  = new Date(asset.warranty_expiry);
      const daysLeft    = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const description =
        `Warranty Warning: ${asset.model_name} (SN: ${asset.serial_number}) ` +
        `warranty expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} ` +
        `on ${asset.warranty_expiry.split("T")[0]}.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = (await (admin as any)
        .from("maintenance_logs")
        .insert({
          asset_id:        asset.id,
          organization_id: asset.organization_id,
          description,
          // service_date defaults to NOW() via column default
        })) as { error: { message: string } | null };

      if (insertError) {
        console.error(
          `[check-warranty] Failed to create log for asset ${asset.id}:`,
          insertError.message
        );
        results.errors.push(`Asset ${asset.id}: ${insertError.message}`);
      } else {
        console.log(`[check-warranty] Created warning log for asset ${asset.id} (${daysLeft} days left).`);
        results.created++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[check-warranty] Unexpected error for asset ${asset.id}:`, msg);
      results.errors.push(`Asset ${asset.id}: ${msg}`);
    }
  }

  console.log("[check-warranty] Complete:", results);
  return NextResponse.json(results);
}
