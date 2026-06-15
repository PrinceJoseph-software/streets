export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      artists: {
        Row: {
          city_id: string | null
          claimed_by: string | null
          created_at: string
          id: string
          ignited_at: string | null
          name: string
          slug: string
        }
        Insert: {
          city_id?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          ignited_at?: string | null
          name: string
          slug: string
        }
        Update: {
          city_id?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          ignited_at?: string | null
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "artists_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artists_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          country?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          country?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      engagement_events: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["engagement_kind"]
          track_id: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["engagement_kind"]
          track_id: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["engagement_kind"]
          track_id?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "engagement_events_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      flags: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "flags_reporter_id_fkey"
            columns:["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      rankings: {
        Row: {
          bucket: string
          momentum: number
          pulse: number
          rank: number | null
          track_id: string
          updated_at: string
        }
        Insert: {
          bucket: string
          momentum?: number
          pulse?: number
          rank?: number | null
          track_id: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          momentum?: number
          pulse?: number
          rank?: number | null
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rankings_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      supporter_ledger: {
        Row: {
          artist_id: string
          created_at: string
          id: string
          supporter_rank: number
          track_id: string
          user_id: string
          weeks_early: number
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          supporter_rank: number
          track_id: string
          user_id: string
          weeks_early: number
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          supporter_rank?: number
          track_id?: string
          user_id?: string
          weeks_early?: number
        }
        Relationships: [
          {
            foreignKeyName: "supporter_ledger_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supporter_ledger_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supporter_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          artist_id: string
          city_id: string | null
          clip_url: string | null
          cover_url: string
          created_at: string
          ext_platform: string
          ext_url: string
          genre_id: string | null
          id: string
          pitch: string | null
          title: string
        }
        Insert: {
          artist_id: string
          city_id?: string | null
          clip_url?: string | null
          cover_url: string
          created_at?: string
          ext_platform?: string
          ext_url: string
          genre_id?: string | null
          id?: string
          pitch?: string | null
          title: string
        }
        Update: {
          artist_id?: string
          city_id?: string | null
          clip_url?: string | null
          cover_url?: string
          created_at?: string
          ext_platform?: string
          ext_url?: string
          genre_id?: string | null
          id?: string
          pitch?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          accuracy: number | null
          created_at: string
          handle: string | null
          id: string
          is_anonymous: boolean
          taste_trust: number
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          handle?: string | null
          id: string
          is_anonymous?: boolean
          taste_trust?: number
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          handle?: string | null
          id?: string
          is_anonymous?: boolean
          taste_trust?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cast_reaction: { Args: { p_track_id: string }; Returns: undefined }
      cast_vote: { Args: { p_track_id: string }; Returns: undefined }
      recompute_pulse: { Args: never; Returns: undefined }
      record_share: { Args: { p_track_id: string }; Returns: undefined }
    }
    Enums: {
      engagement_kind: "react" | "vote" | "share"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      engagement_kind: ["react", "vote", "share"],
    },
  },
} as const
