/**
 * Maintenance Service
 * All database interactions for the `maintenance_logs` table.
 * UI components must call these functions — never query Supabase directly.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database, MaintenanceLogWithAsset } from "@/types/database.types";

export type MaintenanceLog = Database["public"]["Tables"]["maintenance_logs"]["Row"];
type MaintenanceLogInsert = Database["public"]["Tables"]["maintenance_logs"]["Insert"];
type MaintenanceLogUpdate = Database["public"]["Tables"]["maintenance_logs"]["Update"];

export type MaintenanceFilter = {
  assetId?:  string;
  page?:     number;
  pageSize?: number;
};

/**
 * Retrieves maintenance logs, optionally scoped to a specific asset.
 * Results are sorted newest-first by service_date.
 */
export async function getMaintenanceLogs(
  filters: MaintenanceFilter = {}
): Promise<{ data: MaintenanceLogWithAsset[]; count: number; error: string | null }> {
  const { assetId, page = 1, pageSize = 20 } = filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (createClient() as any)
    .from("maintenance_logs")
    .select("*, asset:assets(id, serial_number, model_name)", { count: "exact" })
    .order("service_date", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (assetId) query = query.eq("asset_id", assetId);

  const { data, count, error } = (await query) as {
    data: MaintenanceLogWithAsset[] | null;
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
 * Fetches a single maintenance log by ID with its parent asset details.
 */
export async function getMaintenanceLogById(
  id: string
): Promise<{ data: MaintenanceLogWithAsset | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("maintenance_logs")
    .select("*, asset:assets(id, serial_number, model_name)")
    .eq("id", id)
    .single()) as {
    data: MaintenanceLogWithAsset | null;
    error: { message: string } | null;
  };

  return { data, error: error?.message ?? null };
}

/**
 * Logs a new maintenance event for an asset.
 * `service_date` defaults to NOW() on the server when omitted.
 */
export async function createMaintenanceLog(
  payload: MaintenanceLogInsert
): Promise<{ data: MaintenanceLog | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("maintenance_logs")
    .insert(payload)
    .select()
    .single()) as { data: MaintenanceLog | null; error: { message: string } | null };

  return { data, error: error?.message ?? null };
}

/**
 * Updates an existing maintenance log entry.
 */
export async function updateMaintenanceLog(
  id: string,
  payload: MaintenanceLogUpdate
): Promise<{ data: MaintenanceLog | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("maintenance_logs")
    .update(payload)
    .eq("id", id)
    .select()
    .single()) as { data: MaintenanceLog | null; error: { message: string } | null };

  return { data, error: error?.message ?? null };
}

/**
 * Permanently deletes a maintenance log entry.
 */
export async function deleteMaintenanceLog(
  id: string
): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = (await (createClient() as any)
    .from("maintenance_logs")
    .delete()
    .eq("id", id)) as { error: { message: string } | null };

  return { error: error?.message ?? null };
}

/**
 * Returns the N most recent maintenance events across all assets in the org.
 * Used by the dashboard "Recent Maintenance" card.
 */
export async function getRecentMaintenance(
  limit = 5
): Promise<{ data: MaintenanceLogWithAsset[]; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("maintenance_logs")
    .select("*, asset:assets(id, serial_number, model_name)")
    .order("service_date", { ascending: false })
    .limit(limit)) as {
    data: MaintenanceLogWithAsset[] | null;
    error: { message: string } | null;
  };

  return {
    data:  data ?? [],
    error: error?.message ?? null,
  };
}
