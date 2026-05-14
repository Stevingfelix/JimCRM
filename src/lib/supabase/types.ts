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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attachment_extractions: {
        Row: {
          content_hash: string
          created_at: string
          extraction: Json
          hit_count: number
          id: string
          last_hit_at: string
          prompt_version: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          extraction: Json
          hit_count?: number
          id?: string
          last_hit_at?: string
          prompt_version: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          extraction?: Json
          hit_count?: number
          id?: string
          last_hit_at?: string
          prompt_version?: string
        }
        Relationships: []
      }
      company_info: {
        Row: {
          address: string | null
          brand_color: string | null
          company_name: string
          contact_email: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_path: string | null
          pdf_footer_text: string | null
          phone: string | null
          tagline: string | null
          tax_id: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          brand_color?: string | null
          company_name?: string
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_path?: string | null
          pdf_footer_text?: string | null
          phone?: string | null
          tagline?: string | null
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          brand_color?: string | null
          company_name?: string
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_path?: string | null
          pdf_footer_text?: string | null
          phone?: string | null
          tagline?: string | null
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      csv_export_profiles: {
        Row: {
          column_map: Json
          columns_order: string[]
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          column_map?: Json
          columns_order?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          column_map?: Json
          columns_order?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          role: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address: string | null
          contacts: Json
          created_at: string
          created_by: string | null
          discount_pct: number
          id: string
          markup_multiplier: number
          name: string
          notes: string | null
          pricing_notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billing_address?: string | null
          contacts?: Json
          created_at?: string
          created_by?: string | null
          discount_pct?: number
          id?: string
          markup_multiplier?: number
          name: string
          notes?: string | null
          pricing_notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billing_address?: string | null
          contacts?: Json
          created_at?: string
          created_by?: string | null
          discount_pct?: number
          id?: string
          markup_multiplier?: number
          name?: string
          notes?: string | null
          pricing_notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          created_by: string | null
          gmail_msg_id: string
          id: string
          label: string | null
          linked_quote_id: string | null
          linked_vendor_quote_ids: string[]
          needs_review: boolean
          parse_status: Database["public"]["Enums"]["parse_status"]
          parsed_payload: Json | null
          received_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          gmail_msg_id: string
          id?: string
          label?: string | null
          linked_quote_id?: string | null
          linked_vendor_quote_ids?: string[]
          needs_review?: boolean
          parse_status?: Database["public"]["Enums"]["parse_status"]
          parsed_payload?: Json | null
          received_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          gmail_msg_id?: string
          id?: string
          label?: string | null
          linked_quote_id?: string | null
          linked_vendor_quote_ids?: string[]
          needs_review?: boolean
          parse_status?: Database["public"]["Enums"]["parse_status"]
          parsed_payload?: Json | null
          received_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_linked_quote_id_fkey"
            columns: ["linked_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_credentials: {
        Row: {
          access_token_expires_at: string | null
          created_at: string
          created_by: string | null
          email: string
          encrypted_access_token: string | null
          encrypted_refresh_token: string
          id: string
          is_active: boolean
          last_history_id: string | null
          last_polled_at: string | null
          updated_at: string
          updated_by: string | null
          watch_expiration: string | null
          watched_label: string
        }
        Insert: {
          access_token_expires_at?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          encrypted_access_token?: string | null
          encrypted_refresh_token: string
          id?: string
          is_active?: boolean
          last_history_id?: string | null
          last_polled_at?: string | null
          updated_at?: string
          updated_by?: string | null
          watch_expiration?: string | null
          watched_label?: string
        }
        Update: {
          access_token_expires_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string
          id?: string
          is_active?: boolean
          last_history_id?: string | null
          last_polled_at?: string | null
          updated_at?: string
          updated_by?: string | null
          watch_expiration?: string | null
          watched_label?: string
        }
        Relationships: []
      }
      llm_calls: {
        Row: {
          cache_creation_input_tokens: number
          cache_read_input_tokens: number
          call_type: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          estimated_cost_usd: number
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          related_id: string | null
          succeeded: boolean
        }
        Insert: {
          cache_creation_input_tokens?: number
          cache_read_input_tokens?: number
          call_type: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          related_id?: string | null
          succeeded?: boolean
        }
        Update: {
          cache_creation_input_tokens?: number
          cache_read_input_tokens?: number
          call_type?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          related_id?: string | null
          succeeded?: boolean
        }
        Relationships: []
      }
      part_aliases: {
        Row: {
          alias_pn: string
          created_at: string
          created_by: string | null
          id: string
          part_id: string
          source_name: string | null
          source_type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alias_pn: string
          created_at?: string
          created_by?: string | null
          id?: string
          part_id: string
          source_name?: string | null
          source_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alias_pn?: string
          created_at?: string
          created_by?: string | null
          id?: string
          part_id?: string
          source_name?: string | null
          source_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_aliases_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          drive_file_id: string
          id: string
          mime_type: string | null
          name: string
          part_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          drive_file_id: string
          id?: string
          mime_type?: string | null
          name: string
          part_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          drive_file_id?: string
          id?: string
          mime_type?: string | null
          name?: string
          part_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_attachments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          internal_notes: string | null
          internal_pn: string
          target_margin_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          internal_notes?: string | null
          internal_pn: string
          target_margin_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          internal_notes?: string | null
          internal_pn?: string
          target_margin_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pdf_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          react_component_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          react_component_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          react_component_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      price_suggestion_cache: {
        Row: {
          confidence: number
          created_at: string
          customer_id: string
          id: string
          part_id: string
          qty_bucket: string
          reasoning: string
          suggested_price: number
        }
        Insert: {
          confidence: number
          created_at?: string
          customer_id: string
          id?: string
          part_id: string
          qty_bucket: string
          reasoning: string
          suggested_price: number
        }
        Update: {
          confidence?: number
          created_at?: string
          customer_id?: string
          id?: string
          part_id?: string
          qty_bucket?: string
          reasoning?: string
          suggested_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_suggestion_cache_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_suggestion_cache_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          drive_file_id: string
          id: string
          mime_type: string | null
          name: string
          quote_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          drive_file_id: string
          id?: string
          mime_type?: string | null
          name: string
          quote_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          drive_file_id?: string
          id?: string
          mime_type?: string | null
          name?: string
          quote_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_attachments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          performed_by: string | null
          quote_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          performed_by?: string | null
          quote_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          performed_by?: string | null
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          ai_reasoning: string | null
          ai_suggested_price: number | null
          created_at: string
          created_by: string | null
          id: string
          line_notes_customer: string | null
          line_notes_internal: string | null
          override_reason: string | null
          part_id: string | null
          position: number
          qty: number
          quote_id: string
          unit_price: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          ai_suggested_price?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          line_notes_customer?: string | null
          line_notes_internal?: string | null
          override_reason?: string | null
          part_id?: string | null
          position?: number
          qty: number
          quote_id: string
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          ai_suggested_price?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          line_notes_customer?: string | null
          line_notes_internal?: string | null
          override_reason?: string | null
          part_id?: string | null
          position?: number
          qty?: number
          quote_id?: string
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          customer_notes: string | null
          deleted_at: string | null
          id: string
          internal_notes: string | null
          outcome_at: string | null
          outcome_reason: string | null
          public_shared_at: string | null
          public_token: string | null
          quote_number: number
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          template_id: string | null
          updated_at: string
          updated_by: string | null
          validity_date: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_notes?: string | null
          deleted_at?: string | null
          id?: string
          internal_notes?: string | null
          outcome_at?: string | null
          outcome_reason?: string | null
          public_shared_at?: string | null
          public_token?: string | null
          quote_number?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          template_id?: string | null
          updated_at?: string
          updated_by?: string | null
          validity_date?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_notes?: string | null
          deleted_at?: string | null
          id?: string
          internal_notes?: string | null
          outcome_at?: string | null
          outcome_reason?: string | null
          public_shared_at?: string | null
          public_token?: string | null
          quote_number?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          template_id?: string | null
          updated_at?: string
          updated_by?: string | null
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pdf_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendor_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          role: string | null
          updated_at: string
          updated_by: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_time_days: number | null
          part_id: string | null
          qty: number | null
          quoted_at: string
          source_message_id: string | null
          source_note: string | null
          unit_price: number
          updated_at: string
          updated_by: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_time_days?: number | null
          part_id?: string | null
          qty?: number | null
          quoted_at?: string
          source_message_id?: string | null
          source_note?: string | null
          unit_price: number
          updated_at?: string
          updated_by?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_time_days?: number | null
          part_id?: string | null
          qty?: number | null
          quoted_at?: string
          source_message_id?: string | null
          source_note?: string | null
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_quotes_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_rfqs: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          part_ids: string[]
          quote_id: string | null
          reply_at: string | null
          reply_vendor_quote_ids: string[]
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
          updated_by: string | null
          vendor_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          part_ids?: string[]
          quote_id?: string | null
          reply_at?: string | null
          reply_vendor_quote_ids?: string[]
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          updated_by?: string | null
          vendor_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          part_ids?: string[]
          quote_id?: string | null
          reply_at?: string | null
          reply_vendor_quote_ids?: string[]
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_rfqs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_rfqs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          categories: string[]
          contacts: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          categories?: string[]
          contacts?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          categories?: string[]
          contacts?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_quote_public_token: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      parse_status: "pending" | "parsed" | "failed" | "skipped"
      quote_status: "draft" | "sent" | "won" | "lost" | "expired"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      parse_status: ["pending", "parsed", "failed", "skipped"],
      quote_status: ["draft", "sent", "won", "lost", "expired"],
    },
  },
} as const
