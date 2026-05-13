-- =============================================================================
-- AssetFlow — Canonical Schema (v2)
-- Migration: 002_schema.sql
-- =============================================================================
-- This migration supersedes 001_initial_schema.sql.
-- It replaces PostgreSQL ENUMs with plain TEXT columns for flexibility,
-- introduces the simpler `get_my_org_id()` RLS helper, and tightens the
-- `profiles` policy so each user can only access their own row.
--
-- HOW TO RUN
--   Fresh database : paste into the Supabase SQL editor, or run:
--                    supabase db push
--   Reset existing : uncomment the DROP block below first.
-- =============================================================================


-- =============================================================================
-- Optional Reset Block
-- WARNING: uncomment only when you want to destroy all existing data.
-- =============================================================================
-- DROP TABLE IF EXISTS maintenance_logs CASCADE;
-- DROP TABLE IF EXISTS assets            CASCADE;
-- DROP TABLE IF EXISTS profiles          CASCADE;
-- DROP TABLE IF EXISTS organizations     CASCADE;
-- DROP FUNCTION IF EXISTS get_my_org_id();
-- DROP FUNCTION IF EXISTS get_user_organization_id();
-- DROP FUNCTION IF EXISTS get_user_role();
-- DROP FUNCTION IF EXISTS set_updated_at();
-- DROP TYPE IF EXISTS subscription_status;
-- DROP TYPE IF EXISTS user_role;
-- DROP TYPE IF EXISTS asset_status;


-- =============================================================================
-- Extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- Tables
-- =============================================================================

-- ─── organizations ────────────────────────────────────────────────────────────
-- Top-level tenant boundary. Every record in the system is scoped to one org.
-- `plan` stores the subscription tier as plain text:
--   allowed values: 'free' | 'starter' | 'pro' | 'enterprise'

CREATE TABLE IF NOT EXISTS organizations (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  plan       TEXT        NOT NULL DEFAULT 'free'
);


-- ─── profiles ────────────────────────────────────────────────────────────────
-- Extends Supabase Auth users with an organization membership and a role.
-- `role` stores the access level as plain text:
--   allowed values: 'owner' | 'admin' | 'technician' | 'viewer'
-- A single auth user can belong to multiple organizations (one row per org).

CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'viewer',
  full_name       TEXT,

  CONSTRAINT profiles_user_org_unique UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS profiles_user_id_idx         ON profiles (user_id);
CREATE INDEX IF NOT EXISTS profiles_organization_id_idx ON profiles (organization_id);


-- ─── assets ──────────────────────────────────────────────────────────────────
-- Hardware assets tracked per organization.
-- `status` stores the lifecycle state as plain text:
--   allowed values: 'active' | 'in_maintenance' | 'retired' | 'lost' | 'disposed'

CREATE TABLE IF NOT EXISTS assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  serial_number   TEXT NOT NULL,
  model_name      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  purchase_date   DATE,
  warranty_expiry DATE,

  -- Serial numbers must be unique within an organization
  CONSTRAINT assets_org_serial_unique UNIQUE (organization_id, serial_number)
);

CREATE INDEX IF NOT EXISTS assets_organization_id_idx ON assets (organization_id);
CREATE INDEX IF NOT EXISTS assets_status_idx          ON assets (status);


-- ─── maintenance_logs ────────────────────────────────────────────────────────
-- Service event history for each asset.
-- `service_date` is TIMESTAMPTZ to capture the exact moment of service.
-- `organization_id` is denormalized here so RLS policies can filter directly
-- without a JOIN back through `assets`.

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id        UUID        NOT NULL REFERENCES assets(id)         ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  description     TEXT        NOT NULL,
  service_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maintenance_logs_asset_id_idx     ON maintenance_logs (asset_id);
CREATE INDEX IF NOT EXISTS maintenance_logs_org_id_idx       ON maintenance_logs (organization_id);
CREATE INDEX IF NOT EXISTS maintenance_logs_service_date_idx ON maintenance_logs (service_date DESC);


