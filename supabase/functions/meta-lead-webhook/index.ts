import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




// Global token used in Meta App Dashboard → Webhooks configuration.
const GLOBAL_VERIFY_TOKEN = 'fastestcrm_meta_verify_2024';

interface LeadFieldData {
  name: string;
  values: string[];
}

interface MetaLeadData {
  id: string;
  created_time: string;
  field_data: LeadFieldData[];
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  form_id?: string;
}

// Fetch full lead details from Meta Graph API
async function fetchLeadDetails(leadgenId: string, accessToken: string): Promise<MetaLeadData | null> {
  try {
    const url = `https://graph.facebook.com/v19.0/${leadgenId}?fields=id,created_time,field_data,ad_id,adset_id,campaign_id,form_id&access_token=${accessToken}`;
    console.log('Fetching lead details from Meta:', leadgenId);

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error fetching lead:', data.error);
      return null;
    }

    console.log('Lead details from Meta:', JSON.stringify(data, null, 2));
    return data as MetaLeadData;
  } catch (error) {
    console.error('Error fetching lead details:', error);
    return null;
  }
}

// Extract field value from Meta's field_data array
function getFieldValue(fieldData: LeadFieldData[], fieldName: string): string | null {
  const field = fieldData.find(f =>
    f.name.toLowerCase() === fieldName.toLowerCase() ||
    f.name.toLowerCase().includes(fieldName.toLowerCase())
  );
  return field?.values?.[0] || null;
}

