/**
 * Web Push subscription helper.
 * Registers the service worker, subscribes via PushManager,
 * and persists the subscription to Supabase.
 */

import { supabase } from '@/integrations/supabase/client';

// VAPID public key – generated per-project, safe to embed in client code.
const VAPID_PUBLIC_KEY = 'BAMW56PhO78oEncQJWP4crslrLPePPyQogP5Ac35QKPzh2MYOUV-HTuKW6LTEi5ZZdLPhZa64js4QSuTksxrtYg';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Registers the service worker and subscribes to push notifications.
 * Returns true on success, false on failure.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return false;
        }

        // Register the service worker
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;

        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Subscribe
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
            });
        }

        // Persist to Supabase
        const subscriptionJson = subscription.toJSON();
        
        const { error } = await supabase
            .from('push_subscriptions' as any)
            .upsert(
                {
                    user_id: userId,
                    endpoint: subscriptionJson.endpoint,
                    p256dh: subscriptionJson.keys?.p256dh || '',
                    auth: subscriptionJson.keys?.auth || '',
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'endpoint' }
            );

        if (error) {
            console.error('[Push] Database save failed:', error.message, error.details);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[Push] Subscription process failed entirely:', error);
        return false;
    }
}

/**
 * Unsubscribe from push notifications and remove from DB.
 */
export async function unsubscribeFromPush(): Promise<void> {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            const endpoint = subscription.endpoint;
            await subscription.unsubscribe();

            await supabase
                .from('push_subscriptions' as any)
                .delete()
                .eq('endpoint', endpoint);
        }
    } catch (error) {
        console.error('Error unsubscribing from push:', error);
    }
}
