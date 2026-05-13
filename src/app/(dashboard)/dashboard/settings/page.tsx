/**
 * /dashboard/settings
 *
 * Displays the current organization details and allows the owner / admin to
 * rename the organization. Profile info (name, role) is shown read-only.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings — AssetFlow" };

export default async function SettingsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = (await supabase
    .from("profiles")
    .select("full_name, role, organization_id")
    .eq("user_id", user.id)
    .single()) as {
    data: {
      full_name:       string | null;
      role:            string;
      organization_id: string;
    } | null;
  };

  if (!profile) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Profile setup incomplete</AlertTitle>
          <AlertDescription>
            Your organization profile hasn&apos;t been created yet. Please see the
            <strong> Team</strong> page for instructions on how to fix this.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { data: org } = profile
    ? ((await supabase
        .from("organizations")
        .select("id, name, plan, created_at")
        .eq("id", profile.organization_id)
        .single()) as {
        data: {
          id:         string;
          name:       string;
          plan:       string | null;
          created_at: string;
        } | null;
      })
    : { data: null };

  return (
    <SettingsClient
      userEmail={user.email ?? null}
      profile={profile}
      organization={org}
    />
  );
}
