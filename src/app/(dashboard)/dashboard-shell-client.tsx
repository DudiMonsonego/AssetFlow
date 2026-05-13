"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/services/auth-service";
import { Header } from "@/components/dashboard/header";
import type { Profile } from "@/types/database.types";

interface DashboardShellClientProps {
  profile: Pick<Profile, "full_name" | "role"> | null;
  organizationName: string | null;
  children: React.ReactNode;
}

/**
 * Client boundary for the dashboard shell.
 * Handles sign-out (requires a browser client) while everything else
 * is rendered server-side in the parent layout.
 */
export function DashboardShellClient({
  profile,
  organizationName,
  children,
}: DashboardShellClientProps) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    // Push to login and refresh the RSC tree so the session is cleared.
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <Header
        profile={profile}
        organizationName={organizationName}
        onSignOut={handleSignOut}
      />
      {children}
    </>
  );
}
