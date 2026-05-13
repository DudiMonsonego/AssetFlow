-- =============================================================================
-- AssetFlow — Migration 003: Tenant Bootstrap Function
-- =============================================================================
-- Adds a SECURITY DEFINER function `setup_new_tenant` that is called from
-- auth-service.ts immediately after a successful Supabase Auth sign-up.
--
-- Why SECURITY DEFINER?
--   The `organizations` and `profiles` tables have no client INSERT policy
--   by design. A fresh user has no profile yet, so get_my_org_id() returns
--   NULL and all RLS write policies deny access. SECURITY DEFINER runs the
--   function body as the PostgreSQL role that owns it (the Supabase "postgres"
--   service role), bypassing RLS while still reading auth.uid() from the
--   caller's JWT.
--
-- Atomicity:
--   The function runs inside a single implicit transaction. If the profile
--   INSERT fails after the organization INSERT, Postgres rolls back both
--   changes automatically — no orphaned rows.
--
-- Idempotency:
--   If a profile row already exists for the calling user, the function
--   returns the existing organization_id immediately. This makes it safe
--   to call again on retry without creating duplicate organizations.
--
-- HOW TO RUN
--   Supabase dashboard : SQL editor → paste and execute
--   Local CLI          : supabase db push
-- =============================================================================

CREATE OR REPLACE FUNCTION public.setup_new_tenant(
  org_name       TEXT,
  user_full_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id  UUID;
BEGIN
  -- Resolve the calling user from the JWT embedded in the current session.
  v_user_id := auth.uid();

  -- Guard: the function must only be called by an authenticated user.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'setup_new_tenant: caller is not authenticated (auth.uid() is NULL). '
      'Ensure supabase.auth.signUp() completed successfully before calling this function.';
  END IF;

  -- Guard: a blank organization name is a data error.
  IF org_name IS NULL OR TRIM(org_name) = '' THEN
    RAISE EXCEPTION
      'setup_new_tenant: org_name cannot be empty.';
  END IF;

  -- Idempotency check: return early if this user is already linked to an org.
  SELECT organization_id
  INTO   v_org_id
  FROM   profiles
  WHERE  user_id = v_user_id
  LIMIT  1;

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  -- ── Step 1: Create the organization ────────────────────────────────────────
  -- `plan` defaults to 'free' via the column definition in 002_schema.sql.
  INSERT INTO organizations (name)
  VALUES (TRIM(org_name))
  RETURNING id INTO v_org_id;

  -- ── Step 2: Create the owner profile ───────────────────────────────────────
  -- `role` defaults to 'viewer' via the column definition, but we override it
  -- to 'owner' because this user is the founding member of the organization.
  -- NULLIF converts an empty trimmed string to NULL so full_name stores either
  -- a real value or NULL — never an empty string.
  INSERT INTO profiles (user_id, organization_id, role, full_name)
  VALUES (
    v_user_id,
    v_org_id,
    'owner',
    NULLIF(TRIM(COALESCE(user_full_name, '')), '')
  );

  RETURN v_org_id;
END;
$$;

-- Revoke the default PUBLIC grant and re-grant to authenticated users only.
-- Unauthenticated / anonymous callers cannot execute this function.
REVOKE EXECUTE ON FUNCTION public.setup_new_tenant(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.setup_new_tenant(TEXT, TEXT) TO authenticated;
