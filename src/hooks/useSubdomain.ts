/**
 * useSubdomain
 *
 * Resolves the current hostname to a company record stored in Supabase.
 * Works for:
 *   • Client subdomain:   acme.fastestcrm.com  → RPC get_subdomain_company
 *   • Custom domain:      crm.acme.com         → RPC get_custom_domain_company
 *   • Main domain / dev: fastestcrm.com / localhost → no lookup, instant resolve
 *
 * KEY DESIGN PRINCIPLE: The `loading` state is initialised to `false` on the
 * main domain and `localhost` so the app NEVER blocks on a DB call when not
 * running on a client workspace domain.
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase, anonSupabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { proxifySupabaseUrl } from '@/lib/utils';

// Deep fallback for workspace resolution in case the proxy has CORS/Body issues
// We use a lazy accessor to avoid creating multiple clients on module load
let _fallbackClient: any = null;
const getFallbackClient = () => {
  if (_fallbackClient) return _fallbackClient;
  
  const projectUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'uykdyqdeyilpulaqlqip'}.supabase.co`;
  _fallbackClient = createClient(
    projectUrl,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    { 
      auth: { 
        persistSession: false,
        storageKey: 'sb-fallback-auth-token' // Unique key to avoid conflict
      } 
    }
  );
  return _fallbackClient;
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubdomainCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean;
}

export interface SubdomainResult {
  /** True when on a client subdomain (slug.fastestcrm.com) */
  isSubdomain: boolean;
  /** True when on a custom domain (crm.acme.com) */
  isCustomDomain: boolean;
  /** The resolved subdomain slug, null if custom domain or main domain */
  subdomain: string | null;
  /** The resolved company, null until lookup completes or if not found */
  company: SubdomainCompany | null;
  /** Only true when actively fetching company data for a workspace domain */
  loading: boolean;
  error: string | null;
  /** True only on the platform's own root domain */
  isMainDomain: boolean;
}

type DomainClassification = {
  isMainDomain: boolean;
  isSubdomain: boolean;
  isCustomDomain: boolean;
  subdomain: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MAIN_DOMAIN = 'fastestcrm.com';

/** These subdomains belong to the platform, not a client workspace */
const PLATFORM_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'mail', 'smtp', 'ftp']);

/** How long to wait for a lookup before giving up and rendering anyway */
const LOOKUP_TIMEOUT_MS = 6_000;

// ── Pure classification (no async, no side-effects) ───────────────────────────

