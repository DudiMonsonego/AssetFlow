"use client";

/**
 * OrgClient — interactive organization management page.
 * Displays org details and allows owners/admins to rename the organization.
 */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Package,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Shield,
  Hash,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  organization: {
    id:         string;
    name:       string;
    plan:       string | null;
    created_at: string;
  } | null;
  profile: {
    full_name:       string | null;
    role:            string;
    organization_id: string;
  };
  memberCount: number;
  assetCount:  number;
}

const PLAN_BADGE: Record<string, "default" | "secondary" | "warning" | "success"> = {
  free:       "secondary",
  starter:    "default",
  pro:        "warning",
  enterprise: "success",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function OrgClient({ organization, profile, memberCount, assetCount }: Props) {
  const [orgName, setOrgName]       = useState(organization?.name ?? "");
  const [saving, setSaving]         = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  const canEdit = profile.role === "owner" || profile.role === "admin";
  const plan    = organization?.plan ?? "free";

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgName.trim() || orgName.trim() === organization?.name) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const session = (await createClient().auth.getSession()).data.session;
      if (!session) {
        setSaveError("Your session has expired. Please sign in again.");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/org/update", {
        method:  "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: orgName.trim() }),
      });

      const body = await res.json() as { name?: string; error?: string };

      if (!res.ok) {
        setSaveError(body.error ?? "Failed to update organization name.");
      } else {
        setOrgName(body.name ?? orgName);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">

      {/* Page heading */}
      <div className="flex items-center gap-3">
        <Building2 className="h-7 w-7 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organization</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your organization details and subscription.
          </p>
        </div>
      </div>

      {/* ── Quick stats row ────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Users,    label: "Members",      value: memberCount },
          { icon: Package,  label: "Active Assets", value: assetCount  },
          {
            icon:  Shield,
            label: "Your Role",
            value: profile.role.charAt(0).toUpperCase() + profile.role.slice(1),
          },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-lg border bg-card p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Organization details card ─────────────────────────────────── */}
        <section className="rounded-lg border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Details</h2>
            </div>
            <Badge variant={PLAN_BADGE[plan] ?? "secondary"} className="capitalize">
              {plan} plan
            </Badge>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                <Hash className="h-3.5 w-3.5" /> Organization ID
              </dt>
              <dd
                className="font-mono text-xs text-muted-foreground truncate max-w-[180px]"
                title={organization?.id}
              >
                {organization?.id ?? "—"}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Created
              </dt>
              <dd className="font-medium">
                {organization?.created_at ? formatDate(organization.created_at) : "—"}
              </dd>
            </div>
          </dl>

          {/* Rename form */}
          <form onSubmit={handleSave} className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => { setOrgName(e.target.value); setSaveSuccess(false); }}
                placeholder="Acme Corp"
                disabled={!canEdit || saving}
                maxLength={100}
              />
              {!canEdit && (
                <p className="text-xs text-muted-foreground">
                  Only owners and admins can rename the organization.
                </p>
              )}
            </div>

            {saveError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}

            {saveSuccess && (
              <Alert variant="default" className="border-green-500/50 bg-green-50 text-green-900 [&>svg]:text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>Organization name saved.</AlertDescription>
              </Alert>
            )}

            {canEdit && (
              <Button
                type="submit"
                disabled={saving || !orgName.trim() || orgName.trim() === organization?.name}
                className="w-full"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving…" : "Save Name"}
              </Button>
            )}
          </form>
        </section>

        {/* ── Subscription / billing card ───────────────────────────────── */}
        <section className="rounded-lg border bg-card p-6 space-y-5">
          <div className="flex items-center gap-2 border-b pb-4">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Subscription</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
              <div>
                <p className="text-sm font-medium capitalize">{plan} Plan</p>
                <p className="text-xs text-muted-foreground">Current subscription tier</p>
              </div>
              <Badge variant={PLAN_BADGE[plan] ?? "secondary"} className="capitalize text-sm px-3 py-1">
                {plan}
              </Badge>
            </div>

            {/* Plan feature list */}
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Unlimited assets",
                "Maintenance logging",
                "AI-powered classification",
                "Webhook integrations",
                "Warranty expiry alerts",
                "Team member management",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Billing and plan upgrades are managed through your Supabase
            project. Contact your administrator to change subscription tiers.
          </div>
        </section>
      </div>
    </div>
  );
}
