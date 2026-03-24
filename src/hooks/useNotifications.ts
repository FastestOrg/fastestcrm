import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { requestWebNotificationPermission, sendWebNotification } from '@/lib/webNotificationHelper';
import { subscribeToPush } from '@/lib/pushSubscription';

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    created_at: string;
    lead_id?: string;
}

export function useNotifications() {
    const { session } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        if (!session?.user?.id) return;

        try {
            const { data, error } = await supabase
                .from('notifications' as any)
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(50) as { data: Notification[] | null, error: any };

            if (error) throw error;
            setNotifications(data || []);
            setUnreadCount(data?.filter(n => !n.read).length || 0);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications' as any)
                .update({ read: true })
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setNotifications(prev =>
                prev.map(n => (n.id === id ? { ...n, read: true } : n))
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
            toast.error('Failed to mark as read');
        }
    };

    const markAllAsRead = async () => {
        if (!session?.user?.id) return;
        try {
            const { error } = await supabase
                .from('notifications' as any)
                .update({ read: true })
                .eq('user_id', session.user.id)
                .eq('read', false);

            if (error) throw error;

            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
            toast.success('All notifications marked as read');
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Failed to mark all as read');
        }
    };

    const requestPermission = async () => {
        const status = await requestWebNotificationPermission();
        if (status === 'granted') {
            toast.success('Notifications enabled!', {
                description: 'You will now receive real-time updates.'
            });
            // Register push subscription so notifications work even when tab is closed
            if (session?.user?.id) {
                subscribeToPush(session.user.id).catch(console.error);
            }
        } else if (status === 'denied') {
            toast.error('Permission Denied', {
                description: 'Please enable notifications in your browser address bar settings to receive alerts.'
            });
        } else if (status === 'unsupported') {
            toast.error('Not Supported', {
                description: 'Your browser does not support web notifications.'
            });
        }
    };

    useEffect(() => {
        if (!session?.user?.id) return;

        fetchNotifications();

        // Check permission status on mount
        const currentStatus = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
        let permissionTimer: ReturnType<typeof setTimeout> | null = null;
        if (currentStatus === 'default') {
            permissionTimer = setTimeout(() => {
                toast('Enable Notifications', {
                    description: 'Stay updated with new leads and payments even when you are not looking.',
                    action: {
                        label: 'Enable',
                        onClick: () => requestPermission()
                    },
                });
            }, 3000);
        } else if (currentStatus === 'granted' && session?.user?.id) {
            // Auto-register push subscription if permission is already granted
            subscribeToPush(session.user.id).catch(console.error);
        }

        // Subscribe to real-time changes (ALWAYS, regardless of permission status)
        const channel = supabase
            .channel(`public:notifications:${session.user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications' as any,
                    filter: `user_id=eq.${session.user.id}`,
                },
                (payload) => {
                    const newNotification = payload.new as Notification;
                    setNotifications(prev => [newNotification, ...prev]);
                    setUnreadCount(prev => prev + 1);

                    // In-app toast (bottom right, 10 seconds)
                    toast.info(newNotification.title, {
                        description: newNotification.message,
                        duration: 10000,
                        position: 'bottom-right',
                    });

                    // Play notification sound
                    try {
                        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                        if (AudioContext) {
                            const ctx = new AudioContext();
                            const osc = ctx.createOscillator();
                            const gainNodes = ctx.createGain();
                            
                            osc.connect(gainNodes);
                            gainNodes.connect(ctx.destination);
                            
                            // Pleasant "pop" sound properties
                            osc.type = 'sine';
                            osc.frequency.setValueAtTime(600, ctx.currentTime);
                            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
                            
                            gainNodes.gain.setValueAtTime(0, ctx.currentTime);
                            gainNodes.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
                            gainNodes.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                            
                            osc.start(ctx.currentTime);
                            osc.stop(ctx.currentTime + 0.2);
                        }
                    } catch (e) {
                        console.error('Failed to play notification sound', e);
                    }

                    // Native OS browser popup
                    sendWebNotification(newNotification.title, newNotification.message, {
                        tag: newNotification.id,
                    });
                }
            )
            .subscribe();

        return () => {
            if (permissionTimer) clearTimeout(permissionTimer);
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id]);

    return {
        notifications,
        unreadCount,
        loading,
        permissionStatus: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
        requestPermission,
        markAsRead,
        markAllAsRead,
        refresh: fetchNotifications
    };
}
