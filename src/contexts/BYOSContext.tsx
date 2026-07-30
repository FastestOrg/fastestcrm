/**
 * ─── BYOS Context ───────────────────────────────────────────────────────────
 * Provides org-scoped Supabase client to all child components.
 * - If BYOS is enabled for the company: returns a client → customer's Supabase
 * - If BYOS is disabled: returns the default platform client
 *
 * Auth/licensing ALWAYS uses the platform client (imported from client.ts).
 * Only org data (leads, invoices, etc.) uses the orgClient from this context.
 * ────────────────────────────────────────────────────────────────────────────
 */
import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { supabase, createOrgSupabaseClient } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import type { Database } from '@/integrations/supabase/types';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface BYOSConnection {
  id: string;
  supabase_url: string;
  supabase_anon_key: string;
  status: string;
  migration_version: string | null;
  last_health_check: string | null;
  health_status: string;
  byos_enabled: boolean;
}

interface BYOSContextType {
  /** The Supabase client to use for org-scoped data operations */
  orgClient: SupabaseClient<Database>;
  /** Whether the current company is using BYOS */
  isBYOS: boolean;
  /** Current BYOS connection status */
  byosStatus: string | null;
  /** Health status of the BYOS connection */
  healthStatus: string | null;
  /** Whether the BYOS connection data is still loading */
  isLoading: boolean;
  /** The BYOS connection URL (for display) */
  byosUrl: string | null;
}

const BYOSContext = createContext<BYOSContextType>({
  orgClient: supabase,
  isBYOS: false,
  byosStatus: null,
  healthStatus: null,
  isLoading: false,
  byosUrl: null,
});

// ─── Provider ───────────────────────────────────────────────────────────────
export function BYOSProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { company } = useCompany();

  // Fetch BYOS connection details if company has BYOS enabled
  const { data: byosConn, isLoading } = useQuery({
    queryKey: ['byos-connection', company?.id],
    queryFn: async (): Promise<BYOSConnection | null> => {
      if (!company?.id) return null;

      // Quick check: does this company have byos_enabled?
      const companyData = company as any;
      if (!companyData?.byos_enabled) return null;

      // Fetch connection details (anon key only — service key never leaves the server)
      const { data, error } = await supabase.rpc('get_byos_connection', {
        p_company_id: company.id,
      });

      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        return null;
      }

      const row = Array.isArray(data) ? data[0] : data;
      return row as BYOSConnection;
    },
    enabled: !!company?.id && !!user?.id,
    staleTime: 1000 * 60 * 5,  // Cache for 5 minutes
    gcTime: 1000 * 60 * 10,
    retry: 1,
  });

  // Create the org client — either BYOS or platform
  const orgClient = useMemo(() => {
    if (
      byosConn &&
      byosConn.byos_enabled &&
      byosConn.status === 'active' &&
      byosConn.supabase_url &&
      byosConn.supabase_anon_key
    ) {
      return createOrgSupabaseClient(byosConn.supabase_url, byosConn.supabase_anon_key);
    }
    // Default: use the platform client
    return supabase;
  }, [byosConn?.supabase_url, byosConn?.supabase_anon_key, byosConn?.status, byosConn?.byos_enabled]);

  const contextValue = useMemo<BYOSContextType>(
    () => ({
      orgClient,
      isBYOS: !!byosConn?.byos_enabled && byosConn?.status === 'active',
      byosStatus: byosConn?.status || null,
      healthStatus: byosConn?.health_status || null,
      isLoading,
      byosUrl: byosConn?.supabase_url || null,
    }),
    [orgClient, byosConn, isLoading]
  );

  return (
    <BYOSContext.Provider value={contextValue}>
      {children}
    </BYOSContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useBYOS() {
  return useContext(BYOSContext);
}
