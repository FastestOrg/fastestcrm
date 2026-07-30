/**
 * ─── BYOS Settings Component ────────────────────────────────────────────────
 * Admin-only settings tab for managing Bring Your Own Supabase connection.
 * Handles: connect, validate, migrate, health check, disconnect.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Database, Shield, CheckCircle2, XCircle, AlertTriangle,
  Server, Plug, Unplug, RefreshCw, ChevronDown, ChevronUp,
  Activity, Clock, ExternalLink, Eye, EyeOff, Zap, Lock, Coins, Wallet, Copy, Code,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { clearBYOSClientCache } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ─── Types ──────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  action: string;
  status: string;
  details: Record<string, any>;
  created_at: string;
}

type BYOSStep = 'idle' | 'validating' | 'connecting' | 'migrating' | 'done' | 'error';

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: 'Active', color: 'text-green-500', icon: CheckCircle2 },
  validated: { label: 'Ready to Migrate', color: 'text-blue-500', icon: Zap },
  migration_running: { label: 'Migrating...', color: 'text-amber-500', icon: Loader2 },
  migration_failed: { label: 'Migration Failed', color: 'text-red-500', icon: XCircle },
  pending_validation: { label: 'Pending Validation', color: 'text-gray-500', icon: Clock },
  migrating_back: { label: 'Migrating Data Back...', color: 'text-amber-500', icon: Loader2 },
  error: { label: 'Error', color: 'text-red-500', icon: XCircle },
};

const HEALTH_MAP: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Healthy', color: 'bg-green-500' },
  degraded: { label: 'Degraded', color: 'bg-amber-500' },
  unreachable: { label: 'Unreachable', color: 'bg-red-500' },
  unknown: { label: 'Unknown', color: 'bg-gray-500' },
};

export default function BYOSSettings() {
  const navigate = useNavigate();
  const { company, refetch: refetchCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showServiceKey, setShowServiceKey] = useState(false);

  // Operation state
  const [step, setStep] = useState<BYOSStep>('idle');
  const [stepMessage, setStepMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Connection status
  const [connection, setConnection] = useState<any>(null);
  const [byosEnabled, setByosEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  // Dialogs
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Wallet balance query
  const { data: wallet } = useQuery({
    queryKey: ['wallet-balance', company?.id],
    queryFn: async () => {
      if (!company?.id) return { balance: 0 };
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('company_id', company.id)
        .single();
      if (error) return { balance: 0 };
      return data;
    },
    enabled: !!company?.id,
  });

  // ─── Fetch status on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (company?.id) fetchStatus();
  }, [company?.id]);

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'status', company_id: company?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setConnection(data.connection);
      setByosEnabled(data.byos_enabled);
      setIsUnlocked(data.is_unlocked || false);
      setAuditLog(data.audit_log || []);
    } catch (err: any) {
      console.error('[BYOS] Status fetch error:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  // ─── One-Time Unlock (Rs. 1,00,000) ────────────────────────────────────
  const UNLOCK_FEE = 100000;
  const walletBalance = wallet?.balance || 0;

  const handleUnlockFeature = async () => {
    if (walletBalance < UNLOCK_FEE) {
      toast({
        title: 'Insufficient Balance',
        description: `Required: ₹${UNLOCK_FEE.toLocaleString()}, Available: ₹${walletBalance.toLocaleString()}. Please add money to your wallet.`,
        variant: 'destructive',
      });
      return;
    }

    setUnlocking(true);
    setShowUnlockDialog(false);

    try {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'unlock', company_id: company?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: '🎉 Feature Unlocked!',
        description: 'Bring Your Own Supabase (BYOS) is now unlocked for your company.',
      });

      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      fetchStatus();
    } catch (err: any) {
      toast({
        title: 'Unlock Failed',
        description: err.message || 'Failed to unlock feature',
        variant: 'destructive',
      });
    } finally {
      setUnlocking(false);
    }
  };

  // ─── Validate + Connect + Migrate flow ──────────────────────────────────
  const handleSetup = async () => {
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      toast({ title: 'Missing Fields', description: 'All three fields are required.', variant: 'destructive' });
      return;
    }

    // URL validation
    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('supabase')) {
      toast({ title: 'Invalid URL', description: 'Please enter a valid Supabase project URL (https://xxxxx.supabase.co)', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // Step 1: Validate
      setStep('validating');
      setStepMessage('Testing connection to your Supabase project...');
      const { data: valData, error: valErr } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'validate', company_id: company?.id, supabase_url: supabaseUrl, supabase_anon_key: anonKey, supabase_service_role_key: serviceRoleKey },
      });
      if (valErr) throw valErr;
      if (valData?.error) throw new Error(valData.error);

      // Step 2: Connect (save credentials)
      setStep('connecting');
      setStepMessage('Saving encrypted credentials...');
      const { data: connData, error: connErr } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'connect', company_id: company?.id, supabase_url: supabaseUrl, supabase_anon_key: anonKey, supabase_service_role_key: serviceRoleKey },
      });
      if (connErr) throw connErr;
      if (connData?.error) throw new Error(connData.error);

      // Step 3: Migrate
      setStep('migrating');
      setStepMessage('Running database migration on your Supabase project... This may take a minute.');
      const { data: migData, error: migErr } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'migrate', company_id: company?.id, supabase_access_token: accessToken },
      });
      if (migErr) throw migErr;
      if (migData?.error) throw new Error(migData.error);

      // Done!
      setStep('done');
      setStepMessage('BYOS is now active! All org data will be stored in your Supabase project.');
      toast({ title: '🎉 BYOS Activated', description: 'Your CRM data is now running on your own Supabase project.' });

      // Clear cached clients and refetch everything
      clearBYOSClientCache();
      queryClient.invalidateQueries();
      refetchCompany();
      fetchStatus();

      // Clear form
      setServiceRoleKey('');
    } catch (err: any) {
      setStep('error');
      setStepMessage(err.message || 'Setup failed');
      toast({ title: 'Setup Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Disconnect ─────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    setDisconnecting(true);
    setShowDisconnectDialog(false);

    try {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'disconnect', company_id: company?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'BYOS Disconnected', description: 'Your data has been migrated back. CRM is now using the default backend.' });

      clearBYOSClientCache();
      queryClient.invalidateQueries();
      refetchCompany();
      setConnection(null);
      setByosEnabled(false);
      setStep('idle');
      setStepMessage('');
      fetchStatus();
    } catch (err: any) {
      toast({ title: 'Disconnect Failed', description: err.message, variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  // ─── Health Check ───────────────────────────────────────────────────────
  const handleHealthCheck = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'health', company_id: company?.id },
      });
      if (error) throw error;
      toast({ title: 'Health Check', description: `Status: ${data?.health || 'unknown'}` });
      fetchStatus();
    } catch (err: any) {
      toast({ title: 'Health Check Failed', description: err.message, variant: 'destructive' });
    }
  };

  // ─── Sync Data Helper ───────────────────────────────────────────────────
  const [syncingData, setSyncingData] = useState(false);

  const handleSyncData = async () => {
    setSyncingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'migrate', company_id: company?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const counts: Record<string, number> = data?.syncReport?.syncedCounts || {};
      const totalRows = Object.values(counts).reduce((acc: number, val: any) => acc + Number(val || 0), 0);
      const breakdown = Object.entries(counts)
        .filter(([_, count]) => Number(count) > 0)
        .map(([tbl, count]) => `${tbl}: ${count} rows`)
        .join(' • ');

      toast({
        title: totalRows > 0 ? '🎉 Data Sync Complete!' : 'Data Sync Checked',
        description: totalRows > 0
          ? `Transferred ${totalRows} records to your custom Supabase DB (${breakdown})`
          : 'Data sync complete. No records were found on the platform database.',
        duration: 10000,
      });
      fetchStatus();
    } catch (err: any) {
      if (err.message?.includes('SCHEMA_MISSING') || err.message?.includes('does not exist') || err.message?.includes('relation')) {
        handleCopySQL();
        toast({
          title: '⚠️ Database Schema Missing on Connected Supabase',
          description: 'The Migration SQL script has been copied to your clipboard! Paste it into your Supabase Dashboard → SQL Editor, click RUN, and then click Sync Data to BYOS again.',
          duration: 12000,
        });
      } else {
        toast({
          title: 'Sync Failed',
          description: err.message || 'Failed to sync data to BYOS',
          variant: 'destructive',
        });
      }
    } finally {
      setSyncingData(false);
    }
  };

  // ─── Copy Migration SQL Helper ──────────────────────────────────────────
  const handleCopySQL = () => {
    const sql = `-- FastestCRM — BYOS Migration Bundle v1.0
CREATE TABLE IF NOT EXISTS public._byos_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO public._byos_meta (key, value) VALUES ('migration_version', '1.0.0') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('company','company_subadmin','cbo','vp','avp','dgm','agm','sm','tl','bde','intern','ca','platform_admin','level_3','level_4','level_5','level_6','level_7','level_8','level_9','level_10','level_11','level_12','level_13','level_14','level_15','level_16','level_17','level_18','level_19','level_20'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
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
DO $$ BEGIN CREATE TYPE public.lead_status AS ENUM ('new','interested','not_interested','follow_up','rnr','dnd','paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.profiles (id UUID PRIMARY KEY, email TEXT, full_name TEXT, phone TEXT, avatar_url TEXT, company_id UUID, manager_id UUID REFERENCES public.profiles(id), incentive_percent NUMERIC DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.user_roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, role public.app_role NOT NULL DEFAULT 'bde', UNIQUE (user_id, role));
CREATE TABLE IF NOT EXISTS public.leads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, email TEXT, phone TEXT, whatsapp TEXT, college TEXT, graduating_year INTEGER, branch TEXT, domain TEXT, cgpa DECIMAL(3,2), state TEXT, preferred_language TEXT, company TEXT, ca_name TEXT, pre_sales_owner_id UUID, sales_owner_id UUID, post_sales_owner_id UUID, created_by_id UUID, company_id UUID, status TEXT NOT NULL DEFAULT 'new', revenue_received DECIMAL(12,2) DEFAULT 0, revenue_projected DECIMAL(12,2) DEFAULT 0, total_recovered DECIMAL(12,2) DEFAULT 0, product_purchased TEXT, product_category TEXT, batch_month TEXT, payment_link TEXT, source TEXT, lead_source TEXT, reminder_at TIMESTAMPTZ, last_notification_sent_at TIMESTAMPTZ, notes TEXT, send_web_push BOOLEAN DEFAULT false, custom_data JSONB DEFAULT '{}'::jsonb, lead_history JSONB DEFAULT '[]'::jsonb, status_metadata JSONB DEFAULT '{}'::jsonb, lead_profile JSONB DEFAULT '{}'::jsonb, form_id UUID, lg_link_id UUID, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
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
CREATE TABLE IF NOT EXISTS public.leads_real_estate (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, email TEXT, phone TEXT, whatsapp TEXT, company TEXT, company_id UUID, created_by_id UUID, sales_owner_id UUID, pre_sales_owner_id UUID, post_sales_owner_id UUID, status TEXT NOT NULL DEFAULT 'new', source TEXT, property_type TEXT, budget_min DECIMAL(14,2), budget_max DECIMAL(14,2), preferred_location TEXT, property_size TEXT, possession_timeline TEXT, site_visit_date DATE, site_visit_done BOOLEAN DEFAULT false, revenue_received DECIMAL(12,2) DEFAULT 0, revenue_projected DECIMAL(12,2) DEFAULT 0, total_recovered DECIMAL(12,2) DEFAULT 0, product_purchased TEXT, payment_link TEXT, reminder_at TIMESTAMPTZ, notes TEXT, send_web_push BOOLEAN DEFAULT false, custom_data JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.leads_saas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, email TEXT, phone TEXT, whatsapp TEXT, company_name TEXT, company_size TEXT, company_website TEXT, job_title TEXT, product_interest TEXT, use_case TEXT, current_solution TEXT, demo_date TIMESTAMPTZ, trial_start_date DATE, trial_end_date DATE, plan_type TEXT, seats INTEGER, monthly_value NUMERIC DEFAULT 0, annual_value NUMERIC DEFAULT 0, contract_length INTEGER, deal_stage TEXT, decision_maker TEXT, champion TEXT, competitors TEXT, loss_reason TEXT, status TEXT NOT NULL DEFAULT 'new', notes TEXT, lead_source TEXT, lead_history JSONB DEFAULT '[]'::jsonb, status_metadata JSONB DEFAULT '{}'::jsonb, lead_profile JSONB DEFAULT '{}'::jsonb, company_id UUID, created_by_id UUID, pre_sales_owner_id UUID, sales_owner_id UUID, post_sales_owner_id UUID, revenue_projected NUMERIC DEFAULT 0, revenue_received NUMERIC DEFAULT 0, reminder_at TIMESTAMPTZ, last_notification_sent_at TIMESTAMPTZ, payment_link TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, lg_link_id UUID, form_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.leads_healthcare (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID, created_by_id UUID, pre_sales_owner_id UUID, sales_owner_id UUID, post_sales_owner_id UUID, name TEXT NOT NULL, email TEXT, phone TEXT, whatsapp TEXT, status TEXT NOT NULL DEFAULT 'new_enquiry', notes TEXT, lead_source TEXT, lead_history JSONB DEFAULT '[]'::jsonb, status_metadata JSONB DEFAULT '{}'::jsonb, lead_profile JSONB DEFAULT '{}'::jsonb, revenue_projected NUMERIC DEFAULT 0, revenue_received NUMERIC DEFAULT 0, payment_link TEXT, reminder_at TIMESTAMPTZ, last_notification_sent_at TIMESTAMPTZ, lg_link_id UUID, form_id UUID, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, age INTEGER, gender TEXT, condition TEXT, symptoms TEXT, department TEXT, doctor_preference TEXT, appointment_date TIMESTAMPTZ, appointment_time TEXT, referral_source TEXT, insurance_provider TEXT, insurance_id TEXT, treatment_type TEXT, treatment_cost NUMERIC, treatment_date DATE, follow_up_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.leads_insurance (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, email TEXT, phone TEXT, whatsapp TEXT, company_id UUID, created_by_id UUID, pre_sales_owner_id UUID, sales_owner_id UUID, post_sales_owner_id UUID, age INTEGER, gender TEXT, pan_number TEXT, date_of_birth DATE, occupation TEXT, annual_income NUMERIC, insurance_type TEXT, plan_name TEXT, sum_insured NUMERIC, premium_amount NUMERIC, contribution_frequency TEXT, policy_term INTEGER, existing_policies TEXT, nominee_name TEXT, nominee_relation TEXT, agent_name TEXT, policy_number TEXT, policy_start_date DATE, renewal_date DATE, loss_reason TEXT, revenue_projected NUMERIC, revenue_received NUMERIC, reminder_at TIMESTAMPTZ, last_notification_sent_at TIMESTAMPTZ, payment_link TEXT, lead_source TEXT, lead_history JSONB, status_metadata JSONB, lead_profile JSONB, notes TEXT, form_id UUID, lg_link_id UUID, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, status TEXT NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.leads_travel (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID, created_by_id UUID, pre_sales_owner_id UUID, sales_owner_id UUID, post_sales_owner_id UUID, name TEXT NOT NULL, email TEXT, phone TEXT, whatsapp TEXT, status TEXT NOT NULL DEFAULT 'new', notes TEXT, lead_source TEXT, lead_history JSONB DEFAULT '[]'::jsonb, status_metadata JSONB DEFAULT '{}'::jsonb, lead_profile JSONB DEFAULT '{}'::jsonb, revenue_projected NUMERIC DEFAULT 0, revenue_received NUMERIC DEFAULT 0, reminder_at TIMESTAMPTZ, last_notification_sent_at TIMESTAMPTZ, payment_link TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, lg_link_id UUID, form_id UUID, destination TEXT, travel_date DATE, return_date DATE, travelers_count INTEGER, trip_type TEXT, package_type TEXT, budget NUMERIC, special_requests TEXT, hotel_name TEXT, flight_details TEXT, package_cost NUMERIC, advance_paid NUMERIC, balance_due NUMERIC, booking_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.lead_statuses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, name TEXT NOT NULL, color TEXT DEFAULT '#6B7280', sort_order INTEGER DEFAULT 0, status_type TEXT DEFAULT 'custom', is_default BOOLEAN DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.lead_statuses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.lead_statuses ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6B7280';
ALTER TABLE public.lead_statuses ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.lead_statuses ADD COLUMN IF NOT EXISTS status_type TEXT DEFAULT 'custom';
CREATE TABLE IF NOT EXISTS public.company_lead_statuses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, label TEXT NOT NULL, value TEXT NOT NULL, color TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other', sub_statuses TEXT[] DEFAULT ARRAY[]::TEXT[], order_index INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.real_estate_properties (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, category TEXT NOT NULL, name TEXT NOT NULL, sq_ft NUMERIC, cost NUMERIC, available_units INTEGER, location TEXT, state TEXT, country TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.lead_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lead_id UUID NOT NULL, lead_table TEXT NOT NULL DEFAULT 'leads', changed_by UUID, field_name TEXT NOT NULL, old_value TEXT, new_value TEXT, change_type TEXT DEFAULT 'update', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, category TEXT NOT NULL DEFAULT 'General', name TEXT NOT NULL, price DECIMAL(12,2) NOT NULL DEFAULT 0, quantity_available INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.invoices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, created_by UUID NOT NULL, lead_id UUID, lead_table TEXT, quotation_id UUID, invoice_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', client_name TEXT NOT NULL, client_email TEXT, client_phone TEXT, client_address TEXT, client_gstin TEXT, subject TEXT, subtotal DECIMAL(12,2) NOT NULL DEFAULT 0, discount_type TEXT, discount_value DECIMAL(12,2) DEFAULT 0, discount_amount DECIMAL(12,2) DEFAULT 0, tax_amount DECIMAL(12,2) DEFAULT 0, total DECIMAL(12,2) NOT NULL DEFAULT 0, amount_paid DECIMAL(12,2) DEFAULT 0, amount_due DECIMAL(12,2) DEFAULT 0, currency TEXT DEFAULT 'INR', notes TEXT, terms_and_conditions TEXT, payment_terms TEXT, due_date DATE, template_id TEXT, payment_link TEXT, issued_at TIMESTAMPTZ, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.invoice_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE, product_id UUID, description TEXT NOT NULL, hsn_sac_code TEXT, quantity DECIMAL(12,2) NOT NULL DEFAULT 1, unit_price DECIMAL(12,2) NOT NULL DEFAULT 0, discount_percentage DECIMAL(5,2) DEFAULT 0, tax_ids TEXT[] DEFAULT '{}', tax_amount DECIMAL(12,2) DEFAULT 0, line_total DECIMAL(12,2) NOT NULL DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.invoice_payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE, company_id UUID NOT NULL, amount DECIMAL(12,2) NOT NULL, payment_method TEXT, payment_reference TEXT, razorpay_payment_id TEXT, notes TEXT, paid_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.quotations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, created_by UUID NOT NULL, lead_id UUID, lead_table TEXT, quotation_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', client_name TEXT NOT NULL, client_email TEXT, client_phone TEXT, client_address TEXT, client_gstin TEXT, subject TEXT, subtotal DECIMAL(12,2) NOT NULL DEFAULT 0, discount_type TEXT, discount_value DECIMAL(12,2) DEFAULT 0, discount_amount DECIMAL(12,2) DEFAULT 0, tax_amount DECIMAL(12,2) DEFAULT 0, total DECIMAL(12,2) NOT NULL DEFAULT 0, currency TEXT DEFAULT 'INR', notes TEXT, terms_and_conditions TEXT, validity_days INTEGER DEFAULT 30, template_id TEXT, valid_until DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.quotation_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE, product_id UUID, description TEXT NOT NULL, hsn_sac_code TEXT, quantity DECIMAL(12,2) NOT NULL DEFAULT 1, unit_price DECIMAL(12,2) NOT NULL DEFAULT 0, discount_percentage DECIMAL(5,2) DEFAULT 0, tax_ids TEXT[] DEFAULT '{}', tax_amount DECIMAL(12,2) DEFAULT 0, line_total DECIMAL(12,2) NOT NULL DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.forms (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID, created_by_id UUID, created_by UUID, name TEXT, title TEXT, description TEXT, fields JSONB NOT NULL DEFAULT '[]'::jsonb, settings JSONB DEFAULT '{}'::jsonb, status TEXT DEFAULT 'active', is_active BOOLEAN DEFAULT true, slug TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS created_by_id UUID;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
CREATE TABLE IF NOT EXISTS public.form_responses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE, company_id UUID NOT NULL, data JSONB NOT NULL DEFAULT '{}'::jsonb, lead_id UUID, submitted_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'pending', priority TEXT DEFAULT 'medium', assigned_to UUID, lead_id UUID, lead_table TEXT, due_date TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, company_id UUID, title TEXT NOT NULL, message TEXT NOT NULL, type TEXT DEFAULT 'info', read BOOLEAN DEFAULT false, lead_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.automations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, name TEXT NOT NULL, description TEXT, trigger_type TEXT NOT NULL, trigger_config JSONB DEFAULT '{}'::jsonb, actions JSONB NOT NULL DEFAULT '[]'::jsonb, is_active BOOLEAN DEFAULT true, created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.lead_statuses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, name TEXT NOT NULL, color TEXT DEFAULT '#6B7280', sort_order INTEGER DEFAULT 0, status_type TEXT DEFAULT 'custom', is_default BOOLEAN DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.landing_pages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, created_by UUID NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL, content JSONB DEFAULT '{}'::jsonb, settings JSONB DEFAULT '{}'::jsonb, is_published BOOLEAN DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.push_subscriptions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, endpoint TEXT NOT NULL, keys JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, endpoint));
CREATE TABLE IF NOT EXISTS public.calendar_bookings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID, user_id UUID NOT NULL, lead_id UUID, title TEXT NOT NULL, description TEXT, start_time TIMESTAMPTZ NOT NULL, end_time TIMESTAMPTZ NOT NULL, attendee_name TEXT, attendee_email TEXT, attendee_phone TEXT, status TEXT DEFAULT 'confirmed', google_event_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.integration_api_keys (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, provider TEXT NOT NULL, api_key TEXT NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ai_employees (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, personality JSONB DEFAULT '{}'::jsonb, skills JSONB DEFAULT '[]'::jsonb, is_active BOOLEAN DEFAULT true, working_hours JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ai_caller_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, lead_id UUID, agent_id UUID, call_type TEXT DEFAULT 'outbound', duration_seconds INTEGER DEFAULT 0, transcript TEXT, summary TEXT, sentiment TEXT, outcome TEXT, recording_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.invoice_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL UNIQUE, invoice_prefix TEXT DEFAULT 'INV-', next_invoice_number INTEGER DEFAULT 1, quotation_prefix TEXT DEFAULT 'QT-', next_quotation_number INTEGER DEFAULT 1, company_name TEXT, company_logo TEXT, company_address TEXT, company_email TEXT, company_phone TEXT, company_gstin TEXT, bank_name TEXT, bank_account_number TEXT, bank_ifsc TEXT, default_notes TEXT, default_terms TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.lg_links (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, created_by UUID, title TEXT NOT NULL, slug TEXT NOT NULL, target_url TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, target_form_id UUID, clicks INTEGER DEFAULT 0, leads_generated INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, phone_number TEXT NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_recipients (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id UUID NOT NULL, phone TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, recipient_phone TEXT NOT NULL, message TEXT, status TEXT DEFAULT 'sent', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.email_accounts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, user_id UUID NOT NULL, email TEXT NOT NULL, provider TEXT DEFAULT 'smtp', is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.email_campaigns (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, created_by UUID NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.email_campaign_sequences (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id UUID NOT NULL, step_number INTEGER NOT NULL DEFAULT 1, subject TEXT NOT NULL, body_text TEXT, delay_days INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id UUID NOT NULL, email TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.email_campaign_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id UUID NOT NULL, recipient_email TEXT NOT NULL, event_type TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.email_threads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, lead_id UUID, subject TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.email_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), thread_id UUID NOT NULL, company_id UUID NOT NULL, sender_email TEXT NOT NULL, recipient_email TEXT NOT NULL, subject TEXT, body_text TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.email_integrations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, user_id UUID NOT NULL, provider TEXT NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.agentic_workflows (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL, name TEXT NOT NULL, description TEXT, workflow_type TEXT NOT NULL, config JSONB NOT NULL DEFAULT '{}'::jsonb, is_active BOOLEAN DEFAULT true, created_by UUID NOT NULL, last_run_at TIMESTAMPTZ, run_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.agentic_workflow_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workflow_id UUID NOT NULL REFERENCES public.agentic_workflows(id) ON DELETE CASCADE, company_id UUID NOT NULL, status TEXT NOT NULL DEFAULT 'running', input_data JSONB DEFAULT '{}'::jsonb, output_data JSONB DEFAULT '{}'::jsonb, error TEXT, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "byos_profiles_select" ON public.profiles; CREATE POLICY "byos_profiles_select" ON public.profiles FOR SELECT USING (true); DROP POLICY IF EXISTS "byos_profiles_update" ON public.profiles; CREATE POLICY "byos_profiles_update" ON public.profiles FOR UPDATE USING (true);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "byos_user_roles_select" ON public.user_roles; CREATE POLICY "byos_user_roles_select" ON public.user_roles FOR SELECT USING (true);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "byos_leads_all" ON public.leads; CREATE POLICY "byos_leads_all" ON public.leads FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.leads_real_estate ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "byos_leads_real_estate_all" ON public.leads_real_estate; CREATE POLICY "byos_leads_real_estate_all" ON public.leads_real_estate FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.leads_saas ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "byos_leads_saas_all" ON public.leads_saas; CREATE POLICY "byos_leads_saas_all" ON public.leads_saas FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.leads_healthcare ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "byos_leads_healthcare_all" ON public.leads_healthcare; CREATE POLICY "byos_leads_healthcare_all" ON public.leads_healthcare FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.leads_insurance ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "byos_leads_insurance_all" ON public.leads_insurance; CREATE POLICY "byos_leads_insurance_all" ON public.leads_insurance FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.leads_travel ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "byos_leads_travel_all" ON public.leads_travel; CREATE POLICY "byos_leads_travel_all" ON public.leads_travel FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.company_lead_statuses ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "byos_company_lead_statuses_all" ON public.company_lead_statuses; CREATE POLICY "byos_company_lead_statuses_all" ON public.company_lead_statuses FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.real_estate_properties ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "byos_real_estate_properties_all" ON public.real_estate_properties; CREATE POLICY "byos_real_estate_properties_all" ON public.real_estate_properties FOR ALL USING (true) WITH CHECK (true);
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
CREATE INDEX IF NOT EXISTS idx_calendar_bookings_user_id ON public.calendar_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_employees_company_id ON public.ai_employees(company_id);
DO $$ BEGIN
  ALTER TABLE public.leads ALTER COLUMN status TYPE TEXT;
  ALTER TABLE public.leads_real_estate ALTER COLUMN status TYPE TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
UPDATE public._byos_meta SET value = '1.0.0', updated_at = now() WHERE key = 'migration_version';`;

    navigator.clipboard.writeText(sql);
    toast({
      title: '📋 Schema SQL Copied!',
      description: 'Run this SQL script in your customer Supabase Dashboard → SQL Editor to set up all CRM tables.',
    });
  };

  // ─── Loading state ──────────────────────────────────────────────────────
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Locked Feature View (Rs 1,00,000 One-Time Fee) ────────────────────
  if (!isUnlocked && !byosEnabled) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Card className="glass border-primary/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Lock className="h-48 w-48 text-primary" />
          </div>

          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
                <Lock className="h-3 w-3" /> Premium Infrastructure Feature
              </Badge>
              <Badge variant="outline" className="text-sm font-semibold border-primary/40 text-primary">
                ₹1,00,000 One-Time Fee
              </Badge>
            </div>

            <CardTitle className="text-2xl flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Bring Your Own Supabase (BYOS)
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground leading-relaxed">
              Connect your organisation's own Supabase project. <strong>All database storage, compute, functions, and file assets run directly on your own Supabase account</strong>.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Wallet Balance Banner */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Company Wallet Balance</p>
                  <p className="text-lg font-bold text-foreground">
                    ₹{walletBalance.toLocaleString()}
                  </p>
                </div>
              </div>

              {walletBalance < UNLOCK_FEE && (
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/company')} className="gap-1.5 text-xs border-amber-500/30 text-amber-600">
                  <Coins className="h-3.5 w-3.5" /> Add Money to Wallet
                </Button>
              )}
            </div>

            {/* Value Proposition Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Zero Platform Storage Limits', desc: 'Store unlimited leads, files, invoices, and documents on your own database.' },
                { title: 'Your Own Compute & Server', desc: 'All database queries and heavy lifting execute on your dedicated Supabase server.' },
                { title: 'Direct SQL & Data Sovereignty', desc: 'Maintain complete 100% ownership and direct SQL access to your organisation data.' },
                { title: 'Plug & Play Automation', desc: 'One-click automated migration installs all tables, functions, RLS, and triggers.' },
              ].map(({ title, desc }) => (
                <div key={title} className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-sm font-semibold">{title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">{desc}</p>
                </div>
              ))}
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-border/40 pt-4">
            <div className="text-xs text-muted-foreground">
              One-time charge of ₹1,00,000 deducted directly from company wallet.
            </div>

            {walletBalance >= UNLOCK_FEE ? (
              <Button
                onClick={() => setShowUnlockDialog(true)}
                disabled={unlocking}
                className="gradient-primary gap-2"
              >
                {unlocking ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Unlocking...</>
                ) : (
                  <><Coins className="h-4 w-4" /> Unlock Feature for ₹1,00,000</>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/dashboard/company')}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                <Wallet className="h-4 w-4" /> Add Money to Unlock (₹{(UNLOCK_FEE - walletBalance).toLocaleString()} short)
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Unlock Confirmation Dialog */}
        <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                Unlock Bring Your Own Supabase (BYOS)
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    You are about to unlock <strong>Bring Your Own Supabase (BYOS)</strong> for your organisation.
                  </p>
                  <div className="p-3 rounded-lg bg-muted/50 border space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">One-Time Fee:</span>
                      <span className="font-semibold text-foreground">₹1,00,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Available Wallet Balance:</span>
                      <span className="font-semibold text-foreground">₹{walletBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t">
                      <span className="text-muted-foreground">Balance After Unlock:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">₹{(walletBalance - UNLOCK_FEE).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This charge is non-refundable. Once unlocked, your company can connect any external Supabase instance anytime.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleUnlockFeature} className="gradient-primary">
                Confirm &amp; Deduct ₹1,00,000
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ─── Active BYOS Connection View ────────────────────────────────────────
  if (byosEnabled && connection?.status === 'active') {
    const statusInfo = STATUS_MAP[connection.status] || STATUS_MAP.error;
    const healthInfo = HEALTH_MAP[connection.health_status] || HEALTH_MAP.unknown;
    const StatusIcon = statusInfo.icon;

    return (
      <div className="space-y-6 max-w-3xl">
        {/* Connection Status Card */}
        <Card className="glass border-green-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-green-500" />
                Bring Your Own Supabase
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSyncData} disabled={syncingData} className="gap-1 text-xs">
                  {syncingData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-amber-500" />}
                  {syncingData ? 'Syncing Data...' : 'Sync Data to BYOS'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleHealthCheck} className="gap-1 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Health Check
                </Button>
              </div>
            </div>
            <CardDescription>
              Your CRM data is running on your own Supabase project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Project URL</p>
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm font-mono truncate">{connection.supabase_url}</p>
                  <a href={connection.supabase_url.replace('.supabase.co', '.supabase.com')} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Health Status</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${healthInfo.color} animate-pulse`} />
                  <p className="text-sm font-medium">{healthInfo.label}</p>
                  {connection.last_health_check && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Last: {new Date(connection.last_health_check).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Migration Version</p>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-medium">v{connection.migration_version || '—'}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Connected Since</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{new Date(connection.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Disconnect */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-red-500/30 bg-red-500/5">
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Unplug className="h-4 w-4 text-red-500" />
                  Disconnect BYOS
                </p>
                <p className="text-xs text-muted-foreground">
                  Your data will be migrated back to FastestCRM servers before disconnecting.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Migrating Back...</>
                ) : (
                  <><Unplug className="h-4 w-4 mr-1" /> Disconnect</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card className="glass">
          <CardHeader
            className="cursor-pointer"
            onClick={() => setShowAudit(!showAudit)}
          >
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Activity Log
              </span>
              {showAudit ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
          </CardHeader>
          {showAudit && (
            <CardContent>
              {auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 text-sm">
                      <Badge variant={entry.status === 'success' ? 'default' : entry.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                        {entry.status}
                      </Badge>
                      <span className="font-medium capitalize">{entry.action.replace('_', ' ')}</span>
                      <span className="text-muted-foreground ml-auto text-xs">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Disconnect Confirmation */}
        <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect BYOS</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>This will:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Migrate all your CRM data</strong> (leads, invoices, forms, etc.) back to FastestCRM servers</li>
                    <li>Disable the connection to your Supabase project</li>
                    <li>Resume using the default FastestCRM backend</li>
                  </ul>
                  <p className="text-amber-600 dark:text-amber-400">
                    ⚠️ This process may take several minutes depending on data volume. Your data in the external Supabase project will NOT be deleted.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisconnect} className="bg-red-600 hover:bg-red-700">
                Yes, Disconnect &amp; Migrate Back
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ─── Setup Form View (BYOS not active) ──────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Info Card */}
      <Card className="glass border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Bring Your Own Supabase (BYOS)
          </CardTitle>
          <CardDescription>
            Connect your own Supabase project to run all CRM data operations, storage, and compute on your infrastructure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: Shield, title: 'Full Data Control', desc: 'Your data lives in your Supabase project' },
              { icon: Server, title: 'Your Infrastructure', desc: 'Database, storage, and compute on your account' },
              { icon: Zap, title: 'Plug & Play', desc: 'Automatic schema setup and migration' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
                <Icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <Separator />

          {/* Connection Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="byos-url">Supabase Project URL</Label>
              <Input
                id="byos-url"
                placeholder="https://your-project.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value.trim())}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Found in your Supabase Dashboard → Settings → API → Project URL
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="byos-anon">Anon / Public Key</Label>
              <Input
                id="byos-anon"
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value.trim())}
                disabled={loading}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Found in your Supabase Dashboard → Settings → API → Project API Keys → anon public
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="byos-service" className="flex items-center gap-2">
                Service Role Key
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                  <Shield className="h-2.5 w-2.5 mr-0.5" />
                  Encrypted at Rest
                </Badge>
              </Label>
              <div className="relative">
                <Input
                  id="byos-service"
                  type={showServiceKey ? 'text' : 'password'}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  value={serviceRoleKey}
                  onChange={(e) => setServiceRoleKey(e.target.value.trim())}
                  disabled={loading}
                  className="font-mono text-xs pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowServiceKey(!showServiceKey)}
                >
                  {showServiceKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="byos-access-token" className="flex items-center gap-2">
                Supabase Access Token
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  Optional • 100% Automated Setup
                </Badge>
              </Label>
              <Input
                id="byos-access-token"
                type="password"
                placeholder="sbp_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value.trim())}
                disabled={loading}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Found in <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">Supabase Dashboard &rarr; Account &rarr; Access Tokens</a>. If provided, FastestCRM will <strong>automatically execute the schema migration on your project</strong> during setup.
              </p>
            </div>
          </div>

          {/* 1-Click Schema Setup SQL Box */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Step 1: Setup Schema in Your Supabase Project</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopySQL}
                className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <Copy className="h-3.5 w-3.5" /> Copy Migration SQL Script
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Open your Supabase Dashboard → <strong>SQL Editor</strong>, paste this script and click <strong>RUN</strong> to create all CRM tables, RLS policies, and triggers. Then enter your API keys below and click <strong>Connect &amp; Setup BYOS</strong>.
            </p>
          </div>

          {/* Progress Steps */}
          {step !== 'idle' && (
            <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
              <div className="flex items-center gap-3">
                {step === 'error' ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : step === 'done' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <p className="text-sm font-medium">{stepMessage}</p>
              </div>

              {/* Step indicators */}
              <div className="flex gap-2">
                {(['validating', 'connecting', 'migrating', 'done'] as BYOSStep[]).map((s, i) => {
                  const stepIdx = ['validating', 'connecting', 'migrating', 'done'].indexOf(step);
                  const thisIdx = i;
                  const isComplete = stepIdx > thisIdx || step === 'done';
                  const isCurrent = step === s;
                  return (
                    <div
                      key={s}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        isComplete ? 'bg-green-500' : isCurrent ? 'bg-primary animate-pulse' : 'bg-muted-foreground/20'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleSetup}
            disabled={loading || !supabaseUrl || !anonKey || !serviceRoleKey}
            className="gradient-primary gap-2"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</>
            ) : (
              <><Plug className="h-4 w-4" /> Connect &amp; Setup BYOS</>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Retry for failed migrations */}
      {connection?.status === 'migration_failed' && (
        <Card className="glass border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-600 dark:text-red-400">Previous migration failed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You can retry the migration or update your credentials and try again.
                </p>
                {connection.error_log?.length > 0 && (
                  <pre className="mt-2 text-xs bg-red-500/5 p-2 rounded border border-red-500/20 overflow-auto max-h-24">
                    {JSON.stringify(connection.error_log[connection.error_log.length - 1], null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
