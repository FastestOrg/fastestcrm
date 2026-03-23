import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RegisterRequest {
  companyName: string;
  industry: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const body: RegisterRequest = await req.json()
    const { companyName, industry, adminEmail, adminPassword, adminFullName } = body

    // Validation
    if (!companyName || companyName.trim().length < 2) {
      throw new Error('Company name must be at least 2 characters')
    }
    if (!industry || industry.trim().length === 0) {
      throw new Error('Industry is required')
    }
    if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      throw new Error('Please enter a valid email address')
    }
    if (!adminPassword || adminPassword.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }
    if (!adminFullName || adminFullName.trim().length < 2) {
      throw new Error('Full name must be at least 2 characters')
    }

    console.log('Registering company:', companyName, 'for admin:', adminEmail)

    // Generate unique slug
    let slug = generateSlug(companyName)
    let slugSuffix = 0
    let slugExists = true

    while (slugExists) {
      const testSlug = slugSuffix > 0 ? `${slug}-${slugSuffix}` : slug
      const { data: existing } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('slug', testSlug)
        .single()

      if (!existing) {
        slug = testSlug
        slugExists = false
      } else {
        slugSuffix++
      }
    }

    // Create the admin user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminFullName, role: 'company' }
    })

    if (userError) {
      console.error('Error creating user:', userError)
      throw new Error(userError.message)
    }

    const userId = userData.user.id
    console.log('Created user:', userId)

    // Create the company
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        admin_id: userId,
        name: companyName.trim(),
        industry: industry,
        industry_locked: true,
        slug: slug,
        total_licenses: 1,
        used_licenses: 1,
        is_active: true
      })
      .select()
      .single()

    if (companyError) {
      console.error('Error creating company:', companyError)
      // Rollback: delete the user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      throw new Error('Failed to create company: ' + companyError.message)
    }

    console.log('Created company:', companyData.id)

    // Update the profile with company_id
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_id: companyData.id,
        full_name: adminFullName.trim(),
        email: adminEmail
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating profile:', profileError)
    }

    // Assign 'company' role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: 'company'
      }, { onConflict: 'user_id' })

    if (roleError) {
      console.error('Error assigning role:', roleError)
    }

    console.log('Company registration complete')

    return new Response(
      JSON.stringify({
        success: true,
        company: {
          id: companyData.id,
          name: companyData.name,
          slug: companyData.slug
        },
        user: {
          id: userId,
          email: adminEmail
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Registration error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
