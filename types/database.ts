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
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          avatar_url?: string | null;
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
          country: string;
          city: string;
          is_active: boolean;
          legacy_glide_row_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          country: string;
          city: string;
          is_active?: boolean;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          name?: string;
          country?: string;
          city?: string;
          is_active?: boolean;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_venues: {
        Row: {
          id: string;
          team_id: string;
          venue_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          venue_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_id?: string;
          venue_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      camps: {
        Row: {
          id: string;
          team_venue_id: string;
          name: string;
          camp_type: Database["public"]["Enums"]["camp_type"];
          start_date: string;
          end_date: string;
          notes: string | null;
          is_active: boolean;
          legacy_glide_row_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_venue_id: string;
          name: string;
          camp_type: Database["public"]["Enums"]["camp_type"];
          start_date: string;
          end_date: string;
          notes?: string | null;
          is_active?: boolean;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_venue_id?: string;
          name?: string;
          camp_type?: Database["public"]["Enums"]["camp_type"];
          start_date?: string;
          end_date?: string;
          notes?: string | null;
          is_active?: boolean;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          camp_id: string;
          session_type: Database["public"]["Enums"]["session_type"];
          session_date: string;
          dock_out_at: string | null;
          dock_in_at: string | null;
          net_time_minutes: number | null;
          highlighted_by_coach: boolean;
          coach_profile_id: string | null;
          weather_summary: string | null;
          notes: string | null;
          legacy_glide_row_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          camp_id: string;
          session_type: Database["public"]["Enums"]["session_type"];
          session_date: string;
          dock_out_at?: string | null;
          dock_in_at?: string | null;
          net_time_minutes?: number | null;
          highlighted_by_coach?: boolean;
          coach_profile_id?: string | null;
          weather_summary?: string | null;
          notes?: string | null;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          camp_id?: string;
          session_type?: Database["public"]["Enums"]["session_type"];
          session_date?: string;
          dock_out_at?: string | null;
          dock_in_at?: string | null;
          net_time_minutes?: number | null;
          highlighted_by_coach?: boolean;
          coach_profile_id?: string | null;
          weather_summary?: string | null;
          notes?: string | null;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_reviews: {
        Row: {
          id: string;
          session_id: string;
          best_of_session: string | null;
          to_work: string | null;
          standard_moves: Json | null;
          wind_patterns: Json | null;
          coach_notes: string | null;
          reviewed_by_profile_id: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          best_of_session?: string | null;
          to_work?: string | null;
          standard_moves?: Json | null;
          wind_patterns?: Json | null;
          coach_notes?: string | null;
          reviewed_by_profile_id?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          session_id?: string;
          best_of_session?: string | null;
          to_work?: string | null;
          standard_moves?: Json | null;
          wind_patterns?: Json | null;
          coach_notes?: string | null;
          reviewed_by_profile_id?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_regatta_results: {
        Row: {
          id: string;
          session_id: string;
          race_number: number | null;
          fleet: string | null;
          position: number | null;
          points: number | null;
          result_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          race_number?: number | null;
          fleet?: string | null;
          position?: number | null;
          points?: number | null;
          result_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          session_id?: string;
          race_number?: number | null;
          fleet?: string | null;
          position?: number | null;
          points?: number | null;
          result_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_setups: {
        Row: {
          id: string;
          session_id: string;
          entered_by_profile_id: string | null;
          boat_settings: Json | null;
          sail_settings: Json | null;
          free_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          entered_by_profile_id?: string | null;
          boat_settings?: Json | null;
          sail_settings?: Json | null;
          free_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          session_id?: string;
          entered_by_profile_id?: string | null;
          boat_settings?: Json | null;
          sail_settings?: Json | null;
          free_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_type_setup_items: {
        Row: {
          id: string;
          team_type: string;
          key: string;
          label: string;
          input_kind: Database["public"]["Enums"]["setup_input_kind"];
          position: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_type: string;
          key: string;
          label: string;
          input_kind?: Database["public"]["Enums"]["setup_input_kind"];
          position: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_type?: string;
          key?: string;
          label?: string;
          input_kind?: Database["public"]["Enums"]["setup_input_kind"];
          position?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_type_setup_item_options: {
        Row: {
          id: string;
          team_type_setup_item_id: string;
          value: string;
          label: string;
          position: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_type_setup_item_id: string;
          value: string;
          label: string;
          position: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_type_setup_item_id?: string;
          value?: string;
          label?: string;
          position?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_setup_items: {
        Row: {
          id: string;
          team_id: string;
          team_type_setup_item_id: string | null;
          key: string;
          label: string;
          input_kind: Database["public"]["Enums"]["setup_input_kind"];
          position: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          team_type_setup_item_id?: string | null;
          key: string;
          label: string;
          input_kind: Database["public"]["Enums"]["setup_input_kind"];
          position: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_id?: string;
          team_type_setup_item_id?: string | null;
          key?: string;
          label?: string;
          input_kind?: Database["public"]["Enums"]["setup_input_kind"];
          position?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_setup_item_options: {
        Row: {
          id: string;
          team_setup_item_id: string;
          team_type_setup_item_option_id: string | null;
          value: string;
          label: string;
          position: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_setup_item_id: string;
          team_type_setup_item_option_id?: string | null;
          value: string;
          label: string;
          position: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_setup_item_id?: string;
          team_type_setup_item_option_id?: string | null;
          value?: string;
          label?: string;
          position?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_setup_item_values: {
        Row: {
          id: string;
          session_id: string;
          team_setup_item_id: string;
          text_value: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          team_setup_item_id: string;
          text_value?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          session_id?: string;
          team_setup_item_id?: string;
          text_value?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_setup_item_selected_options: {
        Row: {
          id: string;
          session_setup_item_value_id: string;
          team_setup_item_option_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_setup_item_value_id: string;
          team_setup_item_option_id: string;
          created_at?: string;
        };
        Update: {
          session_setup_item_value_id?: string;
          team_setup_item_option_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      session_assets: {
        Row: {
          id: string;
          session_id: string;
          asset_type: Database["public"]["Enums"]["asset_type"];
          bucket: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          asset_type: Database["public"]["Enums"]["asset_type"];
          bucket: string;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          session_id?: string;
          asset_type?: Database["public"]["Enums"]["asset_type"];
          bucket?: string;
          storage_path?: string;
          file_name?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by_profile_id?: string | null;
          created_at?: string;
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
      asset_type: "photo" | "analytics_file" | "document";
      camp_type: "training" | "regatta" | "mixed";
      global_role_type: "super_admin";
      organization_role_type: "organization_admin";
      session_type: "training" | "regatta";
      setup_input_kind: "single_select" | "multi_select" | "text";
      team_role_type: "team_admin" | "coach" | "crew";
    };
    CompositeTypes: Record<string, never>;
  };
};
