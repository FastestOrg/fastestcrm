import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts";

console.log('Hello from process-reminders!')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const now = new Date().toISOString()

    const notifications: any[] = []
    // Track users who should receive a push notification
    const pushTargets: Map<string, { title: string; body: string }> = new Map()

    // Helper: process leads from any table
    async function processTable(tableName: string) {
      const { data: leadData, error } = await supabaseClient
        .from(tableName as any)
        .select('id, name, sales_owner_id, reminder_at, last_notification_sent_at, send_web_push')
        .lte('reminder_at', now)
        .is('last_notification_sent_at', null)
        .not('reminder_at', 'is', null)

      if (error) {
        console.error(`Error querying ${tableName}:`, error.message)
        return []
      }

      const processedIds: string[] = []
      if (leadData && leadData.length > 0) {
        console.log(`Found ${leadData.length} leads to remind in ${tableName}`)
        for (const lead of leadData) {
          if (!lead.sales_owner_id) continue

          notifications.push({
            user_id: lead.sales_owner_id,
            lead_id: lead.id,
            title: 'Lead Reminder',
            message: `Reminder for lead: ${lead.name}`,
            type: 'reminder',
            created_at: now
          })
          processedIds.push(lead.id)

          // Always send push for reminders
          pushTargets.set(lead.sales_owner_id, {
            title: 'Lead Reminder',
            body: `Time to follow up with ${lead.name}`,
          })
        }

        // Mark as sent immediately
        if (processedIds.length > 0) {
          const { error: updateError } = await supabaseClient
            .from(tableName as any)
            .update({ last_notification_sent_at: now })
            .in('id', processedIds)
          if (updateError) {
            console.error(`Error updating ${tableName}:`, updateError.message)
          }
        }
      }
      return processedIds
    }

    // Discover all lead tables by querying the companies table for custom tables
    const standardTables = ['leads', 'leads_real_estate', 'leads_saas', 'leads_healthcare', 'leads_insurance', 'leads_travel']

    // Get all company-specific custom tables
    const { data: companies } = await supabaseClient
      .from('companies')
      .select('custom_leads_table')
      .not('custom_leads_table', 'is', null)

    const customTables: string[] = []
    if (companies) {
      for (const co of companies) {
        if (co.custom_leads_table && !standardTables.includes(co.custom_leads_table)) {
          customTables.push(co.custom_leads_table)
        }
      }
    }

    const allTables = [...standardTables, ...customTables]
    console.log('Processing tables:', allTables.join(', '))

    // Process all tables
    for (const table of allTables) {
      await processTable(table)
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('notifications')
        .insert(notifications)

      if (insertError) {
        console.error('Failed to insert notifications:', insertError.message)
      } else {
        console.log(`Inserted ${notifications.length} notifications`)
      }
    }

    // Send Web Push notifications for opted-in users
    let pushSent = 0
    for (const [userId, payload] of pushTargets) {
      try {
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-web-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title: payload.title,
            body: payload.body,
          }),
        })

        const pushResult = await pushResponse.text()
        console.log(`Push result for ${userId}: ${pushResponse.status} ${pushResult}`)

        if (pushResponse.ok) {
          pushSent++
        } else {
          console.error(`Push failed for user ${userId}: ${pushResponse.status} ${pushResult}`)
        }
      } catch (pushError) {
        console.error(`Error sending push to user ${userId}:`, pushError)
      }
    }

    console.log(`Push notifications sent: ${pushSent}/${pushTargets.size}`)

    return new Response(JSON.stringify({
      success: true,
      notifications_created: notifications.length,
      pushes_sent: pushSent,
      tables_processed: allTables,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('process-reminders error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
