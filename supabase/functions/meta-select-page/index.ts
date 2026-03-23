import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




serve(async (req) => {
  console.log('meta-select-page: Request received', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    console.log('meta-select-page: Request body:', JSON.stringify(body));
    
    const { companyId, pageId, pageName } = body;

    if (!companyId || !pageId || !pageName) {
      console.error('meta-select-page: Missing required parameters', { companyId: !!companyId, pageId: !!pageId, pageName: !!pageName });
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the integration with user access token
    console.log('meta-select-page: Looking up integration for company', companyId);
    const { data: integration, error: fetchError } = await supabase
      .from('performance_marketing_integrations')
      .select('*')
      .eq('company_id', companyId)
      .eq('platform', 'meta')
      .maybeSingle();

    console.log('meta-select-page: Integration lookup result', { 
      found: !!integration, 
      integrationId: integration?.id,
      hasAccessToken: !!integration?.access_token,
      tokenLength: integration?.access_token?.length,
      error: fetchError 
    });

    if (fetchError) {
      console.error('meta-select-page: Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Database error: ' + fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!integration) {
      console.error('meta-select-page: Integration not found for company', companyId);
      return new Response(JSON.stringify({ error: 'Integration not found. Please login with Facebook first.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userAccessToken = integration.access_token;
    if (!userAccessToken) {
      console.error('meta-select-page: No access token in integration');
      return new Response(JSON.stringify({ error: 'No access token found. Please reconnect to Facebook.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get page access token (long-lived page token)
    console.log('meta-select-page: Fetching page access token for page:', pageId);
    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    console.log('meta-select-page: Pages API response status:', pagesResponse.status);

    if (pagesData.error) {
      console.error('meta-select-page: Error fetching pages:', pagesData.error);
      return new Response(JSON.stringify({ error: pagesData.error.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('meta-select-page: Found', pagesData.data?.length || 0, 'pages');

    const selectedPage = pagesData.data?.find((p: any) => p.id === pageId);
    if (!selectedPage) {
      console.error('meta-select-page: Page not found in response. Available pages:', pagesData.data?.map((p: any) => p.id));
      return new Response(JSON.stringify({ error: 'Page not found or no access' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Page access tokens obtained via /me/accounts are already long-lived (no expiry)
    // when the user token is a long-lived token
    const pageAccessToken = selectedPage.access_token;
    console.log('meta-select-page: Got page access token, length:', pageAccessToken?.length);

    if (!pageAccessToken) {
      console.error('meta-select-page: No page access token returned from Meta');
      return new Response(JSON.stringify({ error: 'Failed to get page access token from Meta' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Subscribe to page webhooks for leadgen
    console.log('meta-select-page: Subscribing to leadgen webhook...');
    const subscribeUrl = `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`;
    const subscribeResponse = await fetch(subscribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscribed_fields: ['leadgen'],
        access_token: pageAccessToken
      })
    });

    const subscribeData = await subscribeResponse.json();
    console.log('meta-select-page: Subscribe response:', JSON.stringify(subscribeData));

    if (subscribeData.error) {
      console.warn('meta-select-page: Webhook subscription warning:', subscribeData.error);
      // Continue anyway - might need app review
    }

    // Generate verify token for webhook
    const verifyToken = 'fastestcrm_meta_verify_2024';

    // Calculate token expiry - page tokens from long-lived user tokens don't expire,
    // but we'll set a far future date for tracking
    const tokenExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year

    // Update integration with page info AND page access token
    console.log('meta-select-page: Updating integration record with page token...');
    const { data: updateData, error: updateError } = await supabase
      .from('performance_marketing_integrations')
      .update({
        page_id: pageId,
        page_name: pageName,
        access_token: pageAccessToken, // Store page access token (long-lived)
        token_expires_at: tokenExpiresAt,
        webhook_verify_token: verifyToken,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', integration.id)
      .select();

    console.log('meta-select-page: Update result', { data: updateData, error: updateError });

    if (updateError) {
      console.error('meta-select-page: Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update integration: ' + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CRITICAL: Verify the page token was actually saved
    console.log('meta-select-page: Verifying update was persisted...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('performance_marketing_integrations')
      .select('id, access_token, page_id, page_name')
      .eq('id', integration.id)
      .single();

    console.log('meta-select-page: Verification result', {
      found: !!verifyData,
      hasAccessToken: !!verifyData?.access_token,
      tokenLength: verifyData?.access_token?.length,
      pageId: verifyData?.page_id,
      pageName: verifyData?.page_name,
      verifyError
    });

    if (!verifyData || !verifyData.access_token || verifyData.access_token.length < 50) {
      console.error('meta-select-page: CRITICAL - Page token not saved correctly!');
      return new Response(JSON.stringify({ error: 'Failed to save page access token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (verifyData.page_id !== pageId) {
      console.error('meta-select-page: CRITICAL - Page ID mismatch!', { expected: pageId, actual: verifyData.page_id });
      return new Response(JSON.stringify({ error: 'Failed to save page selection' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('meta-select-page: SUCCESS - Integration updated with page token');

    // Build webhook URL
    const webhookUrl = `${supabaseUrl}/functions/v1/meta-lead-webhook`;

    const response = { 
      success: true,
      pageName,
      webhookUrl,
      verifyToken,
      subscriptionSuccess: !subscribeData.error,
      message: 'Page connected successfully! Lead forms on this page will now sync to your CRM.'
    };
    
    console.log('meta-select-page: Sending success response');
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('meta-select-page: Caught error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
