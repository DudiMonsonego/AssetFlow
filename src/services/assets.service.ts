/**
 * Assets Service
 * All database interactions for the `assets` table.
 * UI components must call these functions — never query Supabase directly.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database, AssetStatus } from "@/types/database.types";

export type Asset = Database["public"]["Tables"]["assets"]["Row"];
type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];
type AssetUpdate  = Database["public"]["Tables"]["assets"]["Update"];

export type AssetsFilter = {
  status?:   AssetStatus;
  search?:   string;
  page?:     number;
  pageSize?: number;
};

/**
 * Retrieves a paginated, optionally filtered list of assets.
 * RLS ensures only assets belonging to the caller's organization are returned.
 */
export async function getAssets(
  filters: AssetsFilter = {}
): Promise<{ data: Asset[]; count: number; error: string | null }> {
  const { status, search, page = 1, pageSize = 20 } = filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (createClient() as any)
    .from("assets")
    .select("*", { count: "exact" })
    .order("model_name", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);
  if (search) {
    query = query.or(
      `serial_number.ilike.%${search}%,model_name.ilike.%${search}%`
    );
  }

  const { data, count, error } = (await query) as {
    data: Asset[] | null;
    count: number | null;
    error: { message: string } | null;
  };

  return {
    data:  data ?? [],
    count: count ?? 0,
    error: error?.message ?? null,
  };
}

/**
 * Fetches a single asset by ID.
 */
export async function getAssetById(
  id: string
): Promise<{ data: Asset | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("assets")
    .select("*")
    .eq("id", id)
    .single()) as { data: Asset | null; error: { message: string } | null };

  return { data, error: error?.message ?? null };
}

/**
 * Creates a new asset within the caller's organization.
 */
export async function createAsset(
  payload: AssetInsert
): Promise<{ data: Asset | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("assets")
    .insert(payload)
    .select()
    .single()) as { data: Asset | null; error: { message: string } | null };

  return { data, error: error?.message ?? null };
}

/**
 * Updates an existing asset by ID.
 */
export async function updateAsset(
  id: string,
  payload: AssetUpdate
): Promise<{ data: Asset | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("assets")
    .update(payload)
    .eq("id", id)
    .select()
    .single()) as { data: Asset | null; error: { message: string } | null };

  return { data, error: error?.message ?? null };
}

/**
 * Permanently deletes an asset by ID.
 * Cascades to its maintenance_logs automatically (ON DELETE CASCADE).
 */
export async function deleteAsset(
  id: string
): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = (await (createClient() as any)
    .from("assets")
    .delete()
    .eq("id", id)) as { error: { message: string } | null };

  return { error: error?.message ?? null };
}

/**
 * Returns a count of assets grouped by status — used by dashboard KPI cards.
 */
export async function getAssetStatusCounts(): Promise<
  Record<AssetStatus, number>
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (await (createClient() as any)
    .from("assets")
    .select("status")) as { data: { status: string }[] | null };

  const counts: Record<string, number> = {
    active: 0, in_maintenance: 0, retired: 0, lost: 0, disposed: 0,
  };

  data?.forEach(({ status }) => {
    counts[status] = (counts[status] ?? 0) + 1;
  });

  return counts as Record<AssetStatus, number>;
}
