-- ============================================================================
-- FastestCRM — BYOS Migration Bundle v1.0
-- ============================================================================
-- This IDEMPOTENT script is run against a customer's Supabase project to set up
-- the full CRM schema. It creates all org-scoped tables, RLS policies,
-- triggers, and helper functions needed for CRM operations.
--
-- Tables NOT included (remain on platform Supabase):
--   companies, subscriptions, wallets, wallet_transactions,
--   platform_admins, byos_connections, byos_audit_log, announcements,
--   features_unlocked, auth.users (Supabase built-in)
--
-- ⚠️  This script is APPEND-ONLY: it uses IF NOT EXISTS / OR REPLACE
--     so it can be re-run safely to upgrade the schema.
-- ============================================================================

-- ─── Meta table to track migration version ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public._byos_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public._byos_meta (key, value)
VALUES ('migration_version', '1.0.0')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ─── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'company','company_subadmin','cbo','vp','avp','dgm','agm','sm','tl','bde','intern','ca'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'new','interested','not_interested','follow_up','rnr','dnd','paid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Profiles (org-scoped mirror) ───────────────────────────────────────────
-- NOTE: This is a MIRROR of platform profiles for foreign key integrity.
-- The platform syncs relevant profile rows here during migration.
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

-- ─── User Roles (mirror) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'bde',
  UNIQUE (user_id, role)
);

-- ─── Leads ──────────────────────────────────────────────────────────────────
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
  pre_sales_owner_id UUID REFERENCES public.profiles(id),
  sales_owner_id UUID REFERENCES public.profiles(id),
  post_sales_owner_id UUID REFERENCES public.profiles(id),
  created_by_id UUID NOT NULL,
  company_id UUID,
  status public.lead_status NOT NULL DEFAULT 'new',
  revenue_received DECIMAL(12,2) DEFAULT 0,
  revenue_projected DECIMAL(12,2) DEFAULT 0,
  total_recovered DECIMAL(12,2) DEFAULT 0,
  product_purchased TEXT,
  batch_month TEXT,
  payment_link TEXT,
  source TEXT,
  reminder_at TIMESTAMPTZ,
  notes TEXT,
  send_web_push BOOLEAN DEFAULT false,
  custom_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Lead History ───────────────────────────────────────────────────────────
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

-- ─── Products ───────────────────────────────────────────────────────────────
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

-- ─── Invoices ───────────────────────────────────────────────────────────────
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

-- ─── Invoice Items ──────────────────────────────────────────────────────────
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

-- ─── Invoice Payments ───────────────────────────────────────────────────────
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

-- ─── Quotations ─────────────────────────────────────────────────────────────
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

-- ─── Quotation Items ────────────────────────────────────────────────────────
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

-- ─── Forms ──────────────────────────────────────────────────────────────────
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

-- ─── Form Responses ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  lead_id UUID,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Tasks ──────────────────────────────────────────────────────────────────
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

-- ─── Notifications ──────────────────────────────────────────────────────────
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

-- ─── Automations ────────────────────────────────────────────────────────────
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

-- ─── Lead Statuses (custom per company) ─────────────────────────────────────
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

-- ─── Landing Pages ──────────────────────────────────────────────────────────
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

-- ─── Push Subscriptions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- ─── Lead Custom Columns ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_custom_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  column_name TEXT NOT NULL,
  column_type TEXT DEFAULT 'text',
  is_visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  options JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Calendar Bookings ──────────────────────────────────────────────────────
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

-- ─── Integration API Keys ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.integration_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── AI Employees ───────────────────────────────────────────────────────────
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

-- ─── AI Caller Logs ─────────────────────────────────────────────────────────
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

-- ─── Agentic Workflows ─────────────────────────────────────────────────────
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

-- ─── Agentic Workflow Runs ──────────────────────────────────────────────────
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

-- ─── Industry-Specific Lead Tables ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads_real_estate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  company TEXT,
  company_id UUID,
  created_by_id UUID NOT NULL,
  sales_owner_id UUID,
  pre_sales_owner_id UUID,
  post_sales_owner_id UUID,
  status public.lead_status NOT NULL DEFAULT 'new',
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

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- ─── Role checker ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1 $$;

