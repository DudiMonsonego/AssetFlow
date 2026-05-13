-- =============================================================================
-- AssetFlow — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- =============================================================================
-- Run this in the Supabase SQL editor or via `supabase db push`.
-- =============================================================================


-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─── Custom Enum Types ────────────────────────────────────────────────────────

CREATE TYPE subscription_status AS ENUM (
  'trial',
  'active',
  'past_due',
  'canceled'
);

CREATE TYPE user_role AS ENUM (
  'owner',
  'admin',
  'technician',
  'viewer'
);

CREATE TYPE asset_status AS ENUM (
  'active',
  'in_maintenance',
  'retired',
  'lost',
  'disposed'
);


-- ─── organizations ────────────────────────────────────────────────────────────
-- Top-level tenant boundary. Every piece of data is scoped to one organization.

CREATE TABLE organizations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  subscription_status subscription_status NOT NULL DEFAULT 'trial',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically update `updated_at` on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── profiles ────────────────────────────────────────────────────────────────
-- Extends Supabase Auth users with organization membership and role.

CREATE TABLE profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            user_role NOT NULL DEFAULT 'viewer',
  full_name       TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, organization_id)
);

CREATE INDEX profiles_user_id_idx         ON profiles (user_id);
CREATE INDEX profiles_organization_id_idx ON profiles (organization_id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── assets ──────────────────────────────────────────────────────────────────
-- Hardware assets tracked per organization.

CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  serial_number   TEXT NOT NULL,
  model_name      TEXT NOT NULL,
  manufacturer    TEXT,
  category        TEXT,
  status          asset_status NOT NULL DEFAULT 'active',
  purchase_date   DATE,
  warranty_expiry DATE,
  purchase_price  NUMERIC(12, 2),
  location        TEXT,
  assigned_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Serial number must be unique within an organization
  UNIQUE (organization_id, serial_number)
);

CREATE INDEX assets_organization_id_idx ON assets (organization_id);
CREATE INDEX assets_status_idx          ON assets (status);
CREATE INDEX assets_assigned_to_idx     ON assets (assigned_to);

CREATE TRIGGER assets_set_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── maintenance_logs ────────────────────────────────────────────────────────
-- Service history for each asset.

CREATE TABLE maintenance_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id         UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_date     DATE NOT NULL,
  description      TEXT NOT NULL,
  technician_name  TEXT NOT NULL,
  cost             NUMERIC(10, 2),
  next_service_date DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX maintenance_logs_asset_id_idx         ON maintenance_logs (asset_id);
CREATE INDEX maintenance_logs_organization_id_idx  ON maintenance_logs (organization_id);
CREATE INDEX maintenance_logs_service_date_idx     ON maintenance_logs (service_date DESC);

CREATE TRIGGER maintenance_logs_set_updated_at
  BEFORE UPDATE ON maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- Row Level Security (RLS)
-- All tables are fully locked down. Access is granted only through
-- explicit policies that verify organization membership.
-- =============================================================================

ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;


-- ─── Helper function ─────────────────────────────────────────────────────────
-- Returns the organization_id for the currently authenticated user.
-- Using SECURITY DEFINER so it can bypass RLS on the profiles table.

CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT organization_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Returns the role of the currently authenticated user within their org.
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;


-- ─── organizations Policies ───────────────────────────────────────────────────

-- Members can read their own organization
CREATE POLICY "org_members_can_read"
  ON organizations FOR SELECT
  USING (id = get_user_organization_id());

-- Only owners/admins can update org settings
CREATE POLICY "admins_can_update_org"
  ON organizations FOR UPDATE
  USING (
    id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );


-- ─── profiles Policies ───────────────────────────────────────────────────────

-- Members can see all profiles within their organization
CREATE POLICY "org_members_can_read_profiles"
  ON profiles FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Users can update their own profile
CREATE POLICY "users_can_update_own_profile"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Admins/owners can insert new profiles (invite members)
CREATE POLICY "admins_can_insert_profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Admins/owners can delete profiles (remove members)
CREATE POLICY "admins_can_delete_profiles"
  ON profiles FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );


-- ─── assets Policies ─────────────────────────────────────────────────────────

-- All members can read assets in their organization
CREATE POLICY "org_members_can_read_assets"
  ON assets FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Admins, owners, and technicians can insert assets
CREATE POLICY "technicians_can_insert_assets"
  ON assets FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'technician')
  );

-- Admins, owners, and technicians can update assets
CREATE POLICY "technicians_can_update_assets"
  ON assets FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'technician')
  );

-- Only admins/owners can delete assets
CREATE POLICY "admins_can_delete_assets"
  ON assets FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );


-- ─── maintenance_logs Policies ───────────────────────────────────────────────

-- All members can read maintenance logs
CREATE POLICY "org_members_can_read_maintenance_logs"
  ON maintenance_logs FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Technicians and above can insert logs
CREATE POLICY "technicians_can_insert_maintenance_logs"
  ON maintenance_logs FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'technician')
  );

-- Technicians and above can update logs
CREATE POLICY "technicians_can_update_maintenance_logs"
  ON maintenance_logs FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'technician')
  );

-- Only admins/owners can delete logs
CREATE POLICY "admins_can_delete_maintenance_logs"
  ON maintenance_logs FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );


-- =============================================================================
-- Seed: Demo Organization (optional — comment out for production)
-- =============================================================================

-- INSERT INTO organizations (name, subscription_status)
-- VALUES ('Acme Corp', 'active');
