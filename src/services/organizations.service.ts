/**
 * Organizations Service
 * Manages organization and profile data for multi-tenant operations.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type OrganizationUpdate = Database["public"]["Tables"]["organizations"]["Update"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

/**
 * Returns the organization for the currently authenticated user.
 */
export async function getCurrentOrganization(): Promise<{
  data: Organization | null;
  error: string | null;
}> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (supabase as any)
    .from("profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .single()) as { data: { organization_id: string } | null };

  if (!profile) return { data: null, error: "Profile not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase as any)
    .from("organizations")
    .select("*")
    .eq("id", profile.organization_id)
    .single()) as { data: Organization | null; error: { message: string } | null };

  return { data, error: error?.message ?? null };
}

/**
 * Updates organization settings.
 * RLS enforces that only admins/owners can perform this.
 */
export async function updateOrganization(
  id: string,
  payload: OrganizationUpdate
): Promise<{ data: Organization | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("organizations")
    .update(payload)
    .eq("id", id)
    .select()
    .single()) as { data: Organization | null; error: { message: string } | null };

  return { data, error: error?.message ?? null };
}

/**
 * Returns the profile for the currently authenticated user.
 */
export async function getCurrentProfile(): Promise<{
  data: Profile | null;
  error: string | null;
}> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()) as { data: Profile | null; error: { message: string } | null };

  return { data, error: error?.message ?? null };
}

/**
 * Returns all members of the current user's organization.
 */
export async function getOrganizationMembers(): Promise<{
  data: Profile[];
  error: string | null;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true })) as {
    data: Profile[] | null;
    error: { message: string } | null;
  };

  return { data: data ?? [], error: error?.message ?? null };
}

/**
 * Updates a user's own profile.
 */
export async function updateProfile(
  id: string,
  payload: ProfileUpdate
): Promise<{ data: Profile | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .select()
    .single()) as { data: Profile | null; error: { message: string } | null };

  return { data, error: error?.message ?? null };
}

/**
 * Invites a new member to the organization.
 * The user must already have a Supabase Auth account.
 */
export async function inviteMember(
  payload: ProfileInsert
): Promise<{ data: Profile | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (createClient() as any)
    .from("profiles")
    .insert(payload)
    .select()
    .single()) as { data: Profile | null; error: { message: string } | null };

  return { data, error: error?.message ?? null };
}

/**
 * Removes a member from the organization.
 * RLS enforces that only admins/owners can do this.
 */
export async function removeMember(
  profileId: string
): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = (await (createClient() as any)
    .from("profiles")
    .delete()
    .eq("id", profileId)) as { error: { message: string } | null };

  return { error: error?.message ?? null };
}
