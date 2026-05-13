import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { AssetStatus } from "@/types/database.types";

type AssetRow = {
  id: string;
  serial_number: string;
  model_name: string;
  status: AssetStatus;
  purchase_date: string | null;
};

const statusVariantMap: Record<
  AssetStatus,
  "success" | "warning" | "destructive" | "secondary" | "outline"
> = {
  active:         "success",
  in_maintenance: "warning",
  retired:        "secondary",
  lost:           "destructive",
  disposed:       "outline",
};

export async function RecentAssetsTable() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assets } = (await (createClient() as any)
    .from("assets")
    .select("id, serial_number, model_name, status, purchase_date")
    .order("created_at", { ascending: false })
    .limit(5)) as { data: AssetRow[] | null };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Recent Assets</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/assets" className="gap-1 text-xs text-muted-foreground">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {assets && assets.length > 0 ? (
            assets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center justify-between px-6 py-3 hover:bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium">{asset.model_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.serial_number}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(asset.purchase_date)}
                  </span>
                  <Badge variant={statusVariantMap[asset.status]}>
                    {asset.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No assets found. Add your first asset to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
