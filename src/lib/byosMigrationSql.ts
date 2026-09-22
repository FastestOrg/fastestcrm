/**
 * ─── BYOS Migration Bundle v1.1.0 SQL Script ────────────────────────────────
 * Exported migration script to create all CRM tables, RLS policies, indexes,
 * and RPC procedures on a customer's self-hosted Supabase project.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const BYOS_LATEST_VERSION = "1.2.0";

export const BYOS_MIGRATION_SQL = `-- ============================================================================
-- FastestCRM — BYOS Migration Bundle v1.2.0
-- ============================================================================

CREATE TABLE IF NOT EXISTS public._byos_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public._byos_meta (key, value)
VALUES ('migration_version', '1.2.0')
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

-- ─── Faceted Filter Options RPC for Cascading Dropdowns ───────────────────
CREATE OR REPLACE FUNCTION public.get_faceted_filter_options(
    p_table_name text,
    p_company_id uuid,
    p_target_columns text[],
    p_filters jsonb,
    p_accessible_user_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_col text;
    v_filter_key text;
    v_filter_vals jsonb;
    v_where_clauses text[];
    v_where_sql text;
    v_col_query text;
    v_col_vals text[];
    v_result jsonb := '{}'::jsonb;
    v_quoted_vals text;
    v_valid_cols text[];
    v_has_other_filters boolean;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = p_table_name
    ) THEN
        RETURN '{}'::jsonb;
    END IF;

    SELECT array_agg(column_name::text) INTO v_valid_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table_name;

    IF v_valid_cols IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;

    FOREACH v_col IN ARRAY p_target_columns
    LOOP
        IF NOT (v_col = ANY(v_valid_cols)) THEN
            CONTINUE;
        END IF;

        v_has_other_filters := false;
        FOR v_filter_key, v_filter_vals IN SELECT * FROM jsonb_each(p_filters)
        LOOP
            IF v_filter_key <> v_col 
               AND NOT (v_filter_key = 'owner' AND v_col = 'sales_owner_id')
               AND NOT (v_filter_key = 'sales_owner_id' AND v_col = 'owner')
               AND NOT (v_filter_key = 'product' AND v_col = 'product_purchased')
               AND NOT (v_filter_key = 'product_purchased' AND v_col = 'product')
            THEN
                IF jsonb_typeof(v_filter_vals) = 'array' AND jsonb_array_length(v_filter_vals) > 0 THEN
                    v_has_other_filters := true;
                    EXIT;
                END IF;
            END IF;
        END LOOP;

        IF NOT v_has_other_filters THEN
            CONTINUE;
        END IF;

        v_where_clauses := ARRAY[
            format('%I IS NOT NULL', v_col),
            format('%I::text <> %L', v_col, '')
        ];

        IF p_company_id IS NOT NULL THEN
            v_where_clauses := array_append(v_where_clauses, format('company_id = %L', p_company_id));
        END IF;

        IF p_accessible_user_ids IS NOT NULL AND array_length(p_accessible_user_ids, 1) > 0 THEN
            v_where_clauses := array_append(
                v_where_clauses,
                format('sales_owner_id = ANY(%L::uuid[])', p_accessible_user_ids)
            );
        END IF;

        FOR v_filter_key, v_filter_vals IN SELECT * FROM jsonb_each(p_filters)
        LOOP
            IF v_filter_key = v_col 
               OR (v_filter_key = 'owner' AND v_col = 'sales_owner_id')
               OR (v_filter_key = 'sales_owner_id' AND v_col = 'owner')
               OR (v_filter_key = 'product' AND v_col = 'product_purchased')
               OR (v_filter_key = 'product_purchased' AND v_col = 'product')
            THEN
                CONTINUE;
            END IF;

            DECLARE
                v_db_col text := v_filter_key;
                v_has_unassigned boolean := false;
                v_real_ids text[] := ARRAY[]::text[];
                v_arr_elem jsonb;
            BEGIN
                IF v_filter_key = 'owner' THEN
                    v_db_col := 'sales_owner_id';
                ELSIF v_filter_key = 'product' THEN
                    v_db_col := 'product_purchased';
                END IF;

                IF NOT (v_db_col = ANY(v_valid_cols)) THEN
                    CONTINUE;
                END IF;

                IF jsonb_typeof(v_filter_vals) = 'array' AND jsonb_array_length(v_filter_vals) > 0 THEN
                    IF v_db_col = 'sales_owner_id' THEN
                        FOR v_arr_elem IN SELECT * FROM jsonb_array_elements(v_filter_vals)
                        LOOP
                            IF v_arr_elem #>> '{}' = 'unassigned' THEN
                                v_has_unassigned := true;
                            ELSE
                                v_real_ids := array_append(v_real_ids, v_arr_elem #>> '{}');
                            END IF;
                        END LOOP;

                        IF v_has_unassigned AND array_length(v_real_ids, 1) > 0 THEN
                            v_where_clauses := array_append(
                                v_where_clauses,
                                format('(sales_owner_id IS NULL OR sales_owner_id = ANY(%L::uuid[]))', v_real_ids)
                            );
                        ELSIF v_has_unassigned THEN
                            v_where_clauses := array_append(v_where_clauses, 'sales_owner_id IS NULL');
                        ELSIF array_length(v_real_ids, 1) > 0 THEN
                            v_where_clauses := array_append(
                                v_where_clauses,
                                format('sales_owner_id = ANY(%L::uuid[])', v_real_ids)
                            );
                        END IF;
                    ELSE
                        SELECT string_agg(quote_literal(x.val), ', ') INTO v_quoted_vals
                        FROM (SELECT jsonb_array_elements_text(v_filter_vals) AS val) x;

                        IF v_quoted_vals IS NOT NULL AND v_quoted_vals <> '' THEN
                            v_where_clauses := array_append(
                                v_where_clauses,
                                format('%I::text IN (%s)', v_db_col, v_quoted_vals)
                            );
                        END IF;
                    END IF;
                END IF;
            END;
        END LOOP;

        v_where_sql := array_to_string(v_where_clauses, ' AND ');

        BEGIN
            v_col_query := format(
                'SELECT ARRAY(
                    SELECT DISTINCT %I::text 
                    FROM public.%I 
                    WHERE %s 
                    ORDER BY %I::text ASC 
                    LIMIT 250
                )',
                v_col, p_table_name, v_where_sql, v_col
            );
            EXECUTE v_col_query INTO v_col_vals;

            v_result := jsonb_set(
                v_result, 
                ARRAY[v_col], 
                COALESCE(to_jsonb(v_col_vals), '[]'::jsonb)
            );
        EXCEPTION WHEN OTHERS THEN
            v_result := jsonb_set(v_result, ARRAY[v_col], '[]'::jsonb);
        END;
    END LOOP;

    RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_faceted_filter_options(text, uuid, text[], jsonb, uuid[]) TO authenticated, service_role, anon;


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

DROP FUNCTION IF EXISTS public.get_dashboard_analytics(uuid, int);

CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
    p_company_id uuid,
    p_limit_recent int DEFAULT 5,
    p_user_id uuid DEFAULT NULL,
    p_user_ids uuid[] DEFAULT NULL
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
    v_user_filter text := '';
    v_user_incentive_pct numeric := 5.0;
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

    IF v_has_sales_owner THEN
        IF p_user_id IS NOT NULL THEN
            v_user_filter := format(' AND sales_owner_id = %L', p_user_id);
            SELECT COALESCE(incentive_percent, 5.0) INTO v_user_incentive_pct
            FROM public.profiles
            WHERE id = p_user_id;
            IF v_user_incentive_pct IS NULL THEN
                v_user_incentive_pct := 5.0;
            END IF;
        ELSIF p_user_ids IS NOT NULL AND array_length(p_user_ids, 1) > 0 THEN
            v_user_filter := format(' AND sales_owner_id = ANY(%L::uuid[])', p_user_ids);
        END IF;
    END IF;

    IF v_user_filter = '' THEN
        SELECT total_leads, status_distribution, daily_intake
        INTO v_snap_total, v_snap_status_dist, v_snap_daily_intake
        FROM public.company_analytics_snapshots
        WHERE company_id = p_company_id;
    END IF;

    IF v_has_updated_at THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L %s AND updated_at >= %L',
            v_table_name, p_company_id, v_user_filter, v_today_start)
        INTO v_leads_today;
    ELSIF v_has_created_at THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L %s AND created_at >= %L',
            v_table_name, p_company_id, v_user_filter, v_today_start)
        INTO v_leads_today;
    END IF;

    IF v_has_status AND v_has_updated_at THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L %s AND status = ''paid'' AND updated_at >= %L',
            v_table_name, p_company_id, v_user_filter, v_today_start)
        INTO v_paid_today;
    END IF;

    IF v_has_rev_received AND v_has_updated_at THEN
        EXECUTE format('
            SELECT COALESCE(SUM(revenue_received), 0) FROM public.%I
            WHERE company_id = %L %s AND updated_at >= %L AND revenue_received > 0',
            v_table_name, p_company_id, v_user_filter, v_today_start)
        INTO v_rev_today;

        EXECUTE format('
            SELECT COALESCE(SUM(revenue_received), 0) FROM public.%I
            WHERE company_id = %L %s AND revenue_received > 0',
            v_table_name, p_company_id, v_user_filter)
        INTO v_total_rev;
    END IF;

    IF v_has_rev_projected AND v_has_status THEN
        EXECUTE format('
            SELECT COALESCE(SUM(revenue_projected), 0) FROM public.%I
            WHERE company_id = %L %s AND status = ''paid'' AND revenue_projected > 0',
            v_table_name, p_company_id, v_user_filter)
        INTO v_proj_rev;

        EXECUTE format('
            SELECT COALESCE(SUM(revenue_projected), 0) FROM public.%I
            WHERE company_id = %L %s AND status IN (''interested'', ''follow_up'') AND revenue_projected > 0',
            v_table_name, p_company_id, v_user_filter)
        INTO v_pipeline_val;
    END IF;

    IF v_user_filter != '' THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L %s',
            v_table_name, p_company_id, v_user_filter)
        INTO v_total_leads;
    ELSIF v_snap_total IS NOT NULL AND v_snap_total > 0 THEN
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

    IF v_user_filter = '' AND v_snap_status_dist IS NOT NULL AND jsonb_array_length(v_snap_status_dist) > 0 THEN
        v_status_distribution := v_snap_status_dist;
    ELSE
        IF v_has_status THEN
            EXECUTE format('
                WITH raw_statuses AS (
                    SELECT COALESCE(status, ''new'') AS status_key, COUNT(*)::int AS status_count
                    FROM public.%I
                    WHERE company_id = %L %s
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
                FROM raw_statuses', v_table_name, p_company_id, v_user_filter)
            INTO v_status_distribution;
        END IF;
    END IF;

    IF v_user_filter != '' AND v_has_created_at THEN
        EXECUTE format('
            WITH days AS (
                SELECT generate_series(
                    (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'' - INTERVAL ''6 days'')::date,
                    (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'')::date,
                    ''1 day''::interval
                )::date AS day
            ),
            daily_counts AS (
                SELECT date_trunc(''day'', created_at AT TIME ZONE ''UTC'')::date AS day,
                       COUNT(*)::bigint AS cnt,
                       %s AS rev
                FROM public.%I
                WHERE company_id = %L %s
                  AND created_at >= (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'' - INTERVAL ''6 days'')::date
                GROUP BY 1
            )
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    ''dateStr'', to_char(d.day, ''YYYY-MM-DD''),
                    ''label'', to_char(d.day, ''Mon DD''),
                    ''count'', COALESCE(c.cnt, 0),
                    ''revenue'', COALESCE(c.rev, 0)
                ) ORDER BY d.day ASC
            ), ''[]''::jsonb)
            FROM days d
            LEFT JOIN daily_counts c ON d.day = c.day',
            CASE WHEN v_has_rev_received THEN 'COALESCE(SUM(revenue_received), 0)' ELSE '0::numeric' END,
            v_table_name,
            p_company_id,
            v_user_filter)
        INTO v_intake_trend;
    ELSE
        WITH days AS (
            SELECT generate_series(
                (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '6 days')::date,
                (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
                '1 day'::interval
            )::date AS day
        )
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'dateStr', to_char(d.day, 'YYYY-MM-DD'),
                'label', to_char(d.day, 'Mon DD'),
                'count', CASE 
                    WHEN d.day = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date THEN v_leads_today
                    WHEN v_snap_daily_intake IS NOT NULL AND v_snap_daily_intake ? to_char(d.day, 'YYYY-MM-DD') 
                        THEN COALESCE((v_snap_daily_intake ->> to_char(d.day, 'YYYY-MM-DD'))::bigint, 0)
                    ELSE 0
                END,
                'revenue', 0
            ) ORDER BY d.day ASC
        ), '[]'::jsonb)
        INTO v_intake_trend
        FROM days d;
    END IF;

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
                WHERE company_id = %L %s
                ORDER BY created_at DESC
                LIMIT %s
            ) r', 
            CASE WHEN v_has_email THEN 'COALESCE(email, '''')' ELSE '''''' END,
            CASE WHEN v_has_phone THEN 'COALESCE(phone, '''')' ELSE '''''' END,
            CASE WHEN v_has_rev_received THEN 'COALESCE(revenue_received, 0)' ELSE '0::numeric' END,
            CASE WHEN v_has_rev_projected THEN 'COALESCE(revenue_projected, 0)' ELSE '0::numeric' END,
            v_table_name, 
            p_company_id, 
            v_user_filter,
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
                WHERE company_id = %L %s
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
            v_user_filter,
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
            'total_incentive', COALESCE(v_total_rev * (v_user_incentive_pct / 100.0), 0),
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
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(uuid, int, uuid, uuid[]) TO authenticated, service_role, anon;

-- ─── High-Scale Master Report Analytics (Lambda Architecture) ──────────────
CREATE TABLE IF NOT EXISTS public.company_lead_analytics_daily (
    id bigserial PRIMARY KEY,
    company_id uuid NOT NULL,
    day date NOT NULL,
    sales_owner_id uuid,
    status text NOT NULL DEFAULT 'new',
    lead_source text NOT NULL DEFAULT 'organic',
    product text NOT NULL DEFAULT 'General',
    total_leads bigint NOT NULL DEFAULT 0,
    paid_leads bigint NOT NULL DEFAULT 0,
    won_revenue numeric NOT NULL DEFAULT 0,
    pipeline_revenue numeric NOT NULL DEFAULT 0,
    active_leads bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_company_lead_daily UNIQUE(company_id, day, sales_owner_id, status, lead_source, product)
);

CREATE INDEX IF NOT EXISTS idx_lead_daily_company_day 
ON public.company_lead_analytics_daily(company_id, day DESC);

CREATE INDEX IF NOT EXISTS idx_lead_daily_company_owner 
ON public.company_lead_analytics_daily(company_id, sales_owner_id, day DESC);

GRANT SELECT ON public.company_lead_analytics_daily TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.get_master_report_analytics(
    p_company_id uuid,
    p_start_date timestamptz DEFAULT NULL,
    p_end_date timestamptz DEFAULT NULL,
    p_owner_ids uuid[] DEFAULT NULL,
    p_statuses text[] DEFAULT NULL,
    p_sources text[] DEFAULT NULL,
    p_products text[] DEFAULT NULL,
    p_revenue_status text DEFAULT 'all',
    p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_table_name text;
    v_industry text;
    v_has_products boolean := false;
    v_use_rollup boolean := false;
    v_sql text;
    v_where_rollup text := '1=1';
    v_where_live text := '1=1';
    v_where_raw text := '1=1';
    v_result jsonb;
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

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'product_purchased'
    ) INTO v_has_products;

    IF (p_search IS NULL OR TRIM(p_search) = '') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.company_lead_analytics_daily 
            WHERE company_id = p_company_id 
            LIMIT 1
        ) INTO v_use_rollup;
    END IF;

    IF v_use_rollup THEN
        v_where_rollup := format('company_id = %L AND day < CURRENT_DATE', p_company_id);
        v_where_live := format('l.company_id = %L AND l.created_at >= CURRENT_DATE', p_company_id);

        IF p_start_date IS NOT NULL THEN
            v_where_rollup := v_where_rollup || format(' AND day >= %L::date', p_start_date);
            v_where_live := v_where_live || format(' AND l.created_at >= %L', p_start_date);
        END IF;

        IF p_end_date IS NOT NULL THEN
            v_where_rollup := v_where_rollup || format(' AND day <= %L::date', p_end_date);
            v_where_live := v_where_live || format(' AND l.created_at <= %L', p_end_date);
        END IF;

        IF p_owner_ids IS NOT NULL AND array_length(p_owner_ids, 1) > 0 THEN
            v_where_rollup := v_where_rollup || format(' AND sales_owner_id = ANY(%L::uuid[])', p_owner_ids);
            v_where_live := v_where_live || format(' AND l.sales_owner_id = ANY(%L::uuid[])', p_owner_ids);
        END IF;

        IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) > 0 THEN
            v_where_rollup := v_where_rollup || format(' AND status = ANY(%L::text[])', p_statuses);
            v_where_live := v_where_live || format(' AND l.status = ANY(%L::text[])', p_statuses);
        END IF;

        IF p_sources IS NOT NULL AND array_length(p_sources, 1) > 0 THEN
            v_where_rollup := v_where_rollup || format(' AND lead_source = ANY(%L::text[])', p_sources);
            v_where_live := v_where_live || format(' AND LOWER(TRIM(COALESCE(l.lead_source, ''''))) = ANY(%L::text[])', p_sources);
        END IF;

        IF p_products IS NOT NULL AND array_length(p_products, 1) > 0 THEN
            v_where_rollup := v_where_rollup || format(' AND product = ANY(%L::text[])', p_products);
            IF v_has_products THEN
                v_where_live := v_where_live || format(' AND l.product_purchased = ANY(%L::text[])', p_products);
            END IF;
        END IF;

        IF p_revenue_status = 'with_revenue' THEN
            v_where_rollup := v_where_rollup || ' AND won_revenue > 0';
            v_where_live := v_where_live || ' AND COALESCE(l.revenue_received, 0) > 0';
        ELSIF p_revenue_status = 'zero_revenue' THEN
            v_where_rollup := v_where_rollup || ' AND won_revenue <= 0';
            v_where_live := v_where_live || ' AND COALESCE(l.revenue_received, 0) <= 0';
        END IF;

        v_sql := format('
            WITH historical_summary AS (
                SELECT 
                    status,
                    sales_owner_id,
                    lead_source,
                    product,
                    total_leads,
                    paid_leads,
                    won_revenue,
                    pipeline_revenue,
                    active_leads,
                    date_trunc(''month'', day)::date as created_month
                FROM public.company_lead_analytics_daily
                WHERE %s
            ),
            live_today AS (
                SELECT 
                    COALESCE(l.status, ''new'') as status,
                    l.sales_owner_id,
                    LOWER(TRIM(COALESCE(l.lead_source, ''organic''))) as lead_source,
                    %s as product,
                    1::bigint as total_leads,
                    CASE WHEN l.status = ''paid'' OR COALESCE(l.revenue_received, 0) > 0 THEN 1::bigint ELSE 0::bigint END as paid_leads,
                    COALESCE(l.revenue_received, 0) as won_revenue,
                    COALESCE(l.revenue_projected, 0) as pipeline_revenue,
                    CASE WHEN l.status NOT IN (''paid'', ''lost'', ''junk'', ''not_intrested'', ''not_interested'') THEN 1::bigint ELSE 0::bigint END as active_leads,
                    date_trunc(''month'', l.created_at)::date as created_month
                FROM public.%I l
                WHERE %s
            ),
            combined_summary AS MATERIALIZED (
                SELECT * FROM historical_summary
                UNION ALL
                SELECT * FROM live_today
            ),
            kpi_agg AS (
                SELECT 
                    COALESCE(SUM(total_leads), 0) as total_leads,
                    COALESCE(SUM(paid_leads), 0) as paid_leads,
                    COALESCE(SUM(won_revenue), 0) as won_revenue,
                    COALESCE(SUM(pipeline_revenue), 0) as pipeline_revenue,
                    COALESCE(SUM(active_leads), 0) as active_leads
                FROM combined_summary
            ),
            status_agg AS (
                SELECT 
                    status,
                    SUM(total_leads) as count,
                    SUM(paid_leads) as won_count,
                    SUM(won_revenue) as revenue
                FROM combined_summary
                GROUP BY status
                ORDER BY count DESC
            ),
            status_counts_by_owner AS (
                SELECT 
                    sales_owner_id, 
                    status, 
                    SUM(total_leads) as sc_count,
                    SUM(paid_leads) as sc_won,
                    SUM(won_revenue) as sc_revenue
                FROM combined_summary
                GROUP BY sales_owner_id, status
            ),
            owner_agg AS (
                SELECT 
                    sco.sales_owner_id as owner_id,
                    COALESCE(p.full_name, split_part(p.email, ''@'', 1), ''Unassigned'') as owner_name,
                    SUM(sco.sc_count) as total_leads,
                    SUM(sco.sc_won) as won_leads,
                    SUM(sco.sc_revenue) as revenue,
                    jsonb_object_agg(sco.status, sco.sc_count) as status_counts
                FROM status_counts_by_owner sco
                LEFT JOIN public.profiles p ON p.id = sco.sales_owner_id
                GROUP BY sco.sales_owner_id, p.full_name, p.email
                ORDER BY total_leads DESC
            ),
            source_agg AS (
                SELECT 
                    lead_source as source,
                    SUM(total_leads) as volume,
                    SUM(paid_leads) as converted,
                    SUM(won_revenue) as revenue
                FROM combined_summary
                WHERE lead_source IS NOT NULL AND lead_source != ''''
                GROUP BY lead_source
                ORDER BY volume DESC
            ),
            product_agg AS (
                SELECT 
                    product,
                    SUM(total_leads) as volume,
                    SUM(paid_leads) as converted,
                    SUM(won_revenue) as revenue
                FROM combined_summary
                WHERE product IS NOT NULL AND product != ''''
                GROUP BY product
                ORDER BY volume DESC
            ),
            month_agg AS (
                SELECT 
                    to_char(created_month, ''YYYY-MM'') as month_key,
                    to_char(created_month, ''Mon YYYY'') as month_label,
                    SUM(total_leads) as leads,
                    SUM(paid_leads) as paid,
                    SUM(won_revenue) as revenue
                FROM combined_summary
                GROUP BY created_month
                ORDER BY created_month ASC
            )
            SELECT jsonb_build_object(
                ''table_name'', %L,
                ''kpis'', (
                    SELECT jsonb_build_object(
                        ''total_leads'', total_leads,
                        ''paid_leads'', paid_leads,
                        ''won_revenue'', won_revenue,
                        ''pipeline_revenue'', pipeline_revenue,
                        ''active_leads'', active_leads,
                        ''conversion_rate'', CASE WHEN total_leads > 0 THEN ROUND((paid_leads::numeric / total_leads::numeric) * 100, 1) ELSE 0 END,
                        ''avg_deal_size'', CASE WHEN paid_leads > 0 THEN ROUND(won_revenue / paid_leads, 0) ELSE 0 END
                    ) FROM kpi_agg
                ),
                ''status_breakdown'', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''status'', status,
                            ''count'', count,
                            ''won_count'', won_count,
                            ''revenue'', revenue
                        )
                    ) FROM status_agg
                ), ''[]''::jsonb),
                ''owner_breakdown'', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''owner_id'', owner_id,
                            ''owner_name'', owner_name,
                            ''total_leads'', total_leads,
                            ''won_leads'', won_leads,
                            ''revenue'', revenue,
                            ''conversion_rate'', CASE WHEN total_leads > 0 THEN ROUND((won_leads::numeric / total_leads::numeric) * 100, 1) ELSE 0 END,
                            ''status_counts'', status_counts
                        )
                    ) FROM owner_agg
                ), ''[]''::jsonb),
                ''source_breakdown'', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''source'', source,
                            ''volume'', volume,
                            ''converted'', converted,
                            ''revenue'', revenue,
                            ''conversion_rate'', CASE WHEN volume > 0 THEN ROUND((converted::numeric / volume::numeric) * 100, 1) ELSE 0 END,
                            ''share_percent'', CASE WHEN (SELECT total_leads FROM kpi_agg) > 0 THEN ROUND((volume::numeric / (SELECT total_leads FROM kpi_agg)::numeric) * 100, 1) ELSE 0 END
                        )
                    ) FROM source_agg
                ), ''[]''::jsonb),
                ''product_breakdown'', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''product'', product,
                            ''volume'', volume,
                            ''converted'', converted,
                            ''revenue'', revenue,
                            ''conversion_rate'', CASE WHEN volume > 0 THEN ROUND((converted::numeric / volume::numeric) * 100, 1) ELSE 0 END
                        )
                    ) FROM product_agg
                ), ''[]''::jsonb),
                ''month_breakdown'', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''month_key'', month_key,
                            ''month_label'', month_label,
                            ''leads'', leads,
                            ''paid'', paid,
                            ''revenue'', revenue
                        )
                    ) FROM month_agg
                ), ''[]''::jsonb)
            );
        ',
        v_where_rollup,
        CASE WHEN v_has_products THEN 'COALESCE(l.product_purchased, ''General'')' ELSE '''General''' END,
        v_table_name,
        v_where_live,
        v_table_name
        );

        EXECUTE v_sql INTO v_result;
        RETURN v_result;
    END IF;

    v_where_raw := format('l.company_id = %L', p_company_id);

    IF p_start_date IS NOT NULL THEN
        v_where_raw := v_where_raw || format(' AND l.created_at >= %L', p_start_date);
    END IF;
    IF p_end_date IS NOT NULL THEN
        v_where_raw := v_where_raw || format(' AND l.created_at <= %L', p_end_date);
    END IF;

    IF p_owner_ids IS NOT NULL AND array_length(p_owner_ids, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND l.sales_owner_id = ANY(%L::uuid[])', p_owner_ids);
    END IF;

    IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND l.status = ANY(%L::text[])', p_statuses);
    END IF;

    IF p_sources IS NOT NULL AND array_length(p_sources, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND LOWER(TRIM(COALESCE(l.lead_source, ''''))) = ANY(%L::text[])', p_sources);
    END IF;

    IF v_has_products AND p_products IS NOT NULL AND array_length(p_products, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND l.product_purchased = ANY(%L::text[])', p_products);
    END IF;

    IF p_revenue_status = 'with_revenue' THEN
        v_where_raw := v_where_raw || ' AND COALESCE(l.revenue_received, 0) > 0';
    ELSIF p_revenue_status = 'zero_revenue' THEN
        v_where_raw := v_where_raw || ' AND COALESCE(l.revenue_received, 0) <= 0';
    END IF;

    IF p_search IS NOT NULL AND TRIM(p_search) != '' THEN
        v_where_raw := v_where_raw || format(' AND (l.name ILIKE %L OR l.email ILIKE %L OR l.phone ILIKE %L)', 
                                     '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
    END IF;

    v_sql := format('
        WITH filtered_leads AS MATERIALIZED (
            SELECT 
                l.status,
                l.sales_owner_id,
                LOWER(TRIM(COALESCE(l.lead_source, ''organic''))) as clean_source,
                %s as clean_product,
                COALESCE(l.revenue_received, 0) as rev_received,
                COALESCE(l.revenue_projected, 0) as rev_projected,
                date_trunc(''month'', l.created_at)::date as created_month
            FROM public.%I l
            WHERE %s
        ),
        kpi_agg AS (
            SELECT 
                COUNT(*) as total_leads,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as paid_leads,
                COALESCE(SUM(rev_received), 0) as won_revenue,
                COALESCE(SUM(rev_projected), 0) as pipeline_revenue,
                COUNT(*) FILTER (WHERE status NOT IN (''paid'', ''lost'', ''junk'', ''not_intrested'', ''not_interested'')) as active_leads
            FROM filtered_leads
        ),
        status_agg AS (
            SELECT 
                status,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as won_count,
                COALESCE(SUM(rev_received), 0) as revenue
            FROM filtered_leads
            GROUP BY status
            ORDER BY count DESC
        ),
        status_counts_by_owner AS (
            SELECT 
                sales_owner_id, 
                status, 
                COUNT(*) as sc_count,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as sc_won,
                COALESCE(SUM(rev_received), 0) as sc_revenue
            FROM filtered_leads
            GROUP BY sales_owner_id, status
        ),
        owner_agg AS (
            SELECT 
                sco.sales_owner_id as owner_id,
                COALESCE(p.full_name, split_part(p.email, ''@'', 1), ''Unassigned'') as owner_name,
                SUM(sco.sc_count) as total_leads,
                SUM(sco.sc_won) as won_leads,
                SUM(sco.sc_revenue) as revenue,
                jsonb_object_agg(sco.status, sco.sc_count) as status_counts
            FROM status_counts_by_owner sco
            LEFT JOIN public.profiles p ON p.id = sco.sales_owner_id
            GROUP BY sco.sales_owner_id, p.full_name, p.email
            ORDER BY total_leads DESC
        ),
        source_agg AS (
            SELECT 
                clean_source as source,
                COUNT(*) as volume,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as converted,
                COALESCE(SUM(rev_received), 0) as revenue
            FROM filtered_leads
            WHERE clean_source IS NOT NULL AND clean_source != ''''
            GROUP BY clean_source
            ORDER BY volume DESC
        ),
        product_agg AS (
            SELECT 
                clean_product as product,
                COUNT(*) as volume,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as converted,
                COALESCE(SUM(rev_received), 0) as revenue
            FROM filtered_leads
            WHERE clean_product IS NOT NULL AND clean_product != ''''
            GROUP BY clean_product
            ORDER BY volume DESC
        ),
        month_agg AS (
            SELECT 
                to_char(created_month, ''YYYY-MM'') as month_key,
                to_char(created_month, ''Mon YYYY'') as month_label,
                COUNT(*) as leads,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as paid,
                COALESCE(SUM(rev_received), 0) as revenue
            FROM filtered_leads
            GROUP BY created_month
            ORDER BY created_month ASC
        )
        SELECT jsonb_build_object(
            ''table_name'', %L,
            ''kpis'', (
                SELECT jsonb_build_object(
                    ''total_leads'', total_leads,
                    ''paid_leads'', paid_leads,
                    ''won_revenue'', won_revenue,
                    ''pipeline_revenue'', pipeline_revenue,
                    ''active_leads'', active_leads,
                    ''conversion_rate'', CASE WHEN total_leads > 0 THEN ROUND((paid_leads::numeric / total_leads::numeric) * 100, 1) ELSE 0 END,
                    ''avg_deal_size'', CASE WHEN paid_leads > 0 THEN ROUND(won_revenue / paid_leads, 0) ELSE 0 END
                ) FROM kpi_agg
            ),
            ''status_breakdown'', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''status'', status,
                        ''count'', count,
                        ''won_count'', won_count,
                        ''revenue'', revenue
                    )
                ) FROM status_agg
            ), ''[]''::jsonb),
            ''owner_breakdown'', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''owner_id'', owner_id,
                        ''owner_name'', owner_name,
                        ''total_leads'', total_leads,
                        ''won_leads'', won_leads,
                        ''revenue'', revenue,
                        ''conversion_rate'', CASE WHEN total_leads > 0 THEN ROUND((won_leads::numeric / total_leads::numeric) * 100, 1) ELSE 0 END,
                        ''status_counts'', status_counts
                    )
                ) FROM owner_agg
            ), ''[]''::jsonb),
            ''source_breakdown'', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''source'', source,
                        ''volume'', volume,
                        ''converted'', converted,
                        ''revenue'', revenue,
                        ''conversion_rate'', CASE WHEN volume > 0 THEN ROUND((converted::numeric / volume::numeric) * 100, 1) ELSE 0 END,
                        ''share_percent'', CASE WHEN (SELECT total_leads FROM kpi_agg) > 0 THEN ROUND((volume::numeric / (SELECT total_leads FROM kpi_agg)::numeric) * 100, 1) ELSE 0 END
                    )
                ) FROM source_agg
            ), ''[]''::jsonb),
            ''product_breakdown'', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''product'', product,
                        ''volume'', volume,
                        ''converted'', converted,
                        ''revenue'', revenue,
                        ''conversion_rate'', CASE WHEN volume > 0 THEN ROUND((converted::numeric / volume::numeric) * 100, 1) ELSE 0 END
                    )
                ) FROM product_agg
            ), ''[]''::jsonb),
            ''month_breakdown'', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''month_key'', month_key,
                        ''month_label'', month_label,
                        ''leads'', leads,
                        ''paid'', paid,
                        ''revenue'', revenue
                    )
                ) FROM month_agg
            ), ''[]''::jsonb)
        );
    ',
    CASE WHEN v_has_products THEN 'COALESCE(l.product_purchased, ''General'')' ELSE '''General''' END,
    v_table_name,
    v_where_raw,
    v_table_name
    );

    EXECUTE v_sql INTO v_result;
    RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_master_report_analytics(uuid, timestamptz, timestamptz, uuid[], text[], text[], text[], text, text) TO authenticated, service_role, anon;

-- ─── Employee Activity Daily Rollup & High-Performance Audit RPC ──────────
CREATE TABLE IF NOT EXISTS public.company_employee_activity_daily (
    company_id UUID NOT NULL,
    day DATE NOT NULL,
    user_id UUID NOT NULL,
    total_actions INT NOT NULL DEFAULT 0,
    unique_leads_worked INT NOT NULL DEFAULT 0,
    action_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (company_id, day, user_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_activity_daily_comp_day
    ON public.company_employee_activity_daily (company_id, day DESC);

CREATE INDEX IF NOT EXISTS idx_employee_activity_daily_comp_user
    ON public.company_employee_activity_daily (company_id, user_id, day DESC);

ALTER TABLE public.company_employee_activity_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read activity daily of their company" ON public.company_employee_activity_daily;
CREATE POLICY "Users can read activity daily of their company" ON public.company_employee_activity_daily
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE OR REPLACE FUNCTION public.refresh_company_employee_activity_daily(
    p_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    WITH action_agg AS (
        SELECT 
            company_id,
            date_trunc('day', created_at)::date as day,
            user_id,
            action,
            count(*) as action_count,
            count(DISTINCT lead_id) as unique_leads_count
        FROM public.lead_activity_log
        WHERE user_id IS NOT NULL
          AND created_at < date_trunc('day', now())
          AND (p_company_id IS NULL OR company_id = p_company_id)
        GROUP BY company_id, date_trunc('day', created_at)::date, user_id, action
    )
    INSERT INTO public.company_employee_activity_daily (
        company_id,
        day,
        user_id,
        total_actions,
        unique_leads_worked,
        action_counts
    )
    SELECT 
        company_id,
        day,
        user_id,
        sum(action_count)::int as total_actions,
        sum(unique_leads_count)::int as unique_leads_worked,
        jsonb_object_agg(action, action_count) as action_counts
    FROM action_agg
    GROUP BY company_id, day, user_id
    ON CONFLICT (company_id, day, user_id) DO UPDATE
    SET total_actions = EXCLUDED.total_actions,
        unique_leads_worked = EXCLUDED.unique_leads_worked,
        action_counts = EXCLUDED.action_counts;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_daily_activity_report(
    p_company_id uuid,
    p_start_date timestamptz DEFAULT date_trunc('day', now()),
    p_end_date timestamptz DEFAULT now(),
    p_user_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_has_daily_rollup boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.company_employee_activity_daily
        WHERE company_id = p_company_id
        LIMIT 1
    ) INTO v_has_daily_rollup;

    IF v_has_daily_rollup THEN
        WITH profiles_scope AS (
            SELECT id, company_id, full_name, email, avatar_url
            FROM public.profiles
            WHERE company_id = p_company_id
              AND (is_deactivated IS NULL OR is_deactivated = false)
              AND (p_user_ids IS NULL OR id = ANY(p_user_ids))
        ),
        today_raw AS (
            SELECT 
                user_id,
                lead_id,
                action
            FROM public.lead_activity_log
            WHERE company_id = p_company_id
              AND created_at >= GREATEST(p_start_date, date_trunc('day', now()))
              AND created_at <= p_end_date
              AND user_id IS NOT NULL
              AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
        ),
        today_action_counts AS (
            SELECT user_id, action, count(*) as cnt
            FROM today_raw
            GROUP BY user_id, action
        ),
        today_action_json AS (
            SELECT user_id, jsonb_object_agg(action, cnt) as action_counts
            FROM today_action_counts
            GROUP BY user_id
        ),
        today_summary AS (
            SELECT 
                CURRENT_DATE as day,
                tr.user_id,
                count(DISTINCT tr.lead_id)::int as unique_leads_worked,
                count(*)::int as total_actions,
                COALESCE(taj.action_counts, '{}'::jsonb) as action_counts
            FROM today_raw tr
            LEFT JOIN today_action_json taj ON taj.user_id = tr.user_id
            GROUP BY tr.user_id, taj.action_counts
        ),
        combined_activities AS (
            SELECT day, user_id, total_actions, unique_leads_worked, action_counts
            FROM public.company_employee_activity_daily
            WHERE company_id = p_company_id
              AND day >= p_start_date::date
              AND day <= LEAST(p_end_date::date, (CURRENT_DATE - 1))
              AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
            UNION ALL
            SELECT day, user_id, total_actions, unique_leads_worked, action_counts
            FROM today_summary
        ),
        user_actions_combined AS (
            SELECT 
                ca.user_id,
                kv.key as action,
                sum((kv.value)::text::int)::int as action_count
            FROM combined_activities ca,
            LATERAL jsonb_each(ca.action_counts) kv
            GROUP BY ca.user_id, kv.key
        ),
        user_action_counts_json AS (
            SELECT 
                user_id,
                jsonb_object_agg(action, action_count) as action_counts
            FROM user_actions_combined
            GROUP BY user_id
        ),
        user_metrics AS (
            SELECT 
                ca.user_id,
                sum(ca.unique_leads_worked)::int as unique_leads_worked,
                sum(ca.total_actions)::int as total_actions,
                COALESCE(uacj.action_counts, '{}'::jsonb) as action_counts
            FROM combined_activities ca
            LEFT JOIN user_action_counts_json uacj ON uacj.user_id = ca.user_id
            GROUP BY ca.user_id, uacj.action_counts
        ),
        latest_activities AS (
            SELECT 
                p.id as user_id,
                la.last_active_at,
                la.action,
                la.lead_id,
                la.lead_name,
                la.old_status,
                la.new_status,
                la.details,
                la.seconds_ago
            FROM profiles_scope p
            LEFT JOIN LATERAL (
                SELECT 
                    l.created_at as last_active_at,
                    l.action,
                    l.lead_id,
                    l.lead_name,
                    l.old_status,
                    l.new_status,
                    l.details,
                    EXTRACT(EPOCH FROM (now() - l.created_at))::int as seconds_ago
                FROM public.lead_activity_log l
                WHERE l.company_id = p.company_id
                  AND l.user_id = p.id
                ORDER BY l.created_at DESC
                LIMIT 1
            ) la ON true
        ),
        employee_agg AS (
            SELECT 
                p.id as user_id,
                COALESCE(p.full_name, split_part(p.email, '@', 1), 'Team Member') as name,
                p.email,
                p.avatar_url,
                COALESCE(um.unique_leads_worked, 0) as unique_leads_worked,
                COALESCE(um.total_actions, 0) as total_actions,
                COALESCE(um.action_counts, '{}'::jsonb) as action_counts,
                CASE 
                    WHEN la.last_active_at IS NOT NULL THEN
                        jsonb_build_object(
                            'timestamp', la.last_active_at,
                            'action', la.action,
                            'lead_id', la.lead_id,
                            'lead_name', la.lead_name,
                            'old_status', la.old_status,
                            'new_status', la.new_status,
                            'details', la.details,
                            'seconds_ago', la.seconds_ago,
                            'status_badge', CASE 
                                WHEN la.seconds_ago <= 900 THEN 'active_now'
                                WHEN la.seconds_ago <= 3600 THEN 'idle'
                                WHEN la.seconds_ago <= 86400 THEN 'earlier_today'
                                ELSE 'inactive'
                            END
                        )
                    ELSE NULL
                END as last_activity
            FROM profiles_scope p
            LEFT JOIN user_metrics um ON um.user_id = p.id
            LEFT JOIN latest_activities la ON la.user_id = p.id
            ORDER BY unique_leads_worked DESC, total_actions DESC, name ASC
        ),
        daily_trend AS (
            SELECT 
                ca.day::timestamptz as day_date,
                ca.user_id,
                COALESCE(p.full_name, 'Unknown') as name,
                ca.unique_leads_worked as unique_leads,
                ca.total_actions
            FROM combined_activities ca
            LEFT JOIN profiles_scope p ON p.id = ca.user_id
            ORDER BY ca.day ASC, ca.unique_leads_worked DESC
        )
        SELECT jsonb_build_object(
            'summary', jsonb_build_object(
                'total_unique_leads_worked', COALESCE((SELECT sum(unique_leads_worked)::int FROM combined_activities), 0),
                'total_actions', COALESCE((SELECT sum(total_actions)::int FROM combined_activities), 0),
                'active_employees_count', (SELECT count(*) FROM employee_agg WHERE unique_leads_worked > 0),
                'total_employees_count', (SELECT count(*) FROM profiles_scope),
                'active_now_count', (SELECT count(*) FROM employee_agg WHERE last_activity->>'status_badge' = 'active_now'),
                'top_performer', (
                    SELECT jsonb_build_object(
                        'user_id', user_id,
                        'name', name,
                        'email', email,
                        'unique_leads_worked', unique_leads_worked,
                        'total_actions', total_actions
                    )
                    FROM employee_agg
                    WHERE unique_leads_worked > 0
                    LIMIT 1
                )
            ),
            'employees', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'user_id', user_id,
                        'name', name,
                        'email', email,
                        'avatar_url', avatar_url,
                        'unique_leads_worked', unique_leads_worked,
                        'total_actions', total_actions,
                        'action_counts', action_counts,
                        'last_activity', last_activity
                    )
                )
                FROM employee_agg
            ), '[]'::jsonb),
            'daily_trend', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'date', day_date,
                        'user_id', user_id,
                        'name', name,
                        'unique_leads', unique_leads,
                        'total_actions', total_actions
                    )
                    ORDER BY day_date ASC, unique_leads DESC
                )
                FROM daily_trend
            ), '[]'::jsonb),
            'start_date', p_start_date,
            'end_date', p_end_date
        ) INTO v_result;

    ELSE
        WITH profiles_scope AS (
            SELECT id, company_id, full_name, email, avatar_url
            FROM public.profiles
            WHERE company_id = p_company_id
              AND (is_deactivated IS NULL OR is_deactivated = false)
              AND (p_user_ids IS NULL OR id = ANY(p_user_ids))
        ),
        period_activities AS MATERIALIZED (
            SELECT 
                l.user_id,
                l.lead_id,
                l.action,
                l.created_at
            FROM public.lead_activity_log l
            WHERE l.company_id = p_company_id
              AND l.created_at >= p_start_date
              AND l.created_at <= p_end_date
              AND l.user_id IS NOT NULL
              AND (p_user_ids IS NULL OR l.user_id = ANY(p_user_ids))
        ),
        user_action_counts AS (
            SELECT 
                user_id,
                action,
                count(*) as cnt
            FROM period_activities
            GROUP BY user_id, action
        ),
        user_action_objs AS (
            SELECT 
                user_id,
                jsonb_object_agg(action, cnt) as action_counts
            FROM user_action_counts
            GROUP BY user_id
        ),
        user_period_metrics AS (
            SELECT 
                pa.user_id,
                count(*) as unique_leads_worked,
                sum(pa.action_count)::int as total_actions,
                COALESCE(uao.action_counts, '{}'::jsonb) as action_counts
            FROM (
                SELECT user_id, lead_id, count(*) as action_count
                FROM period_activities
                GROUP BY user_id, lead_id
            ) pa
            LEFT JOIN user_action_objs uao ON uao.user_id = pa.user_id
            GROUP BY pa.user_id, uao.action_counts
        ),
        latest_activities AS (
            SELECT 
                p.id as user_id,
                la.last_active_at,
                la.action,
                la.lead_id,
                la.lead_name,
                la.old_status,
                la.new_status,
                la.details,
                la.seconds_ago
            FROM profiles_scope p
            LEFT JOIN LATERAL (
                SELECT 
                    l.created_at as last_active_at,
                    l.action,
                    l.lead_id,
                    l.lead_name,
                    l.old_status,
                    l.new_status,
                    l.details,
                    EXTRACT(EPOCH FROM (now() - l.created_at))::int as seconds_ago
                FROM public.lead_activity_log l
                WHERE l.company_id = p_company_id
                  AND l.user_id = p.id
                ORDER BY l.created_at DESC
                LIMIT 1
            ) la ON true
        ),
        employee_agg AS (
            SELECT 
                p.id as user_id,
                COALESCE(p.full_name, split_part(p.email, '@', 1), 'Team Member') as name,
                p.email,
                p.avatar_url,
                COALESCE(upm.unique_leads_worked, 0) as unique_leads_worked,
                COALESCE(upm.total_actions, 0) as total_actions,
                COALESCE(upm.action_counts, '{}'::jsonb) as action_counts,
                CASE 
                    WHEN la.last_active_at IS NOT NULL THEN
                        jsonb_build_object(
                            'timestamp', la.last_active_at,
                            'action', la.action,
                            'lead_id', la.lead_id,
                            'lead_name', la.lead_name,
                            'old_status', la.old_status,
                            'new_status', la.new_status,
                            'details', la.details,
                            'seconds_ago', la.seconds_ago,
                            'status_badge', CASE 
                                WHEN la.seconds_ago <= 900 THEN 'active_now'
                                WHEN la.seconds_ago <= 3600 THEN 'idle'
                                WHEN la.seconds_ago <= 86400 THEN 'earlier_today'
                                ELSE 'inactive'
                            END
                        )
                    ELSE NULL
                END as last_activity
            FROM profiles_scope p
            LEFT JOIN user_period_metrics upm ON upm.user_id = p.id
            LEFT JOIN latest_activities la ON la.user_id = p.id
            ORDER BY unique_leads_worked DESC, total_actions DESC, name ASC
        ),
        daily_counts AS (
            SELECT 
                date_trunc('day', pa.created_at) as day_date,
                pa.user_id,
                COALESCE(p.full_name, 'Unknown') as name,
                count(DISTINCT pa.lead_id) as unique_leads_count,
                count(*) as total_actions
            FROM period_activities pa
            LEFT JOIN profiles_scope p ON p.id = pa.user_id
            GROUP BY 1, 2, 3
            ORDER BY 1 ASC, unique_leads_count DESC
        ),
        overall_totals AS (
            SELECT 
                COUNT(DISTINCT lead_id) as total_unique_leads,
                COUNT(*) as total_actions
            FROM period_activities
        )
        SELECT jsonb_build_object(
            'summary', jsonb_build_object(
                'total_unique_leads_worked', COALESCE((SELECT total_unique_leads FROM overall_totals), 0),
                'total_actions', COALESCE((SELECT total_actions FROM overall_totals), 0),
                'active_employees_count', (SELECT count(*) FROM employee_agg WHERE unique_leads_worked > 0),
                'total_employees_count', (SELECT count(*) FROM profiles_scope),
                'active_now_count', (SELECT count(*) FROM employee_agg WHERE last_activity->>'status_badge' = 'active_now'),
                'top_performer', (
                    SELECT jsonb_build_object(
                        'user_id', user_id,
                        'name', name,
                        'email', email,
                        'unique_leads_worked', unique_leads_worked,
                        'total_actions', total_actions
                    )
                    FROM employee_agg
                    WHERE unique_leads_worked > 0
                    LIMIT 1
                )
            ),
            'employees', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'user_id', user_id,
                        'name', name,
                        'email', email,
                        'avatar_url', avatar_url,
                        'unique_leads_worked', unique_leads_worked,
                        'total_actions', total_actions,
                        'action_counts', action_counts,
                        'last_activity', last_activity
                    )
                )
                FROM employee_agg
            ), '[]'::jsonb),
            'daily_trend', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'date', day_date,
                        'user_id', user_id,
                        'name', name,
                        'unique_leads', unique_leads,
                        'total_actions', total_actions
                    )
                    ORDER BY day_date ASC, unique_leads DESC
                )
                FROM daily_counts
            ), '[]'::jsonb),
            'start_date', p_start_date,
            'end_date', p_end_date
        ) INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_employee_daily_activity_report(uuid, timestamptz, timestamptz, uuid[]) TO authenticated, service_role, anon;

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

-- ─── High-Performance Merge Duplicate Leads ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.merge_duplicate_leads(
  input_company_id uuid,
  batch_limit int DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name text;
  v_unique_constraints text[];
  v_industry text;
  v_constraint text;
  v_total_merged int := 0;
  v_total_deleted int := 0;
  v_dup_record RECORD;
  v_newest_id uuid;
  v_effective_limit int := LEAST(COALESCE(batch_limit, 100), 200);
  v_has_more boolean := false;
BEGIN
  -- Get constraints and table info
  SELECT custom_leads_table, unique_constraints, industry 
  INTO v_table_name, v_unique_constraints, v_industry
  FROM public.companies WHERE id = input_company_id;

  IF v_unique_constraints IS NULL OR array_length(v_unique_constraints, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No unique identifier configured.');
  END IF;

  IF v_table_name IS NULL THEN
    IF v_industry = 'real_estate' THEN v_table_name := 'leads_real_estate';
    ELSIF v_industry = 'saas' THEN v_table_name := 'leads_saas';
    ELSIF v_industry = 'healthcare' THEN v_table_name := 'leads_healthcare';
    ELSIF v_industry = 'insurance' THEN v_table_name := 'leads_insurance';
    ELSIF v_industry = 'travel' THEN v_table_name := 'leads_travel';
    ELSE v_table_name := 'leads';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table_name) THEN
    RETURN jsonb_build_object('success', false, 'message', format('Table %s not found', v_table_name));
  END IF;

  FOREACH v_constraint IN ARRAY v_unique_constraints
  LOOP
    IF v_total_merged >= v_effective_limit THEN
      v_has_more := true;
      EXIT;
    END IF;

    FOR v_dup_record IN EXECUTE format('
      SELECT %I as value, array_agg(id ORDER BY created_at DESC, id DESC) as ids
      FROM %I
      WHERE %I IS NOT NULL AND %I != '''' AND company_id = %L
      GROUP BY %I
      HAVING count(*) > 1
      LIMIT %L
    ', v_constraint, v_table_name, v_constraint, v_constraint, input_company_id, v_constraint, (v_effective_limit - v_total_merged))
    LOOP
      v_newest_id := v_dup_record.ids[1];

      DECLARE
        v_old_ids uuid[];
        v_row_json jsonb;
        v_merged_json jsonb := '{}'::jsonb;
        v_key text;
        v_val text;
        v_set_parts text[] := '{}';
      BEGIN
        v_old_ids := v_dup_record.ids[2:array_length(v_dup_record.ids, 1)];

        FOR v_row_json IN EXECUTE format('
          SELECT to_jsonb(t) FROM %I t 
          WHERE id = ANY(%L::uuid[]) 
          ORDER BY created_at ASC, id ASC
        ', v_table_name, v_dup_record.ids)
        LOOP
          v_merged_json := v_merged_json || jsonb_strip_nulls(v_row_json);
        END LOOP;

        v_merged_json := v_merged_json - 'id' - 'company_id' - 'created_at' - 'embedding';
        v_merged_json := v_merged_json || jsonb_build_object('updated_at', NOW());

        FOR v_key, v_val IN SELECT key, value FROM jsonb_each_text(v_merged_json)
        LOOP
          v_set_parts := array_append(v_set_parts, format('%I = %L', v_key, v_val));
        END LOOP;

        IF array_length(v_set_parts, 1) > 0 THEN
          EXECUTE format('UPDATE %I SET %s WHERE id = %L', v_table_name, array_to_string(v_set_parts, ', '), v_newest_id);
        END IF;

        IF array_length(v_old_ids, 1) > 0 THEN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_activity_log') THEN
            UPDATE public.lead_activity_log SET lead_id = v_newest_id WHERE lead_id = ANY(v_old_ids);
          END IF;

          EXECUTE format('DELETE FROM %I WHERE id = ANY(%L::uuid[])', v_table_name, v_old_ids);
          v_total_deleted := v_total_deleted + array_length(v_old_ids, 1);
        END IF;

        v_total_merged := v_total_merged + 1;

        IF v_total_merged >= v_effective_limit THEN
          v_has_more := true;
          EXIT;
        END IF;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'message', format('Merged %s duplicate group(s), removed %s redundant record(s)', v_total_merged, v_total_deleted),
    'merged_groups', v_total_merged,
    'deleted_records', v_total_deleted,
    'has_more', v_has_more
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_leads(uuid, integer) TO authenticated, service_role;

-- ─── Storage bucket ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ─── SaaS Partnership Program Ecosystem ─────────────────────────────────────

-- 1. Create partners table
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    company_name TEXT,
    website TEXT,
    phone TEXT,
    category TEXT NOT NULL DEFAULT 'affiliate' CHECK (category IN ('affiliate', 'agency', 'white_label')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
    referral_code TEXT UNIQUE NOT NULL,
    commission_rate NUMERIC DEFAULT 0,
    fixed_monthly_cost NUMERIC DEFAULT 0,
    custom_terms JSONB DEFAULT '{}'::jsonb,
    payout_info JSONB DEFAULT '{"upi_id": "", "bank_name": "", "account_number": "", "ifsc_code": "", "pan_number": "", "gst_number": ""}'::jsonb,
    total_earnings NUMERIC DEFAULT 0,
    pending_earnings NUMERIC DEFAULT 0,
    paid_earnings NUMERIC DEFAULT 0,
    total_clicks NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_referral_code ON public.partners (referral_code);
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON public.partners (user_id);
CREATE INDEX IF NOT EXISTS idx_partners_category ON public.partners (category);
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners (status);

-- 2. Create partner_referrals table
CREATE TABLE IF NOT EXISTS public.partner_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    referred_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    admin_name TEXT,
    admin_email TEXT,
    plan_type TEXT DEFAULT 'quarterly',
    is_paid BOOLEAN DEFAULT false,
    first_topup_amount NUMERIC DEFAULT 0,
    first_topup_discount NUMERIC DEFAULT 0,
    total_revenue_generated NUMERIC DEFAULT 0,
    commission_earned NUMERIC DEFAULT 0,
    commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'approved', 'paid')),
    registered_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner_id ON public.partner_referrals (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_referred_company_id ON public.partner_referrals (referred_company_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_is_paid ON public.partner_referrals (is_paid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_referrals_unique_company ON public.partner_referrals (referred_company_id) WHERE referred_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_referrals_admin_email ON public.partner_referrals (LOWER(admin_email)) WHERE referred_company_id IS NULL;

-- 3. Create partner_payouts table
CREATE TABLE IF NOT EXISTS public.partner_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    reference_number TEXT,
    payment_method TEXT DEFAULT 'bank_transfer',
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'rejected')),
    notes TEXT,
    paid_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner_id ON public.partner_payouts (partner_id);

-- 4. Add Partner Attributes to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS partner_category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS partner_referral_code TEXT DEFAULT NULL;

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

-- Partners Policies
DROP POLICY IF EXISTS "Partners can view their own record" ON public.partners;
CREATE POLICY "Partners can view their own record"
ON public.partners FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can insert partner record" ON public.partners;
CREATE POLICY "Anyone can insert partner record"
ON public.partners FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Partners can update own profile" ON public.partners;
CREATE POLICY "Partners can update own profile"
ON public.partners FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
)
WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Platform admins full access to partners" ON public.partners;
CREATE POLICY "Platform admins full access to partners"
ON public.partners FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Referrals Policies
DROP POLICY IF EXISTS "Partners can view their own referrals" ON public.partner_referrals;
CREATE POLICY "Partners can view their own referrals"
ON public.partner_referrals FOR SELECT
TO authenticated
USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Public can create referral on signup" ON public.partner_referrals;
CREATE POLICY "Public can create referral on signup"
ON public.partner_referrals FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins full access to referrals" ON public.partner_referrals;
CREATE POLICY "Platform admins full access to referrals"
ON public.partner_referrals FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Payouts Policies
DROP POLICY IF EXISTS "Partners can view their own payouts" ON public.partner_payouts;
CREATE POLICY "Partners can view their own payouts"
ON public.partner_payouts FOR SELECT
TO authenticated
USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Partners can insert payout request" ON public.partner_payouts;
CREATE POLICY "Partners can insert payout request"
ON public.partner_payouts FOR INSERT
TO authenticated
WITH CHECK (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    AND status = 'pending'
);

DROP POLICY IF EXISTS "Platform admins full access to payouts" ON public.partner_payouts;
CREATE POLICY "Platform admins full access to payouts"
ON public.partner_payouts FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Triggers and Functions
CREATE OR REPLACE FUNCTION public.sync_partner_discount_code()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.discount_codes (
        code,
        discount_percentage,
        active,
        uses_count,
        total_uses,
        valid_until,
        created_at
    ) VALUES (
        NEW.referral_code,
        10,
        true,
        0,
        100000,
        now() + interval '5 years',
        now()
    )
    ON CONFLICT (code) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_partner_discount_code ON public.partners;
CREATE TRIGGER trg_sync_partner_discount_code
AFTER INSERT ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.sync_partner_discount_code();

CREATE OR REPLACE FUNCTION public.track_partner_click(p_code TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.partners
    SET total_clicks = COALESCE(total_clicks, 0) + 1
    WHERE referral_code = UPPER(TRIM(p_code)) AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.track_partner_click(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_partner_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      is_partner = (NEW.status = 'active'),
      partner_category = NEW.category,
      partner_referral_code = NEW.referral_code,
      updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_partner_to_profile ON public.partners;
CREATE TRIGGER trg_sync_partner_to_profile
  AFTER INSERT OR UPDATE OF user_id, category, referral_code, status
  ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_partner_to_profile();

CREATE OR REPLACE FUNCTION public.link_partner_on_profile_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner RECORD;
BEGIN
  SELECT id, category, referral_code, status INTO v_partner
  FROM public.partners
  WHERE LOWER(email) = LOWER(NEW.email)
    AND user_id IS NULL
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.partners
    SET user_id = NEW.id,
        updated_at = NOW()
    WHERE id = v_partner.id;

    NEW.is_partner := (v_partner.status = 'active');
    NEW.partner_category := v_partner.category;
    NEW.partner_referral_code := v_partner.referral_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_partner_on_profile_create ON public.profiles;
CREATE TRIGGER trg_link_partner_on_profile_create
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.link_partner_on_profile_create();

CREATE OR REPLACE FUNCTION public.request_partner_payout(
    p_amount NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_id UUID;
    v_pending NUMERIC;
    v_payout_id UUID;
    v_min_threshold NUMERIC := 1000;
BEGIN
    SELECT id, pending_earnings INTO v_partner_id, v_pending
    FROM public.partners
    WHERE user_id = auth.uid();

    IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'Caller is not registered as a partner';
    END IF;

    IF p_amount < v_min_threshold THEN
        RAISE EXCEPTION 'Minimum payout request amount is ₹%', v_min_threshold;
    END IF;

    IF p_amount > v_pending THEN
        RAISE EXCEPTION 'Requested amount (₹%) exceeds available pending earnings (₹%)', p_amount, v_pending;
    END IF;

    INSERT INTO public.partner_payouts (
        partner_id,
        amount,
        reference_number,
        payment_method,
        status,
        notes,
        created_at
    ) VALUES (
        v_partner_id,
        p_amount,
        'REQ-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6),
        'bank_transfer',
        'pending',
        p_notes,
        now()
    ) RETURNING id INTO v_payout_id;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'amount', p_amount,
        'status', 'pending'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_partner_payout(NUMERIC, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_settle_partner_payout(
    p_payout_id UUID,
    p_reference_number TEXT,
    p_payment_method TEXT DEFAULT 'bank_transfer',
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_payout RECORD;
    v_partner RECORD;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Platform admin only';
    END IF;

    SELECT * INTO v_payout
    FROM public.partner_payouts
    WHERE id = p_payout_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payout record not found';
    END IF;

    IF v_payout.status = 'completed' THEN
        RAISE EXCEPTION 'Payout is already settled';
    END IF;

    SELECT * INTO v_partner
    FROM public.partners
    WHERE id = v_payout.partner_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated partner not found';
    END IF;

    UPDATE public.partner_payouts
    SET 
        status = 'completed',
        reference_number = p_reference_number,
        payment_method = COALESCE(p_payment_method, 'bank_transfer'),
        notes = COALESCE(p_admin_notes, notes),
        paid_at = now()
    WHERE id = p_payout_id;

    UPDATE public.partners
    SET 
        pending_earnings = GREATEST(0, pending_earnings - v_payout.amount),
        paid_earnings = paid_earnings + v_payout.amount,
        updated_at = now()
    WHERE id = v_payout.partner_id;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', p_payout_id,
        'amount', v_payout.amount,
        'status', 'completed'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_settle_partner_payout(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ─── High-Performance Server-Side Leads Search RPC ────────────────────────
CREATE OR REPLACE FUNCTION public.search_leads_fast(
    p_table_name text,
    p_company_id uuid,
    p_search text,
    p_status_filter text[] DEFAULT NULL,
    p_owner_filter text[] DEFAULT NULL,
    p_product_filter text[] DEFAULT NULL,
    p_accessible_user_ids uuid[] DEFAULT NULL,
    p_dynamic_filters jsonb DEFAULT NULL,
    p_pending_payment_only boolean DEFAULT false,
    p_exclude_history boolean DEFAULT true,
    p_limit int DEFAULT 25,
    p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_clean_search text := trim(p_search);
    v_phone_digits text := regexp_replace(v_clean_search, '\D', '', 'g');
    v_where_clauses text[] := ARRAY['1=1'];
    v_search_clauses text[] := ARRAY[]::text[];
    v_where_sql text;
    v_sql text;
    v_count_sql text;
    v_leads jsonb;
    v_total_count bigint := 0;
    v_valid_cols text[];
    v_dyn_key text;
    v_dyn_val jsonb;
    v_is_uuid boolean := false;
BEGIN
    -- 1. Validate table exists in public schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = p_table_name
    ) THEN
        RETURN jsonb_build_object('leads', '[]'::jsonb, 'total_count', 0);
    END IF;

    -- 2. Fetch list of all valid columns for this table
    SELECT array_agg(column_name::text) INTO v_valid_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table_name;

    IF v_valid_cols IS NULL THEN
        RETURN jsonb_build_object('leads', '[]'::jsonb, 'total_count', 0);
    END IF;

    -- 3. Company isolation
    IF 'company_id' = ANY(v_valid_cols) AND p_company_id IS NOT NULL THEN
        v_where_clauses := array_append(v_where_clauses, format('l.company_id = %L', p_company_id));
    END IF;

    -- 4. Search condition (combines GIN trigram indexes for <50ms response)
    IF v_clean_search <> '' THEN
        -- Check if search query is a UUID
        IF v_clean_search ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_is_uuid := true;
            IF 'id' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.id = %L::uuid', v_clean_search));
            END IF;
        END IF;

        IF NOT v_is_uuid THEN
            IF 'name' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.name ILIKE %L', '%' || v_clean_search || '%'));
            END IF;
            IF 'email' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.email ILIKE %L', '%' || v_clean_search || '%'));
            END IF;
            IF 'phone' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.phone ILIKE %L', '%' || v_clean_search || '%'));
                -- If phone digits provided (at least 6 digits), also match normalized digits
                IF length(v_phone_digits) >= 6 AND v_phone_digits <> v_clean_search THEN
                    v_search_clauses := array_append(v_search_clauses, format('l.phone ILIKE %L', '%' || v_phone_digits || '%'));
                END IF;
                -- If international phone number with country prefix (e.g. 61432530013 or 919876543210), match last 9 or 10 digits
                IF length(v_phone_digits) >= 10 THEN
                    v_search_clauses := array_append(v_search_clauses, format('l.phone ILIKE %L', '%' || right(v_phone_digits, 10) || '%'));
                    v_search_clauses := array_append(v_search_clauses, format('l.phone ILIKE %L', '%' || right(v_phone_digits, 9) || '%'));
                ELSIF length(v_phone_digits) = 10 AND starts_with(v_phone_digits, '0') THEN
                    v_search_clauses := array_append(v_search_clauses, format('l.phone ILIKE %L', '%' || substring(v_phone_digits from 2) || '%'));
                END IF;
            END IF;
            IF 'college' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.college ILIKE %L', '%' || v_clean_search || '%'));
            END IF;
            IF 'property_name' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.property_name ILIKE %L', '%' || v_clean_search || '%'));
            END IF;
        END IF;

        IF array_length(v_search_clauses, 1) > 0 THEN
            v_where_clauses := array_append(v_where_clauses, '(' || array_to_string(v_search_clauses, ' OR ') || ')');
        END IF;
    END IF;

    -- 5. Status filter
    IF p_status_filter IS NOT NULL AND array_length(p_status_filter, 1) > 0 AND 'status' = ANY(v_valid_cols) THEN
        v_where_clauses := array_append(v_where_clauses, format('l.status::text = ANY(%L)', p_status_filter));
    END IF;

    -- 6. Owner filter
    IF p_owner_filter IS NOT NULL AND array_length(p_owner_filter, 1) > 0 AND 'sales_owner_id' = ANY(v_valid_cols) THEN
        DECLARE
            v_has_unassigned boolean := 'unassigned' = ANY(p_owner_filter);
            v_real_owners uuid[] := ARRAY[]::uuid[];
            v_owner_str text;
        BEGIN
            FOREACH v_owner_str IN ARRAY p_owner_filter LOOP
                IF v_owner_str <> 'unassigned' THEN
                    BEGIN
                        v_real_owners := array_append(v_real_owners, v_owner_str::uuid);
                    EXCEPTION WHEN OTHERS THEN
                        -- ignore non-uuids
                    END;
                END IF;
            END LOOP;

            IF v_has_unassigned AND array_length(v_real_owners, 1) > 0 THEN
                v_where_clauses := array_append(v_where_clauses, format('(l.sales_owner_id IS NULL OR l.sales_owner_id = ANY(%L))', v_real_owners));
            ELSIF v_has_unassigned THEN
                v_where_clauses := array_append(v_where_clauses, 'l.sales_owner_id IS NULL');
            ELSIF array_length(v_real_owners, 1) > 0 THEN
                v_where_clauses := array_append(v_where_clauses, format('l.sales_owner_id = ANY(%L)', v_real_owners));
            END IF;
        END;
    END IF;

    -- 7. Product filter
    IF p_product_filter IS NOT NULL AND array_length(p_product_filter, 1) > 0 AND 'product_purchased' = ANY(v_valid_cols) THEN
        v_where_clauses := array_append(v_where_clauses, format('l.product_purchased = ANY(%L)', p_product_filter));
    END IF;

    -- 8. Hierarchy scoping (non-admin restrictions)
    IF p_accessible_user_ids IS NOT NULL AND array_length(p_accessible_user_ids, 1) > 0 AND 'sales_owner_id' = ANY(v_valid_cols) THEN
        v_where_clauses := array_append(v_where_clauses, format('l.sales_owner_id = ANY(%L)', p_accessible_user_ids));
    END IF;

    -- 9. Dynamic column filters
    IF p_dynamic_filters IS NOT NULL AND p_dynamic_filters <> '{}'::jsonb THEN
        FOR v_dyn_key, v_dyn_val IN SELECT * FROM jsonb_each(p_dynamic_filters) LOOP
            IF v_dyn_key = ANY(v_valid_cols) THEN
                IF jsonb_typeof(v_dyn_val) = 'array' THEN
                    DECLARE
                        v_str_arr text[] := ARRAY(SELECT jsonb_array_elements_text(v_dyn_val));
                    BEGIN
                        IF array_length(v_str_arr, 1) > 0 THEN
                            v_where_clauses := array_append(v_where_clauses, format('l.%I::text = ANY(%L)', v_dyn_key, v_str_arr));
                        END IF;
                    END;
                ELSE
                    v_where_clauses := array_append(v_where_clauses, format('l.%I::text = %L', v_dyn_key, v_dyn_val #>> '{}'));
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 10. Pending payment filter
    IF p_pending_payment_only AND 'revenue_received' = ANY(v_valid_cols) THEN
        v_where_clauses := array_append(v_where_clauses, 'l.revenue_received > 0');
    END IF;

    -- Assemble WHERE SQL
    v_where_sql := array_to_string(v_where_clauses, ' AND ');

    -- 11. Count total matching rows (uses GIN trigram index fast bitmap scan)
    v_count_sql := format('SELECT count(*) FROM %I l WHERE %s', p_table_name, v_where_sql);
    EXECUTE v_count_sql INTO v_total_count;

    -- 12. Fetch paginated records with sales_owner full_name joined
    v_sql := format($q$
        SELECT coalesce(jsonb_agg(sub.lead_row), '[]'::jsonb)
        FROM (
            SELECT 
                (CASE WHEN %s THEN to_jsonb(l.*) - 'lead_history' ELSE to_jsonb(l.*) END) || 
                jsonb_build_object(
                    'sales_owner', 
                    CASE 
                        WHEN p.id IS NOT NULL THEN jsonb_build_object('full_name', p.full_name)
                        ELSE NULL 
                    END
                ) AS lead_row
            FROM %I l
            LEFT JOIN profiles p ON p.id = l.sales_owner_id
            WHERE %s
            ORDER BY l.created_at DESC, l.id DESC
            LIMIT %s OFFSET %s
        ) sub
    $q$, 
        (p_exclude_history AND 'lead_history' = ANY(v_valid_cols))::text,
        p_table_name, 
        v_where_sql, 
        p_limit, 
        p_offset
    );

    EXECUTE v_sql INTO v_leads;

    RETURN jsonb_build_object(
        'leads', coalesce(v_leads, '[]'::jsonb),
        'total_count', v_total_count
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.search_leads_fast(
    text, uuid, text, text[], text[], text[], uuid[], jsonb, boolean, boolean, int, int
) TO authenticated, service_role, anon;

UPDATE public._byos_meta SET value = '1.2.0', updated_at = now() WHERE key = 'migration_version';
NOTIFY pgrst, 'reload schema';
`;
