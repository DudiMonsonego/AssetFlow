import { Suspense } from "react";
import { Package, Wrench, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentAssetsTable } from "@/components/dashboard/recent-assets-table";
import { UpcomingMaintenanceList } from "@/components/dashboard/upcoming-maintenance-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard — AssetFlow" };

async function getDashboardStats() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const [assetsResult, inMaintenanceResult, warrantyResult] = await Promise.all([
    supabase.from("assets").select("id, status") as Promise<{
      data: { id: string; status: string }[] | null;
    }>,
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_maintenance") as Promise<{ count: number | null }>,
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .lt("warranty_expiry", thirtyDaysFromNow)
      .gt("warranty_expiry", today) as Promise<{ count: number | null }>,
  ]);

  const allAssets             = assetsResult.data ?? [];
  const totalAssets           = allAssets.length;
  const activeAssets          = allAssets.filter((a) => a.status === "active").length;
  const inMaintenance         = inMaintenanceResult.count ?? 0;
  const warrantiesExpiringSoon = warrantyResult.count ?? 0;

  // Attention score: assets that need action right now.
  const attentionCount = inMaintenance + warrantiesExpiringSoon;

  return { totalAssets, activeAssets, inMaintenance, warrantiesExpiringSoon, attentionCount };
}

export default async function DashboardPage() {
  const {
    totalAssets,
    activeAssets,
    inMaintenance,
    warrantiesExpiringSoon,
    attentionCount,
  } = await getDashboardStats();

  return (
    <div className="space-y-8">

      {/* ── Page heading ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Overview of your hardware asset lifecycle.
        </p>
      </div>

      {/* ── Attention alert — shown when > 3 assets need immediate action ─────── */}
      {attentionCount > 3 && (
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Immediate Attention Required</AlertTitle>
          <AlertDescription>
            <strong>{attentionCount} assets</strong> need action right now —{" "}
            {inMaintenance > 0 && (
              <>
                <strong>{inMaintenance}</strong> currently in maintenance
                {warrantiesExpiringSoon > 0 ? " and " : ""}
              </>
            )}
            {warrantiesExpiringSoon > 0 && (
              <>
                <strong>{warrantiesExpiringSoon}</strong> with warranties expiring within
                30&nbsp;days
              </>
            )}
            . Visit the{" "}
            <a href="/dashboard/maintenance" className="font-semibold underline underline-offset-4">
              Maintenance
            </a>{" "}
            page for details.
          </AlertDescription>
        </Alert>
      )}

      {/* ── KPI stat cards ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Assets"
          value={totalAssets}
          description="All tracked hardware"
          icon={Package}
          variant="default"
        />
        <StatsCard
          title="Active Assets"
          value={activeAssets}
          description="Deployed and in use"
          icon={CheckCircle2}
          variant="success"
        />
        <StatsCard
          title="In Maintenance"
          value={inMaintenance}
          description="Currently being serviced"
          icon={Wrench}
          variant="warning"
        />
        <StatsCard
          title="Warranties Expiring"
          value={warrantiesExpiringSoon}
          description="Within the next 30 days"
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      {/* ── Activity panels ───────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<TableSkeleton />}>
          <RecentAssetsTable />
        </Suspense>
        <Suspense fallback={<TableSkeleton />}>
          <UpcomingMaintenanceList />
        </Suspense>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
