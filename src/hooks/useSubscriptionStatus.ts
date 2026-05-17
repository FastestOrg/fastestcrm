import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionStatus {
  /** Whether the subscription has expired (past_due or canceled) */
  isExpired: boolean;
  /** Whether the company is in the 180-day grace period */
  isInGracePeriod: boolean;
  /** Number of days remaining before data deletion */
  graceDaysRemaining: number;
  /** Total grace period duration in days (always 180) */
  graceTotalDays: number;
  /** The scheduled data deletion date */
  deletionDate: Date | null;
  /** When the grace period started */
  graceStartDate: Date | null;
  /** Whether the current user is the company admin */
  isAdmin: boolean;
  /** The subscription status string */
  subscriptionStatus: string | null;
  /** Whether the data is still loading */
  isLoading: boolean;
}

interface GracePeriodData {
  subscription_status: string | null;
  subscription_valid_until: string | null;
  grace_period_start: string | null;
  data_deletion_scheduled_at: string | null;
  admin_id: string;
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const { user } = useAuth();
  const { company } = useCompany();

  const { data: gracePeriodData, isLoading } = useQuery({
    queryKey: ['subscription-grace-period', company?.id],
    queryFn: async (): Promise<GracePeriodData | null> => {
      if (!company?.id) return null;

      const { data, error } = await supabase
        .from('companies')
        .select('subscription_status, subscription_valid_until, grace_period_start, data_deletion_scheduled_at, admin_id')
        .eq('id', company.id)
        .single();

      if (error) {
        console.error('[useSubscriptionStatus] Error:', error);
        return null;
      }

      return data as unknown as GracePeriodData;
    },
    enabled: !!company?.id,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
    retry: 2,
  });

  const isAdmin = !!(user && gracePeriodData && gracePeriodData.admin_id === user.id);

  const subscriptionStatus = gracePeriodData?.subscription_status ?? null;
  const validUntilStr = gracePeriodData?.subscription_valid_until ?? null;
  const validUntilDate = validUntilStr ? new Date(validUntilStr) : null;
  const now = new Date();

  // A subscription is expired if marked as past_due/canceled OR if the expiration date has passed
  const isChronologicallyExpired = !!(validUntilDate && validUntilDate < now);
  const isExpired = subscriptionStatus === 'past_due' || 
                    subscriptionStatus === 'canceled' || 
                    isChronologicallyExpired;

  // Synthesize grace period start date if not explicitly set in the DB yet
  const graceStartDate = gracePeriodData?.grace_period_start
    ? new Date(gracePeriodData.grace_period_start)
    : (isChronologicallyExpired && validUntilDate ? validUntilDate : null);

  // Synthesize deletion date (grace period start + 180 days) if not explicitly set
  const deletionDate = gracePeriodData?.data_deletion_scheduled_at
    ? new Date(gracePeriodData.data_deletion_scheduled_at)
    : (graceStartDate ? new Date(graceStartDate.getTime() + 180 * 24 * 60 * 60 * 1000) : null);

  const isInGracePeriod = isExpired && !!graceStartDate && !!deletionDate;

  let graceDaysRemaining = 0;
  if (deletionDate) {
    const diff = deletionDate.getTime() - now.getTime();
    graceDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  }

  return {
    isExpired,
    isInGracePeriod,
    graceDaysRemaining,
    graceTotalDays: 180,
    deletionDate,
    graceStartDate,
    isAdmin,
    subscriptionStatus,
    isLoading,
  };
}
