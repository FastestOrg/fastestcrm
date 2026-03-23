import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";




interface DnsRecord {
  type: string;
  name: string;
  data: string;
}

// Vercel API Helper Functions
interface VercelDomainConfig {
  type: string;
  domain: string;
  value: string;
}

async function addDomainToVercel(domain: string): Promise<{
  success: boolean;
  error?: string;
  verificationRecord?: VercelDomainConfig;
}> {
  try {
    const vercelToken = Deno.env.get('VERCEL_API_TOKEN');
    const projectId = Deno.env.get('VERCEL_PROJECT_ID');

    if (!vercelToken || !projectId) {
      console.error('Missing Vercel API credentials');
      return { success: false, error: 'Vercel API not configured' };
    }

    const response = await fetch(
      `https://api.vercel.com/v10/projects/${projectId}/domains`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Domain might already exist, check its status
      if (response.status === 409 || data.error?.code === 'domain_already_in_use') {
        console.log(`Domain ${domain} already exists in Vercel project, fetching verification info...`);
        // Fetch the existing domain configuration
        const domainInfo = await getVercelDomainConfig(domain);
        return { success: true, verificationRecord: domainInfo?.verificationRecord };
      }
      console.error('Vercel API error:', data);
      return { success: false, error: data.error?.message || 'Failed to add domain to Vercel' };
    }

    console.log(`Successfully added domain ${domain} to Vercel project`);

    // Extract verification record from response
    const verificationRecord = data.verification?.find((v: any) => v.type === 'TXT');

    return {
      success: true,
      verificationRecord: verificationRecord ? {
        type: 'TXT',
        domain: verificationRecord.domain || '_vercel',
        value: verificationRecord.value || ''
      } : undefined
    };
  } catch (error) {
    console.error('Error adding domain to Vercel:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function getVercelDomainConfig(domain: string): Promise<{
  verified: boolean;
  verificationRecord?: VercelDomainConfig;
} | null> {
  try {
    const vercelToken = Deno.env.get('VERCEL_API_TOKEN');
    const projectId = Deno.env.get('VERCEL_PROJECT_ID');

    if (!vercelToken || !projectId) {
      return null;
    }

    const response = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}/config`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Extract TXT verification record
    const txtRecord = data.verification?.find((v: any) => v.type === 'TXT');

    return {
      verified: data.verified || false,
      verificationRecord: txtRecord ? {
        type: 'TXT',
        domain: txtRecord.domain || '_vercel',
        value: txtRecord.value || ''
      } : undefined
    };
  } catch (error) {
    console.error('Error fetching Vercel domain config:', error);
    return null;
  }
}

async function removeDomainFromVercel(domain: string): Promise<{ success: boolean; error?: string }> {
  try {
    const vercelToken = Deno.env.get('VERCEL_API_TOKEN');
    const projectId = Deno.env.get('VERCEL_PROJECT_ID');

    if (!vercelToken || !projectId) {
      console.error('Missing Vercel API credentials');
      return { success: false, error: 'Vercel API not configured' };
    }

    const response = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const data = await response.json();
      console.error('Vercel API error:', data);
      return { success: false, error: data.error?.message || 'Failed to remove domain from Vercel' };
    }

    console.log(`Successfully removed domain ${domain} from Vercel project`);
    return { success: true };
  } catch (error) {
    console.error('Error removing domain from Vercel:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function checkVercelDomainStatus(domain: string): Promise<{ verified: boolean; error?: string }> {
  try {
    const vercelToken = Deno.env.get('VERCEL_API_TOKEN');
    const projectId = Deno.env.get('VERCEL_PROJECT_ID');

    if (!vercelToken || !projectId) {
      return { verified: false, error: 'Vercel API not configured' };
    }

    const response = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
        },
      }
    );

    if (!response.ok) {
      return { verified: false };
    }

    const data = await response.json();
    // Vercel considers a domain verified if it's successfully configured
    return { verified: data.verified || false };
  } catch (error) {
    console.error('Error checking Vercel domain status:', error);
    return { verified: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function checkDnsRecords(domain: string): Promise<{ valid: boolean; records: DnsRecord[]; error?: string }> {
  try {
    // Use Cloudflare's DNS-over-HTTPS API to check CNAME records
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=CNAME`,
      {
        headers: {
          'Accept': 'application/dns-json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('DNS lookup failed');
    }

    const data = await response.json();
    console.log(`DNS lookup for ${domain}:`, JSON.stringify(data, null, 2));

    const records: DnsRecord[] = [];

    if (data.Answer && Array.isArray(data.Answer)) {
      for (const answer of data.Answer) {
        records.push({
          type: 'CNAME',
          name: answer.name,
          data: answer.data?.replace(/\.$/, '') || '', // Remove trailing dot
        });
      }
    }

    // Check if any CNAME points to dns.fastestcrm.com
    const validTargets = ['dns.fastestcrm.com'];
    const isValid = records.some(record =>
      validTargets.some(target =>
        record.data.toLowerCase() === target.toLowerCase() ||
        record.data.toLowerCase().endsWith('.' + target.toLowerCase())
      )
    );

    // If no CNAME found, also check A records (in case they pointed directly)
    if (records.length === 0) {
      const aResponse = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
        {
          headers: {
            'Accept': 'application/dns-json',
          },
        }
      );

      if (aResponse.ok) {
        const aData = await aResponse.json();
        console.log(`A record lookup for ${domain}:`, JSON.stringify(aData, null, 2));

        if (aData.Answer && Array.isArray(aData.Answer)) {
          for (const answer of aData.Answer) {
            records.push({
              type: 'A',
              name: answer.name,
              data: answer.data || '',
            });
          }
        }
      }
    }

    return { valid: isValid, records };
  } catch (error) {
    console.error('DNS check error:', error);
    return {
      valid: false,
      records: [],
      error: error instanceof Error ? error.message : 'DNS lookup failed'
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, domain, company_id } = await req.json();
    console.log(`Verify domain action: ${action}, domain: ${domain}, company_id: ${company_id}`);

    // Verify user owns this company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, admin_id, custom_domain, domain_status')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (company.admin_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You are not authorized to manage this company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'check') {
      // Check DNS records for the domain
      if (!domain) {
        return new Response(
          JSON.stringify({ error: 'Domain is required' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const dnsResult = await checkDnsRecords(domain);

      // Update domain status based on DNS check
      const newStatus = dnsResult.valid ? 'active' : 'pending';

      if (company.custom_domain === domain) {
        await supabase
          .from('companies')
          .update({ domain_status: newStatus })
          .eq('id', company_id);
      }

      // Retrieve TXT verification record from database
      const { data: verificationData } = await supabase
        .from('domain_verification')
        .select('txt_record_name, txt_record_value, is_verified')
        .eq('company_id', company_id)
        .eq('domain', domain.toLowerCase())
        .maybeSingle();

      const vercelTxtRecord = verificationData ? {
        type: 'TXT',
        domain: verificationData.txt_record_name,
        value: verificationData.txt_record_value
      } : null;

      return new Response(
        JSON.stringify({
          success: true,
          domain,
          valid: dnsResult.valid,
          records: dnsResult.records,
          status: newStatus,
          error: dnsResult.error,
          vercelTxtRecord, // Include TXT record from database
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'save') {
      // Save custom domain and set to pending
      if (!domain) {
        // Removing custom domain
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            custom_domain: null,
            domain_status: null
          })
          .eq('id', company_id);

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({ success: true, message: 'Custom domain removed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate domain format
      const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(domain)) {
        return new Response(
          JSON.stringify({ error: 'Invalid domain format' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if domain is already in use by another company
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('custom_domain', domain)
        .neq('id', company_id)
        .maybeSingle();

      if (existingCompany) {
        return new Response(
          JSON.stringify({ error: 'This domain is already in use by another company' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check DNS immediately
      const dnsResult = await checkDnsRecords(domain);
      const initialStatus = dnsResult.valid ? 'active' : 'pending';

      // Add domain to Vercel project
      console.log(`Attempting to add domain ${domain} to Vercel project...`);
      const vercelResult = await addDomainToVercel(domain);

      if (!vercelResult.success) {
        console.error(`Failed to add domain to Vercel: ${vercelResult.error}`);
        return new Response(
          JSON.stringify({
            error: `Failed to register domain with hosting provider: ${vercelResult.error}. Please contact support.`
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Save TXT verification record to database if available
      if (vercelResult.verificationRecord) {
        const { error: verifyError } = await supabase
          .from('domain_verification')
          .upsert({
            company_id: company_id,
            domain: domain.toLowerCase(),
            txt_record_name: vercelResult.verificationRecord.domain,
            txt_record_value: vercelResult.verificationRecord.value,
            is_verified: false,
          }, {
            onConflict: 'company_id,domain'
          });

        if (verifyError) {
          console.error('Error saving TXT record:', verifyError);
          // Don't fail the whole operation if just TXT record save fails
        }
      }

      // Save the domain
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          custom_domain: domain.toLowerCase(),
          domain_status: initialStatus
        })
        .eq('id', company_id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          message: dnsResult.valid
            ? 'Domain verified and activated!'
            : 'Domain saved and registered. Please configure DNS and TXT records.',
          status: initialStatus,
          dnsValid: dnsResult.valid,
          records: dnsResult.records,
          vercelTxtRecord: vercelResult.verificationRecord, // Include TXT record for UI display
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'remove') {
      // Remove custom domain from Vercel first
      if (company.custom_domain) {
        console.log(`Attempting to remove domain ${company.custom_domain} from Vercel project...`);
        const vercelResult = await removeDomainFromVercel(company.custom_domain);

        if (!vercelResult.success) {
          console.warn(`Failed to remove domain from Vercel: ${vercelResult.error}`);
          // Continue anyway - we still want to remove from our database
        }
      }

      // Remove custom domain from database
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          custom_domain: null,
          domain_status: null
        })
        .eq('id', company_id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, message: 'Custom domain removed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Verify domain error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