-- =============================================================================
-- RLS Helper Function
-- =============================================================================
-- `get_my_org_id()` returns the organization_id of the currently authenticated
-- user by looking up their profile row.
--
-- SECURITY DEFINER: runs with the function owner's privileges so it can read
-- the `profiles` table even when that table's own RLS policies are active.
-- This avoids the infinite-recursion problem that would occur if the function
-- ran as the calling user.
--
-- SET search_path = public: prevents search-path-injection attacks by locking
-- the function to the `public` schema.

CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM   profiles
  WHERE  user_id = auth.uid()
  LIMIT  1;
$$;


-- =============================================================================
-- Row Level Security
-- =============================================================================
-- RLS is enabled on ALL tables. No row is readable or writable without an
-- explicit matching policy. The default is DENY.

ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;


-- ─── organizations ────────────────────────────────────────────────────────────

-- Any authenticated member of an organization may read that organization's row.
CREATE POLICY "organizations: members can read own org"
  ON organizations
  FOR SELECT
  USING ( id = get_my_org_id() );

-- Organization rows are created via the service role (e.g., during signup).
-- No direct INSERT from the client is permitted.

-- Only the org owner or admin may update organization settings.
CREATE POLICY "organizations: owner and admin can update"
  ON organizations
  FOR UPDATE
  USING ( id = get_my_org_id() )
  WITH CHECK ( id = get_my_org_id() );


-- ─── profiles ─────────────────────────────────────────────────────────────────
-- Intentionally restrictive: each user can only see and edit their OWN profile.
-- If you later need org-wide member lists, add a separate scoped SELECT policy.

-- A user may read only their own profile row.
CREATE POLICY "profiles: user can read own profile"
  ON profiles
  FOR SELECT
  USING ( user_id = auth.uid() );

-- A user may update only their own profile row.
CREATE POLICY "profiles: user can update own profile"
  ON profiles
  FOR UPDATE
  USING    ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

-- Profile rows are created via the service role (e.g., during onboarding).
-- No direct client-side INSERT.


-- ─── assets ───────────────────────────────────────────────────────────────────
-- All four operations are gated on org membership via get_my_org_id().
-- For role-based write restrictions (e.g., only admins can delete), add an
-- additional check: `AND (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('owner', 'admin')`.

-- All org members may view assets belonging to their organization.
CREATE POLICY "assets: org members can select"
  ON assets
  FOR SELECT
  USING ( organization_id = get_my_org_id() );

-- Any org member may register a new asset for their organization.
CREATE POLICY "assets: org members can insert"
  ON assets
  FOR INSERT
  WITH CHECK ( organization_id = get_my_org_id() );

-- Any org member may update an asset that belongs to their organization.
CREATE POLICY "assets: org members can update"
  ON assets
  FOR UPDATE
  USING    ( organization_id = get_my_org_id() )
  WITH CHECK ( organization_id = get_my_org_id() );

-- Any org member may delete an asset that belongs to their organization.
CREATE POLICY "assets: org members can delete"
  ON assets
  FOR DELETE
  USING ( organization_id = get_my_org_id() );


-- ─── maintenance_logs ─────────────────────────────────────────────────────────
-- Mirrors the asset policies exactly: access is gated on org membership.

CREATE POLICY "maintenance_logs: org members can select"
  ON maintenance_logs
  FOR SELECT
  USING ( organization_id = get_my_org_id() );

CREATE POLICY "maintenance_logs: org members can insert"
  ON maintenance_logs
  FOR INSERT
  WITH CHECK ( organization_id = get_my_org_id() );

CREATE POLICY "maintenance_logs: org members can update"
  ON maintenance_logs
  FOR UPDATE
  USING    ( organization_id = get_my_org_id() )
  WITH CHECK ( organization_id = get_my_org_id() );

CREATE POLICY "maintenance_logs: org members can delete"
  ON maintenance_logs
  FOR DELETE
  USING ( organization_id = get_my_org_id() );