// Map Meta field names to our lead fields
function mapMetaLeadToDbFields(metaLead: MetaLeadData): Record<string, any> {
  const fieldData = metaLead.field_data || [];

  // Common Meta form field names mapped to our schema
  const mappedData: Record<string, any> = {};

  // Name fields - Meta often uses full_name, first_name, last_name
  const fullName = getFieldValue(fieldData, 'full_name');
  const firstName = getFieldValue(fieldData, 'first_name');
  const lastName = getFieldValue(fieldData, 'last_name');

  if (fullName) {
    mappedData.name = fullName;
  } else if (firstName || lastName) {
    mappedData.name = [firstName, lastName].filter(Boolean).join(' ');
  } else {
    // Fallback to any name-like field
    const anyName = getFieldValue(fieldData, 'name');
    mappedData.name = anyName || `Meta Lead ${metaLead.id.substring(0, 8)}`;
  }

  // Email
  const email = getFieldValue(fieldData, 'email');
  if (email) mappedData.email = email;

  // Phone - Meta uses phone_number, phone, mobile
  const phone = getFieldValue(fieldData, 'phone_number') ||
    getFieldValue(fieldData, 'phone') ||
    getFieldValue(fieldData, 'mobile');
  if (phone) mappedData.phone = phone;

  // WhatsApp (sometimes separate)
  const whatsapp = getFieldValue(fieldData, 'whatsapp') ||
    getFieldValue(fieldData, 'whatsapp_number');
  if (whatsapp) mappedData.whatsapp = whatsapp;

  // City/State/Location
  const city = getFieldValue(fieldData, 'city');
  const state = getFieldValue(fieldData, 'state');
  if (state) mappedData.state = state;
  if (city) mappedData.preferred_location = city;

  // Company
  const company = getFieldValue(fieldData, 'company_name') ||
    getFieldValue(fieldData, 'company');
  if (company) mappedData.company = company;

  // Job title / role
  const jobTitle = getFieldValue(fieldData, 'job_title');
  if (jobTitle) mappedData.domain = jobTitle;

  // Budget (for real estate)
  const budget = getFieldValue(fieldData, 'budget');
  if (budget) {
    const budgetNum = parseFloat(budget.replace(/[^0-9.]/g, ''));
    if (!isNaN(budgetNum)) {
      mappedData.budget_min = budgetNum;
      mappedData.budget_max = budgetNum;
    }
  }

  // Property type (for real estate)
  const propertyType = getFieldValue(fieldData, 'property_type') ||
    getFieldValue(fieldData, 'property');
  if (propertyType) mappedData.property_type = propertyType;

  // Notes - combine any other fields
  const otherFields: string[] = [];
  for (const field of fieldData) {
    const knownFields = ['full_name', 'first_name', 'last_name', 'name', 'email',
      'phone_number', 'phone', 'mobile', 'whatsapp', 'city',
      'state', 'company_name', 'company', 'job_title', 'budget',
      'property_type', 'property', 'whatsapp_number'];
    if (!knownFields.some(k => field.name.toLowerCase().includes(k.toLowerCase()))) {
      otherFields.push(`${field.name}: ${field.values.join(', ')}`);
    }
  }
  if (otherFields.length > 0) {
    mappedData.notes = otherFields.join('\n');
  }

  return mappedData;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Handle webhook verification (GET request from Meta)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('Meta webhook verification request:', { mode, token });

      if (mode === 'subscribe' && challenge) {
        // Accept global verify token
        if (token === GLOBAL_VERIFY_TOKEN) {
          console.log('Webhook verified successfully (global token)');
          return new Response(challenge, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          });
        }

        // Backward compatible: accept company-specific token from DB
        const { data: integration } = await supabase
          .from('performance_marketing_integrations')
          .select('id')
          .eq('platform', 'meta')
          .eq('webhook_verify_token', token)
          .neq('is_active', false)
          .limit(1)
          .maybeSingle();

        if (integration) {
          console.log('Webhook verified successfully (integration token)');
          return new Response(challenge, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          });
        }
      }

      return new Response('Verification failed', {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    // Handle lead notification (POST request)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Meta lead webhook received:', JSON.stringify(body, null, 2));

      if (body.object !== 'page' || !body.entry) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      for (const entry of body.entry) {
        const pageId = entry.id;

        // Find the integration for this page
        const { data: integration, error: integrationError } = await supabase
          .from('performance_marketing_integrations')
          .select('*, companies!inner(custom_leads_table, admin_id, industry)')
          .eq('platform', 'meta')
          .eq('page_id', pageId)
          .neq('is_active', false)
          .limit(1)
          .maybeSingle();

        if (integrationError) {
          console.error('Error finding integration:', integrationError);
          continue;
        }

        if (!integration) {
          console.log('No integration found for page:', pageId);
          // Try to find any active Meta integration as fallback
          const { data: fallbackIntegration } = await supabase
            .from('performance_marketing_integrations')
            .select('*, companies!inner(custom_leads_table, admin_id, industry)')
            .eq('platform', 'meta')
            .neq('is_active', false)
            .limit(1)
            .maybeSingle();

          if (!fallbackIntegration) {
            console.log('No fallback integration found either');
            continue;
          }
          console.log('Using fallback integration:', fallbackIntegration.id);
        }

        const activeIntegration = integration || null;
        if (!activeIntegration) continue;

        const accessToken = activeIntegration.access_token;
        const industry = activeIntegration.companies?.industry;

        // Determine table name based on industry
        let tableName = activeIntegration.companies?.custom_leads_table || 'leads';
        if (industry === 'real_estate' && !activeIntegration.companies?.custom_leads_table) {
          tableName = 'leads_real_estate';
        }

        const adminId = activeIntegration.companies?.admin_id;

        // Process each leadgen change
        for (const change of entry.changes || []) {
          if (change.field !== 'leadgen') continue;

          const leadgenId = change.value?.leadgen_id;
          const formId = change.value?.form_id;
          const adId = change.value?.ad_id;
          const adgroupId = change.value?.adgroup_id;

          console.log('Processing Meta lead:', { leadgenId, formId, tableName });

          // Fetch full lead details from Meta Graph API
          let leadDetails: MetaLeadData | null = null;
          if (accessToken && leadgenId) {
            leadDetails = await fetchLeadDetails(leadgenId, accessToken);
          }

          // Build lead data
          let leadData: Record<string, any> = {
            company_id: activeIntegration.company_id,
            created_by_id: adminId,
            sales_owner_id: adminId,
            status: activeIntegration.default_lead_status || 'new',
            lead_source: `Meta Lead Ads`,
            utm_source: 'meta',
            utm_medium: 'paid',
            utm_campaign: adgroupId || adId || formId || null,
          };

          // Map Meta fields if we got the lead details
          if (leadDetails) {
            const mappedFields = mapMetaLeadToDbFields(leadDetails);
            leadData = { ...leadData, ...mappedFields };

            // Add form/campaign info to lead source
            if (formId) {
              leadData.lead_source = `Meta Lead Ads (Form: ${formId})`;
            }
          } else {
            // Fallback name if we couldn't fetch details
            leadData.name = `Meta Lead ${leadgenId?.substring(0, 8) || 'Unknown'}`;
          }

          // Ensure name field exists
          if (!leadData.name) {
            leadData.name = `Meta Lead ${leadgenId?.substring(0, 8) || new Date().getTime()}`;
          }

          console.log('Inserting lead into', tableName, ':', JSON.stringify(leadData, null, 2));

          const { data: insertedLead, error: insertError } = await supabase
            .from(tableName)
            .insert(leadData)
            .select('id')
            .single();

          if (insertError) {
            console.error('Error inserting Meta lead:', insertError);

            // Try with minimal fields if full insert failed
            const minimalLead = {
              name: leadData.name,
              company_id: activeIntegration.company_id,
              created_by_id: adminId,
              sales_owner_id: adminId,
              status: activeIntegration.default_lead_status || 'new',
              lead_source: 'Meta Lead Ads',
              email: leadData.email || null,
              phone: leadData.phone || null,
            };

            const { error: retryError } = await supabase
              .from(tableName)
              .insert(minimalLead);

            if (retryError) {
              console.error('Retry insert also failed:', retryError);
            } else {
              console.log('Meta lead created with minimal fields');
            }
          } else {
            console.log('Meta lead created successfully:', insertedLead?.id);

            // Send notification to the owner/admin
            if (leadData.sales_owner_id) {
              await supabase
                .from('notifications')
                .insert({
                  user_id: leadData.sales_owner_id,
                  title: 'New Lead Received! 🚀',
                  message: `New lead "${leadData.name}" has been captured via Meta Ads.`,
                  type: 'info',
                  lead_id: insertedLead.id
                });

              // Send Web Push notification
              const _serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
              fetch(`${supabaseUrl}/functions/v1/send-web-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_serviceRoleKey}` },
                body: JSON.stringify({ user_id: leadData.sales_owner_id, title: 'New Lead Received! 🚀', body: `New lead "${leadData.name}" has been captured via Meta Ads.` }),
              }).catch(e => console.error('[Push] meta-lead-webhook:', e));
            }

            // Update campaign connection stats
            if (formId) {
              await supabase
                .from('marketing_campaign_connections')
                .update({
                  leads_received: supabase.rpc('increment_leads_received'),
                  updated_at: new Date().toISOString()
                })
                .eq('integration_id', activeIntegration.id)
                .eq('form_id', formId);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });

  } catch (error: unknown) {
    console.error('Meta webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
