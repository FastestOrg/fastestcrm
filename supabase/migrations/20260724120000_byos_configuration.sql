-- ============================================================================
-- BYOS (Bring Your Own Supabase) Configuration
-- ============================================================================
-- Stores encrypted connection details for customer Supabase projects.
-- Auth/licensing stays on OUR Supabase; org data routes to THEIR Supabase.
-- ============================================================================

-- Ensure pgcrypto is available for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── BYOS Connections Table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.byos_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Customer's Supabase project coordinates
  supabase_url TEXT NOT NULL,
  supabase_anon_key TEXT NOT NULL,
  -- Service role key is encrypted at rest via pgcrypto
  supabase_service_role_key_encrypted BYTEA NOT NULL,
  -- Connection lifecycle
  status TEXT NOT NULL DEFAULT 'pending_validation'
    CHECK (status IN (
      'pending_validation', 'validating', 'validated',
      'migration_running', 'migration_failed',
      'active', 'disconnecting', 'migrating_back', 'error'
    )),
  migration_version TEXT,
  last_health_check TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown'
    CHECK (health_status IN ('healthy', 'degraded', 'unreachable', 'unknown')),
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One BYOS connection per company
  UNIQUE(company_id)
);

-- ─── Add byos_enabled flag to companies ─────────────────────────────────────
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS byos_enabled BOOLEAN NOT NULL DEFAULT false;

-- ─── BYOS Audit Log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.byos_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN (
      'connect', 'validate', 'migrate', 'health_check',
      'disconnect', 'migrate_back', 'error'
    )),
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed')),
  details JSONB DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.byos_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.byos_audit_log ENABLE ROW LEVEL SECURITY;

-- Company admin can manage their BYOS connection
CREATE POLICY "byos_connections_admin_all"
  ON public.byos_connections FOR ALL
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE admin_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE admin_id = auth.uid()
    )
  );

-- Company admin can view their BYOS audit log
CREATE POLICY "byos_audit_log_admin_select"
  ON public.byos_audit_log FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE admin_id = auth.uid()
    )
  );

-- Service-role can insert audit logs (edge functions)
CREATE POLICY "byos_audit_log_service_insert"
  ON public.byos_audit_log FOR INSERT
  WITH CHECK (true);

-- ─── Helper: Encrypt service role key ────────────────────────────────────────
-- Uses a server-side secret as the encryption passphrase.
-- The passphrase is stored as a Supabase secret / env var.
CREATE OR REPLACE FUNCTION public.byos_encrypt_key(plain_key TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  passphrase TEXT;
BEGIN
  passphrase := COALESCE(current_setting('app.settings.byos_encryption_key', true), 'byos-default-key-change-in-production');
  RETURN pgp_sym_encrypt(plain_key, passphrase);
END;
$$;

-- ─── Helper: Decrypt service role key ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.byos_decrypt_key(encrypted_key BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  passphrase TEXT;
BEGIN
  passphrase := COALESCE(current_setting('app.settings.byos_encryption_key', true), 'byos-default-key-change-in-production');
  RETURN pgp_sym_decrypt(encrypted_key, passphrase);
END;
$$;

-- ─── Updated_at trigger ──────────────────────────────────────────────────────
CREATE TRIGGER update_byos_connections_updated_at
  BEFORE UPDATE ON public.byos_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Index for fast lookups ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_byos_connections_company_id ON public.byos_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_byos_connections_status ON public.byos_connections(status);
CREATE INDEX IF NOT EXISTS idx_byos_audit_log_company_id ON public.byos_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_byos_audit_log_created_at ON public.byos_audit_log(created_at DESC);

-- ─── RPC: Get BYOS connection (anon key only, no service key to frontend) ───
CREATE OR REPLACE FUNCTION public.get_byos_connection(p_company_id UUID)
RETURNS TABLE (
  id UUID,
  supabase_url TEXT,
  supabase_anon_key TEXT,
  status TEXT,
  migration_version TEXT,
  last_health_check TIMESTAMPTZ,
  health_status TEXT,
  byos_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.id,
    bc.supabase_url,
    bc.supabase_anon_key,
    bc.status,
    bc.migration_version,
    bc.last_health_check,
    bc.health_status,
    c.byos_enabled
  FROM public.byos_connections bc
  JOIN public.companies c ON c.id = bc.company_id
  WHERE bc.company_id = p_company_id
    AND c.admin_id = auth.uid();
END;
$$;
