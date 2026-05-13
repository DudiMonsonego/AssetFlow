"use client";

/**
 * SettingsClient — full interactive Settings page.
 *
 * Two independent edit forms:
 *   • Organization — rename the org (owners / admins only)
 *   • Account      — update the user's own display name
 */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Settings,
  User,
  Calendar,
  Shield,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  userEmail: string | null;
  profile: {
    full_name:       string | null;
    role:            string;
    organization_id: string;
  } | null;
  organization: {
    id:         string;
    name:       string;
    plan:       string | null;
    created_at: string;
  } | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner:      "Owner",
  admin:      "Admin",
  technician: "Technician",
  member:     "Member",
  viewer:     "Viewer",
};

// ─── Shared helper ────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const session = (await createClient().auth.getSession()).data.session;
  return session?.access_token ?? null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsClient({ userEmail, profile, organization }: Props) {

  // Org name form state
  const [orgName, setOrgName]           = useState(organization?.name ?? "");
  const [savingOrg, setSavingOrg]       = useState(false);
  const [orgSuccess, setOrgSuccess]     = useState(false);
  const [orgError, setOrgError]         = useState<string | null>(null);

  // Profile display-name form state
  const [fullName, setFullName]             = useState(profile?.full_name ?? "");
  const [savingProfile, setSavingProfile]   = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError]     = useState<string | null>(null);

  const canEditOrg = profile?.role === "owner" || profile?.role === "admin";

  // ── Save org name ─────────────────────────────────────────────────────────

  async function handleSaveOrg(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgName.trim()) return;

    setSavingOrg(true);
    setOrgError(null);
    setOrgSuccess(false);

    const token = await getAccessToken();
    if (!token) {
      setOrgError("Your session has expired. Please sign in again.");
      setSavingOrg(false);
      return;
    }

    try {
      const res = await fetch("/api/org/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ name: orgName.trim() }),
      });

      const body = await res.json() as { name?: string; error?: string };

      if (!res.ok) {
        setOrgError(body.error ?? "Failed to update organization name.");
      } else {
        setOrgName(body.name ?? orgName);
        setOrgSuccess(true);
        setTimeout(() => setOrgSuccess(false), 3000);
      }
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSavingOrg(false);
    }
  }

  // ── Save display name ─────────────────────────────────────────────────────

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    const token = await getAccessToken();
    if (!token) {
      setProfileError("Your session has expired. Please sign in again.");
      setSavingProfile(false);
      return;
    }

    try {
      const res = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ full_name: fullName.trim() }),
      });

      const body = await res.json() as { full_name?: string | null; error?: string };

      if (!res.ok) {
        setProfileError(body.error ?? "Failed to update profile.");
      } else {
        setFullName(body.full_name ?? "");
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* Page heading */}
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your account and organization preferences.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Organization card ─────────────────────────────────────────────── */}
        <section className="rounded-lg border bg-card p-6 space-y-5">
          <div className="flex items-center gap-2 border-b pb-4">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Organization</h2>
          </div>

          {/* Read-only org info */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Organization ID</span>
              <span className="font-mono text-xs text-muted-foreground truncate max-w-[180px]" title={organization?.id}>
                {organization?.id ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="capitalize font-medium">{organization?.plan ?? "Free"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Created
              </span>
              <span>{organization?.created_at ? formatDate(organization.created_at) : "—"}</span>
            </div>
          </div>

          {/* Editable org name */}
          <form onSubmit={handleSaveOrg} className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => { setOrgName(e.target.value); setOrgSuccess(false); }}
                placeholder="Acme Corp"
                disabled={!canEditOrg || savingOrg}
                maxLength={100}
              />
              {!canEditOrg && (
                <p className="text-xs text-muted-foreground">
                  Only owners and admins can rename the organization.
                </p>
              )}
            </div>

            {orgError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{orgError}</AlertDescription>
              </Alert>
            )}

            {orgSuccess && (
              <Alert variant="default" className="border-green-500/50 bg-green-50 text-green-900 [&>svg]:text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>Organization name saved.</AlertDescription>
              </Alert>
            )}

            {canEditOrg && (
              <Button
                type="submit"
                disabled={savingOrg || !orgName.trim() || orgName.trim() === organization?.name}
                className="w-full"
              >
                {savingOrg && <Loader2 className="h-4 w-4 animate-spin" />}
                {savingOrg ? "Saving…" : "Save Organization Name"}
              </Button>
            )}
          </form>
        </section>

        {/* ── Account / Profile card ───────────────────────────────────────── */}
        <section className="rounded-lg border bg-card p-6 space-y-5">
          <div className="flex items-center gap-2 border-b pb-4">
            <User className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Account</h2>
          </div>

          {/* Read-only fields */}
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</p>
              <p className="font-medium">{userEmail ?? "—"}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</p>
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">
                  {profile?.role ? (ROLE_LABELS[profile.role] ?? profile.role) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Editable display name */}
          <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Display Name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setProfileSuccess(false); }}
                placeholder="Your full name"
                disabled={savingProfile}
                maxLength={120}
              />
              <p className="text-xs text-muted-foreground">
                This name is shown to other team members.
              </p>
            </div>

            {profileError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            )}

            {profileSuccess && (
              <Alert variant="default" className="border-green-500/50 bg-green-50 text-green-900 [&>svg]:text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>Display name saved.</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={savingProfile || fullName.trim() === (profile?.full_name ?? "")}
              className="w-full"
            >
              {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
              {savingProfile ? "Saving…" : "Save Display Name"}
            </Button>
          </form>

          {/* Security note */}
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Password and two-factor authentication are managed in your
            Supabase project dashboard under Authentication → Users.
          </div>
        </section>
      </div>
    </div>
  );
}
