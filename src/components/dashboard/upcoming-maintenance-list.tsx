import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type LogRow = {
  id: string;
  service_date: string;
  description: string;
  asset: { model_name: string; serial_number: string } | null;
};

/**
 * Shows the 5 most recent maintenance events across all assets in the org.
 * Note: the v2 schema removed `next_service_date` and `technician_name`.
 * For scheduled maintenance, add those columns back in a future migration.
 */
export async function UpcomingMaintenanceList() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logs } = (await (createClient() as any)
    .from("maintenance_logs")
    .select("id, service_date, description, asset:assets(model_name, serial_number)")
    .order("service_date", { ascending: false })
    .limit(5)) as { data: LogRow[] | null };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          Recent Maintenance
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link
            href="/dashboard/maintenance"
            className="gap-1 text-xs text-muted-foreground"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {logs && logs.length > 0 ? (
            logs.map((log) => {
              const asset = Array.isArray(log.asset) ? log.asset[0] : log.asset;
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-4 px-6 py-3 hover:bg-muted/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {asset?.model_name ?? "Unknown Asset"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {asset?.serial_number} — {log.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(log.service_date)}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No maintenance events logged yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
