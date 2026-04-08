export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          photo_url: string | null;
          global_role: Database["public"]["Enums"]["global_role_type"] | null;
          is_active: boolean;
          legacy_glide_row_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          photo_url?: string | null;
          global_role?: Database["public"]["Enums"]["global_role_type"] | null;
          is_active?: boolean;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          photo_url?: string | null;
          global_role?: Database["public"]["Enums"]["global_role_type"] | null;
          is_active?: boolean;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_memberships: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["organization_role_type"];
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["organization_role_type"];
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["organization_role_type"];
          created_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          team_type: string | null;
          is_active: boolean;
          legacy_glide_row_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug: string;
          team_type?: string | null;
          is_active?: boolean;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          name?: string;
          slug?: string;
          team_type?: string | null;
          is_active?: boolean;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          country: string | null;
          city: string | null;
          venue_type: string | null;
          notes: string | null;
          is_active: boolean;
          legacy_glide_row_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          country?: string | null;
          city?: string | null;
          venue_type?: string | null;
          notes?: string | null;
          is_active?: boolean;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          name?: string;
          country?: string | null;
          city?: string | null;
          venue_type?: string | null;
          notes?: string | null;
          is_active?: boolean;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_memberships: {
        Row: {
          id: string;
          team_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["team_role_type"];
          is_active: boolean;
          joined_at: string;
          left_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["team_role_type"];
          is_active?: boolean;
          joined_at?: string;
          left_at?: string | null;
          created_at?: string;
        };
        Update: {
          team_id?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["team_role_type"];
          is_active?: boolean;
          joined_at?: string;
          left_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      global_role_type: "super_admin";
      organization_role_type: "organization_admin";
      team_role_type: "team_admin" | "coach" | "crew";
    };
    CompositeTypes: Record<string, never>;
  };
};
