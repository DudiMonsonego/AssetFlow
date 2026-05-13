/**
 * Asset Service (client-side)
 *
 * Provides typed, try/catch-wrapped functions for all asset CRUD operations.
 * Intended for use inside Client Components and React hooks.
 * For Server Components / Route Handlers, use assets.service.ts instead.
 *
 * RLS enforcement:
 *   Every query runs in the context of the authenticated user's session cookie.
 *   Supabase RLS (get_my_org_id()) automatically scopes all results and writes
 *   to the caller's organization — no manual org_id filtering is needed here.
 *
 * Error handling:
 *   All functions return { data, error } — they never throw.
 *   Errors are logged with a structured [asset-service] prefix.
 */
import { createClient } from "@/lib/supabase/client";
import type { Database, AssetStatus } from "@/types/database.types";

// ─── Local type aliases ────────────────────────────────────────────────────────

export type Asset = Database["public"]["Tables"]["assets"]["Row"];
type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];

// ─── Return-type helper ────────────────────────────────────────────────────────

export interface ServiceResult<T> {
  data: T | null;
  /** Human-readable error message, or null on success. */
  error: string | null;
}

// ─── getAssets ─────────────────────────────────────────────────────────────────

/**
 * Fetches all assets belonging to the authenticated user's organization.
 * Results are sorted alphabetically by model_name.
 *
 * RLS: get_my_org_id() on the assets table filters rows automatically.
 */
export async function getAssets(): Promise<ServiceResult<Asset[]>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    const { data, error } = (await supabase
      .from("assets")
      .select("*")
      .order("model_name", { ascending: true })) as {
      data: Asset[] | null;
      error: { message: string } | null;
    };

    if (error) {
      console.error("[asset-service] getAssets DB error:", error.message);
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred while fetching assets.";
    console.error("[asset-service] getAssets unexpected error:", err);
    return { data: null, error: message };
  }
}

// ─── createAsset ───────────────────────────────────────────────────────────────

/**
 * Inserts a new asset row for the caller's organization.
 *
 * The `organization_id` field must be included in `data` and must match the
 * caller's org (RLS WITH CHECK enforces this — an insert with a mismatched
 * org_id will fail with a policy violation error).
 *
 * @param data - Asset fields to persist. `id`, `created_at` etc. are optional
 *               because the database provides defaults.
 */
export async function createAsset(
  data: AssetInsert
): Promise<ServiceResult<Asset>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    const { data: created, error } = (await supabase
      .from("assets")
      .insert(data)
      .select()
      .single()) as {
      data: Asset | null;
      error: { message: string } | null;
    };

    if (error) {
      console.error("[asset-service] createAsset DB error:", error.message);
      return { data: null, error: error.message };
    }

    return { data: created, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred while creating the asset.";
    console.error("[asset-service] createAsset unexpected error:", err);
    return { data: null, error: message };
  }
}

// ─── updateAssetStatus ─────────────────────────────────────────────────────────

/**
 * Updates the lifecycle status of a single asset.
 *
 * Allowed status values (enforced at the application level):
 *   'active' | 'in_maintenance' | 'retired' | 'lost' | 'disposed'
 *
 * RLS UPDATE policy ensures the asset belongs to the caller's organization
 * before applying the change.
 *
 * @param id     - UUID of the asset to update.
 * @param status - New status value.
 *
 * @example
 *   const { data, error } = await updateAssetStatus(assetId, "in_maintenance");
 */
export async function updateAssetStatus(
  id: string,
  status: AssetStatus
): Promise<ServiceResult<Asset>> {
  try {
    if (!id?.trim()) {
      return { data: null, error: "Asset ID is required." };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    const { data: updated, error } = (await supabase
      .from("assets")
      .update({ status })
      .eq("id", id)
      .select()
      .single()) as {
      data: Asset | null;
      error: { message: string } | null;
    };

    if (error) {
      console.error(
        `[asset-service] updateAssetStatus DB error (id=${id}, status=${status}):`,
        error.message
      );
      return { data: null, error: error.message };
    }

    if (!updated) {
      // Row not found or RLS blocked the update.
      const message = `Asset not found or you do not have permission to update it (id=${id}).`;
      console.warn("[asset-service] updateAssetStatus:", message);
      return { data: null, error: message };
    }

    return { data: updated, error: null };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while updating the asset status.";
    console.error("[asset-service] updateAssetStatus unexpected error:", err);
    return { data: null, error: message };
  }
}

// ─── suggestAssetCategory ─────────────────────────────────────────────────────

/**
 * Calls POST /api/ai/suggest-category to classify an asset description.
 * Falls back silently to "Other" on any network or API error.
 *
 * Runs from the browser — the route handler takes care of the OpenAI call
 * so no API key is ever exposed to the client.
 *
 * @param description - Asset name or description to classify.
 * @returns One of: Computing | Mobile | Networking | Peripherals |
 *                  Office Equipment | Infrastructure | Other
 */
export async function suggestAssetCategory(
  description: string
): Promise<{ category: string; error: string | null }> {
  if (!description.trim()) {
    return { category: "Other", error: "Description is required for classification." };
  }

  try {
    const response = await fetch("/api/ai/suggest-category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      const message = body.error ?? `Server returned HTTP ${response.status}`;
      console.error("[asset-service] suggestAssetCategory error:", message);
      return { category: "Other", error: message };
    }

    const data = (await response.json()) as { category: string; source: string };
    console.log(`[asset-service] Category suggestion: "${data.category}" (source: ${data.source})`);
    return { category: data.category, error: null };

  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error during category suggestion.";
    console.error("[asset-service] suggestAssetCategory unexpected error:", err);
    return { category: "Other", error: message };
  }
}

// ─── deleteAsset ───────────────────────────────────────────────────────────────

/**
 * Permanently deletes an asset.
 * Cascades to all linked maintenance_logs (ON DELETE CASCADE in the schema).
 *
 * @param id - UUID of the asset to delete.
 */
export async function deleteAsset(id: string): Promise<ServiceResult<null>> {
  try {
    if (!id?.trim()) {
      return { data: null, error: "Asset ID is required." };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    const { error } = (await supabase
      .from("assets")
      .delete()
      .eq("id", id)) as { error: { message: string } | null };

    if (error) {
      console.error(`[asset-service] deleteAsset DB error (id=${id}):`, error.message);
      return { data: null, error: error.message };
    }

    return { data: null, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred while deleting the asset.";
    console.error("[asset-service] deleteAsset unexpected error:", err);
    return { data: null, error: message };
  }
}
