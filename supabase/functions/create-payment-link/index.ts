import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation helpers
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
    // Allow digits, spaces, dashes, plus sign, and parentheses
    const phoneRegex = /^[\d\s\-+()]{7,20}$/;
    return phoneRegex.test(phone);
}

function sanitizeString(str: string, maxLength: number): string {
    return str.slice(0, maxLength).replace(/[<>]/g, '');
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Authenticate the request
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('Missing authorization header');
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // Verify the user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''));
        if (authError || !user) {
            console.error('Authentication failed:', authError?.message);
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('Authenticated user:', user.id);

        // Determine which table to query (leads or custom table)
        let tableName = 'leads';

        // Fetch user's company settings
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (profile?.company_id) {
            const { data: company } = await supabase
                .from('companies')
                .select('custom_leads_table')
                .eq('id', profile.company_id)
                .single();

            if (company?.custom_leads_table) {
                tableName = company.custom_leads_table;
                console.log(`Using custom leads table: ${tableName}`);
            }
        }

        // 2. Parse and validate input
        const body = await req.json();
        const { amount, description, customer, reference_id } = body;

        // Validate amount
        if (typeof amount !== 'number' || amount <= 0) {
            return new Response(
                JSON.stringify({ error: 'Amount must be a positive number' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Amount in paise - limit to reasonable range (1 INR to 10 Lakh INR)
        if (amount < 100 || amount > 100000000) {
            return new Response(
                JSON.stringify({ error: 'Amount must be between 100 paise (1 INR) and 10,00,00,000 paise (10 Lakh INR)' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Validate customer object
        if (!customer || typeof customer !== 'object') {
            return new Response(
                JSON.stringify({ error: 'Customer details are required' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!customer.name || typeof customer.name !== 'string' || customer.name.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: 'Customer name is required' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const hasEmail = customer.email && isValidEmail(customer.email);
        const hasPhone = customer.phone && isValidPhone(customer.phone);

        if (!hasEmail && !hasPhone) {
            return new Response(
                JSON.stringify({ error: 'At least one valid contact method (email or phone) is required' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Validate reference_id (lead_id)
        if (!reference_id || typeof reference_id !== 'string') {
            return new Response(
                JSON.stringify({ error: 'Reference ID (lead_id) is required' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 3. Verify the lead exists and user has access to it
        const { data: lead, error: leadError } = await supabase
            .from(tableName)
            .select('id, sales_owner_id')
            .eq('id', reference_id)
            .single();

        if (leadError || !lead) {
            console.error('Lead not found or access denied:', leadError?.message);
            return new Response(
                JSON.stringify({ error: 'Lead not found or access denied' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('Lead verified:', lead.id);

        // Sanitize inputs
        const sanitizedDescription = description ? sanitizeString(String(description), 255) : 'Payment';
        const sanitizedCustomerName = sanitizeString(customer.name, 100);

        const RZP_KEY_ID = Deno.env.get('RZP_KEY_ID')
        const RZP_KEY_SECRET = Deno.env.get('RZP_KEY_SECRET')

        if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
            throw new Error('Razorpay keys are not configured')
        }

        // Create the Basic Auth header
        const authHeaderRazorpay = `Basic ${btoa(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`)}`

        const response = await fetch('https://api.razorpay.com/v1/payment_links', {
            method: 'POST',
            headers: {
                'Authorization': authHeaderRazorpay,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amount,
                currency: "INR",
                accept_partial: true,
                first_min_partial_amount: 100,
                description: sanitizedDescription,
                customer: {
                    name: sanitizedCustomerName,
                    ...(hasEmail && { email: customer.email.trim().toLowerCase() }),
                    ...(hasPhone && { contact: customer.phone.replace(/[^\d+]/g, '') })
                },
                notify: {
                    sms: !!hasPhone,
                    email: !!hasEmail
                },
                reminder_enable: true,
                notes: {
                    lead_id: reference_id,
                    created_by: user.id,
                    table_name: tableName
                },
                reference_id: `${reference_id.slice(-12)}_${Date.now()}`
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            console.error('Razorpay Error:', data)
            throw new Error(data.error?.description || 'Failed to create payment link')
        }

        console.log('Payment link created successfully for lead:', reference_id);

        return new Response(
            JSON.stringify(data),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('Edge Function Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
