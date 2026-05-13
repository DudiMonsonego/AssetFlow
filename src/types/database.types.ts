/**
 * AssetFlow — Database Type Definitions
 *
 * Mirrors the format that `supabase gen types typescript` produces so the
 * Supabase client can resolve table/column types via the Database generic.
 *
 * Schema source: supabase/migrations/002_schema.sql
 *
 * To regenerate from a running Supabase project:
 *   npm run db:types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// =============================================================================
// Application-level union types
// These are NOT PostgreSQL ENUMs — the DB stores plain TEXT. These unions give
// compile-time safety inside the TypeScript codebase.
// =============================================================================

/**
 * Subscription tier stored in `organizations.plan`.
 * Allowed values must stay in sync with any application logic that writes
 * to this column.
 */
export type OrgPlan = "free" | "starter" | "pro" | "enterprise";

/**
 * Access level stored in `profiles.role`.
 * Permission checks in services and RLS policies are based on these values.
 */
export type UserRole = "owner" | "admin" | "technician" | "viewer";

/**
 * Lifecycle state stored in `assets.status`.
 * Used by the dashboard KPIs and the assets table filter.
 */
export type AssetStatus =
  | "active"
  | "in_maintenance"
  | "retired"
  | "lost"
  | "disposed";

// =============================================================================
// Convenience aliases — derived directly from the Database type below
// so there is a single source of truth.
// =============================================================================

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Profile      = Database["public"]["Tables"]["profiles"]["Row"];
export type Asset        = Database["public"]["Tables"]["assets"]["Row"];
export type MaintenanceLog = Database["public"]["Tables"]["maintenance_logs"]["Row"];

// Insert / Update helpers
export type OrganizationInsert = Database["public"]["Tables"]["organizations"]["Insert"];
export type OrganizationUpdate = Database["public"]["Tables"]["organizations"]["Update"];

export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];
export type AssetUpdate = Database["public"]["Tables"]["assets"]["Update"];

export type MaintenanceLogInsert = Database["public"]["Tables"]["maintenance_logs"]["Insert"];
export type MaintenanceLogUpdate = Database["public"]["Tables"]["maintenance_logs"]["Update"];

// =============================================================================
// Joined / view types
// These are manually maintained until `supabase gen types` supports joins.
// =============================================================================

/**
 * A maintenance log record joined with its parent asset's identity columns.
 * Used in the maintenance service and dashboard list components.
 */
export type MaintenanceLogWithAsset = MaintenanceLog & {
  asset: Pick<Asset, "id" | "serial_number" | "model_name"> | null;
};

// =============================================================================
// Supabase Database schema
// Must satisfy the GenericSchema constraint from @supabase/supabase-js:
//   { Tables: Record<string, GenericTable>, Views: ..., Functions: ... }
// =============================================================================

export type Database = {
  public: {
    Tables: {

      // ── organizations ──────────────────────────────────────────────────────
      organizations: {
        Row: {
          id:         string;
          name:       string;
          created_at: string;
          /** Subscription tier. App-level values: OrgPlan */
          plan:       string;
        };
        Insert: {
          id?:         string | undefined;
          name:        string;
          created_at?: string | undefined;
          plan?:       string | undefined;
        };
        Update: {
          id?:         string | undefined;
          name?:       string | undefined;
          created_at?: string | undefined;
          plan?:       string | undefined;
        };
        Relationships: [];
      };

      // ── profiles ───────────────────────────────────────────────────────────
      profiles: {
        Row: {
          id:              string;
          user_id:         string;
          organization_id: string;
          /** Access level. App-level values: UserRole */
          role:            string;
          full_name:       string | null;
        };
        Insert: {
          id?:              string | undefined;
          user_id:          string;
          organization_id:  string;
          role?:            string | undefined;
          full_name?:       string | null | undefined;
        };
        Update: {
          id?:              string | undefined;
          user_id?:         string | undefined;
          organization_id?: string | undefined;
          role?:            string | undefined;
          full_name?:       string | null | undefined;
        };
        Relationships: [
          {
            foreignKeyName:    "profiles_organization_id_fkey";
            columns:           ["organization_id"];
            isOneToOne:        false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };

      // ── assets ─────────────────────────────────────────────────────────────
      assets: {
        Row: {
          id:              string;
          organization_id: string;
          serial_number:   string;
          model_name:      string;
          /** Lifecycle state. App-level values: AssetStatus */
          status:          string;
          purchase_date:   string | null;
          warranty_expiry: string | null;
        };
        Insert: {
          id?:              string | undefined;
          organization_id:  string;
          serial_number:    string;
          model_name:       string;
          status?:          string | undefined;
          purchase_date?:   string | null | undefined;
          warranty_expiry?: string | null | undefined;
        };
        Update: {
          id?:              string | undefined;
          organization_id?: string | undefined;
          serial_number?:   string | undefined;
          model_name?:      string | undefined;
          status?:          string | undefined;
          purchase_date?:   string | null | undefined;
          warranty_expiry?: string | null | undefined;
        };
        Relationships: [
          {
            foreignKeyName:    "assets_organization_id_fkey";
            columns:           ["organization_id"];
            isOneToOne:        false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };

      // ── maintenance_logs ───────────────────────────────────────────────────
      maintenance_logs: {
        Row: {
          id:              string;
          asset_id:        string;
          organization_id: string;
          description:     string;
          /** ISO-8601 timestamp string (TIMESTAMPTZ stored as UTC) */
          service_date:    string;
        };
        Insert: {
          id?:              string | undefined;
          asset_id:         string;
          organization_id:  string;
          description:      string;
          service_date?:    string | undefined;
        };
        Update: {
          id?:              string | undefined;
          asset_id?:        string | undefined;
          organization_id?: string | undefined;
          description?:     string | undefined;
          service_date?:    string | undefined;
        };
        Relationships: [
          {
            foreignKeyName:    "maintenance_logs_asset_id_fkey";
            columns:           ["asset_id"];
            isOneToOne:        false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName:    "maintenance_logs_organization_id_fkey";
            columns:           ["organization_id"];
            isOneToOne:        false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };

    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      /**
       * Returns the organization_id for the currently authenticated user.
       * SECURITY DEFINER — bypasses RLS on the profiles table.
       */
      get_my_org_id: {
        Args:    Record<PropertyKey, never>;
        Returns: string;
      };

      /**
       * Atomically creates an organization and an owner profile for a new user.
       * Called from auth-service.signUp() immediately after auth.signUp().
       * SECURITY DEFINER — bypasses RLS so a brand-new user (who has no
       * profile yet) can bootstrap their tenant in a single transaction.
       *
       * Returns the UUID of the newly created (or pre-existing) organization.
       */
      setup_new_tenant: {
        Args: {
          org_name:       string;
          user_full_name?: string | null;
        };
        Returns: string;
      };
    };

    Enums: {
      // The DB schema uses plain TEXT for all status/role/plan columns.
      // No PostgreSQL ENUMs are defined in 002_schema.sql.
      [_ in never]: never;
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
