import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import { corsHeaders } from "../_shared/cors.ts";




// HMAC-SHA256 helper for LinkedIn validation
async function computeHmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return new TextDecoder().decode(encode(new Uint8Array(signature)));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get('company');

    // Handle LinkedIn webhook validation (GET with challengeCode)
    if (req.method === 'GET') {
      const challengeCode = url.searchParams.get('challengeCode');

      if (!challengeCode || !companyId) {
        return new Response('Missing parameters', { status: 400 });
      }

      // Find the integration
      const { data: integration } = await supabase
        .from('performance_marketing_integrations')
        .select('webhook_verify_token')
        .eq('platform', 'linkedin')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single();

      if (!integration?.webhook_verify_token) {
        return new Response('Integration not found', { status: 404 });
      }

      // Compute HMAC-SHA256 response
      const challengeResponse = await computeHmacSha256(
        integration.webhook_verify_token,
        challengeCode
      );

      console.log('LinkedIn webhook validation:', { challengeCode, response: challengeResponse });

      return new Response(JSON.stringify({ challengeResponse }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle lead notification (POST)
    if (req.method === 'POST') {
      if (!companyId) {
        return new Response(JSON.stringify({ error: 'Missing company parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      console.log('LinkedIn lead webhook received:', JSON.stringify(body, null, 2));

      // Find the integration
      const { data: integration } = await supabase
        .from('performance_marketing_integrations')
        .select('*, companies!inner(custom_leads_table, admin_id)')
        .eq('platform', 'linkedin')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single();

      if (!integration) {
        return new Response(JSON.stringify({ error: 'Integration not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // LinkedIn Lead Gen webhook payload format varies
      // Common structure includes:
      // {
      //   leadId: string,
      //   formId: string,
      //   campaignId: string,
      //   creativeId: string,
      //   eventType: "LEAD_GEN_FORM_RESPONSE_CREATED" | "LEAD_GEN_FORM_RESPONSE_DELETED",
      //   submittedAt: number,
      //   formResponse: { answers: [...] }
      // }

      const eventType = body.eventType || body.event_type;

      // Only process CREATED events
      if (eventType === 'LEAD_GEN_FORM_RESPONSE_DELETED') {
        console.log('Ignoring deleted lead event');
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Parse form response answers
      const answers: Record<string, string> = {};
      for (const answer of body.formResponse?.answers || body.answers || []) {
        const questionId = answer.questionId || answer.question_id;
        const value = answer.answerValue || answer.answer_value || answer.value;
        if (questionId && value) {
          answers[questionId.toLowerCase()] = value;
        }
      }

      console.log('Parsed LinkedIn answers:', answers);

      // Map LinkedIn lead fields
      const tableName = integration.companies?.custom_leads_table || 'leads';
      const adminId = integration.companies?.admin_id;
      const campaignId = body.campaignId || body.campaign_id;
      const formName = body.formName || body.form_name;

      const leadData = {
        name: answers.name || answers.fullname || answers.full_name ||
          `${answers.firstname || answers.first_name || ''} ${answers.lastname || answers.last_name || ''}`.trim() ||
          `LinkedIn Lead ${body.leadId?.substring(0, 8) || 'Unknown'}`,
        email: answers.email || answers.emailaddress || answers.email_address || null,
        phone: answers.phone || answers.phonenumber || answers.phone_number || null,
        company: answers.company || answers.companyname || answers.company_name || null,
        company_id: integration.company_id,
        created_by_id: adminId,
        sales_owner_id: adminId,
        status: integration.default_lead_status || 'new',
        lead_source: `LinkedIn - ${formName || campaignId || 'Lead Gen Form'}`,
        utm_source: 'linkedin',
        utm_medium: 'paid',
        utm_campaign: campaignId?.toString() || null,
      };

      const { data: insertedLead, error: insertError } = await supabase
        .from(tableName || 'leads')
        .insert(leadData)
        .select('id')
        .maybeSingle();

      if (insertError) {
        console.error('Error inserting LinkedIn lead:', insertError);
      } else {
        console.log('LinkedIn lead created successfully');

        // Send notification to the owner/admin
        if (leadData.sales_owner_id && insertedLead) {
          await supabase
            .from('notifications')
            .insert({
              user_id: leadData.sales_owner_id,
              title: 'New Lead Received! 🚀',
              message: `New lead "${leadData.name}" has been captured via LinkedIn.`,
              type: 'info',
              lead_id: insertedLead.id
            });

          // Send Web Push notification
          const _serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          fetch(`${supabaseUrl}/functions/v1/send-web-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_serviceRoleKey}` },
            body: JSON.stringify({ user_id: leadData.sales_owner_id, title: 'New Lead Received! 🚀', body: `New lead "${leadData.name}" has been captured via LinkedIn.` }),
          }).catch(e => console.error('[Push] linkedin-lead-webhook:', e));
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error: unknown) {
    console.error('LinkedIn webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
