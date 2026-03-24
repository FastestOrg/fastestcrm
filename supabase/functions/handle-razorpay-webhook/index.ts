import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const signature = req.headers.get('x-razorpay-signature')
    const webhookSecret = Deno.env.get('RZP_WEBHOOK_SECRET')

    if (!webhookSecret) {
      throw new Error('Webhook secret not configured')
    }

    if (!signature) {
      throw new Error('No signature provided')
    }

    // Get raw body for signature verification
    const body = await req.text()

    // Verify signature
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body)
    )
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (signatureHex !== signature) {
      throw new Error('Invalid signature')
    }

    const payload = JSON.parse(body)
    console.log('Webhook received:', payload.event)



    let leadId = null
    let amount = 0
    let status = ''

    if (payload.event === 'payment.captured') {
      const payment = payload.payload.payment.entity
      console.log('Processing payment.captured', { paymentNotes: payment.notes })
      leadId = payment.notes?.lead_id
      amount = payment.amount / 100
      status = 'paid'
    } else if (payload.event === 'payment_link.paid') {
      const paymentLink = payload.payload.payment_link.entity
      const payment = payload.payload.payment?.entity
      console.log('Processing payment_link.paid', {
        linkNotes: paymentLink.notes,
        paymentNotes: payment?.notes
      })
      leadId = paymentLink.notes?.lead_id
      // Fallback to payment amount or link amount
      const amountPaise = payment?.amount || paymentLink.amount_paid
      amount = amountPaise / 100
      status = 'paid'
      amount = amountPaise / 100
      status = 'paid'
    }

    const tableName = (payload.event === 'payment.captured'
      ? payload.payload.payment.entity.notes?.table_name
      : payload.payload.payment_link.entity.notes?.table_name) || 'leads';

    console.log(`Extracted: leadId=${leadId}, amount=${amount}, status=${status}, tableName=${tableName}`)

    if (leadId && status === 'paid') {
      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Update lead status
      const { error } = await supabase
        .from(tableName)
        .update({
          status: 'paid',
          revenue_received: amount,
          total_recovered: amount
        })
        .eq('id', leadId)

      if (error) {
        console.error('Failed to update lead:', error)
        throw error
      }
      console.log(`Lead ${leadId} updated to paid`)

      // Fetch lead details to notify the owner
      const { data: lead } = await supabase
        .from(tableName)
        .select('name, sales_owner_id')
        .eq('id', leadId)
        .single()

      if (lead?.sales_owner_id) {
        console.log(`Sending notification to owner: ${lead.sales_owner_id}`)
        await supabase
          .from('notifications')
          .insert({
            user_id: lead.sales_owner_id,
            title: 'Lead Paid! 💰',
            message: `Lead "${lead.name}" has completed the payment of ₹${amount}.`,
            type: 'success',
            lead_id: leadId
          })

        // Send Web Push notification
        const _serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        fetch(`${supabaseUrl}/functions/v1/send-web-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_serviceRoleKey}` },
          body: JSON.stringify({ user_id: lead.sales_owner_id, title: 'Lead Paid! 💰', body: `Lead "${lead.name}" has completed the payment of ₹${amount}.` }),
        }).catch(e => console.error('[Push] razorpay-webhook:', e))
      }
    } else {
      console.log(`Event ${payload.event} processed but no action taken (leadId: ${leadId}, status: ${status})`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
