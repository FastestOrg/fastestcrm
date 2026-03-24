/**
 * Shared helper – fire-and-forget push notification via send-web-push edge function.
 * Import into any edge function that inserts a notification row.
 */

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[sendPush] Missing SUPABASE_URL or SERVICE_ROLE_KEY — skipping push')
    return
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-web-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ user_id: userId, title, body, url }),
    })

    const txt = await res.text()
    console.log(`[sendPush] ${userId}: ${res.status} ${txt.substring(0, 120)}`)
  } catch (err) {
    console.error('[sendPush] Failed:', err)
  }
}