-- ─── Hierarchy checker ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_in_hierarchy(_manager_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_id UUID := _user_id;
  max_depth INTEGER := 15;
  depth INTEGER := 0;
BEGIN
  IF _manager_id = _user_id THEN RETURN TRUE; END IF;
  WHILE current_id IS NOT NULL AND depth < max_depth LOOP
    SELECT manager_id INTO current_id FROM public.profiles WHERE id = current_id;
    IF current_id = _manager_id THEN RETURN TRUE; END IF;
    depth := depth + 1;
  END LOOP;
  RETURN FALSE;
END;
$$;

-- ─── Updated-at trigger function ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- ── Profiles ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_profiles_select" ON public.profiles;
CREATE POLICY "byos_profiles_select" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "byos_profiles_update" ON public.profiles;
CREATE POLICY "byos_profiles_update" ON public.profiles FOR UPDATE USING (true);

-- ── User Roles ──────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_user_roles_select" ON public.user_roles;
CREATE POLICY "byos_user_roles_select" ON public.user_roles FOR SELECT USING (true);

-- ── Leads ───────────────────────────────────────────────────────────────────
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_leads_all" ON public.leads;
CREATE POLICY "byos_leads_all" ON public.leads FOR ALL USING (true) WITH CHECK (true);

-- ── Lead History ────────────────────────────────────────────────────────────
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_lead_history_all" ON public.lead_history;
CREATE POLICY "byos_lead_history_all" ON public.lead_history FOR ALL USING (true) WITH CHECK (true);

-- ── Products ────────────────────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_products_all" ON public.products;
CREATE POLICY "byos_products_all" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- ── Invoices ────────────────────────────────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_invoices_all" ON public.invoices;
CREATE POLICY "byos_invoices_all" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_invoice_items_all" ON public.invoice_items;
CREATE POLICY "byos_invoice_items_all" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_invoice_payments_all" ON public.invoice_payments;
CREATE POLICY "byos_invoice_payments_all" ON public.invoice_payments FOR ALL USING (true) WITH CHECK (true);

-- ── Quotations ──────────────────────────────────────────────────────────────
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_quotations_all" ON public.quotations;
CREATE POLICY "byos_quotations_all" ON public.quotations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_quotation_items_all" ON public.quotation_items;
CREATE POLICY "byos_quotation_items_all" ON public.quotation_items FOR ALL USING (true) WITH CHECK (true);

-- ── Forms ───────────────────────────────────────────────────────────────────
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_forms_all" ON public.forms;
CREATE POLICY "byos_forms_all" ON public.forms FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_form_responses_all" ON public.form_responses;
CREATE POLICY "byos_form_responses_all" ON public.form_responses FOR ALL USING (true) WITH CHECK (true);

-- ── Tasks ───────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_tasks_all" ON public.tasks;
CREATE POLICY "byos_tasks_all" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- ── Notifications ───────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_notifications_all" ON public.notifications;
CREATE POLICY "byos_notifications_all" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- ── Automations ─────────────────────────────────────────────────────────────
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_automations_all" ON public.automations;
CREATE POLICY "byos_automations_all" ON public.automations FOR ALL USING (true) WITH CHECK (true);

-- ── Lead Statuses ───────────────────────────────────────────────────────────
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_lead_statuses_all" ON public.lead_statuses;
CREATE POLICY "byos_lead_statuses_all" ON public.lead_statuses FOR ALL USING (true) WITH CHECK (true);

-- ── Landing Pages ───────────────────────────────────────────────────────────
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_landing_pages_all" ON public.landing_pages;
CREATE POLICY "byos_landing_pages_all" ON public.landing_pages FOR ALL USING (true) WITH CHECK (true);

-- ── Push Subscriptions ──────────────────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_push_subscriptions_all" ON public.push_subscriptions;
CREATE POLICY "byos_push_subscriptions_all" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- ── Lead Custom Columns ─────────────────────────────────────────────────────
ALTER TABLE public.lead_custom_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_lead_custom_columns_all" ON public.lead_custom_columns;
CREATE POLICY "byos_lead_custom_columns_all" ON public.lead_custom_columns FOR ALL USING (true) WITH CHECK (true);

-- ── Calendar Bookings ───────────────────────────────────────────────────────
ALTER TABLE public.calendar_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_calendar_bookings_all" ON public.calendar_bookings;
CREATE POLICY "byos_calendar_bookings_all" ON public.calendar_bookings FOR ALL USING (true) WITH CHECK (true);

-- ── Integration API Keys ────────────────────────────────────────────────────
ALTER TABLE public.integration_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_integration_api_keys_all" ON public.integration_api_keys;
CREATE POLICY "byos_integration_api_keys_all" ON public.integration_api_keys FOR ALL USING (true) WITH CHECK (true);

-- ── AI Employees ────────────────────────────────────────────────────────────
ALTER TABLE public.ai_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_ai_employees_all" ON public.ai_employees;
CREATE POLICY "byos_ai_employees_all" ON public.ai_employees FOR ALL USING (true) WITH CHECK (true);

-- ── AI Caller Logs ──────────────────────────────────────────────────────────
ALTER TABLE public.ai_caller_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_ai_caller_logs_all" ON public.ai_caller_logs;
CREATE POLICY "byos_ai_caller_logs_all" ON public.ai_caller_logs FOR ALL USING (true) WITH CHECK (true);

-- ── Agentic Workflows ───────────────────────────────────────────────────────
ALTER TABLE public.agentic_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_agentic_workflows_all" ON public.agentic_workflows;
CREATE POLICY "byos_agentic_workflows_all" ON public.agentic_workflows FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.agentic_workflow_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_agentic_workflow_runs_all" ON public.agentic_workflow_runs;
CREATE POLICY "byos_agentic_workflow_runs_all" ON public.agentic_workflow_runs FOR ALL USING (true) WITH CHECK (true);

-- ── Real Estate Leads ───────────────────────────────────────────────────────
ALTER TABLE public.leads_real_estate ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_leads_real_estate_all" ON public.leads_real_estate;
CREATE POLICY "byos_leads_real_estate_all" ON public.leads_real_estate FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_quotations_updated_at ON public.quotations;
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_forms_updated_at ON public.forms;
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_automations_updated_at ON public.automations;
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_landing_pages_updated_at ON public.landing_pages;
CREATE TRIGGER update_landing_pages_updated_at BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_leads_real_estate_updated_at ON public.leads_real_estate;
CREATE TRIGGER update_leads_real_estate_updated_at BEFORE UPDATE ON public.leads_real_estate FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_calendar_bookings_updated_at ON public.calendar_bookings;
CREATE TRIGGER update_calendar_bookings_updated_at BEFORE UPDATE ON public.calendar_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ai_employees_updated_at ON public.ai_employees;
CREATE TRIGGER update_ai_employees_updated_at BEFORE UPDATE ON public.ai_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_agentic_workflows_updated_at ON public.agentic_workflows;
CREATE TRIGGER update_agentic_workflows_updated_at BEFORE UPDATE ON public.agentic_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_sales_owner ON public.leads(sales_owner_id);
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
CREATE INDEX IF NOT EXISTS idx_calendar_bookings_user_id ON public.calendar_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_employees_company_id ON public.ai_employees(company_id);

-- ─── Storage bucket ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ─── Purge Company Leads Helper RPC ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_company_leads(p_company_id TEXT DEFAULT NULL, p_table_name TEXT DEFAULT 'leads')
RETURNS INTEGER AS $$
DECLARE
    deleted_total INTEGER := 0;
    deleted_batch INTEGER := 0;
BEGIN
    LOOP
        IF p_company_id IS NOT NULL AND p_company_id <> '' THEN
            EXECUTE format('DELETE FROM %I WHERE id IN (SELECT id FROM %I WHERE company_id = %L LIMIT 5000)', 
                           p_table_name, p_table_name, p_company_id);
        ELSE
            EXECUTE format('DELETE FROM %I WHERE id IN (SELECT id FROM %I LIMIT 5000)', 
                           p_table_name, p_table_name);
        END IF;

        GET DIAGNOSTICS deleted_batch = ROW_COUNT;
        deleted_total := deleted_total + deleted_batch;
        
        EXIT WHEN deleted_batch = 0;
    END LOOP;
    
    RETURN deleted_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done!
UPDATE public._byos_meta SET value = '1.0.0', updated_at = now() WHERE key = 'migration_version';
