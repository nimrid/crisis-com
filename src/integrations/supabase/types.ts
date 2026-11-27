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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audience_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audience: string
          church_id: string | null
          confidentiality_acknowledged: boolean
          created_at: string
          draft_text: string
          id: string
          incident_id: string
          origin: string
          owner_id: string
          recipient_tier: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audience: string
          church_id?: string | null
          confidentiality_acknowledged?: boolean
          created_at?: string
          draft_text?: string
          id?: string
          incident_id: string
          origin?: string
          owner_id: string
          recipient_tier?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string
          church_id?: string | null
          confidentiality_acknowledged?: boolean
          created_at?: string
          draft_text?: string
          id?: string
          incident_id?: string
          origin?: string
          owner_id?: string
          recipient_tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_drafts_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audience_drafts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incident_records"
            referencedColumns: ["id"]
          },
        ]
      }
      church_members: {
        Row: {
          church_id: string
          created_at: string
          email: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          email: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          email?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      counseling_vault: {
        Row: {
          church_id: string | null
          created_at: string
          id: string
          incident_id: string
          note: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          church_id?: string | null
          created_at?: string
          id?: string
          incident_id: string
          note: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          church_id?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          note?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "counseling_vault_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counseling_vault_incident_id_owner_id_fkey"
            columns: ["incident_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "incident_records"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      incident_records: {
        Row: {
          church_id: string | null
          confirmed_facts: Json
          confirmed_parties: Json
          created_at: string
          id: string
          intake_notes: string
          legal_notes: Json
          medical_family_details: Json
          owner_id: string
          pastoral_guidance: Json
          safety_gates: Json
          situation_type: string
          timeline: Json
          title: string
          unconfirmed_rumors: Json
          updated_at: string
        }
        Insert: {
          church_id?: string | null
          confirmed_facts?: Json
          confirmed_parties?: Json
          created_at?: string
          id?: string
          intake_notes?: string
          legal_notes?: Json
          medical_family_details?: Json
          owner_id: string
          pastoral_guidance?: Json
          safety_gates?: Json
          situation_type: string
          timeline?: Json
          title: string
          unconfirmed_rumors?: Json
          updated_at?: string
        }
        Update: {
          church_id?: string | null
          confirmed_facts?: Json
          confirmed_parties?: Json
          created_at?: string
          id?: string
          intake_notes?: string
          legal_notes?: Json
          medical_family_details?: Json
          owner_id?: string
          pastoral_guidance?: Json
          safety_gates?: Json
          situation_type?: string
          timeline?: Json
          title?: string
          unconfirmed_rumors?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_records_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      team_profiles: {
        Row: {
          church_id: string | null
          church_name: string
          contact_preferences: Json
          created_at: string
          leadership_roles: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          church_id?: string | null
          church_name?: string
          contact_preferences?: Json
          created_at?: string
          leadership_roles?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          church_id?: string | null
          church_name?: string
          contact_preferences?: Json
          created_at?: string
          leadership_roles?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_profiles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graceguard_has_church_role: {
        Args: { _church_id: string; _roles: string[] }
        Returns: boolean
      }
      graceguard_is_church_member: {
        Args: { _church_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
