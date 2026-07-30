// Export the migration bundle as a TypeScript string literal
// This eliminates runtime file system reads or Deno fetch("file://...") calls in Edge Functions.

export const BYOS_MIGRATION_SQL = `
-- ============================================================================
-- FastestCRM — BYOS Migration Bundle v1.0
-- ============================================================================

CREATE TABLE IF NOT EXISTS public._byos_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public._byos_meta (key, value)
VALUES ('migration_version', '1.0.0')
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

-- Idempotent column upgrades for existing BYOS databases
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
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  form_id UUID NOT NULL,
  company_id UUID,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  lead_id UUID,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- RLS POLICIES
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

ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_lead_history_all" ON public.lead_history;
CREATE POLICY "byos_lead_history_all" ON public.lead_history FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_products_all" ON public.products;
CREATE POLICY "byos_products_all" ON public.products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_invoices_all" ON public.invoices;
CREATE POLICY "byos_invoices_all" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_invoice_items_all" ON public.invoice_items;
CREATE POLICY "byos_invoice_items_all" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_invoice_payments_all" ON public.invoice_payments;
CREATE POLICY "byos_invoice_payments_all" ON public.invoice_payments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_quotations_all" ON public.quotations;
CREATE POLICY "byos_quotations_all" ON public.quotations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_quotation_items_all" ON public.quotation_items;
CREATE POLICY "byos_quotation_items_all" ON public.quotation_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_forms_all" ON public.forms;
CREATE POLICY "byos_forms_all" ON public.forms FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_form_responses_all" ON public.form_responses;
CREATE POLICY "byos_form_responses_all" ON public.form_responses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_tasks_all" ON public.tasks;
CREATE POLICY "byos_tasks_all" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_notifications_all" ON public.notifications;
CREATE POLICY "byos_notifications_all" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_automations_all" ON public.automations;
CREATE POLICY "byos_automations_all" ON public.automations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_lead_statuses_all" ON public.lead_statuses;
CREATE POLICY "byos_lead_statuses_all" ON public.lead_statuses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_landing_pages_all" ON public.landing_pages;
CREATE POLICY "byos_landing_pages_all" ON public.landing_pages FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_push_subscriptions_all" ON public.push_subscriptions;
CREATE POLICY "byos_push_subscriptions_all" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.calendar_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_calendar_bookings_all" ON public.calendar_bookings;
CREATE POLICY "byos_calendar_bookings_all" ON public.calendar_bookings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.integration_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_integration_api_keys_all" ON public.integration_api_keys;
CREATE POLICY "byos_integration_api_keys_all" ON public.integration_api_keys FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.ai_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_ai_employees_all" ON public.ai_employees;
CREATE POLICY "byos_ai_employees_all" ON public.ai_employees FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.ai_caller_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_ai_caller_logs_all" ON public.ai_caller_logs;
CREATE POLICY "byos_ai_caller_logs_all" ON public.ai_caller_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.agentic_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_agentic_workflows_all" ON public.agentic_workflows;
CREATE POLICY "byos_agentic_workflows_all" ON public.agentic_workflows FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.agentic_workflow_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_agentic_workflow_runs_all" ON public.agentic_workflow_runs;
CREATE POLICY "byos_agentic_workflow_runs_all" ON public.agentic_workflow_runs FOR ALL USING (true) WITH CHECK (true);

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
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_sales_owner ON public.leads(sales_owner_id);
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

UPDATE public._byos_meta SET value = '1.0.0', updated_at = now() WHERE key = 'migration_version';
NOTIFY pgrst, 'reload schema';
`;
