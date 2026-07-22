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
          is_profile_complete: boolean;
          profile_completed_at: string | null;
          first_seen_at: string | null;
          onboarding_stage: number;
          onboarding_draft: Json;
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
          is_profile_complete?: boolean;
          profile_completed_at?: string | null;
          first_seen_at?: string | null;
          onboarding_stage?: number;
          onboarding_draft?: Json;
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
          is_profile_complete?: boolean;
          profile_completed_at?: string | null;
          first_seen_at?: string | null;
          onboarding_stage?: number;
          onboarding_draft?: Json;
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
      calendar_events: {
        Row: {
          id: string;
          team_id: string;
          title: string;
          event_type: Database["public"]["Enums"]["calendar_event_type"];
          start_date: string;
          end_date: string;
          notes: string | null;
          is_active: boolean;
          created_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          title: string;
          event_type?: Database["public"]["Enums"]["calendar_event_type"];
          start_date: string;
          end_date: string;
          notes?: string | null;
          is_active?: boolean;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_id?: string;
          title?: string;
          event_type?: Database["public"]["Enums"]["calendar_event_type"];
          start_date?: string;
          end_date?: string;
          notes?: string | null;
          is_active?: boolean;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_presence: {
        Row: {
          id: string;
          source_type: Database["public"]["Enums"]["calendar_presence_source_type"];
          camp_id: string | null;
          calendar_event_id: string | null;
          profile_id: string;
          presence_date: string;
          created_by_profile_id: string | null;
          updated_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_type: Database["public"]["Enums"]["calendar_presence_source_type"];
          camp_id?: string | null;
          calendar_event_id?: string | null;
          profile_id: string;
          presence_date: string;
          created_by_profile_id?: string | null;
          updated_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          source_type?: Database["public"]["Enums"]["calendar_presence_source_type"];
          camp_id?: string | null;
          calendar_event_id?: string | null;
          profile_id?: string;
          presence_date?: string;
          created_by_profile_id?: string | null;
          updated_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_venue_reports: {
        Row: {
          id: string;
          team_venue_id: string;
          year: number;
          name: string;
          created_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_venue_id: string;
          year: number;
          name: string;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_venue_id?: string;
          year?: number;
          name?: string;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_venue_report_camps: {
        Row: {
          id: string;
          report_id: string;
          camp_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          camp_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          camp_id?: string;
          created_at?: string;
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
          goals: string | null;
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
          goals?: string | null;
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
          goals?: string | null;
          notes?: string | null;
          legacy_glide_row_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_standard_moves: {
        Row: {
          id: string;
          session_id: string;
          team_standard_move_id: string;
          created_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          team_standard_move_id: string;
          created_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          team_standard_move_id?: string;
          created_by_profile_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      session_wind_patterns: {
        Row: {
          id: string;
          session_id: string;
          team_venue_wind_pattern_id: string;
          created_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          team_venue_wind_pattern_id: string;
          created_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          team_venue_wind_pattern_id?: string;
          created_by_profile_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      session_reviews: {
        Row: {
          id: string;
          session_id: string;
          best_of_session: string | null;
          to_work: string | null;
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
          wind_patterns?: Json | null;
          coach_notes?: string | null;
          reviewed_by_profile_id?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_profile_id: string;
          actor_profile_id: string | null;
          team_id: string;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          message: string;
          target_href: string;
          metadata: Json;
          read_at: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_profile_id: string;
          actor_profile_id?: string | null;
          team_id: string;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          message: string;
          target_href: string;
          metadata?: Json;
          read_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_profile_id?: string;
          actor_profile_id?: string | null;
          team_id?: string;
          event_type?: Database["public"]["Enums"]["notification_event_type"];
          message?: string;
          target_href?: string;
          metadata?: Json;
          read_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
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
      team_standard_moves: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_venue_wind_patterns: {
        Row: {
          id: string;
          team_venue_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_venue_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_venue_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_by_profile_id?: string | null;
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
          metric_group: Database["public"]["Enums"]["setup_metric_group"];
          is_fixed: boolean;
          is_required: boolean;
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
          metric_group?: Database["public"]["Enums"]["setup_metric_group"];
          is_fixed?: boolean;
          is_required?: boolean;
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
          metric_group?: Database["public"]["Enums"]["setup_metric_group"];
          is_fixed?: boolean;
          is_required?: boolean;
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
          metric_group: Database["public"]["Enums"]["setup_metric_group"];
          is_fixed: boolean;
          is_required: boolean;
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
          metric_group?: Database["public"]["Enums"]["setup_metric_group"];
          is_fixed?: boolean;
          is_required?: boolean;
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
          metric_group?: Database["public"]["Enums"]["setup_metric_group"];
          is_fixed?: boolean;
          is_required?: boolean;
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
          allocation_percent: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_setup_item_value_id: string;
          team_setup_item_option_id: string;
          allocation_percent?: number | null;
          created_at?: string;
        };
        Update: {
          session_setup_item_value_id?: string;
          team_setup_item_option_id?: string;
          allocation_percent?: number | null;
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
          description: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          thumbnail_bucket: string | null;
          thumbnail_storage_path: string | null;
          thumbnail_mime_type: string | null;
          thumbnail_size_bytes: number | null;
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
          description?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          thumbnail_bucket?: string | null;
          thumbnail_storage_path?: string | null;
          thumbnail_mime_type?: string | null;
          thumbnail_size_bytes?: number | null;
          uploaded_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          session_id?: string;
          asset_type?: Database["public"]["Enums"]["asset_type"];
          bucket?: string;
          storage_path?: string;
          file_name?: string;
          description?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          thumbnail_bucket?: string | null;
          thumbnail_storage_path?: string | null;
          thumbnail_mime_type?: string | null;
          thumbnail_size_bytes?: number | null;
          uploaded_by_profile_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      session_vakaros_uploads: {
        Row: {
          id: string;
          session_id: string;
          asset_id: string;
          bucket: string;
          raw_storage_path: string | null;
          series_1hz_storage_path: string;
          track_geojson_storage_path: string;
          summary_storage_path: string;
          rows_raw: number;
          rows_1hz: number;
          start_at: string | null;
          end_at: string | null;
          duration_hours: number;
          distance_nm: number;
          avg_sog_kts: number;
          p95_sog_kts: number;
          max_sog_kts: number;
          uploaded_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          asset_id: string;
          bucket: string;
          raw_storage_path?: string | null;
          series_1hz_storage_path: string;
          track_geojson_storage_path: string;
          summary_storage_path: string;
          rows_raw: number;
          rows_1hz: number;
          start_at?: string | null;
          end_at?: string | null;
          duration_hours: number;
          distance_nm: number;
          avg_sog_kts: number;
          p95_sog_kts: number;
          max_sog_kts: number;
          uploaded_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          session_id?: string;
          asset_id?: string;
          bucket?: string;
          raw_storage_path?: string | null;
          series_1hz_storage_path?: string;
          track_geojson_storage_path?: string;
          summary_storage_path?: string;
          rows_raw?: number;
          rows_1hz?: number;
          start_at?: string | null;
          end_at?: string | null;
          duration_hours?: number;
          distance_nm?: number;
          avg_sog_kts?: number;
          p95_sog_kts?: number;
          max_sog_kts?: number;
          uploaded_by_profile_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      session_vakaros_saved_trims: {
        Row: {
          id: string;
          upload_id: string;
          name: string;
          trim_start_index: number;
          trim_end_index: number;
          buoys: Json;
          created_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          upload_id: string;
          name: string;
          trim_start_index: number;
          trim_end_index: number;
          buoys?: Json;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          upload_id?: string;
          name?: string;
          trim_start_index?: number;
          trim_end_index?: number;
          buoys?: Json;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gear_items: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          gear_type: Database["public"]["Enums"]["gear_type"];
          serial_number: string | null;
          barcode: string | null;
          status: Database["public"]["Enums"]["gear_status"];
          condition: Database["public"]["Enums"]["gear_condition"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          gear_type: Database["public"]["Enums"]["gear_type"];
          serial_number?: string | null;
          barcode?: string | null;
          status?: Database["public"]["Enums"]["gear_status"];
          condition?: Database["public"]["Enums"]["gear_condition"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          gear_type?: Database["public"]["Enums"]["gear_type"];
          serial_number?: string | null;
          barcode?: string | null;
          status?: Database["public"]["Enums"]["gear_status"];
          condition?: Database["public"]["Enums"]["gear_condition"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gear_alert_rules: {
        Row: {
          id: string;
          gear_item_id: string;
          metric: Database["public"]["Enums"]["gear_alert_metric"];
          severity: Database["public"]["Enums"]["gear_alert_severity"];
          threshold_value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gear_item_id: string;
          metric: Database["public"]["Enums"]["gear_alert_metric"];
          severity: Database["public"]["Enums"]["gear_alert_severity"];
          threshold_value: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gear_item_id?: string;
          metric?: Database["public"]["Enums"]["gear_alert_metric"];
          severity?: Database["public"]["Enums"]["gear_alert_severity"];
          threshold_value?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gear_tws_option_multipliers: {
        Row: {
          id: string;
          gear_item_id: string;
          team_setup_item_option_id: string;
          usage_minutes_multiplier: number;
          usage_count_multiplier: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gear_item_id: string;
          team_setup_item_option_id: string;
          usage_minutes_multiplier?: number;
          usage_count_multiplier?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gear_item_id?: string;
          team_setup_item_option_id?: string;
          usage_minutes_multiplier?: number;
          usage_count_multiplier?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_gear_usage: {
        Row: {
          id: string;
          session_id: string;
          gear_item_id: string;
          linked_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          gear_item_id: string;
          linked_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          gear_item_id?: string;
          linked_by_profile_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      assessment_templates: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_template_scale_options: {
        Row: {
          id: string;
          assessment_template_id: string;
          label: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_template_id: string;
          label: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assessment_template_id?: string;
          label?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_template_categories: {
        Row: {
          id: string;
          assessment_template_id: string;
          name: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_template_id: string;
          name: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assessment_template_id?: string;
          name?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_template_modes: {
        Row: {
          id: string;
          assessment_template_category_id: string;
          name: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_template_category_id: string;
          name: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assessment_template_category_id?: string;
          name?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_template_questions: {
        Row: {
          id: string;
          assessment_template_category_id: string;
          assessment_template_mode_id: string | null;
          prompt: string;
          position: number;
          is_required: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_template_category_id: string;
          assessment_template_mode_id?: string | null;
          prompt: string;
          position: number;
          is_required?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assessment_template_category_id?: string;
          assessment_template_mode_id?: string | null;
          prompt?: string;
          position?: number;
          is_required?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_runs: {
        Row: {
          id: string;
          team_id: string;
          team_venue_id: string;
          assessment_template_id: string | null;
          name: string;
          description: string | null;
          status: Database["public"]["Enums"]["assessment_run_status_type"];
          created_by_profile_id: string | null;
          published_at: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          team_venue_id: string;
          assessment_template_id?: string | null;
          name: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["assessment_run_status_type"];
          created_by_profile_id?: string | null;
          published_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          team_venue_id?: string;
          assessment_template_id?: string | null;
          name?: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["assessment_run_status_type"];
          created_by_profile_id?: string | null;
          published_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_run_scale_options: {
        Row: {
          id: string;
          assessment_run_id: string;
          label: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_run_id: string;
          label: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assessment_run_id?: string;
          label?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_run_categories: {
        Row: {
          id: string;
          assessment_run_id: string;
          name: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_run_id: string;
          name: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assessment_run_id?: string;
          name?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_run_modes: {
        Row: {
          id: string;
          assessment_run_category_id: string;
          name: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_run_category_id: string;
          name: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assessment_run_category_id?: string;
          name?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_run_questions: {
        Row: {
          id: string;
          assessment_run_category_id: string;
          assessment_run_mode_id: string | null;
          prompt: string;
          position: number;
          is_required: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_run_category_id: string;
          assessment_run_mode_id?: string | null;
          prompt: string;
          position: number;
          is_required?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assessment_run_category_id?: string;
          assessment_run_mode_id?: string | null;
          prompt?: string;
          position?: number;
          is_required?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_run_camps: {
        Row: {
          id: string;
          assessment_run_id: string;
          camp_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_run_id: string;
          camp_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          assessment_run_id?: string;
          camp_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      assessment_run_respondents: {
        Row: {
          id: string;
          assessment_run_id: string;
          profile_id: string;
          responded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_run_id: string;
          profile_id: string;
          responded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          assessment_run_id?: string;
          profile_id?: string;
          responded_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      assessment_run_answers: {
        Row: {
          id: string;
          assessment_run_id: string;
          assessment_run_question_id: string;
          respondent_profile_id: string;
          assessment_run_scale_option_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_run_id: string;
          assessment_run_question_id: string;
          respondent_profile_id: string;
          assessment_run_scale_option_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assessment_run_id?: string;
          assessment_run_question_id?: string;
          respondent_profile_id?: string;
          assessment_run_scale_option_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_subscriptions: {
        Row: {
          organization_id: string;
          plan_tier: Database["public"]["Enums"]["plan_tier"];
          billing_cycle: Database["public"]["Enums"]["billing_cycle"];
          status: Database["public"]["Enums"]["subscription_status"];
          paypal_subscription_id: string | null;
          paypal_plan_id: string | null;
          polar_customer_id: string | null;
          polar_subscription_id: string | null;
          polar_product_id: string | null;
          polar_checkout_id: string | null;
          polar_status: string | null;
          current_period_start_at: string | null;
          current_period_end_at: string | null;
          cancelled_at: string | null;
          cancel_at_period_end: boolean;
          created_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          plan_tier?: Database["public"]["Enums"]["plan_tier"];
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"];
          status?: Database["public"]["Enums"]["subscription_status"];
          paypal_subscription_id?: string | null;
          paypal_plan_id?: string | null;
          polar_customer_id?: string | null;
          polar_subscription_id?: string | null;
          polar_product_id?: string | null;
          polar_checkout_id?: string | null;
          polar_status?: string | null;
          current_period_start_at?: string | null;
          current_period_end_at?: string | null;
          cancelled_at?: string | null;
          cancel_at_period_end?: boolean;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          plan_tier?: Database["public"]["Enums"]["plan_tier"];
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"];
          status?: Database["public"]["Enums"]["subscription_status"];
          paypal_subscription_id?: string | null;
          paypal_plan_id?: string | null;
          polar_customer_id?: string | null;
          polar_subscription_id?: string | null;
          polar_product_id?: string | null;
          polar_checkout_id?: string | null;
          polar_status?: string | null;
          current_period_start_at?: string | null;
          current_period_end_at?: string | null;
          cancelled_at?: string | null;
          cancel_at_period_end?: boolean;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      polar_webhook_events: {
        Row: {
          id: string;
          event_id: string;
          event_type: string;
          resource_id: string | null;
          organization_id: string | null;
          payload: Json;
          processed_at: string | null;
          processing_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          event_type: string;
          resource_id?: string | null;
          organization_id?: string | null;
          payload: Json;
          processed_at?: string | null;
          processing_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          event_type?: string;
          resource_id?: string | null;
          organization_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          processing_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      paypal_webhook_events: {
        Row: {
          id: string;
          event_id: string;
          event_type: string;
          resource_id: string | null;
          organization_id: string | null;
          payload: Json;
          verification_status: string;
          processed_at: string | null;
          processing_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          event_type: string;
          resource_id?: string | null;
          organization_id?: string | null;
          payload: Json;
          verification_status: string;
          processed_at?: string | null;
          processing_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          event_type?: string;
          resource_id?: string | null;
          organization_id?: string | null;
          payload?: Json;
          verification_status?: string;
          processed_at?: string | null;
          processing_error?: string | null;
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
    Functions: {
      get_team_asset_page: {
        Args: {
          p_asset_type: Database["public"]["Enums"]["asset_type"];
          p_camp_id?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
          p_session_id?: string | null;
          p_team_id: string;
          p_venue_id?: string | null;
          p_year?: number | null;
        };
        Returns: {
          asset_id: string;
          session_id: string;
          asset_type: Database["public"]["Enums"]["asset_type"];
          bucket: string;
          storage_path: string;
          file_name: string;
          description: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          thumbnail_bucket: string | null;
          thumbnail_storage_path: string | null;
          thumbnail_mime_type: string | null;
          thumbnail_size_bytes: number | null;
          asset_created_at: string;
          team_venue_id: string;
          venue_id: string;
          venue_name: string;
          venue_city: string;
          venue_country: string;
          camp_id: string;
          camp_name: string;
          session_type: Database["public"]["Enums"]["session_type"];
          session_date: string;
          total_count: number;
        }[];
      };
      get_team_gear_alert_rows: {
        Args: {
          p_gear_item_ids?: string[] | null;
          p_team_id: string;
        };
        Returns: {
          gear_item_id: string;
          team_id: string;
          name: string;
          gear_type: Database["public"]["Enums"]["gear_type"];
          usage_count: number;
          usage_minutes: number;
          alert_state: Database["public"]["Enums"]["gear_alert_state"];
          triggered_alert_count: number;
        }[];
      };
      get_team_gear_list_rows: {
        Args: {
          p_alert?: Database["public"]["Enums"]["gear_alert_state"] | null;
          p_condition?: Database["public"]["Enums"]["gear_condition"] | null;
          p_limit?: number | null;
          p_offset?: number | null;
          p_status?: Database["public"]["Enums"]["gear_status"] | null;
          p_team_id: string;
          p_type?: Database["public"]["Enums"]["gear_type"] | null;
        };
        Returns: {
          gear_item_id: string;
          team_id: string;
          name: string;
          gear_type: Database["public"]["Enums"]["gear_type"];
          serial_number: string | null;
          barcode: string | null;
          status: Database["public"]["Enums"]["gear_status"];
          condition: Database["public"]["Enums"]["gear_condition"];
          usage_count: number;
          usage_minutes: number;
          alert_state: Database["public"]["Enums"]["gear_alert_state"];
          triggered_alert_count: number;
          created_at: string;
          total_count: number;
        }[];
      };
      get_team_home_kpi_totals: {
        Args: {
          p_team_id: string;
        };
        Returns: {
          camp_count: number;
          session_count: number;
          sessions_with_net_time: number;
          total_net_time_minutes: number;
          average_net_time_minutes: number | null;
        }[];
      };
      replace_session_gear_usage_atomic: {
        Args: {
          p_gear_item_ids: string[];
          p_linked_by_profile_id: string | null;
          p_session_id: string;
          p_team_id: string;
        };
        Returns: undefined;
      };
      save_session_setup_atomic: {
        Args: {
          p_delete_item_ids: string[];
          p_ordered_item_ids: string[] | null;
          p_session_id: string;
          p_team_id: string;
          p_values: Json;
        };
        Returns: undefined;
      };
    };
    Enums: {
      assessment_run_status_type: "draft" | "published" | "closed";
      asset_type: "photo" | "analytics_file" | "document" | "gps_file";
      billing_cycle: "monthly" | "yearly" | "none";
      camp_type: "training" | "regatta" | "mixed";
      calendar_event_type: "meeting" | "travel" | "logistics" | "other";
      calendar_presence_source_type: "camp" | "event";
      gear_alert_metric: "usage_count" | "usage_minutes";
      gear_alert_severity: "warning" | "critical";
      gear_alert_state: "critical" | "warning" | "none";
      gear_condition: "new" | "used" | "refurbished";
      gear_status:
        | "active_regatta"
        | "active_training"
        | "retired_spare"
        | "on_repair";
      gear_type:
        | "sails"
        | "spars_and_foils"
        | "running_rigging"
        | "hardware_and_fittings";
      global_role_type: "super_admin";
      notification_event_type:
        | "camp_goals_added"
        | "session_review_added"
        | "session_goals_added"
        | "assessment_run_created"
        | "gear_warning"
        | "gear_critical";
      organization_role_type: "organization_admin";
      plan_tier: "free" | "pro" | "premium";
      session_type: "training" | "regatta";
      setup_metric_group: "weather" | "boat";
      setup_input_kind: "single_select" | "multi_select" | "text";
      subscription_status:
        | "active"
        | "approval_pending"
        | "approved"
        | "suspended"
        | "cancelled"
        | "expired"
        | "payment_failed";
      team_role_type: "team_admin" | "coach" | "crew";
    };
    CompositeTypes: Record<string, never>;
  };
};
