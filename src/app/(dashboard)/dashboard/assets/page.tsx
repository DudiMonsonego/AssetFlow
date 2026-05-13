import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AssetsClient } from "./assets-client";
import type { Asset } from "@/services/asset-service";

export const metadata: Metadata = {
  title: "Assets — AssetFlow",
  description: "Manage and track all hardware assets in your organization.",
};

/**
 * /dashboard/assets
 *
 * Pre-fetches assets + org_id on the server so AssetsClient can render
 * immediately without a client-side loading spinner.
 */
export default async function AssetsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  // Both queries run in parallel — zero sequential waterfall.
  const [assetsRes, orgRes] = await Promise.all([
    supabase
      .from("assets")
      .select("*")
      .order("model_name", { ascending: true }) as Promise<{
      data: Asset[] | null;
      error: { message: string } | null;
    }>,
    supabase.rpc("get_my_org_id") as Promise<{
      data: string | null;
      error: { message: string } | null;
    }>,
  ]);

  return (
    <AssetsClient
      initialAssets={assetsRes.data ?? []}
      initialOrgId={orgRes.data ?? null}
      initialError={assetsRes.error?.message ?? orgRes.error?.message ?? null}
    />
  );
}
