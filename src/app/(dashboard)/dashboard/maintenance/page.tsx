/**
 * /dashboard/maintenance
 *
 * Shows all assets whose warranty will expire within the next 30 days,
 * sorted by urgency (soonest first). Data is fetched server-side and is
 * automatically scoped to the current user's organization via RLS.
 */
import { ShieldCheck, ShieldAlert, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintenance — AssetFlow",
  description: "Upcoming warranty expirations across your hardware fleet.",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpiringAsset {
  id:              string;
  model_name:      string;
  serial_number:   string;
  status:          string;
  warranty_expiry: string;
  daysLeft:        number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcDaysLeft(warrantyExpiry: string): number {
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(warrantyExpiry);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyBadge(daysLeft: number) {
  if (daysLeft < 0)   return { label: "Expired",         variant: "destructive" as const };
  if (daysLeft <= 7)  return { label: "Critical",        variant: "destructive" as const };
  if (daysLeft <= 14) return { label: "Urgent",          variant: "warning"     as const };
  return               { label: `${daysLeft}d left`,     variant: "secondary"   as const };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MaintenancePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const today        = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr     = today.toISOString().split("T")[0];

  // Include warranties that expire up to 30 days from now AND already-expired
  // ones (daysLeft < 0) so nothing falls through the cracks.
  const in30Days     = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: rows, error } = (await supabase
    .from("assets")
    .select("id, model_name, serial_number, status, warranty_expiry")
    .not("warranty_expiry", "is", null)
    .lte("warranty_expiry", in30Days)
    .not("status", "in", '("retired","disposed")')
    .order("warranty_expiry", { ascending: true })) as {
    data:
      | Array<{
          id: string;
          model_name: string;
          serial_number: string;
          status: string;
          warranty_expiry: string;
        }>
      | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("[MaintenancePage] Query error:", error.message);
  }

  const assets: ExpiringAsset[] = (rows ?? []).map((r) => ({
    ...r,
    daysLeft: calcDaysLeft(r.warranty_expiry),
  }));

  const critical = assets.filter((a) => a.daysLeft <= 7).length;
  const expired  = assets.filter((a) => a.daysLeft < 0).length;

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assets with warranties expiring within the next 30 days.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          <span>As of {new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date())}</span>
        </div>
      </div>

      {/* ── Summary alerts ───────────────────────────────────────────────────── */}
      {expired > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>
            {expired} warranty{expired !== 1 ? " warranties" : ""} already expired
          </AlertTitle>
          <AlertDescription>
            These assets are out of coverage. Consider renewing or replacing them.
          </AlertDescription>
        </Alert>
      )}

      {critical > 0 && expired === 0 && (
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>
            {critical} asset{critical !== 1 ? "s expire" : " expires"} within 7 days
          </AlertTitle>
          <AlertDescription>
            Run the warranty check cron or manually log a maintenance record for each.
          </AlertDescription>
        </Alert>
      )}

      {assets.length === 0 && (
        <Alert variant="default">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>All warranties look healthy</AlertTitle>
          <AlertDescription>
            No active assets have warranties expiring in the next 30 days.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Expiration table ─────────────────────────────────────────────────── */}
      {assets.length > 0 && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model Name</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead>Warranty Expiry</TableHead>
                <TableHead>Urgency</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {assets.map((asset) => {
                const { label, variant } = urgencyBadge(asset.daysLeft);
                const isExpired          = asset.daysLeft < 0;

                return (
                  <TableRow
                    key={asset.id}
                    className={isExpired ? "bg-destructive/5" : undefined}
                  >
                    <TableCell className="font-medium">{asset.model_name}</TableCell>

                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {asset.serial_number}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {asset.status.replace("_", " ")}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-sm">
                      {formatDate(asset.warranty_expiry)}
                    </TableCell>

                    <TableCell>
                      <Badge variant={variant}>{label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {assets.length} asset{assets.length !== 1 ? "s" : ""} shown •{" "}
            Retired and disposed assets are excluded
          </div>
        </div>
      )}

      {/* ── Cron tip ─────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Automate warranty warnings</p>
        <p className="mt-1">
          Schedule a daily call to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            POST /api/cron/check-warranty
          </code>{" "}
          with your{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">CRON_SECRET</code> to
          automatically create maintenance log entries for expiring warranties.
        </p>
      </div>
    </div>
  );
}
