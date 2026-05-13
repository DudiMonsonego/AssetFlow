/**
 * /dashboard/organization
 *
 * Shows organization details and lets owners/admins update the org name.
 * Data is fetched server-side; the edit form is a client component.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgClient } from "./org-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Organization — AssetFlow" };

export default async function OrganizationPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Current user's profile
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
        <h1 className="text-3xl font-bold tracking-tight">Organization</h1>
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Profile setup incomplete</AlertTitle>
          <AlertDescription>
            Your organization profile hasn&apos;t been created yet. Please
            visit the <strong>Team</strong> page for setup instructions.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Organization details
  const { data: org } = (await supabase
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
  };

  // Member count
  const { count: memberCount } = (await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", profile.organization_id)) as { count: number | null };

  // Asset count
  const { count: assetCount } = (await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .not("status", "in", '("retired","disposed")')) as { count: number | null };

  return (
    <OrgClient
      organization={org}
      profile={profile}
      memberCount={memberCount ?? 0}
      assetCount={assetCount ?? 0}
    />
  );
}
