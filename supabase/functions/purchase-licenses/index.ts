import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRICE_PER_SEAT = 500 // Rs. 500 per seat

interface PurchaseRequest {
  quantity: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    // Get auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create client with user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''))
    if (userError || !user) {
      throw new Error('Not authenticated')
    }

    // Get user's company
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      throw new Error('No company associated with this user')
    }

    // Check if user is company admin
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single()

    if (!company) {
      throw new Error('Company not found')
    }

    if (company.admin_id !== user.id) {
      // Check if user has company or company_subadmin role
      const { data: userRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (!userRole || !['company', 'company_subadmin'].includes(userRole.role)) {
        throw new Error('Only company admins can purchase licenses')
      }
    }

    const body: PurchaseRequest = await req.json()
    const { quantity } = body

    if (!quantity || quantity < 1 || quantity > 100) {
      throw new Error('Quantity must be between 1 and 100')
    }

    const amount = quantity * PRICE_PER_SEAT * 100 // Convert to paise

    console.log(`Creating order for ${quantity} licenses, amount: ${amount} paise`)

    // Get Razorpay credentials
    const rzpKeyId = Deno.env.get('RZP_KEY_ID')
    const rzpKeySecret = Deno.env.get('RZP_KEY_SECRET')

    if (!rzpKeyId || !rzpKeySecret) {
      throw new Error('Razorpay credentials not configured')
    }

    // Create Razorpay order
    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${rzpKeyId}:${rzpKeySecret}`)
      },
      body: JSON.stringify({
        amount: amount,
        currency: 'INR',
        receipt: `lic_${Date.now()}`,
        notes: {
          company_id: company.id,
          quantity: quantity.toString(),
          type: 'license_purchase'
        }
      })
    })

    if (!orderResponse.ok) {
      const errorData = await orderResponse.text()
      console.error('Razorpay order error:', errorData)
      throw new Error('Failed to create payment order')
    }

    const order = await orderResponse.json()
    console.log('Created Razorpay order:', order.id)

    // Create license purchase record
    const { error: licenseError } = await supabaseAdmin
      .from('company_licenses')
      .insert({
        company_id: company.id,
        quantity: quantity,
        amount_paid: quantity * PRICE_PER_SEAT,
        razorpay_order_id: order.id,
        status: 'pending'
      })

    if (licenseError) {
      console.error('Error creating license record:', licenseError)
    }

    return new Response(
      JSON.stringify({
        order_id: order.id,
        amount: amount,
        currency: 'INR',
        key_id: rzpKeyId,
        company_name: company.name,
        quantity: quantity
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Purchase error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
