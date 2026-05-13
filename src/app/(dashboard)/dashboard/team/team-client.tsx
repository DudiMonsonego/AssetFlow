"use client";

/**
 * TeamClient — interactive team member list with role management.
 * Owners see a role dropdown on every row except their own.
 * Non-owners see the list in read-only mode.
 */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import type { TeamMember } from "./page";

// ─── Role config ──────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "secondary" | "outline" | "warning";

const ROLE_CONFIG: Record<string, { label: string; badge: BadgeVariant }> = {
  owner:      { label: "Owner",      badge: "default"    },
  admin:      { label: "Admin",      badge: "warning"    },
  technician: { label: "Technician", badge: "secondary"  },
  viewer:     { label: "Viewer",     badge: "outline"    },
};

const ASSIGNABLE_ROLES = ["admin", "technician", "viewer"] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  currentUserId:   string;
  currentUserRole: string;
  initialMembers:  TeamMember[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TeamClient({ currentUserId, currentUserRole, initialMembers }: Props) {
  const [members, setMembers]     = useState<TeamMember[]>(initialMembers);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [flashError, setFlashError] = useState<string | null>(null);

  const isOwner = currentUserRole === "owner";

  async function handleRoleChange(member: TeamMember, newRole: string) {
    setUpdatingId(member.id);
    setFlashError(null);

    try {
      const session = (await createClient().auth.getSession()).data.session;
      if (!session) {
        setFlashError("Session expired — please sign in again.");
        setUpdatingId(null);
        return;
      }

      const res = await fetch("/api/team/update-role", {
        method: "PATCH",
        headers: {
          "Content-Type":  "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ profileId: member.id, role: newRole }),
      });

      const body = await res.json() as { role?: string; error?: string };

      if (!res.ok) {
        setFlashError(body.error ?? "Failed to update role.");
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, role: body.role ?? newRole } : m))
        );
      }
    } catch (err) {
      setFlashError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">

      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {members.length} member{members.length !== 1 ? "s" : ""} in your organization.
            </p>
          </div>
        </div>
      </div>

      {/* Role-change error */}
      {flashError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{flashError}</AlertDescription>
        </Alert>
      )}

      {/* Permissions note for non-owners */}
      {!isOwner && (
        <Alert variant="info">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            Only owners can change member roles. Contact your organization owner
            to request a role change.
          </AlertDescription>
        </Alert>
      )}

      {/* Member table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              {isOwner && <TableHead className="w-[160px]">Change Role</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isOwner ? 3 : 2}>
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No team members found.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const roleCfg    = ROLE_CONFIG[member.role] ?? { label: member.role, badge: "outline" as BadgeVariant };
                const isMe       = member.user_id === currentUserId;
                const isUpdating = updatingId === member.id;

                return (
                  <TableRow key={member.id} className={isMe ? "bg-muted/30" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {/* Avatar initials */}
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {(member.full_name ?? "?")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {member.full_name ?? "Unnamed user"}
                          </p>
                          {isMe && (
                            <p className="text-xs text-muted-foreground">You</p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={roleCfg.badge}>{roleCfg.label}</Badge>
                    </TableCell>

                    {isOwner && (
                      <TableCell>
                        {isMe ? (
                          <span className="text-xs text-muted-foreground italic">
                            Cannot change own role
                          </span>
                        ) : isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <select
                            value={member.role === "owner" ? "owner" : member.role}
                            disabled={member.role === "owner"}
                            onChange={(e) => handleRoleChange(member, e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {member.role === "owner" && (
                              <option value="owner">Owner</option>
                            )}
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_CONFIG[r].label}
                              </option>
                            ))}
                          </select>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          Member invitations are managed through your Supabase project dashboard.
        </div>
      </div>
    </div>
  );
}
