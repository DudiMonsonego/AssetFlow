/**
 * /dashboard/team
 *
 * Lists every profile in the current organization.
 * Owners can promote / demote other members via a role dropdown.
 * Data is fetched server-side; the role dropdown is a client component.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeamClient } from "./team-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Team — AssetFlow" };

export interface TeamMember {
  id:        string;
  full_name: string | null;
  role:      string;
  /** Supabase auth user ID — used to identify the current user's own row. */
  user_id:   string;
}

export default async function TeamPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the caller's own profile to know their role.
  const { data: myProfile } = (await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("user_id", user.id)
    .single()) as {
    data: { id: string; organization_id: string; role: string } | null;
  };

  if (!myProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-muted-foreground">Manage your organization members.</p>
        </div>
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Profile setup incomplete</AlertTitle>
          <AlertDescription>
            Your account exists in Supabase Auth but your profile and organization
            haven&apos;t been created yet. This usually means the SQL migrations
            were applied after your account was registered.
            <br /><br />
            <strong>Fix:</strong> Run the SQL below in your Supabase SQL Editor, then
            sign out and sign back in:
            <pre className="mt-2 rounded bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
{`-- Run this in Supabase → SQL Editor
-- 1. First find your user ID:
SELECT id, email FROM auth.users;

-- 2. Then create your org + profile.
--    Replace ALL three placeholder values below.
DO $$
DECLARE
  v_user_id uuid := 'PASTE-YOUR-USER-ID-HERE';
  v_org_id  uuid;
BEGIN
  INSERT INTO organizations (name)
  VALUES ('Your Company Name')
  RETURNING id INTO v_org_id;

  INSERT INTO profiles (user_id, organization_id, role, full_name)
  VALUES (v_user_id, v_org_id, 'owner', 'Your Full Name');

  RAISE NOTICE 'Done — org id: %', v_org_id;
END $$;`}
            </pre>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch all members of the same organization.
  const { data: members } = (await supabase
    .from("profiles")
    .select("id, full_name, role, user_id")
    .eq("organization_id", myProfile.organization_id)
    .order("role", { ascending: true })
    .order("full_name", { ascending: true })) as {
    data: TeamMember[] | null;
  };

  return (
    <TeamClient
      currentUserId={user.id}
      currentUserRole={myProfile.role}
      initialMembers={members ?? []}
    />
  );
}
