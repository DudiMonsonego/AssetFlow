"use client";

/**
 * AssetsClient — interactive asset management UI.
 *
 * Features:
 *   • Data table with status badges, loading skeletons, empty state
 *   • "Add Asset" dialog with AI category suggestion
 *   • Per-row status update dropdown + webhook trigger on "In Maintenance"
 *   • Per-row delete with confirmation dialog
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getAssets,
  createAsset,
  updateAssetStatus,
  deleteAsset,
  suggestAssetCategory,
} from "@/services/asset-service";
import type { Asset, AssetStatus } from "@/types/database.types";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import {
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

// ─── Status helpers ────────────────────────────────────────────────────────────

type BadgeVariant = "success" | "warning" | "secondary" | "destructive" | "outline";

const STATUS_CONFIG: Record<AssetStatus, { label: string; badge: BadgeVariant }> = {
  active:         { label: "Active",         badge: "success"     },
  in_maintenance: { label: "In Maintenance", badge: "warning"     },
  retired:        { label: "Retired",        badge: "secondary"   },
  lost:           { label: "Lost",           badge: "destructive" },
  disposed:       { label: "Disposed",       badge: "outline"     },
};

const ALL_STATUSES: AssetStatus[] = [
  "active",
  "in_maintenance",
  "retired",
  "lost",
  "disposed",
];

// ─── Form state ────────────────────────────────────────────────────────────────

interface AssetForm {
  model_name:      string;
  serial_number:   string;
  status:          AssetStatus;
  purchase_date:   string;
  warranty_expiry: string;
}

const EMPTY_FORM: AssetForm = {
  model_name:      "",
  serial_number:   "",
  status:          "active",
  purchase_date:   "",
  warranty_expiry: "",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface AssetsClientProps {
  /** Assets pre-fetched on the server — skips the initial client-side fetch. */
  initialAssets?: Asset[];
  /** org_id pre-fetched on the server. */
  initialOrgId?:  string | null;
  /** Error message if the server-side pre-fetch failed. */
  initialError?:  string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssetsClient({
  initialAssets,
  initialOrgId  = null,
  initialError  = null,
}: AssetsClientProps = {}) {
  const [assets, setAssets]       = useState<Asset[]>(initialAssets ?? []);
  const [orgId, setOrgId]         = useState<string | null>(initialOrgId);
  // If the server passed initial data we start with loading=false.
  const [loading, setLoading]     = useState(!initialAssets);
  const [pageError, setPageError] = useState<string | null>(initialError);

  // "Add Asset" dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]             = useState<AssetForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  // AI suggestion
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [suggesting, setSuggesting]               = useState(false);

  // Per-row in-flight tracking
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    const [assetsResult, orgIdResult] = await Promise.all([
      getAssets(),
      supabase.rpc("get_my_org_id") as Promise<{
        data: string | null;
        error: { message: string } | null;
      }>,
    ]);

    if (assetsResult.error) {
      setPageError(assetsResult.error);
    } else {
      setAssets(assetsResult.data ?? []);
    }

    if (orgIdResult.error) {
      console.error("[AssetsClient] Could not fetch org id:", orgIdResult.error.message);
      setPageError(
        "Could not load your organization. Make sure the SQL migrations have been applied " +
        "in Supabase and that your profile exists in the profiles table."
      );
    } else if (!orgIdResult.data) {
      setPageError(
        "Your organization profile is not set up yet. " +
        "Please visit the Team page for instructions."
      );
    } else {
      setOrgId(orgIdResult.data);
    }

    setLoading(false);
  }, []);

  // Only run the client-side fetch on mount when no server data was provided.
  // When initialAssets is set (SSR path), skip the fetch entirely.
  useEffect(() => {
    if (!initialAssets) { loadData(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Add dialog helpers ────────────────────────────────────────────────────

  function openAddDialog() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setSuggestedCategory(null);
    setDialogOpen(true);
  }

  function setField<K extends keyof AssetForm>(key: K, value: AssetForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "model_name") setSuggestedCategory(null);
  }

  // ── AI suggestion ─────────────────────────────────────────────────────────

  async function handleAISuggest() {
    if (!form.model_name.trim()) {
      setFormError("Enter a model name first so the AI has something to classify.");
      return;
    }
    setSuggesting(true);
    setSuggestedCategory(null);
    setFormError(null);
    const { category, error } = await suggestAssetCategory(form.model_name);
    setSuggesting(false);
    if (error) {
      setFormError(`AI suggestion failed: ${error}`);
    } else {
      setSuggestedCategory(category);
    }
  }

  // ── Create asset ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) {
      setFormError("Could not determine your organization. Please refresh and try again.");
      return;
    }
    setSubmitting(true);
    setFormError(null);

    const { error } = await createAsset({
      model_name:      form.model_name.trim(),
      serial_number:   form.serial_number.trim(),
      status:          form.status,
      organization_id: orgId,
      purchase_date:   form.purchase_date   || null,
      warranty_expiry: form.warranty_expiry || null,
    });

    setSubmitting(false);
    if (error) { setFormError(error); return; }
    setDialogOpen(false);
    loadData();
  }

  // ── Status change + webhook ───────────────────────────────────────────────

  async function handleStatusChange(asset: Asset, newStatus: AssetStatus) {
    setUpdatingId(asset.id);
    const { data: updated } = await updateAssetStatus(asset.id, newStatus);

    if (newStatus === "in_maintenance" && updated) {
      try {
        const session = (await createClient().auth.getSession()).data.session;
        if (session) {
          fetch("/api/webhooks/notify-repair", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              assetId:      updated.id,
              assetName:    updated.model_name,
              serialNumber: updated.serial_number,
            }),
          }).catch((err) =>
            console.error("[AssetsClient] Webhook delivery failed:", err)
          );
        }
      } catch (err) {
        console.error("[AssetsClient] Could not fire webhook:", err);
      }
    }

    setUpdatingId(null);
    loadData();
  }

  // ── Delete asset ──────────────────────────────────────────────────────────

  function openDeleteDialog(asset: Asset) {
    setDeleteTarget(asset);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    const { error } = await deleteAsset(deleteTarget.id);

    setDeleting(false);
    if (error) {
      setDeleteError(error);
      return;
    }
    setDeleteTarget(null);
    loadData();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and track all hardware assets across your organization.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={loadData}
            disabled={loading}
            title="Refresh table"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
          <Button onClick={openAddDialog} className="gap-2" disabled={loading || !orgId}>
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Page-level error */}
      {pageError && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {pageError}
        </div>
      )}

      {/* Asset table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model Name</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead>Warranty Expiry</TableHead>
              <TableHead className="w-[52px]" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="rounded-full bg-muted p-4">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">No assets yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click &quot;Add Asset&quot; to track your first piece of hardware.
                      </p>
                    </div>
                    <Button size="sm" onClick={openAddDialog} className="mt-1 gap-2">
                      <Plus className="h-3.5 w-3.5" />
                      Add your first asset
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => {
                const statusCfg  = STATUS_CONFIG[asset.status as AssetStatus] ?? {
                  label: asset.status,
                  badge: "outline" as BadgeVariant,
                };
                const isUpdating = updatingId === asset.id;

                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.model_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {asset.serial_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {asset.purchase_date ? formatDate(asset.purchase_date) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {asset.warranty_expiry ? formatDate(asset.warranty_expiry) : "—"}
                    </TableCell>

                    {/* Row actions */}
                    <TableCell>
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Actions for ${asset.model_name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs">Update Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {ALL_STATUSES.filter((s) => s !== asset.status).map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => handleStatusChange(asset, s)}
                              >
                                <Badge
                                  variant={STATUS_CONFIG[s].badge}
                                  className="mr-2 text-[10px]"
                                >
                                  {STATUS_CONFIG[s].label}
                                </Badge>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => openDeleteDialog(asset)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete asset
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {!loading && assets.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {assets.length} asset{assets.length !== 1 ? "s" : ""} total
          </div>
        )}
      </div>

      {/* ── Add Asset dialog ─────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>
              Register a new hardware asset. Fields marked * are required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Model Name + AI Suggest */}
            <div className="space-y-1.5">
              <Label htmlFor="add-model-name">Model Name *</Label>
              <div className="flex gap-2">
                <Input
                  id="add-model-name"
                  required
                  placeholder="e.g. Dell Latitude 5540"
                  value={form.model_name}
                  onChange={(e) => setField("model_name", e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 px-3"
                  onClick={handleAISuggest}
                  disabled={suggesting || !form.model_name.trim()}
                  title="Let AI suggest a category"
                >
                  {suggesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {suggesting ? "Thinking…" : "AI Suggest"}
                </Button>
              </div>
              {suggestedCategory && (
                <div className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                  <Tag className="h-3 w-3 text-primary" />
                  <span>AI classified as</span>
                  <Badge variant="default" className="h-4 px-1.5 text-[10px]">
                    {suggestedCategory}
                  </Badge>
                  <span className="italic">(informational — not stored)</span>
                </div>
              )}
            </div>

            {/* Serial Number */}
            <div className="space-y-1.5">
              <Label htmlFor="add-serial">Serial Number *</Label>
              <Input
                id="add-serial"
                required
                placeholder="e.g. SN-2024-0012"
                value={form.serial_number}
                onChange={(e) => setField("serial_number", e.target.value)}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="add-status">Status</Label>
              <select
                id="add-status"
                value={form.status}
                onChange={(e) => setField("status", e.target.value as AssetStatus)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="add-purchase-date">Purchase Date</Label>
                <Input
                  id="add-purchase-date"
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setField("purchase_date", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-warranty-expiry">Warranty Expiry</Label>
                <Input
                  id="add-warranty-expiry"
                  type="date"
                  value={form.warranty_expiry}
                  onChange={(e) => setField("warranty_expiry", e.target.value)}
                />
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {formError}
              </div>
            )}

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={submitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Saving…" : "Save Asset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ───────────────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.model_name}
              </span>{" "}
              (SN: {deleteTarget?.serial_number}) and all its maintenance logs.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {deleteError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleConfirmDelete}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
