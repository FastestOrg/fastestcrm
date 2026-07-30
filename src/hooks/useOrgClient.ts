/**
 * ─── useOrgClient ───────────────────────────────────────────────────────────
 * Drop-in hook for accessing the correct Supabase client for org data.
 *
 * Usage:
 *   const { orgClient, isBYOS } = useOrgClient();
 *   const { data } = await orgClient.from('leads').select('*');
 *
 * When BYOS is OFF:  orgClient === supabase (zero behavior change)
 * When BYOS is ON:   orgClient → customer's Supabase project
 * ────────────────────────────────────────────────────────────────────────────
 */
import { useBYOS } from '@/contexts/BYOSContext';

export function useOrgClient() {
  const { orgClient, isBYOS, byosStatus, healthStatus, isLoading, byosUrl } = useBYOS();

  return {
    /** The Supabase client to use for org-scoped data (leads, invoices, etc.) */
    orgClient,
    /** True if company is actively using their own Supabase */
    isBYOS,
    /** Current BYOS connection status */
    byosStatus,
    /** Health of the BYOS connection */
    healthStatus,
    /** Whether BYOS config is still loading */
    isBYOSLoading: isLoading,
    /** The customer's Supabase URL (for display purposes) */
    byosUrl,
  };
}
