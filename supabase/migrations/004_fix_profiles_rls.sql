-- =============================================================================
-- AssetFlow — Migration 004: Fix profiles RLS for team visibility
-- =============================================================================
-- Problem:
--   The SELECT policy on `profiles` (added in 002_schema.sql) only lets a user
--   see their own row:
--     USING ( user_id = auth.uid() )
--
--   This was intentionally restrictive during early development but breaks the
--   Team page, which needs to list ALL members of the same organization.
--   Because of RLS, the query returns only the current user's own row — every
--   other member is silently filtered out.
--
-- Fix:
--   Drop the old restrictive SELECT policy and replace it with one that allows
--   any authenticated user to read all profiles that belong to their org.
--   The existing UPDATE policy (own-row only) is left unchanged.
--
-- HOW TO RUN
--   Supabase dashboard : SQL editor → paste and execute
--   Local CLI          : supabase db push
-- =============================================================================

-- Drop the old single-row SELECT policy.
DROP POLICY IF EXISTS "profiles: user can read own profile" ON profiles;

-- New policy: any member of an org can read all profiles in that same org.
-- get_my_org_id() is SECURITY DEFINER so it safely reads through its own RLS.
CREATE POLICY "profiles: org members can read all org profiles"
  ON profiles
  FOR SELECT
  USING ( organization_id = get_my_org_id() );
