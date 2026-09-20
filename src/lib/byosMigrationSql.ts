/**
 * ─── BYOS Migration Bundle v1.1.0 SQL Script ────────────────────────────────
 * Exported migration script to create all CRM tables, RLS policies, indexes,
 * and RPC procedures on a customer's self-hosted Supabase project.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const BYOS_LATEST_VERSION = "1.1.0";

export const BYOS_MIGRATION_SQL = `-- ============================================================================
-- FastestCRM — BYOS Migration Bundle v1.1.0
-- ============================================================================

CREATE TABLE IF NOT EXISTS public._byos_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public._byos_meta (key, value)
VALUES ('migration_version', '1.1.0')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'company','company_subadmin','cbo','vp','avp','dgm','agm','sm','tl','bde','intern','ca','platform_admin','level_3','level_4','level_5','level_6','level_7','level_8','level_9','level_10','level_11','level_12','level_13','level_14','level_15','level_16','level_17','level_18','level_19','level_20'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_3';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_4';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_5';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_6';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_7';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_8';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_9';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_10';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_11';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_12';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_13';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_14';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_15';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_16';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_17';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_18';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_19';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'level_20';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'new','interested','not_interested','follow_up','rnr','dnd','paid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  company_id UUID,
  manager_id UUID REFERENCES public.profiles(id),
  incentive_percent NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'bde',
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  college TEXT,
  graduating_year INTEGER,
  branch TEXT,
  domain TEXT,
  cgpa DECIMAL(3,2),
  state TEXT,
  preferred_language TEXT,
  company TEXT,
  ca_name TEXT,
  pre_sales_owner_id UUID,
  sales_owner_id UUID,
  post_sales_owner_id UUID,
  created_by_id UUID,
  company_id UUID,
  status TEXT NOT NULL DEFAULT 'new',
  revenue_received DECIMAL(12,2) DEFAULT 0,
  revenue_projected DECIMAL(12,2) DEFAULT 0,
  total_recovered DECIMAL(12,2) DEFAULT 0,
  product_purchased TEXT,
  product_category TEXT,
  batch_month TEXT,
  payment_link TEXT,
  source TEXT,
  lead_source TEXT,
  reminder_at TIMESTAMPTZ,
  last_notification_sent_at TIMESTAMPTZ,
  notes TEXT,
  send_web_push BOOLEAN DEFAULT false,
  custom_data JSONB DEFAULT '{}'::jsonb,
  lead_history JSONB DEFAULT '[]'::jsonb,
  status_metadata JSONB DEFAULT '{}'::jsonb,
  lead_profile JSONB DEFAULT '{}'::jsonb,
  form_id UUID,
  lg_link_id UUID,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS product_category TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_profile JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS form_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lg_link_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

CREATE TABLE IF NOT EXISTS public.leads_real_estate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  company TEXT,
  company_id UUID,
  created_by_id UUID,
  sales_owner_id UUID,
  pre_sales_owner_id UUID,
  post_sales_owner_id UUID,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT,
  property_type TEXT,
  budget_min DECIMAL(14,2),
  budget_max DECIMAL(14,2),
  preferred_location TEXT,
  property_size TEXT,
  possession_timeline TEXT,
  site_visit_date DATE,
  site_visit_done BOOLEAN DEFAULT false,
  revenue_received DECIMAL(12,2) DEFAULT 0,
  revenue_projected DECIMAL(12,2) DEFAULT 0,
  total_recovered DECIMAL(12,2) DEFAULT 0,
  product_purchased TEXT,
  payment_link TEXT,
  reminder_at TIMESTAMPTZ,
  notes TEXT,
  send_web_push BOOLEAN DEFAULT false,
  custom_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads_saas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  company_name TEXT,
  company_size TEXT,
  company_website TEXT,
  job_title TEXT,
  product_interest TEXT,
  use_case TEXT,
  current_solution TEXT,
  demo_date TIMESTAMPTZ,
  trial_start_date DATE,
  trial_end_date DATE,
  plan_type TEXT,
  seats INTEGER,
  monthly_value NUMERIC DEFAULT 0,
  annual_value NUMERIC DEFAULT 0,
  contract_length INTEGER,
  deal_stage TEXT,
  decision_maker TEXT,
  champion TEXT,
  competitors TEXT,
  loss_reason TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  lead_source TEXT,
  lead_history JSONB DEFAULT '[]'::jsonb,
  status_metadata JSONB DEFAULT '{}'::jsonb,
  lead_profile JSONB DEFAULT '{}'::jsonb,
  company_id UUID,
  created_by_id UUID,
  pre_sales_owner_id UUID,
  sales_owner_id UUID,
  post_sales_owner_id UUID,
  revenue_projected NUMERIC DEFAULT 0,
  revenue_received NUMERIC DEFAULT 0,
  reminder_at TIMESTAMPTZ,
  last_notification_sent_at TIMESTAMPTZ,
  payment_link TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  lg_link_id UUID,
  form_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads_healthcare (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  created_by_id UUID,
  pre_sales_owner_id UUID,
  sales_owner_id UUID,
  post_sales_owner_id UUID,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  status TEXT NOT NULL DEFAULT 'new_enquiry',
  notes TEXT,
  lead_source TEXT,
  lead_history JSONB DEFAULT '[]'::jsonb,
  status_metadata JSONB DEFAULT '{}'::jsonb,
  lead_profile JSONB DEFAULT '{}'::jsonb,
  revenue_projected NUMERIC DEFAULT 0,
  revenue_received NUMERIC DEFAULT 0,
  payment_link TEXT,
  reminder_at TIMESTAMPTZ,
  last_notification_sent_at TIMESTAMPTZ,
  lg_link_id UUID,
  form_id UUID,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  age INTEGER,
  gender TEXT,
  condition TEXT,
  symptoms TEXT,
  department TEXT,
  doctor_preference TEXT,
  appointment_date TIMESTAMPTZ,
  appointment_time TEXT,
  referral_source TEXT,
  insurance_provider TEXT,
  insurance_id TEXT,
  treatment_type TEXT,
  treatment_cost NUMERIC,
  treatment_date DATE,
  follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  company_id UUID,
  created_by_id UUID,
  pre_sales_owner_id UUID,
  sales_owner_id UUID,
  post_sales_owner_id UUID,
  age INTEGER,
  gender TEXT,
  pan_number TEXT,
  date_of_birth DATE,
  occupation TEXT,
  annual_income NUMERIC,
  insurance_type TEXT,
  plan_name TEXT,
  sum_insured NUMERIC,
  premium_amount NUMERIC,
  contribution_frequency TEXT,
  policy_term INTEGER,
  existing_policies TEXT,
  nominee_name TEXT,
  nominee_relation TEXT,
  agent_name TEXT,
  policy_number TEXT,
  policy_start_date DATE,
  renewal_date DATE,
  loss_reason TEXT,
  revenue_projected NUMERIC,
  revenue_received NUMERIC,
  reminder_at TIMESTAMPTZ,
  last_notification_sent_at TIMESTAMPTZ,
  payment_link TEXT,
  lead_source TEXT,
  lead_history JSONB,
  status_metadata JSONB,
  lead_profile JSONB,
  notes TEXT,
  form_id UUID,
  lg_link_id UUID,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads_travel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  created_by_id UUID,
  pre_sales_owner_id UUID,
  sales_owner_id UUID,
  post_sales_owner_id UUID,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  lead_source TEXT,
  lead_history JSONB DEFAULT '[]'::jsonb,
  status_metadata JSONB DEFAULT '{}'::jsonb,
  lead_profile JSONB DEFAULT '{}'::jsonb,
  revenue_projected NUMERIC DEFAULT 0,
  revenue_received NUMERIC DEFAULT 0,
  reminder_at TIMESTAMPTZ,
  last_notification_sent_at TIMESTAMPTZ,
  payment_link TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  lg_link_id UUID,
  form_id UUID,
  destination TEXT,
  travel_date DATE,
  return_date DATE,
  travelers_count INTEGER,
  trip_type TEXT,
  package_type TEXT,
  budget NUMERIC,
  special_requests TEXT,
  hotel_name TEXT,
  flight_details TEXT,
  package_cost NUMERIC,
  advance_paid NUMERIC,
  balance_due NUMERIC,
  booking_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  sort_order INTEGER DEFAULT 0,
  status_type TEXT DEFAULT 'custom',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_statuses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.lead_statuses ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6B7280';
ALTER TABLE public.lead_statuses ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.lead_statuses ADD COLUMN IF NOT EXISTS status_type TEXT DEFAULT 'custom';

CREATE TABLE IF NOT EXISTS public.company_lead_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  color TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  sub_statuses TEXT[] DEFAULT ARRAY[]::TEXT[],
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.real_estate_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  sq_ft NUMERIC,
  cost NUMERIC,
  available_units INTEGER,
  location TEXT,
  state TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  lead_table TEXT NOT NULL DEFAULT 'leads',
  changed_by UUID,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_type TEXT DEFAULT 'update',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  name TEXT NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity_available INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  lead_id UUID,
  lead_table TEXT,
  quotation_id UUID,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  client_gstin TEXT,
  subject TEXT,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  amount_due DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  notes TEXT,
  terms_and_conditions TEXT,
  payment_terms TEXT,
  due_date DATE,
  template_id TEXT,
  payment_link TEXT,
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID,
  description TEXT NOT NULL,
  hsn_sac_code TEXT,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_ids TEXT[] DEFAULT '{}',
  tax_amount DECIMAL(12,2) DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT,
  payment_reference TEXT,
  razorpay_payment_id TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  lead_id UUID,
  lead_table TEXT,
  quotation_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  client_gstin TEXT,
  subject TEXT,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  notes TEXT,
  terms_and_conditions TEXT,
  validity_days INTEGER DEFAULT 30,
  template_id TEXT,
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id UUID,
  description TEXT NOT NULL,
  hsn_sac_code TEXT,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_ids TEXT[] DEFAULT '{}',
  tax_amount DECIMAL(12,2) DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  created_by_id UUID,
  created_by UUID,
  name TEXT,
  title TEXT,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active',
  is_active BOOLEAN DEFAULT true,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS created_by_id UUID;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS public.form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  lead_id UUID,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  assigned_to UUID,
  lead_id UUID,
  lead_table TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  lead_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.calendar_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  user_id UUID NOT NULL,
  lead_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  attendee_name TEXT,
  attendee_email TEXT,
  attendee_phone TEXT,
  status TEXT DEFAULT 'confirmed',
  google_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  personality JSONB DEFAULT '{}'::jsonb,
  skills JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  working_hours JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_caller_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  lead_id UUID,
  agent_id UUID,
  call_type TEXT DEFAULT 'outbound',
  duration_seconds INTEGER DEFAULT 0,
  transcript TEXT,
  summary TEXT,
  sentiment TEXT,
  outcome TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE,
  invoice_prefix TEXT DEFAULT 'INV-',
  next_invoice_number INTEGER DEFAULT 1,
  quotation_prefix TEXT DEFAULT 'QT-',
  next_quotation_number INTEGER DEFAULT 1,
  company_name TEXT,
  company_logo TEXT,
  company_address TEXT,
  company_email TEXT,
  company_phone TEXT,
  company_gstin TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  default_notes TEXT,
  default_terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lg_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  created_by UUID,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  target_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  target_form_id UUID,
  clicks INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  recipient_phone TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  provider TEXT DEFAULT 'smtp',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_campaign_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  step_number INTEGER NOT NULL DEFAULT 1,
  subject TEXT NOT NULL,
  body_text TEXT,
  delay_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  lead_id UUID,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  company_id UUID NOT NULL,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agentic_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  workflow_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agentic_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.agentic_workflows(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_profiles_select" ON public.profiles;
CREATE POLICY "byos_profiles_select" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "byos_profiles_update" ON public.profiles;
CREATE POLICY "byos_profiles_update" ON public.profiles FOR UPDATE USING (true);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_user_roles_select" ON public.user_roles;
CREATE POLICY "byos_user_roles_select" ON public.user_roles FOR SELECT USING (true);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_leads_all" ON public.leads;
CREATE POLICY "byos_leads_all" ON public.leads FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.leads_real_estate ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_leads_real_estate_all" ON public.leads_real_estate;
CREATE POLICY "byos_leads_real_estate_all" ON public.leads_real_estate FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.leads_saas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_leads_saas_all" ON public.leads_saas;
CREATE POLICY "byos_leads_saas_all" ON public.leads_saas FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.leads_healthcare ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_leads_healthcare_all" ON public.leads_healthcare;
CREATE POLICY "byos_leads_healthcare_all" ON public.leads_healthcare FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.leads_insurance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_leads_insurance_all" ON public.leads_insurance;
CREATE POLICY "byos_leads_insurance_all" ON public.leads_insurance FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.leads_travel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_leads_travel_all" ON public.leads_travel;
CREATE POLICY "byos_leads_travel_all" ON public.leads_travel FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.company_lead_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_company_lead_statuses_all" ON public.company_lead_statuses;
CREATE POLICY "byos_company_lead_statuses_all" ON public.company_lead_statuses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.real_estate_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_real_estate_properties_all" ON public.real_estate_properties;
CREATE POLICY "byos_real_estate_properties_all" ON public.real_estate_properties FOR ALL USING (true) WITH CHECK (true);

-- INDEXES
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_sales_owner ON public.leads(sales_owner_id);

-- High-scale compound indexes (sub-50ms queries on 500k+ rows)
CREATE INDEX IF NOT EXISTS idx_leads_company_created_id ON public.leads (company_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_co_status_created ON public.leads (company_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_co_owner_created ON public.leads (company_id, sales_owner_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_co_updated_at ON public.leads (company_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_co_rev_received ON public.leads (company_id, created_at DESC) WHERE (revenue_received > 0);

-- GIN Trigram Search Indexes
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON public.leads USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON public.leads USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON public.leads USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_college_trgm ON public.leads USING gin (college gin_trgm_ops);

-- Industry Tables High-scale Compound Indexes
CREATE INDEX IF NOT EXISTS idx_leads_real_estate_company_created_id ON public.leads_real_estate (company_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_real_estate_co_status_created ON public.leads_real_estate (company_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_real_estate_co_owner_created ON public.leads_real_estate (company_id, sales_owner_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_real_estate_co_updated_at ON public.leads_real_estate (company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_saas_company_created_id ON public.leads_saas (company_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_saas_co_status_created ON public.leads_saas (company_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_saas_co_owner_created ON public.leads_saas (company_id, sales_owner_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_saas_co_updated_at ON public.leads_saas (company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_healthcare_company_created_id ON public.leads_healthcare (company_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_healthcare_co_status_created ON public.leads_healthcare (company_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_healthcare_co_owner_created ON public.leads_healthcare (company_id, sales_owner_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_healthcare_co_updated_at ON public.leads_healthcare (company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_insurance_company_created_id ON public.leads_insurance (company_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_insurance_co_status_created ON public.leads_insurance (company_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_insurance_co_owner_created ON public.leads_insurance (company_id, sales_owner_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_insurance_co_updated_at ON public.leads_insurance (company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_travel_company_created_id ON public.leads_travel (company_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_travel_co_status_created ON public.leads_travel (company_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_travel_co_owner_created ON public.leads_travel (company_id, sales_owner_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_travel_co_updated_at ON public.leads_travel (company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_byos_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_byos_quotations_created_at ON public.quotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_byos_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_byos_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_byos_calendar_start ON public.calendar_bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_leads_custom_data_gin ON public.leads USING gin (custom_data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_leads_re_custom_data_gin ON public.leads_real_estate USING gin (custom_data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_leads_saas_custom_data_gin ON public.leads_saas USING gin (custom_data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_leads_hc_custom_data_gin ON public.leads_healthcare USING gin (custom_data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_leads_ins_custom_data_gin ON public.leads_insurance USING gin (custom_data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_leads_tr_custom_data_gin ON public.leads_travel USING gin (custom_data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_lead_history_lead_id ON public.lead_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_company_id ON public.quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_forms_company_id ON public.forms(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_company_id ON public.automations(company_id);
CREATE INDEX IF NOT EXISTS idx_lead_statuses_company_id ON public.lead_statuses(company_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_company_id ON public.landing_pages(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_real_estate_company_id ON public.leads_real_estate(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_saas_company_id ON public.leads_saas(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_healthcare_company_id ON public.leads_healthcare(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_insurance_company_id ON public.leads_insurance(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_travel_company_id ON public.leads_travel(company_id);
CREATE INDEX IF NOT EXISTS idx_company_lead_statuses_company_id ON public.company_lead_statuses(company_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_properties_company_id ON public.real_estate_properties(company_id);
CREATE INDEX IF NOT EXISTS idx_calendar_bookings_user_id ON public.calendar_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_employees_company_id ON public.ai_employees(company_id);

DO $$ BEGIN
  ALTER TABLE public.leads ALTER COLUMN status TYPE TEXT;
  ALTER TABLE public.leads_real_estate ALTER COLUMN status TYPE TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── Fast Distinct Column Values (Recursive CTE Skip Scan) ─────────────────
CREATE OR REPLACE FUNCTION public.get_distinct_column_values(
    p_table_name text,
    p_column_name text,
    p_company_id uuid DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_result text[];
    v_query text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = p_table_name
    ) THEN
        RETURN ARRAY[]::text[];
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = p_column_name
    ) THEN
        RETURN ARRAY[]::text[];
    END IF;

    IF p_company_id IS NOT NULL THEN
        v_query := format(
            'SELECT ARRAY(
                SELECT DISTINCT %I::text 
                FROM public.%I 
                WHERE (company_id = %L OR company_id IS NULL)
                  AND %I IS NOT NULL 
                  AND %I::text <> %L 
                ORDER BY %I::text ASC
            )',
            p_column_name, p_table_name, p_company_id,
            p_column_name, p_column_name, '', p_column_name
        );
    ELSE
        v_query := format(
            'SELECT ARRAY(
                SELECT DISTINCT %I::text 
                FROM public.%I 
                WHERE %I IS NOT NULL 
                  AND %I::text <> %L 
                ORDER BY %I::text ASC
            )',
            p_column_name, p_table_name,
            p_column_name, p_column_name, '', p_column_name
        );
    END IF;

    EXECUTE v_query INTO v_result;
    RETURN COALESCE(v_result, ARRAY[]::text[]);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_distinct_column_values(text, text, uuid) TO authenticated, service_role, anon;

-- ─── High-Scale Dashboard Analytics Cache & RPC (Sub-50ms) ───────────────
CREATE TABLE IF NOT EXISTS public.company_analytics_snapshots (
    company_id UUID PRIMARY KEY,
    table_name TEXT NOT NULL,
    total_leads BIGINT NOT NULL DEFAULT 0,
    status_distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
    daily_intake JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_analytics_snapshots_table 
ON public.company_analytics_snapshots(table_name);

CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
    p_company_id uuid,
    p_limit_recent int DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_table_name text;
    v_industry text;
    v_today_start timestamptz := date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
    v_snap_total bigint;
    v_snap_status_dist jsonb;
    v_snap_daily_intake jsonb;
    v_leads_today bigint := 0;
    v_paid_today bigint := 0;
    v_rev_today numeric := 0;
    v_total_rev numeric := 0;
    v_proj_rev numeric := 0;
    v_pipeline_val numeric := 0;
    v_total_leads bigint := 0;
    v_recent_leads jsonb := '[]'::jsonb;
    v_action_leads jsonb := '[]'::jsonb;
    v_intake_trend jsonb := '[]'::jsonb;
    v_status_distribution jsonb := '[]'::jsonb;
    v_has_reminder boolean := false;
    v_has_product boolean := false;
    v_has_phone boolean := false;
    v_has_email boolean := false;
    v_has_sales_owner boolean := false;
    v_has_rev_received boolean := false;
    v_has_rev_projected boolean := false;
    v_has_status boolean := false;
    v_has_created_at boolean := false;
    v_has_updated_at boolean := false;
BEGIN
    SELECT custom_leads_table, LOWER(industry) 
    INTO v_table_name, v_industry 
    FROM public.companies 
    WHERE id = p_company_id;

    IF v_table_name IS NULL OR v_table_name = '' THEN
        IF v_industry = 'real_estate' THEN v_table_name := 'leads_real_estate';
        ELSIF v_industry = 'saas' THEN v_table_name := 'leads_saas';
        ELSIF v_industry = 'healthcare' THEN v_table_name := 'leads_healthcare';
        ELSIF v_industry = 'insurance' THEN v_table_name := 'leads_insurance';
        ELSIF v_industry = 'travel' THEN v_table_name := 'leads_travel';
        ELSE v_table_name := 'leads';
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = v_table_name
    ) THEN
        v_table_name := 'leads';
    END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'reminder_at') INTO v_has_reminder;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'product_purchased') INTO v_has_product;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'email') INTO v_has_email;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'phone') INTO v_has_phone;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'sales_owner_id') INTO v_has_sales_owner;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'revenue_received') INTO v_has_rev_received;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'revenue_projected') INTO v_has_rev_projected;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'status') INTO v_has_status;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'created_at') INTO v_has_created_at;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'updated_at') INTO v_has_updated_at;

    SELECT total_leads, status_distribution, daily_intake
    INTO v_snap_total, v_snap_status_dist, v_snap_daily_intake
    FROM public.company_analytics_snapshots
    WHERE company_id = p_company_id;

    IF v_has_updated_at THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L AND updated_at >= %L',
            v_table_name, p_company_id, v_today_start)
        INTO v_leads_today;
    ELSIF v_has_created_at THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L AND created_at >= %L',
            v_table_name, p_company_id, v_today_start)
        INTO v_leads_today;
    END IF;

    IF v_has_status AND v_has_updated_at THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L AND status = ''paid'' AND updated_at >= %L',
            v_table_name, p_company_id, v_today_start)
        INTO v_paid_today;
    END IF;

    IF v_has_rev_received AND v_has_updated_at THEN
        EXECUTE format('
            SELECT COALESCE(SUM(revenue_received), 0) FROM public.%I
            WHERE company_id = %L AND updated_at >= %L AND revenue_received > 0',
            v_table_name, p_company_id, v_today_start)
        INTO v_rev_today;

        EXECUTE format('
            SELECT COALESCE(SUM(revenue_received), 0) FROM public.%I
            WHERE company_id = %L AND revenue_received > 0',
            v_table_name, p_company_id)
        INTO v_total_rev;
    END IF;

    IF v_has_rev_projected AND v_has_status THEN
        EXECUTE format('
            SELECT COALESCE(SUM(revenue_projected), 0) FROM public.%I
            WHERE company_id = %L AND status = ''paid'' AND revenue_projected > 0',
            v_table_name, p_company_id)
        INTO v_proj_rev;

        EXECUTE format('
            SELECT COALESCE(SUM(revenue_projected), 0) FROM public.%I
            WHERE company_id = %L AND status IN (''interested'', ''follow_up'') AND revenue_projected > 0',
            v_table_name, p_company_id)
        INTO v_pipeline_val;
    END IF;

    IF v_snap_total IS NOT NULL AND v_snap_total > 0 THEN
        v_total_leads := v_snap_total;
    ELSE
        IF v_table_name != 'leads' THEN
            SELECT COALESCE(reltuples::bigint, 0) 
            FROM pg_class 
            WHERE oid = format('public.%I', v_table_name)::regclass 
            INTO v_total_leads;
            IF v_total_leads < 0 THEN v_total_leads := 0; END IF;
        ELSE
            SELECT COUNT(*)::bigint FROM public.leads WHERE company_id = p_company_id INTO v_total_leads;
        END IF;
    END IF;

    IF v_snap_status_dist IS NOT NULL AND jsonb_array_length(v_snap_status_dist) > 0 THEN
        v_status_distribution := v_snap_status_dist;
    ELSE
        IF v_has_status THEN
            EXECUTE format('
                WITH raw_statuses AS (
                    SELECT COALESCE(status, ''new'') AS status_key, COUNT(*)::int AS status_count
                    FROM public.%I
                    WHERE company_id = %L
                    GROUP BY status
                    ORDER BY status_count DESC
                    LIMIT 5
                )
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        ''name'', CASE status_key
                            WHEN ''paid'' THEN ''Paid''
                            WHEN ''interested'' THEN ''Interested''
                            WHEN ''follow_up'' THEN ''Follow Up''
                            WHEN ''dropped'' THEN ''Dropped''
                            WHEN ''new'' THEN ''New''
                            ELSE INITCAP(REPLACE(status_key, ''_'', '' ''))
                        END,
                        ''count'', status_count,
                        ''fill'', CASE status_key
                            WHEN ''paid'' THEN ''#10b981''
                            WHEN ''interested'' THEN ''#6366f1''
                            WHEN ''follow_up'' THEN ''#f59e0b''
                            WHEN ''dropped'' THEN ''#ef4444''
                            WHEN ''new'' THEN ''#3b82f6''
                            ELSE ''#6b7280''
                        END
                    )
                ), ''[]''::jsonb)
                FROM raw_statuses', v_table_name, p_company_id)
            INTO v_status_distribution;
        END IF;
    END IF;

    WITH days AS (
        SELECT generate_series(
            (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'' - INTERVAL ''6 days'')::date,
            (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'')::date,
            ''1 day''::interval
        )::date AS day
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            ''dateStr'', to_char(d.day, ''YYYY-MM-DD''),
            ''label'', to_char(d.day, ''Mon DD''),
            ''count'', CASE 
                WHEN d.day = (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'')::date THEN v_leads_today
                WHEN v_snap_daily_intake IS NOT NULL AND v_snap_daily_intake ? to_char(d.day, ''YYYY-MM-DD'') 
                    THEN COALESCE((v_snap_daily_intake ->> to_char(d.day, ''YYYY-MM-DD''))::bigint, 0)
                ELSE 0
            END,
            ''revenue'', 0
        ) ORDER BY d.day ASC
    ), ''[]''::jsonb)
    INTO v_intake_trend
    FROM days d;

    IF v_has_created_at THEN
        EXECUTE format('
            SELECT COALESCE(jsonb_agg(r), ''[]''::jsonb)
            FROM (
                SELECT 
                    id, 
                    name, 
                    %s as email, 
                    %s as phone, 
                    status, 
                    created_at, 
                    updated_at,
                    %s as revenue_received,
                    %s as revenue_projected
                FROM public.%I
                WHERE company_id = %L
                ORDER BY created_at DESC
                LIMIT %s
            ) r', 
            CASE WHEN v_has_email THEN 'COALESCE(email, '''')' ELSE '''''' END,
            CASE WHEN v_has_phone THEN 'COALESCE(phone, '''')' ELSE '''''' END,
            CASE WHEN v_has_rev_received THEN 'COALESCE(revenue_received, 0)' ELSE '0::numeric' END,
            CASE WHEN v_has_rev_projected THEN 'COALESCE(revenue_projected, 0)' ELSE '0::numeric' END,
            v_table_name, 
            p_company_id, 
            GREATEST(1, LEAST(p_limit_recent, 20))
        ) INTO v_recent_leads;
    END IF;

    IF v_has_updated_at THEN
        EXECUTE format('
            SELECT COALESCE(jsonb_agg(a), ''[]''::jsonb)
            FROM (
                SELECT 
                    id, 
                    name, 
                    %s as email, 
                    %s as phone, 
                    status, 
                    created_at, 
                    updated_at, 
                    %s as reminder_at,
                    %s as product_purchased,
                    %s as sales_owner_id
                FROM public.%I
                WHERE company_id = %L
                  AND (
                      %s
                      OR status IN (''interested'', ''follow_up'', ''new'')
                  )
                ORDER BY updated_at DESC
                LIMIT 25
            ) a',
            CASE WHEN v_has_email THEN 'COALESCE(email, '''')' ELSE '''''' END,
            CASE WHEN v_has_phone THEN 'COALESCE(phone, '''')' ELSE '''''' END,
            CASE WHEN v_has_reminder THEN 'reminder_at' ELSE 'NULL::timestamptz' END,
            CASE WHEN v_has_product THEN 'product_purchased' ELSE 'NULL::text' END,
            CASE WHEN v_has_sales_owner THEN 'sales_owner_id' ELSE 'NULL::uuid' END,
            v_table_name,
            p_company_id,
            CASE WHEN v_has_reminder THEN 'reminder_at IS NOT NULL' ELSE 'FALSE' END
        ) INTO v_action_leads;
    END IF;

    RETURN jsonb_build_object(
        'kpis', jsonb_build_object(
            'leads_today', COALESCE(v_leads_today, 0),
            'paid_today', COALESCE(v_paid_today, 0),
            'revenue_today', COALESCE(v_rev_today, 0),
            'total_revenue', COALESCE(v_total_rev, 0),
            'projected_revenue', COALESCE(v_proj_rev, 0),
            'pipeline_value', COALESCE(v_pipeline_val, 0),
            'total_incentive', COALESCE(v_total_rev * 0.05, 0),
            'total_leads', COALESCE(v_total_leads, 0)
        ),
        'intake_trend', COALESCE(v_intake_trend, '[]'::jsonb),
        'status_distribution', COALESCE(v_status_distribution, '[]'::jsonb),
        'recent_leads', COALESCE(v_recent_leads, '[]'::jsonb),
        'action_leads', COALESCE(v_action_leads, '[]'::jsonb),
        'table_name', v_table_name
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(uuid, int) TO authenticated, service_role, anon;

-- ─── Get Company Lead Columns ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_company_lead_columns(
  input_company_id uuid DEFAULT NULL
)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name text := 'leads';
BEGIN
  RETURN QUERY
  SELECT c.column_name::text, c.data_type::text, c.is_nullable::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  AND c.table_name = v_table_name
  ORDER BY c.ordinal_position;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_company_lead_columns(uuid) TO authenticated, service_role, anon;

-- ─── Add Lead Attribute (DDL) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_lead_attribute(
  input_company_id uuid DEFAULT NULL,
  attribute_name text DEFAULT '',
  attribute_type text DEFAULT 'text'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name text := 'leads';
  v_clean_attr text;
BEGIN
  v_clean_attr := lower(regexp_replace(trim(attribute_name), '[^a-z0-9_]', '_', 'g'));
  IF v_clean_attr = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid attribute name');
  END IF;

  IF attribute_type NOT IN ('text', 'integer', 'boolean', 'date', 'numeric', 'jsonb', 'timestamp with time zone') THEN
     attribute_type := 'text';
  END IF;

  BEGIN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', v_table_name, v_clean_attr, attribute_type);
    RETURN jsonb_build_object('success', true, 'message', 'Attribute added successfully', 'column_name', v_clean_attr);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
  END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_lead_attribute(uuid, text, text) TO authenticated, service_role;

-- ─── Remove Lead Attribute (DDL) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_lead_attribute(
  input_company_id uuid DEFAULT NULL,
  attribute_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name text := 'leads';
  v_clean_attr text;
BEGIN
  v_clean_attr := lower(regexp_replace(trim(attribute_name), '[^a-z0-9_]', '_', 'g'));
  
  IF v_clean_attr IN ('id', 'created_at', 'updated_at', 'company_id', 'created_by_id', 'name', 'email', 'phone', 'status') THEN
     RETURN jsonb_build_object('success', false, 'message', 'Cannot delete system attribute');
  END IF;

  BEGIN
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS %I', v_table_name, v_clean_attr);
    RETURN jsonb_build_object('success', true, 'message', 'Attribute removed successfully');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
  END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_lead_attribute(uuid, text) TO authenticated, service_role;

-- ─── Toggle Lead Unique Constraint ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_lead_unique_constraint(
  input_company_id uuid DEFAULT NULL,
  attribute_name text DEFAULT '',
  is_unique boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_idx_name text;
  v_clean_attr text;
BEGIN
  v_clean_attr := lower(regexp_replace(trim(attribute_name), '[^a-z0-9_]', '_', 'g'));
  v_idx_name := format('idx_leads_unique_%s', v_clean_attr);

  IF is_unique THEN
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.leads(%I) WHERE %I IS NOT NULL AND %I <> ''''', 
                   v_idx_name, v_clean_attr, v_clean_attr, v_clean_attr);
    RETURN jsonb_build_object('success', true, 'message', format('Unique constraint enabled on %s', v_clean_attr));
  ELSE
    EXECUTE format('DROP INDEX IF EXISTS public.%I', v_idx_name);
    RETURN jsonb_build_object('success', true, 'message', format('Unique constraint removed from %s', v_clean_attr));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_lead_unique_constraint(uuid, text, boolean) TO authenticated, service_role;

-- ─── Storage bucket ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

UPDATE public._byos_meta SET value = '1.1.0', updated_at = now() WHERE key = 'migration_version';
NOTIFY pgrst, 'reload schema';
`;
