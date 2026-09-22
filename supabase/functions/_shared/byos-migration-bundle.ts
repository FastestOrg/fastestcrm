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

  -- Sync the analytics snapshot so dashboard total_leads stays accurate
  IF v_total_deleted > 0 THEN
    UPDATE public.company_analytics_snapshots
    SET total_leads = GREATEST(0, total_leads - v_total_deleted),
        last_computed_at = NOW()
    WHERE company_id = input_company_id;
  END IF;

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