function classifyHostname(hostname: string): DomainClassification {
  // Local development / CI / LAN
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')
  ) {
    return { isMainDomain: true, isSubdomain: false, isCustomDomain: false, subdomain: null };
  }

  // Localhost subdomain testing (e.g. weskill.localhost)
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.slice(0, hostname.length - '.localhost'.length);
    return { isMainDomain: false, isSubdomain: true, isCustomDomain: false, subdomain: sub };
  }

  // Preview / staging deployments
  if (
    hostname.endsWith('.lovable.app') ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.netlify.app') ||
    hostname.endsWith('.pages.dev')
  ) {
    return { isMainDomain: true, isSubdomain: false, isCustomDomain: false, subdomain: null };
  }

  // Exact root or www of the platform domain
  if (hostname === MAIN_DOMAIN || hostname === `www.${MAIN_DOMAIN}`) {
    return { isMainDomain: true, isSubdomain: false, isCustomDomain: false, subdomain: null };
  }

  // Platform subdomain: *.fastestcrm.com
  if (hostname.endsWith(`.${MAIN_DOMAIN}`)) {
    const sub = hostname.slice(0, hostname.length - MAIN_DOMAIN.length - 1);

    // Known platform subdomains (www, api, etc.) → still the main domain
    if (PLATFORM_SUBDOMAINS.has(sub)) {
      return { isMainDomain: true, isSubdomain: false, isCustomDomain: false, subdomain: null };
    }

    // Client workspace subdomain
    return { isMainDomain: false, isSubdomain: true, isCustomDomain: false, subdomain: sub };
  }

  // Everything else is treated as a custom domain
  return { isMainDomain: false, isSubdomain: false, isCustomDomain: true, subdomain: null };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSubdomain(): SubdomainResult {
  const hostname = window.location.hostname;

  // Classification is pure / synchronous — computed once
  const { isMainDomain, isSubdomain, isCustomDomain, subdomain } = useMemo(
    () => classifyHostname(hostname),
    [hostname]
  );

  // On main-domain / localhost, we never need to load anything
  const needsLookup = !isMainDomain && (isSubdomain || isCustomDomain);

  const [company, setCompany] = useState<SubdomainCompany | null>(null);
  // loading starts false on main domain — no spinner, no delay, no DB call
  const [loading, setLoading] = useState(needsLookup);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Main domain / localhost — nothing to do
    if (!needsLookup) return;

    let cancelled = false;

    // Safety timeout — never block the app forever
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.warn('[useSubdomain] Lookup timed out — rendering without company data');
        setLoading(false);
      }
    }, LOOKUP_TIMEOUT_MS);

    const run = async () => {
      try {
        if (isSubdomain && subdomain) {
          // ── Slug-based lookup ──────────────────────────────────────────────
          const { data, error: rpcError } = await (anonSupabase.rpc as any)(
            'get_subdomain_company', { _slug: subdomain }
          );

          if (cancelled) return;

          if (rpcError) {
            console.error('[useSubdomain] Proxy RPC failed, trying fallback...', rpcError);

            // EMERGENCY FALLBACK: Hit Supabase direct if proxy failed
            const { data: fallbackData, error: fallbackError } = await getFallbackClient().rpc(
              'get_subdomain_company', { _slug: subdomain }
            );

            if (fallbackError) {
              console.error('[useSubdomain] Fallback RPC also failed:', fallbackError);
              setError(`Failed to load workspace: ${fallbackError.message}`);
              return;
            }

            const fallbackRows = Array.isArray(fallbackData) ? fallbackData : fallbackData ? [fallbackData] : [];
            if (fallbackRows.length === 0) {
              setError('Workspace not found');
              return;
            }

            const fallbackRow = fallbackRows[0] as unknown as SubdomainCompany;
            if (!fallbackRow.is_active) {
              setError('This workspace is currently inactive');
              return;
            }
            // Proxify logo URL
            fallbackRow.logo_url = proxifySupabaseUrl(fallbackRow.logo_url);
            setCompany(fallbackRow);
            return;
          }

          // RPC returns a TABLE — PostgREST wraps it as an array
          const rows = Array.isArray(data) ? data : data ? [data] : [];

          if (rows.length === 0) {
            setError('Workspace not found');
            return;
          }

          const row = rows[0] as unknown as SubdomainCompany;
          if (!row.is_active) {
            setError('This workspace is currently inactive');
            return;
          }

          // Proxify logo URL
          row.logo_url = proxifySupabaseUrl(row.logo_url);
          setCompany(row);

        } else if (isCustomDomain) {
          // ── Custom-domain lookup ───────────────────────────────────────────
          const normalized = hostname.toLowerCase().replace(/^www\./, '');

          const { data, error: rpcError } = await (anonSupabase.rpc as any)(
            'get_custom_domain_company', { _domain: normalized }
          );

          if (cancelled) return;

          if (rpcError) {
            // Fail-open: don't block users for custom-domain errors
            console.error('[useSubdomain] RPC Error (Custom Domain):', rpcError);
            setError(`Failed to load workspace: ${rpcError.message || 'Unknown error'}`);
            return;
          }

          const rows = Array.isArray(data) ? data : data ? [data] : [];
          if (rows.length > 0) {
            const row = rows[0] as unknown as SubdomainCompany;
            if (row.is_active) {
              row.logo_url = proxifySupabaseUrl(row.logo_url);
              setCompany(row);
            }
          }
        }
      } catch (err: unknown) {
        if (cancelled) return;
        console.error('[useSubdomain] Unexpected error:', err);
        // Fail-open — don't block the user
      } finally {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsLookup, isSubdomain, isCustomDomain, subdomain, hostname]);

  return {
    isSubdomain,
    isCustomDomain,
    subdomain,
    company,
    loading,
    error,
    isMainDomain,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the full workspace URL for a given company slug */
export function getWorkspaceUrl(slug: string): string {
  return `https://${slug}.${MAIN_DOMAIN}`;
}

/** Returns true if the current hostname matches the given company's subdomain */
export function isCompanyWorkspace(companySlug: string): boolean {
  const hostname = window.location.hostname;
  return (
    hostname === `${companySlug}.${MAIN_DOMAIN}` ||
    hostname === companySlug // custom domain
  );
}
