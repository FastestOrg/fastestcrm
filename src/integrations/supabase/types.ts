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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          scheduled_at: string | null
          target_company_ids: string[] | null
          target_subscription_statuses: string[] | null
          target_type: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          scheduled_at?: string | null
          target_company_ids?: string[] | null
          target_subscription_statuses?: string[] | null
          target_type?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          scheduled_at?: string | null
          target_company_ids?: string[] | null
          target_subscription_statuses?: string[] | null
          target_type?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          automation_id: string
          created_at: string | null
          id: string
          logs: string | null
          status: string
        }
        Insert: {
          automation_id: string
          created_at?: string | null
          id?: string
          logs?: string | null
          status: string
        }
        Update: {
          automation_id?: string
          created_at?: string | null
          id?: string
          logs?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_states: {
        Row: {
          automation_id: string
          last_index: number | null
          updated_at: string | null
        }
        Insert: {
          automation_id: string
          last_index?: number | null
          updated_at?: string | null
        }
        Update: {
          automation_id?: string
          last_index?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_states_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: true
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action_config: Json | null
          action_type: string
          company_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_pages: {
        Row: {
          availability: Json
          buffer_minutes: number | null
          company_id: string
          created_at: string
          description: string | null
          durations: number[]
          id: string
          is_active: boolean | null
          slug: string
          timezone: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: Json
          buffer_minutes?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          durations?: number[]
          id?: string
          is_active?: boolean | null
          slug: string
          timezone?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: Json
          buffer_minutes?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          durations?: number[]
          id?: string
          is_active?: boolean | null
          slug?: string
          timezone?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_pages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          attendee_email: string | null
          attendee_name: string | null
          attendee_phone: string | null
          booking_page_id: string | null
          company_id: string
          created_at: string
          description: string | null
          end_time: string
          event_type: string
          google_event_id: string | null
          id: string
          lead_id: string | null
          location: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          booking_page_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          end_time: string
          event_type?: string
          google_event_id?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          booking_page_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          end_time?: string
          event_type?: string
          google_event_id?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_booking_page_id_fkey"
            columns: ["booking_page_id"]
            isOneToOne: false
            referencedRelation: "booking_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          admin_id: string
          billing_cycle_anchor: string | null
          created_at: string | null
          custom_domain: string | null
          custom_leads_table: string | null
          domain_status: string | null
          features: Json | null
          id: string
          industry: string | null
          industry_locked: boolean | null
          is_active: boolean | null
          logo_url: string | null
          mask_leads: boolean | null
          name: string
          primary_color: string | null
          slug: string
          subscription_status: string | null
          subscription_valid_until: string | null
          total_licenses: number
          unique_constraints: string[] | null
          updated_at: string | null
          used_licenses: number
        }
        Insert: {
          admin_id: string
          billing_cycle_anchor?: string | null
          created_at?: string | null
          custom_domain?: string | null
          custom_leads_table?: string | null
          domain_status?: string | null
          features?: Json | null
          id?: string
          industry?: string | null
          industry_locked?: boolean | null
          is_active?: boolean | null
          logo_url?: string | null
          mask_leads?: boolean | null
          name: string
          primary_color?: string | null
          slug: string
          subscription_status?: string | null
          subscription_valid_until?: string | null
          total_licenses?: number
          unique_constraints?: string[] | null
          updated_at?: string | null
          used_licenses?: number
        }
        Update: {
          admin_id?: string
          billing_cycle_anchor?: string | null
          created_at?: string | null
          custom_domain?: string | null
          custom_leads_table?: string | null
          domain_status?: string | null
          features?: Json | null
          id?: string
          industry?: string | null
          industry_locked?: boolean | null
          is_active?: boolean | null
          logo_url?: string | null
          mask_leads?: boolean | null
          name?: string
          primary_color?: string | null
          slug?: string
          subscription_status?: string | null
          subscription_valid_until?: string | null
          total_licenses?: number
          unique_constraints?: string[] | null
          updated_at?: string | null
          used_licenses?: number
        }
        Relationships: []
      }
      company_hierarchies: {
        Row: {
          company_id: string
          created_at: string
          level_1: string
          level_10: string
          level_11: string
          level_12: string
          level_13: string
          level_14: string
          level_15: string
          level_16: string
          level_17: string
          level_18: string
          level_19: string
          level_2: string
          level_20: string
          level_3: string
          level_4: string
          level_5: string
          level_6: string
          level_7: string
          level_8: string
          level_9: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          level_1?: string
          level_10?: string
          level_11?: string
          level_12?: string
          level_13?: string
          level_14?: string
          level_15?: string
          level_16?: string
          level_17?: string
          level_18?: string
          level_19?: string
          level_2?: string
          level_20?: string
          level_3?: string
          level_4?: string
          level_5?: string
          level_6?: string
          level_7?: string
          level_8?: string
          level_9?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          level_1?: string
          level_10?: string
          level_11?: string
          level_12?: string
          level_13?: string
          level_14?: string
          level_15?: string
          level_16?: string
          level_17?: string
          level_18?: string
          level_19?: string
          level_2?: string
          level_20?: string
          level_3?: string
          level_4?: string
          level_5?: string
          level_6?: string
          level_7?: string
          level_8?: string
          level_9?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_hierarchies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_lead_statuses: {
        Row: {
          category: string
          color: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          label: string
          order_index: number
          status_type: string | null
          sub_statuses: string[] | null
          updated_at: string
          value: string
          web_push_enabled: boolean | null
        }
        Insert: {
          category: string
          color: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          label: string
          order_index?: number
          status_type?: string | null
          sub_statuses?: string[] | null
          updated_at?: string
          value: string
          web_push_enabled?: boolean | null
        }
        Update: {
          category?: string
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string
          order_index?: number
          status_type?: string | null
          sub_statuses?: string[] | null
          updated_at?: string
          value?: string
          web_push_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "company_lead_statuses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_licenses: {
        Row: {
          amount_paid: number
          company_id: string
          created_at: string | null
          id: string
          payment_id: string | null
          quantity: number
          razorpay_order_id: string | null
          status: string | null
        }
        Insert: {
          amount_paid: number
          company_id: string
          created_at?: string | null
          id?: string
          payment_id?: string | null
          quantity: number
          razorpay_order_id?: string | null
          status?: string | null
        }
        Update: {
          amount_paid?: number
          company_id?: string
          created_at?: string | null
          id?: string
          payment_id?: string | null
          quantity?: number
          razorpay_order_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_licenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      country_prefixes: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          dial_code: string
          flag_emoji: string
          id: string
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          dial_code: string
          flag_emoji: string
          id?: string
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          dial_code?: string
          flag_emoji?: string
          id?: string
        }
        Relationships: []
      }
      debug_logs: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          message: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          message?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          message?: string | null
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          discount_percentage: number
          total_uses: number | null
          uses_count: number | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          discount_percentage: number
          total_uses?: number | null
          uses_count?: number | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          discount_percentage?: number
          total_uses?: number | null
          uses_count?: number | null
          valid_until?: string | null
        }
        Relationships: []
      }
      domain_verification: {
        Row: {
          company_id: string
          created_at: string | null
          domain: string
          id: string
          is_verified: boolean | null
          txt_record_name: string
          txt_record_value: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          domain: string
          id?: string
          is_verified?: boolean | null
          txt_record_name: string
          txt_record_value: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          domain?: string
          id?: string
          is_verified?: boolean | null
          txt_record_name?: string
          txt_record_value?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_verification_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token: string | null
          company_id: string
          created_at: string | null
          daily_limit: number | null
          display_name: string | null
          email_address: string
          emails_sent_today: number | null
          id: string
          imap_host: string | null
          imap_password: string | null
          imap_port: number | null
          imap_user: string | null
          last_error: string | null
          protocol: string
          provider: string
          refresh_token: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
          warmup_current_day: number | null
          warmup_daily_target: number | null
          warmup_enabled: boolean | null
          warmup_ramp_per_day: number | null
        }
        Insert: {
          access_token?: string | null
          company_id: string
          created_at?: string | null
          daily_limit?: number | null
          display_name?: string | null
          email_address: string
          emails_sent_today?: number | null
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_user?: string | null
          last_error?: string | null
          protocol?: string
          provider?: string
          refresh_token?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
          warmup_current_day?: number | null
          warmup_daily_target?: number | null
          warmup_enabled?: boolean | null
          warmup_ramp_per_day?: number | null
        }
        Update: {
          access_token?: string | null
          company_id?: string
          created_at?: string | null
          daily_limit?: number | null
          display_name?: string | null
          email_address?: string
          emails_sent_today?: number | null
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_user?: string | null
          last_error?: string | null
          protocol?: string
          provider?: string
          refresh_token?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
          warmup_current_day?: number | null
          warmup_daily_target?: number | null
          warmup_enabled?: boolean | null
          warmup_ramp_per_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_aliases: {
        Row: {
          alias_email: string
          company_id: string
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          alias_email: string
          company_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          alias_email?: string
          company_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_aliases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_logs: {
        Row: {
          campaign_id: string | null
          clicked_at: string | null
          company_id: string
          error_message: string | null
          id: string
          opened_at: string | null
          recipient_email: string | null
          recipient_id: string | null
          replied_at: string | null
          sent_at: string | null
          sent_by_account_id: string | null
          sequence_step_id: string | null
          status: string | null
          subject: string | null
          tracking_pixel_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          clicked_at?: string | null
          company_id: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sent_by_account_id?: string | null
          sequence_step_id?: string | null
          status?: string | null
          subject?: string | null
          tracking_pixel_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          clicked_at?: string | null
          company_id?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sent_by_account_id?: string | null
          sequence_step_id?: string | null
          status?: string | null
          subject?: string | null
          tracking_pixel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_logs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "email_campaign_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_logs_sent_by_account_id_fkey"
            columns: ["sent_by_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_logs_sequence_step_id_fkey"
            columns: ["sequence_step_id"]
            isOneToOne: false
            referencedRelation: "email_campaign_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_recipients: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          created_at: string | null
          current_step: number | null
          id: string
          last_sent_at: string | null
          lead_data: Json | null
          lead_email: string
          lead_id: string | null
          lead_name: string | null
          lead_table: string | null
          opened_at: string | null
          replied_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          last_sent_at?: string | null
          lead_data?: Json | null
          lead_email: string
          lead_id?: string | null
          lead_name?: string | null
          lead_table?: string | null
          opened_at?: string | null
          replied_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          last_sent_at?: string | null
          lead_data?: Json | null
          lead_email?: string
          lead_id?: string | null
          lead_name?: string | null
          lead_table?: string | null
          opened_at?: string | null
          replied_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_sequences: {
        Row: {
          ai_generated: boolean | null
          body_html: string
          body_text: string | null
          campaign_id: string
          created_at: string | null
          delay_after_ms: number | null
          id: string
          send_condition: string | null
          step_number: number
          subject: string
          updated_at: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          body_html: string
          body_text?: string | null
          campaign_id: string
          created_at?: string | null
          delay_after_ms?: number | null
          id?: string
          send_condition?: string | null
          step_number?: number
          subject: string
          updated_at?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          body_html?: string
          body_text?: string | null
          campaign_id?: string
          created_at?: string | null
          delay_after_ms?: number | null
          id?: string
          send_condition?: string | null
          step_number?: number
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          account_ids: string[] | null
          ai_generated: boolean | null
          ai_perspective: string | null
          campaign_goal: string | null
          campaign_mode: string | null
          company_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          daily_limit: number | null
          delay_between_emails_ms: number | null
          id: string
          name: string
          recipient_count: number | null
          recipient_filter: Json | null
          scheduled_at: string | null
          started_at: string | null
          status: string | null
          updated_at: string | null
          warmup_enabled: boolean | null
          warmup_ramp_per_day: number | null
        }
        Insert: {
          account_ids?: string[] | null
          ai_generated?: boolean | null
          ai_perspective?: string | null
          campaign_goal?: string | null
          campaign_mode?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_limit?: number | null
          delay_between_emails_ms?: number | null
          id?: string
          name: string
          recipient_count?: number | null
          recipient_filter?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          warmup_enabled?: boolean | null
          warmup_ramp_per_day?: number | null
        }
        Update: {
          account_ids?: string[] | null
          ai_generated?: boolean | null
          ai_perspective?: string | null
          campaign_goal?: string | null
          campaign_mode?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_limit?: number | null
          delay_between_emails_ms?: number | null
          id?: string
          name?: string
          recipient_count?: number | null
          recipient_filter?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          warmup_enabled?: boolean | null
          warmup_ramp_per_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_integrations: {
        Row: {
          access_token: string | null
          admin_email: string | null
          company_id: string
          created_at: string
          email_dashboard_enabled: boolean
          id: string
          is_active: boolean
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          admin_email?: string | null
          company_id: string
          created_at?: string
          email_dashboard_enabled?: boolean
          id?: string
          is_active?: boolean
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          admin_email?: string | null
          company_id?: string
          created_at?: string
          email_dashboard_enabled?: boolean
          id?: string
          is_active?: boolean
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      features_unlocked: {
        Row: {
          amount_paid: number
          company_id: string
          feature_name: string
          id: string
          unlocked_at: string | null
          unlocked_by: string | null
        }
        Insert: {
          amount_paid: number
          company_id: string
          feature_name: string
          id?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
        }
        Update: {
          amount_paid?: number
          company_id?: string
          feature_name?: string
          id?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "features_unlocked_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "features_unlocked_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          created_by_id: string
          description: string | null
          fields: Json
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_id: string
          description?: string | null
          fields?: Json
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_id?: string
          description?: string | null
          fields?: Json
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          active: boolean | null
          amount: number
          code: string
          created_at: string | null
          expires_at: string | null
          is_redeemed: boolean | null
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          active?: boolean | null
          amount: number
          code: string
          created_at?: string | null
          expires_at?: string | null
          is_redeemed?: boolean | null
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          code?: string
          created_at?: string | null
          expires_at?: string | null
          is_redeemed?: boolean | null
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_api_keys: {
        Row: {
          api_key: string
          created_at: string | null
          id: string
          is_active: boolean | null
          service_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          service_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          service_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lead_profiling_config: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          id: string
          industry: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          id?: string
          industry: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          industry?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_profiling_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          batch_month: string | null
          branch: string | null
          ca_name: string | null
          cgpa: number | null
          college: string | null
          company: string | null
          company_id: string | null
          created_at: string
          created_by_id: string
          domain: string | null
          email: string | null
          form_id: string | null
          graduating_year: number | null
          id: string
          last_notification_sent_at: string | null
          lead_history: Json | null
          lead_source: string | null
          lg_link_id: string | null
          name: string
          notes: string | null
          payment_link: string | null
          phone: string | null
          post_sales_owner_id: string | null
          pre_sales_owner_id: string | null
          preferred_language: string | null
          product_category: string | null
          product_purchased: string | null
          reminder_at: string | null
          revenue_projected: number | null
          revenue_received: number | null
          sales_owner_id: string | null
          send_web_push: boolean
          state: string | null
          status: string
          total_recovered: number | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          batch_month?: string | null
          branch?: string | null
          ca_name?: string | null
          cgpa?: number | null
          college?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          created_by_id: string
          domain?: string | null
          email?: string | null
          form_id?: string | null
          graduating_year?: number | null
          id?: string
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          name: string
          notes?: string | null
          payment_link?: string | null
          phone?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          preferred_language?: string | null
          product_category?: string | null
          product_purchased?: string | null
          reminder_at?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          send_web_push?: boolean
          state?: string | null
          status?: string
          total_recovered?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          batch_month?: string | null
          branch?: string | null
          ca_name?: string | null
          cgpa?: number | null
          college?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          created_by_id?: string
          domain?: string | null
          email?: string | null
          form_id?: string | null
          graduating_year?: number | null
          id?: string
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          name?: string
          notes?: string | null
          payment_link?: string | null
          phone?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          preferred_language?: string | null
          product_category?: string | null
          product_purchased?: string | null
          reminder_at?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          send_web_push?: boolean
          state?: string | null
          status?: string
          total_recovered?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lg_link_id_fkey"
            columns: ["lg_link_id"]
            isOneToOne: false
            referencedRelation: "lg_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_post_sales_owner_id_fkey"
            columns: ["post_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_pre_sales_owner_id_fkey"
            columns: ["pre_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_sales_owner_id_fkey"
            columns: ["sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_healthcare: {
        Row: {
          age: number | null
          appointment_date: string | null
          appointment_time: string | null
          company_id: string | null
          condition: string | null
          created_at: string
          created_by_id: string
          department: string | null
          doctor_preference: string | null
          email: string | null
          follow_up_date: string | null
          form_id: string | null
          gender: string | null
          id: string
          insurance_id: string | null
          insurance_provider: string | null
          last_notification_sent_at: string | null
          lead_history: Json | null
          lead_profile: Json | null
          lead_source: string | null
          lg_link_id: string | null
          name: string
          notes: string | null
          payment_link: string | null
          phone: string | null
          post_sales_owner_id: string | null
          pre_sales_owner_id: string | null
          referral_source: string | null
          reminder_at: string | null
          revenue_projected: number | null
          revenue_received: number | null
          sales_owner_id: string | null
          status: string
          status_metadata: Json | null
          symptoms: string | null
          treatment_cost: number | null
          treatment_date: string | null
          treatment_type: string | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          age?: number | null
          appointment_date?: string | null
          appointment_time?: string | null
          company_id?: string | null
          condition?: string | null
          created_at?: string
          created_by_id: string
          department?: string | null
          doctor_preference?: string | null
          email?: string | null
          follow_up_date?: string | null
          form_id?: string | null
          gender?: string | null
          id?: string
          insurance_id?: string | null
          insurance_provider?: string | null
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_profile?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          name: string
          notes?: string | null
          payment_link?: string | null
          phone?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          referral_source?: string | null
          reminder_at?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          status?: string
          status_metadata?: Json | null
          symptoms?: string | null
          treatment_cost?: number | null
          treatment_date?: string | null
          treatment_type?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          age?: number | null
          appointment_date?: string | null
          appointment_time?: string | null
          company_id?: string | null
          condition?: string | null
          created_at?: string
          created_by_id?: string
          department?: string | null
          doctor_preference?: string | null
          email?: string | null
          follow_up_date?: string | null
          form_id?: string | null
          gender?: string | null
          id?: string
          insurance_id?: string | null
          insurance_provider?: string | null
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_profile?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          name?: string
          notes?: string | null
          payment_link?: string | null
          phone?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          referral_source?: string | null
          reminder_at?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          status?: string
          status_metadata?: Json | null
          symptoms?: string | null
          treatment_cost?: number | null
          treatment_date?: string | null
          treatment_type?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_healthcare_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_healthcare_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_healthcare_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_healthcare_lg_link_id_fkey"
            columns: ["lg_link_id"]
            isOneToOne: false
            referencedRelation: "lg_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_healthcare_post_sales_owner_id_fkey"
            columns: ["post_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_healthcare_pre_sales_owner_id_fkey"
            columns: ["pre_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_healthcare_sales_owner_id_fkey"
            columns: ["sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_insurance: {
        Row: {
          age: number | null
          agent_name: string | null
          annual_income: number | null
          company_id: string | null
          contribution_frequency: string | null
          created_at: string
          created_by_id: string
          date_of_birth: string | null
          email: string | null
          existing_policies: string | null
          form_id: string | null
          gender: string | null
          id: string
          insurance_type: string | null
          last_notification_sent_at: string | null
          lead_history: Json | null
          lead_profile: Json | null
          lead_source: string | null
          lg_link_id: string | null
          loss_reason: string | null
          name: string
          nominee_name: string | null
          nominee_relation: string | null
          notes: string | null
          occupation: string | null
          pan_number: string | null
          payment_link: string | null
          phone: string | null
          plan_name: string | null
          policy_number: string | null
          policy_start_date: string | null
          policy_term: number | null
          post_sales_owner_id: string | null
          pre_sales_owner_id: string | null
          premium_amount: number | null
          reminder_at: string | null
          renewal_date: string | null
          revenue_projected: number | null
          revenue_received: number | null
          sales_owner_id: string | null
          status: string
          status_metadata: Json | null
          sum_insured: number | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          age?: number | null
          agent_name?: string | null
          annual_income?: number | null
          company_id?: string | null
          contribution_frequency?: string | null
          created_at?: string
          created_by_id: string
          date_of_birth?: string | null
          email?: string | null
          existing_policies?: string | null
          form_id?: string | null
          gender?: string | null
          id?: string
          insurance_type?: string | null
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_profile?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          loss_reason?: string | null
          name: string
          nominee_name?: string | null
          nominee_relation?: string | null
          notes?: string | null
          occupation?: string | null
          pan_number?: string | null
          payment_link?: string | null
          phone?: string | null
          plan_name?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          policy_term?: number | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          premium_amount?: number | null
          reminder_at?: string | null
          renewal_date?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          status?: string
          status_metadata?: Json | null
          sum_insured?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          age?: number | null
          agent_name?: string | null
          annual_income?: number | null
          company_id?: string | null
          contribution_frequency?: string | null
          created_at?: string
          created_by_id?: string
          date_of_birth?: string | null
          email?: string | null
          existing_policies?: string | null
          form_id?: string | null
          gender?: string | null
          id?: string
          insurance_type?: string | null
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_profile?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          loss_reason?: string | null
          name?: string
          nominee_name?: string | null
          nominee_relation?: string | null
          notes?: string | null
          occupation?: string | null
          pan_number?: string | null
          payment_link?: string | null
          phone?: string | null
          plan_name?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          policy_term?: number | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          premium_amount?: number | null
          reminder_at?: string | null
          renewal_date?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          status?: string
          status_metadata?: Json | null
          sum_insured?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_insurance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_insurance_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_insurance_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_insurance_lg_link_id_fkey"
            columns: ["lg_link_id"]
            isOneToOne: false
            referencedRelation: "lg_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_insurance_post_sales_owner_id_fkey"
            columns: ["post_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_insurance_pre_sales_owner_id_fkey"
            columns: ["pre_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_insurance_sales_owner_id_fkey"
            columns: ["sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_real_estate: {
        Row: {
          broker_name: string | null
          budget_max: number | null
          budget_min: number | null
          commission_amount: number | null
          commission_percentage: number | null
          company_id: string | null
          created_at: string
          created_by_id: string
          deal_value: number | null
          email: string | null
          form_id: string | null
          id: string
          last_notification_sent_at: string | null
          lead_history: Json | null
          lead_profile: Json | null
          lead_source: string | null
          lg_link_id: string | null
          name: string
          notes: string | null
          payment_link: string | null
          phone: string | null
          possession_timeline: string | null
          post_sales_owner_id: string | null
          pre_sales_owner_id: string | null
          preferred_location: string | null
          property_name: string | null
          property_size: string | null
          property_type: string | null
          purpose: string | null
          reminder_at: string | null
          revenue_projected: number | null
          revenue_received: number | null
          sales_owner_id: string | null
          send_web_push: boolean
          site_visit_photos: Json | null
          status: string
          status_metadata: Json | null
          unit_number: string | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          broker_name?: string | null
          budget_max?: number | null
          budget_min?: number | null
          commission_amount?: number | null
          commission_percentage?: number | null
          company_id?: string | null
          created_at?: string
          created_by_id: string
          deal_value?: number | null
          email?: string | null
          form_id?: string | null
          id?: string
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_profile?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          name: string
          notes?: string | null
          payment_link?: string | null
          phone?: string | null
          possession_timeline?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          preferred_location?: string | null
          property_name?: string | null
          property_size?: string | null
          property_type?: string | null
          purpose?: string | null
          reminder_at?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          send_web_push?: boolean
          site_visit_photos?: Json | null
          status?: string
          status_metadata?: Json | null
          unit_number?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          broker_name?: string | null
          budget_max?: number | null
          budget_min?: number | null
          commission_amount?: number | null
          commission_percentage?: number | null
          company_id?: string | null
          created_at?: string
          created_by_id?: string
          deal_value?: number | null
          email?: string | null
          form_id?: string | null
          id?: string
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_profile?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          name?: string
          notes?: string | null
          payment_link?: string | null
          phone?: string | null
          possession_timeline?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          preferred_location?: string | null
          property_name?: string | null
          property_size?: string | null
          property_type?: string | null
          purpose?: string | null
          reminder_at?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          send_web_push?: boolean
          site_visit_photos?: Json | null
          status?: string
          status_metadata?: Json | null
          unit_number?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_real_estate_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_real_estate_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_real_estate_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_real_estate_lg_link_id_fkey"
            columns: ["lg_link_id"]
            isOneToOne: false
            referencedRelation: "lg_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_real_estate_post_sales_owner_id_fkey"
            columns: ["post_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_real_estate_pre_sales_owner_id_fkey"
            columns: ["pre_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_real_estate_sales_owner_id_fkey"
            columns: ["sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_saas: {
        Row: {
          annual_value: number | null
          champion: string | null
          company_id: string | null
          company_name: string | null
          company_size: string | null
          company_website: string | null
          competitors: string | null
          contract_length: number | null
          created_at: string
          created_by_id: string
          current_solution: string | null
          deal_stage: string | null
          decision_maker: string | null
          demo_date: string | null
          email: string | null
          form_id: string | null
          id: string
          job_title: string | null
          last_notification_sent_at: string | null
          lead_history: Json | null
          lead_profile: Json | null
          lead_source: string | null
          lg_link_id: string | null
          loss_reason: string | null
          monthly_value: number | null
          name: string
          notes: string | null
          payment_link: string | null
          phone: string | null
          plan_type: string | null
          post_sales_owner_id: string | null
          pre_sales_owner_id: string | null
          product_interest: string | null
          reminder_at: string | null
          revenue_projected: number | null
          revenue_received: number | null
          sales_owner_id: string | null
          seats: number | null
          status: string
          status_metadata: Json | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
          use_case: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          annual_value?: number | null
          champion?: string | null
          company_id?: string | null
          company_name?: string | null
          company_size?: string | null
          company_website?: string | null
          competitors?: string | null
          contract_length?: number | null
          created_at?: string
          created_by_id: string
          current_solution?: string | null
          deal_stage?: string | null
          decision_maker?: string | null
          demo_date?: string | null
          email?: string | null
          form_id?: string | null
          id?: string
          job_title?: string | null
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_profile?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          loss_reason?: string | null
          monthly_value?: number | null
          name: string
          notes?: string | null
          payment_link?: string | null
          phone?: string | null
          plan_type?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          product_interest?: string | null
          reminder_at?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          seats?: number | null
          status?: string
          status_metadata?: Json | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          use_case?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          annual_value?: number | null
          champion?: string | null
          company_id?: string | null
          company_name?: string | null
          company_size?: string | null
          company_website?: string | null
          competitors?: string | null
          contract_length?: number | null
          created_at?: string
          created_by_id?: string
          current_solution?: string | null
          deal_stage?: string | null
          decision_maker?: string | null
          demo_date?: string | null
          email?: string | null
          form_id?: string | null
          id?: string
          job_title?: string | null
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_profile?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          loss_reason?: string | null
          monthly_value?: number | null
          name?: string
          notes?: string | null
          payment_link?: string | null
          phone?: string | null
          plan_type?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          product_interest?: string | null
          reminder_at?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          seats?: number | null
          status?: string
          status_metadata?: Json | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          use_case?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_saas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_saas_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_saas_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_saas_lg_link_id_fkey"
            columns: ["lg_link_id"]
            isOneToOne: false
            referencedRelation: "lg_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_saas_post_sales_owner_id_fkey"
            columns: ["post_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_saas_pre_sales_owner_id_fkey"
            columns: ["pre_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_saas_sales_owner_id_fkey"
            columns: ["sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_travel: {
        Row: {
          advance_paid: number | null
          balance_due: number | null
          booking_id: string | null
          budget: number | null
          company_id: string | null
          created_at: string
          created_by_id: string
          destination: string | null
          email: string | null
          flight_details: string | null
          form_id: string | null
          hotel_name: string | null
          id: string
          last_notification_sent_at: string | null
          lead_history: Json | null
          lead_profile: Json | null
          lead_source: string | null
          lg_link_id: string | null
          name: string
          notes: string | null
          package_cost: number | null
          package_type: string | null
          payment_link: string | null
          phone: string | null
          post_sales_owner_id: string | null
          pre_sales_owner_id: string | null
          reminder_at: string | null
          return_date: string | null
          revenue_projected: number | null
          revenue_received: number | null
          sales_owner_id: string | null
          special_requests: string | null
          status: string
          status_metadata: Json | null
          travel_date: string | null
          travelers_count: number | null
          trip_type: string | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          advance_paid?: number | null
          balance_due?: number | null
          booking_id?: string | null
          budget?: number | null
          company_id?: string | null
          created_at?: string
          created_by_id: string
          destination?: string | null
          email?: string | null
          flight_details?: string | null
          form_id?: string | null
          hotel_name?: string | null
          id?: string
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_profile?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          name: string
          notes?: string | null
          package_cost?: number | null
          package_type?: string | null
          payment_link?: string | null
          phone?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          reminder_at?: string | null
          return_date?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          special_requests?: string | null
          status?: string
          status_metadata?: Json | null
          travel_date?: string | null
          travelers_count?: number | null
          trip_type?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          advance_paid?: number | null
          balance_due?: number | null
          booking_id?: string | null
          budget?: number | null
          company_id?: string | null
          created_at?: string
          created_by_id?: string
          destination?: string | null
          email?: string | null
          flight_details?: string | null
          form_id?: string | null
          hotel_name?: string | null
          id?: string
          last_notification_sent_at?: string | null
          lead_history?: Json | null
          lead_profile?: Json | null
          lead_source?: string | null
          lg_link_id?: string | null
          name?: string
          notes?: string | null
          package_cost?: number | null
          package_type?: string | null
          payment_link?: string | null
          phone?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          reminder_at?: string | null
          return_date?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          special_requests?: string | null
          status?: string
          status_metadata?: Json | null
          travel_date?: string | null
          travelers_count?: number | null
          trip_type?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_travel_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_travel_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_travel_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_travel_lg_link_id_fkey"
            columns: ["lg_link_id"]
            isOneToOne: false
            referencedRelation: "lg_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_travel_post_sales_owner_id_fkey"
            columns: ["post_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_travel_pre_sales_owner_id_fkey"
            columns: ["pre_sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_travel_sales_owner_id_fkey"
            columns: ["sales_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_weskill: {
        Row: {
          batch_month: string | null
          branch: string | null
          ca_name: string | null
          cgpa: number | null
          college: string | null
          company: string | null
          company_id: string | null
          created_at: string
          created_by_id: string
          domain: string | null
          email: string | null
          form_id: string | null
          graduating_year: number | null
          id: string
          last_notification_sent_at: string | null
          lead_source: string | null
          lg_link_id: string | null
          name: string
          notes: string | null
          payment_link: string | null
          phone: string | null
          post_sales_owner_id: string | null
          pre_sales_owner_id: string | null
          preferred_language: string | null
          product_category: string | null
          product_purchased: string | null
          reminder_at: string | null
          revenue_projected: number | null
          revenue_received: number | null
          sales_owner_id: string | null
          send_web_push: boolean
          state: string | null
          status: string
          total_recovered: number | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          batch_month?: string | null
          branch?: string | null
          ca_name?: string | null
          cgpa?: number | null
          college?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          created_by_id: string
          domain?: string | null
          email?: string | null
          form_id?: string | null
          graduating_year?: number | null
          id?: string
          last_notification_sent_at?: string | null
          lead_source?: string | null
          lg_link_id?: string | null
          name: string
          notes?: string | null
          payment_link?: string | null
          phone?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          preferred_language?: string | null
          product_category?: string | null
          product_purchased?: string | null
          reminder_at?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          send_web_push?: boolean
          state?: string | null
          status?: string
          total_recovered?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          batch_month?: string | null
          branch?: string | null
          ca_name?: string | null
          cgpa?: number | null
          college?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          created_by_id?: string
          domain?: string | null
          email?: string | null
          form_id?: string | null
          graduating_year?: number | null
          id?: string
          last_notification_sent_at?: string | null
          lead_source?: string | null
          lg_link_id?: string | null
          name?: string
          notes?: string | null
          payment_link?: string | null
          phone?: string | null
          post_sales_owner_id?: string | null
          pre_sales_owner_id?: string | null
          preferred_language?: string | null
          product_category?: string | null
          product_purchased?: string | null
          reminder_at?: string | null
          revenue_projected?: number | null
          revenue_received?: number | null
          sales_owner_id?: string | null
          send_web_push?: boolean
          state?: string | null
          status?: string
          total_recovered?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      lg_links: {
        Row: {
          ca_name: string
          created_at: string
          created_by_id: string
          form_id: string
          id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string
        }
        Insert: {
          ca_name: string
          created_at?: string
          created_by_id: string
          form_id: string
          id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source: string
        }
        Update: {
          ca_name?: string
          created_at?: string
          created_by_id?: string
          form_id?: string
          id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lg_links_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lg_links_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaign_connections: {
        Row: {
          campaign_id: string
          campaign_name: string
          created_at: string
          form_id: string | null
          form_name: string | null
          id: string
          integration_id: string
          is_active: boolean | null
          lead_status: string | null
          leads_received: number | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          campaign_name: string
          created_at?: string
          form_id?: string | null
          form_name?: string | null
          id?: string
          integration_id: string
          is_active?: boolean | null
          lead_status?: string | null
          leads_received?: number | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          created_at?: string
          form_id?: string | null
          form_name?: string | null
          id?: string
          integration_id?: string
          is_active?: boolean | null
          lead_status?: string | null
          leads_received?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaign_connections_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "performance_marketing_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_marketing_integrations: {
        Row: {
          access_token: string | null
          ad_account_id: string | null
          company_id: string
          created_at: string
          credentials: Json | null
          default_lead_status: string | null
          id: string
          is_active: boolean | null
          page_id: string | null
          page_name: string | null
          platform: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          webhook_verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          ad_account_id?: string | null
          company_id: string
          created_at?: string
          credentials?: Json | null
          default_lead_status?: string | null
          id?: string
          is_active?: boolean | null
          page_id?: string | null
          page_name?: string | null
          platform: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          ad_account_id?: string | null
          company_id?: string
          created_at?: string
          credentials?: Json | null
          default_lead_status?: string | null
          id?: string
          is_active?: boolean | null
          page_id?: string | null
          page_name?: string | null
          platform?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_marketing_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          company_id: string
          created_at: string
          id: string
          metadata: Json | null
          name: string
          price: number
          quantity_available: number | null
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          price?: number
          quantity_available?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          price?: number
          quantity_available?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          deactivated_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_deactivated: boolean
          manager_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_deactivated?: boolean
          manager_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_deactivated?: boolean
          manager_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      real_estate_properties: {
        Row: {
          available_units: number | null
          category: string
          company_id: string
          cost: number | null
          country: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          sq_ft: number | null
          state: string | null
          updated_at: string
        }
        Insert: {
          available_units?: number | null
          category: string
          company_id: string
          cost?: number | null
          country?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          sq_ft?: number | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          available_units?: number | null
          category?: string
          company_id?: string
          cost?: number | null
          country?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          sq_ft?: number | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "real_estate_properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          status: Database["public"]["Enums"]["wallet_transaction_status"]
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["wallet_transaction_status"]
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["wallet_transaction_status"]
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["company_id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          company_id: string
          created_at: string | null
          currency: string
          updated_at: string | null
        }
        Insert: {
          balance?: number
          company_id: string
          created_at?: string | null
          currency?: string
          updated_at?: string | null
        }
        Update: {
          balance?: number
          company_id?: string
          created_at?: string | null
          currency?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          ai_enabled: boolean | null
          ai_goal: string | null
          ai_knowledge_base: string | null
          ai_max_replies_per_day: number | null
          ai_prompt: string | null
          ai_response_delay_seconds: number | null
          auth_creds: Json | null
          company_id: string
          created_at: string
          daily_limit: number
          display_name: string | null
          id: string
          last_connected_at: string | null
          messages_sent_today: number
          phone_number: string | null
          session_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          ai_enabled?: boolean | null
          ai_goal?: string | null
          ai_knowledge_base?: string | null
          ai_max_replies_per_day?: number | null
          ai_prompt?: string | null
          ai_response_delay_seconds?: number | null
          auth_creds?: Json | null
          company_id: string
          created_at?: string
          daily_limit?: number
          display_name?: string | null
          id?: string
          last_connected_at?: string | null
          messages_sent_today?: number
          phone_number?: string | null
          session_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          ai_enabled?: boolean | null
          ai_goal?: string | null
          ai_knowledge_base?: string | null
          ai_max_replies_per_day?: number | null
          ai_prompt?: string | null
          ai_response_delay_seconds?: number | null
          auth_creds?: Json | null
          company_id?: string
          created_at?: string
          daily_limit?: number
          display_name?: string | null
          id?: string
          last_connected_at?: string | null
          messages_sent_today?: number
          phone_number?: string | null
          session_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          error_message: string | null
          id: string
          lead_data: Json | null
          lead_id: string | null
          lead_table: string | null
          phone_number: string
          resolved_message: string | null
          sent_at: string | null
          sent_by_account_id: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_data?: Json | null
          lead_id?: string | null
          lead_table?: string | null
          phone_number: string
          resolved_message?: string | null
          sent_at?: string | null
          sent_by_account_id?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_data?: Json | null
          lead_id?: string | null
          lead_table?: string | null
          phone_number?: string
          resolved_message?: string | null
          sent_at?: string | null
          sent_by_account_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_sent_by_account_id_fkey"
            columns: ["sent_by_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          account_ids: string[]
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          delay_max_seconds: number
          delay_min_seconds: number
          id: string
          message_template: string
          name: string
          recipient_count: number
          recipient_filter: Json | null
          scheduled_at: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          account_ids?: string[]
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delay_max_seconds?: number
          delay_min_seconds?: number
          id?: string
          message_template?: string
          name: string
          recipient_count?: number
          recipient_filter?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          account_ids?: string[]
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delay_max_seconds?: number
          delay_min_seconds?: number
          id?: string
          message_template?: string
          name?: string
          recipient_count?: number
          recipient_filter?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_log: {
        Row: {
          account_id: string | null
          campaign_id: string | null
          company_id: string
          direction: string
          id: string
          message_body: string | null
          recipient_phone: string
          sent_at: string
          status: string
        }
        Insert: {
          account_id?: string | null
          campaign_id?: string | null
          company_id: string
          direction?: string
          id?: string
          message_body?: string | null
          recipient_phone: string
          sent_at?: string
          status?: string
        }
        Update: {
          account_id?: string | null
          campaign_id?: string | null
          company_id?: string
          direction?: string
          id?: string
          message_body?: string | null
          recipient_phone?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_automation_trigger_to_table: {
        Args: { table_name: string }
        Returns: undefined
      }
      add_company_licenses: {
        Args: { _company_id: string; _quantity: number }
        Returns: boolean
      }
      add_credits: {
        Args: { amount: number; transaction_label: string }
        Returns: boolean
      }
      add_lead_attribute: {
        Args: {
          attribute_name: string
          attribute_type?: string
          input_company_id: string
        }
        Returns: Json
      }
      can_add_team_member: { Args: { _company_id: string }; Returns: boolean }
      can_promote_user: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _promoter_id: string
          _target_user_id: string
        }
        Returns: boolean
      }
      debug_company_status: { Args: never; Returns: Json }
      debug_get_constraints: { Args: { target_table: string }; Returns: Json }
      debug_rls_status: { Args: { target_table: string }; Returns: Json }
      decrement_used_licenses: {
        Args: { _company_id: string }
        Returns: boolean
      }
      deduct_ai_credits: { Args: { amount?: number }; Returns: undefined }
      deduct_credits:
        | {
            Args: { amount: number; reason: string; transaction_type?: string }
            Returns: undefined
          }
        | {
            Args: { amount: number; transaction_label: string }
            Returns: boolean
          }
      deduplicate_leads: {
        Args: { attribute_name: string; input_table_name: string }
        Returns: undefined
      }
      enable_custom_leads_table: {
        Args: { input_company_id: string }
        Returns: Json
      }
      fix_custom_table_rls: {
        Args: { input_table_name: string }
        Returns: undefined
      }
      fix_custom_table_rls_comprehensive: {
        Args: { input_table_name: string }
        Returns: undefined
      }
      get_accessible_team_ids: {
        Args: { input_user_id: string }
        Returns: string[]
      }
      get_company_by_custom_domain: {
        Args: { p_domain: string }
        Returns: {
          id: string
          is_active: boolean
          logo_url: string
          name: string
          primary_color: string
          slug: string
        }[]
      }
      get_company_by_domain: { Args: { _domain: string }; Returns: string }
      get_company_by_subdomain: {
        Args: { p_slug: string }
        Returns: {
          id: string
          is_active: boolean
          logo_url: string
          name: string
          primary_color: string
          slug: string
        }[]
      }
      get_company_lead_columns: {
        Args: { input_company_id: string }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
        }[]
      }
      get_custom_domain_company: {
        Args: { _domain: string }
        Returns: {
          id: string
          is_active: boolean
          logo_url: string
          name: string
          primary_color: string
          slug: string
        }[]
      }
      get_lead_unique_constraints: {
        Args: { input_company_id: string }
        Returns: Json
      }
      get_real_estate_leads: {
        Args: {
          owner_filter?: string[]
          page?: number
          page_size?: number
          property_type_filter?: string[]
          search_query?: string
          status_filter?: string
        }
        Returns: Json
      }
      get_role_level: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      get_subdomain_company: {
        Args: { _slug: string }
        Returns: {
          id: string
          is_active: boolean
          logo_url: string
          name: string
          primary_color: string
          slug: string
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_email_sent: {
        Args: { account_uuid: string }
        Returns: undefined
      }
      increment_used_licenses: {
        Args: { _company_id: string }
        Returns: boolean
      }
      increment_wa_messages_sent: {
        Args: { account_id: string }
        Returns: undefined
      }
      is_company_admin: { Args: { _user_id: string }; Returns: boolean }
      is_in_hierarchy: {
        Args: { _manager_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_same_company: {
        Args: { _lead_company_id: string; _user_id: string }
        Returns: boolean
      }
      remove_lead_attribute: {
        Args: { attribute_name: string; input_company_id: string }
        Returns: Json
      }
      reset_email_daily_counters: { Args: never; Returns: undefined }
      reset_monthly_xp: { Args: never; Returns: undefined }
      toggle_lead_unique_constraint: {
        Args: {
          attribute_name: string
          input_company_id: string
          is_unique: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      announcement_target_type:
        | "all"
        | "specific_companies"
        | "subscription_status"
      announcement_type: "info" | "warning" | "success" | "maintenance"
      app_role:
        | "platform_admin"
        | "company"
        | "company_subadmin"
        | "cbo"
        | "vp"
        | "avp"
        | "dgm"
        | "agm"
        | "sm"
        | "tl"
        | "bde"
        | "intern"
        | "ca"
        | "level_3"
        | "level_4"
        | "level_5"
        | "level_6"
        | "level_7"
        | "level_8"
        | "level_9"
        | "level_10"
        | "level_11"
        | "level_12"
        | "level_13"
        | "level_14"
        | "level_15"
        | "level_16"
        | "level_17"
        | "level_18"
        | "level_19"
        | "level_20"
      lead_status:
        | "new"
        | "interested"
        | "not_interested"
        | "follow_up"
        | "rnr"
        | "dnd"
        | "paid"
      wallet_transaction_status: "pending" | "success" | "failed"
      wallet_transaction_type:
        | "credit_recharge"
        | "credit_gift_card"
        | "debit_license_purchase"
        | "debit_auto_renewal"
        | "debit_manual_adjustment"
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
      announcement_target_type: [
        "all",
        "specific_companies",
        "subscription_status",
      ],
      announcement_type: ["info", "warning", "success", "maintenance"],
      app_role: [
        "platform_admin",
        "company",
        "company_subadmin",
        "cbo",
        "vp",
        "avp",
        "dgm",
        "agm",
        "sm",
        "tl",
        "bde",
        "intern",
        "ca",
        "level_3",
        "level_4",
        "level_5",
        "level_6",
        "level_7",
        "level_8",
        "level_9",
        "level_10",
        "level_11",
        "level_12",
        "level_13",
        "level_14",
        "level_15",
        "level_16",
        "level_17",
        "level_18",
        "level_19",
        "level_20",
      ],
      lead_status: [
        "new",
        "interested",
        "not_interested",
        "follow_up",
        "rnr",
        "dnd",
        "paid",
      ],
      wallet_transaction_status: ["pending", "success", "failed"],
      wallet_transaction_type: [
        "credit_recharge",
        "credit_gift_card",
        "debit_license_purchase",
        "debit_auto_renewal",
        "debit_manual_adjustment",
      ],
    },
  },
} as const
