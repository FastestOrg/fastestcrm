import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Skull, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

/**
 * Non-dismissible banner shown to admins when their subscription is expired.
 * Displays countdown to data deletion with progressive urgency styling.
 */
export function SubscriptionExpiredBanner() {
  const {
    isInGracePeriod,
    graceDaysRemaining,
    graceTotalDays,
    deletionDate,
    isAdmin,
  } = useSubscriptionStatus();
  const navigate = useNavigate();

  // Only show for admins in grace period
  if (!isInGracePeriod || !isAdmin) return null;

  // Progressive urgency levels
  const urgency = graceDaysRemaining <= 7
    ? 'critical'
    : graceDaysRemaining <= 30
    ? 'urgent'
    : graceDaysRemaining <= 90
    ? 'warning'
    : 'info';

  const progressPercent = Math.max(
    0,
    Math.min(100, ((graceTotalDays - graceDaysRemaining) / graceTotalDays) * 100)
  );

  const urgencyConfig = {
    critical: {
      bg: 'bg-red-600/95',
      border: 'border-red-500',
      text: 'text-white',
      progressBg: 'bg-red-900/50',
      progressBar: 'bg-red-300',
      icon: Skull,
      pulse: 'animate-pulse',
    },
    urgent: {
      bg: 'bg-gradient-to-r from-red-600/90 to-orange-600/90',
      border: 'border-red-500/50',
      text: 'text-white',
      progressBg: 'bg-red-900/30',
      progressBar: 'bg-orange-300',
      icon: AlertTriangle,
      pulse: '',
    },
    warning: {
      bg: 'bg-gradient-to-r from-amber-600/90 to-orange-600/90',
      border: 'border-amber-500/50',
      text: 'text-white',
      progressBg: 'bg-amber-900/30',
      progressBar: 'bg-amber-300',
      icon: AlertTriangle,
      pulse: '',
    },
    info: {
      bg: 'bg-gradient-to-r from-amber-500/80 to-yellow-500/80',
      border: 'border-amber-400/50',
      text: 'text-white',
      progressBg: 'bg-amber-800/30',
      progressBar: 'bg-yellow-300',
      icon: Clock,
      pulse: '',
    },
  };

  const config = urgencyConfig[urgency];
  const Icon = config.icon;

  const deletionDateStr = deletionDate
    ? deletionDate.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <div
      className={`${config.bg} ${config.border} ${config.text} border-b backdrop-blur-sm ${config.pulse}`}
      role="alert"
      id="subscription-expired-banner"
    >
      <div className="max-w-screen-xl mx-auto px-4 py-3">
        {/* Main content */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="shrink-0 p-1.5 bg-white/20 rounded-lg">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">
                {urgency === 'critical'
                  ? '🚨 CRITICAL: Subscription Expired'
                  : '⚠️ Subscription Expired'}
              </p>
              <p className="text-xs opacity-90 mt-0.5">
                {graceDaysRemaining === 0
                  ? 'Your data is being deleted today!'
                  : graceDaysRemaining === 1
                  ? 'Your data will be permanently deleted tomorrow!'
                  : `${graceDaysRemaining} days remaining before all data is permanently deleted (${deletionDateStr})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono opacity-80">
              <span className="tabular-nums text-lg font-bold">
                {graceDaysRemaining}
              </span>
              <span>days left</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-red-700 hover:bg-white/90 font-semibold shadow-lg text-xs px-4"
              onClick={() => navigate('/dashboard/company')}
            >
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              Renew Now
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className={`mt-2.5 h-1.5 rounded-full ${config.progressBg} overflow-hidden`}>
          <div
            className={`h-full rounded-full ${config.progressBar} transition-all duration-1000`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] mt-1 opacity-70 font-medium">
          <span>Grace period started</span>
          <span>Data deletion: {deletionDateStr}</span>
        </div>
      </div>

      {/* Extra warning for critical */}
      {urgency === 'critical' && (
        <div className="bg-red-900/60 text-center py-1.5 text-xs font-bold tracking-wide">
          ⛔ ALL TEAM MEMBERS ARE LOCKED OUT • ONLY YOU (ADMIN) CAN ACCESS BILLING •
          RENEW IMMEDIATELY TO PREVENT DATA LOSS ⛔
        </div>
      )}
    </div>
  );
}
