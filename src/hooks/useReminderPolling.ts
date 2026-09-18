import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useReminderPolling() {
    const { session } = useAuth();

    useEffect(() => {
        if (!session?.user?.id) return;

        const checkReminders = async () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            try {
                await supabase.functions.invoke('process-reminders');
            } catch (error) {
                console.error('Error triggering reminder check:', error);
            }
        };

        // Initial check
        checkReminders();

        // Check when tab becomes visible again
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkReminders();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Poll every 120 seconds while active
        const interval = setInterval(checkReminders, 120 * 1000);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [session?.user?.id]);
}
