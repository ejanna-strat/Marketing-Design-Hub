// Generated from the Supabase schema. Regenerate after every migration
// (Supabase MCP `generate_typescript_types`, or `npx supabase gen types typescript`).

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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          from_value: string | null
          id: string
          note: string | null
          request_id: string
          to_value: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: string
          note?: string | null
          request_id: string
          to_value?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: string
          note?: string | null
          request_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      designers: {
        Row: {
          active: boolean
          display_name: string
          email: string
          id: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          display_name: string
          email: string
          id?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          display_name?: string
          email?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "designers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comments: string | null
          id: string
          output_rating: number
          process_rating: number
          request_id: string
          requester_id: string
          submitted_at: string
        }
        Insert: {
          comments?: string | null
          id?: string
          output_rating: number
          process_rating: number
          request_id: string
          requester_id: string
          submitted_at?: string
        }
        Update: {
          comments?: string | null
          id?: string
          output_rating?: number
          process_rating?: number
          request_id?: string
          requester_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_questions: {
        Row: {
          active: boolean
          allow_other: boolean
          field_type: Database["public"]["Enums"]["field_type"]
          help_text: string | null
          id: string
          is_output_needed: boolean
          label: string
          options: Json
          request_type_id: string | null
          required: boolean
          sort_order: number
        }
        Insert: {
          active?: boolean
          allow_other?: boolean
          field_type: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_output_needed?: boolean
          label: string
          options?: Json
          request_type_id?: string | null
          required?: boolean
          sort_order?: number
        }
        Update: {
          active?: boolean
          allow_other?: boolean
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_output_needed?: boolean
          label?: string
          options?: Json
          request_type_id?: string | null
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_questions_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "request_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          error: string | null
          id: string
          notification_key: string
          once_only: boolean
          recipients: string[]
          request_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          error?: string | null
          id?: string
          notification_key: string
          once_only?: boolean
          recipients?: string[]
          request_id?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          id?: string
          notification_key?: string
          once_only?: boolean
          recipients?: string[]
          request_id?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          team_id: string | null
          theme: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          team_id?: string | null
          theme?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          team_id?: string | null
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      request_answers: {
        Row: {
          id: string
          question_id: string
          question_label_snapshot: string
          request_id: string
          value: Json
        }
        Insert: {
          id?: string
          question_id: string
          question_label_snapshot: string
          request_id: string
          value: Json
        }
        Update: {
          id?: string
          question_id?: string
          question_label_snapshot?: string
          request_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "request_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "form_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_answers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_counters: {
        Row: {
          last_value: number
          year: number
        }
        Insert: {
          last_value?: number
          year: number
        }
        Update: {
          last_value?: number
          year?: number
        }
        Relationships: []
      }
      request_types: {
        Row: {
          active: boolean
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      requests: {
        Row: {
          assigned_designer_id: string | null
          cancel_reason: string | null
          cancelled_by: string | null
          created_at: string
          date_completed: string | null
          date_needed: string
          date_started: string | null
          deal_name: string | null
          deal_size: number | null
          designer_responded_at: string | null
          designer_response: string | null
          final_approver_email: string
          final_approver_name: string
          id: string
          is_deal: boolean
          link_to_output: string | null
          output_needed: string
          reassign_reason: string | null
          request_code: string
          request_type_id: string
          requester_email: string
          requester_id: string
          requester_name: string
          return_reason: string | null
          returned_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_designer_id?: string | null
          cancel_reason?: string | null
          cancelled_by?: string | null
          created_at?: string
          date_completed?: string | null
          date_needed: string
          date_started?: string | null
          deal_name?: string | null
          deal_size?: number | null
          designer_responded_at?: string | null
          designer_response?: string | null
          final_approver_email: string
          final_approver_name: string
          id?: string
          is_deal?: boolean
          link_to_output?: string | null
          output_needed: string
          reassign_reason?: string | null
          request_code: string
          request_type_id: string
          requester_email: string
          requester_id: string
          requester_name: string
          return_reason?: string | null
          returned_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_designer_id?: string | null
          cancel_reason?: string | null
          cancelled_by?: string | null
          created_at?: string
          date_completed?: string | null
          date_needed?: string
          date_started?: string | null
          deal_name?: string | null
          deal_size?: number | null
          designer_responded_at?: string | null
          designer_response?: string | null
          final_approver_email?: string
          final_approver_name?: string
          id?: string
          is_deal?: boolean
          link_to_output?: string | null
          output_needed?: string
          reassign_reason?: string | null
          request_code?: string
          request_type_id?: string
          requester_email?: string
          requester_id?: string
          requester_name?: string
          return_reason?: string | null
          returned_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_assigned_designer_id_fkey"
            columns: ["assigned_designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "request_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          added_at: string
          designer_display_name: string | null
          email: string
          full_name: string
          gets_team_emails: boolean
          roles: Database["public"]["Enums"]["app_role"][]
        }
        Insert: {
          added_at?: string
          designer_display_name?: string | null
          email: string
          full_name: string
          gets_team_emails?: boolean
          roles?: Database["public"]["Enums"]["app_role"][]
        }
        Update: {
          added_at?: string
          designer_display_name?: string | null
          email?: string
          full_name?: string
          gets_team_emails?: boolean
          roles?: Database["public"]["Enums"]["app_role"][]
        }
        Relationships: []
      }
      teams: {
        Row: {
          active: boolean
          id: string
          is_marketing: boolean
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id?: string
          is_marketing?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          id?: string
          is_marketing?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: { r: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      hook_restrict_signup_domain: { Args: { event: Json }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      remove_team_member: { Args: { p_email: string }; Returns: undefined }
      save_team_member: {
        Args: {
          p_designer_name: string
          p_email: string
          p_full_name: string
          p_gets_team_emails: boolean
          p_roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: undefined
      }
      submit_request: { Args: { payload: Json }; Returns: Json }
      designer_respond: {
        Args: { p_accept: boolean; p_reason: string; p_request_id: string }
        Returns: Json
      }
      return_request: { Args: { p_reason: string; p_request_id: string }; Returns: Json }
      cancel_my_request: { Args: { p_reason: string; p_request_id: string }; Returns: Json }
      submit_feedback: {
        Args: { p_comments: string; p_output: number; p_process: number; p_request_code: string }
        Returns: Json
      }
      update_request_specs: { Args: { p_answers: Json; p_request_id: string }; Returns: Json }
      update_request: { Args: { p_request_id: string; payload: Json }; Returns: Json }
      sync_team_roster: { Args: never; Returns: undefined }
      sync_user_roles: { Args: { uid: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "lead_designer" | "designer" | "requester"
      field_type:
        | "short_text"
        | "long_text"
        | "url"
        | "single_select"
        | "multi_select"
        | "date"
      request_status:
        | "new_request"
        | "designer_assigned"
        | "in_progress"
        | "for_review"
        | "for_revision"
        | "completed"
        | "rejected"
        | "cancelled"
        | "on_hold"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "lead_designer", "designer", "requester"],
      field_type: [
        "short_text",
        "long_text",
        "url",
        "single_select",
        "multi_select",
        "date",
      ],
      request_status: [
        "new_request",
        "designer_assigned",
        "in_progress",
        "for_review",
        "for_revision",
        "completed",
        "rejected",
        "cancelled",
        "on_hold",
      ],
    },
  },
} as const
