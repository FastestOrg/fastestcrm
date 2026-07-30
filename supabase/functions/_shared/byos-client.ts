/**
 * ─── BYOS Shared Client Utility ─────────────────────────────────────────────
 * Used by Edge Functions to get the correct Supabase admin client for a company.
 * If BYOS is enabled → creates client using decrypted customer credentials.
 * If BYOS is disabled → returns the platform admin client.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Cache clients per company to avoid re-creation within the same function invocation
const clientCache = new Map<string, SupabaseClient>();

const keepAliveFetch: typeof fetch = (url, options = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      "Connection": "keep-alive",
      "Keep-Alive": "timeout=60, max=1000",
    },
  });
};

export function getPlatformAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key);
}

/**
 * Check if a company has BYOS enabled and return its connection details.
 * Returns null if BYOS is not active.
 */
export async function getBYOSConnection(companyId: string): Promise<{
  supabase_url: string;
  supabase_anon_key: string;
  service_role_key: string;
  status: string;
} | null> {
  const platform = getPlatformAdminClient();

  // Check if company has BYOS enabled
  const { data: company } = await platform
    .from("companies")
    .select("byos_enabled")
    .eq("id", companyId)
    .single();

  if (!company?.byos_enabled) return null;

  // Get BYOS connection with decrypted service role key
  const { data, error } = await platform.rpc("sql", {
    query: `
      SELECT 
        supabase_url,
        supabase_anon_key,
        public.byos_decrypt_key(supabase_service_role_key_encrypted) AS service_role_key,
        status
      FROM public.byos_connections
      WHERE company_id = '${companyId}'
        AND status = 'active'
      LIMIT 1
    `,
  });

  // Fallback: direct query if RPC sql is not available
  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    // Use direct query approach
    const { data: conn } = await platform
      .from("byos_connections")
      .select("supabase_url, supabase_anon_key, supabase_service_role_key_encrypted, status")
      .eq("company_id", companyId)
      .eq("status", "active")
      .single();

    if (!conn) return null;

    // Decrypt using a direct SQL call
    const { data: decrypted } = await platform.rpc("byos_decrypt_key", {
      encrypted_key: conn.supabase_service_role_key_encrypted,
    });

    if (!decrypted) return null;

    return {
      supabase_url: conn.supabase_url,
      supabase_anon_key: conn.supabase_anon_key,
      service_role_key: decrypted as string,
      status: conn.status,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

/**
 * Get the correct Supabase ADMIN client for a given company.
 * - If BYOS is active: returns a client pointing to the customer's project
 * - Otherwise: returns the platform admin client
 *
 * Edge Functions should use this instead of directly creating clients.
 */
export async function getOrgAdminClient(companyId: string): Promise<{
  client: SupabaseClient;
  isBYOS: boolean;
}> {
  // Check cache first
  const cached = clientCache.get(companyId);
  if (cached) {
    return { client: cached, isBYOS: true };
  }

  const conn = await getBYOSConnection(companyId);

  if (!conn) {
    return { client: getPlatformAdminClient(), isBYOS: false };
  }

  // Create and cache a client for the customer's Supabase
  const customerClient = createClient(conn.supabase_url, conn.service_role_key, {
    global: { fetch: keepAliveFetch },
  });
  clientCache.set(companyId, customerClient);

  return { client: customerClient, isBYOS: true };
}

/**
 * Log a BYOS operation to the audit log
 */
export async function logBYOSAudit(
  companyId: string,
  action: string,
  status: string,
  details: Record<string, unknown> = {},
  performedBy?: string
) {
  const platform = getPlatformAdminClient();
  await platform.from("byos_audit_log").insert({
    company_id: companyId,
    action,
    status,
    details,
    performed_by: performedBy,
  });
}

/**
 * List of org-scoped tables that are migrated during BYOS setup
 * and need to be synced back on disconnect.
 */
export const ORG_SCOPED_TABLES = [
  "leads",
  "leads_real_estate",
  "leads_saas",
  "leads_healthcare",
  "leads_insurance",
  "leads_travel",
  "company_lead_statuses",
  "real_estate_properties",
  "lead_history",
  "products",
  "invoices",
  "invoice_items",
  "invoice_payments",
  "quotations",
  "quotation_items",
  "forms",
  "form_responses",
  "tasks",
  "notifications",
  "automations",
  "lead_statuses",
  "landing_pages",
  "push_subscriptions",
  "calendar_bookings",
  "integration_api_keys",
  "invoice_settings",
  "lg_links",
  "whatsapp_accounts",
  "whatsapp_campaigns",
  "whatsapp_campaign_recipients",
  "whatsapp_message_log",
  "email_accounts",
  "email_campaigns",
  "email_campaign_sequences",
  "email_campaign_recipients",
  "email_campaign_logs",
  "email_threads",
  "email_messages",
  "email_integrations",
  "ai_employees",
  "ai_caller_logs",
  "agentic_workflows",
  "agentic_workflow_runs",
] as const;
