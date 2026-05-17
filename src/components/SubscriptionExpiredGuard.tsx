import { useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

/**
 * Allowed paths for admins whose company subscription is expired.
 * All other dashboard paths will be redirected to /dashboard/company.
 */
const ALLOWED_EXPIRED_PATHS = [
  '/dashboard/settings',
  '/dashboard/company',
];

/**
 * SubscriptionExpiredGuard
 * 
 * Wraps the dashboard <Outlet /> and enforces route restrictions when
 * the company's subscription is in the grace period:
 * 
 * - Non-admin users: Already handled by the existing `Protected` component
 *   which checks `is_deactivated` and signs them out. The DB trigger and
 *   cron job ensure these users are deactivated.
 * 
 * - Admin users: Can only access /dashboard/settings and /dashboard/company.
 *   All other routes redirect to /dashboard/company with a toast notification.
 */
export function SubscriptionExpiredGuard() {
  const { isExpired, isInGracePeriod, isAdmin, isLoading } = useSubscriptionStatus();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Don't enforce while loading
    if (isLoading || !user) return;

    // Enforce grace period lockout
    if (isExpired && isInGracePeriod) {
      if (!isAdmin) {
        // Automatically sign out team members and notify them
        toast({
          title: 'Workspace Blocked',
          description: 'Your company subscription has expired. Please contact your company administrator to renew.',
          variant: 'destructive',
        });
        signOut();
        return;
      }

      // Admin access restriction
      const currentPath = location.pathname;
      const isAllowed = ALLOWED_EXPIRED_PATHS.some(
        (allowed) => currentPath === allowed || currentPath.startsWith(allowed + '/')
      );

      if (!isAllowed) {
        toast({
          title: 'Subscription Expired',
          description:
            'Your subscription has expired. Please renew to access all features. Only Settings and Billing are available.',
          variant: 'destructive',
        });
        navigate('/dashboard/company', { replace: true });
      }
    }
  }, [isExpired, isInGracePeriod, isAdmin, isLoading, user, location.pathname, navigate, toast, signOut]);

  return <Outlet />;
}
