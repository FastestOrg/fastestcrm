import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        // Auth with user token
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: userError } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''))
        if (userError || !user) throw new Error('Not authenticated')

        // Use service role for admin operations
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // Verify platform admin
        const { data: adminCheck, error: adminError } = await supabaseAdmin
            .from('platform_admins')
            .select('id')
            .eq('user_id', user.id)
            .single()

        if (adminError || !adminCheck) {
            throw new Error('Access denied. Platform admin privileges required.')
        }

        const body = await req.json()
        const { action } = body

        console.log(`Admin action: ${action}`, body)

        switch (action) {
            case 'add_wallet_credits': {
                const { company_id, amount, description } = body
                if (!company_id || !amount || amount <= 0) {
                    throw new Error('Invalid company_id or amount')
                }

                // Get current wallet
                const { data: wallet, error: walletError } = await supabaseAdmin
                    .from('wallets')
                    .select('balance')
                    .eq('company_id', company_id)
                    .single()

                if (walletError) {
                    // Create wallet if doesn't exist
                    await supabaseAdmin.from('wallets').insert({
                        company_id,
                        balance: amount,
                        currency: 'INR'
                    })
                } else {
                    // Update existing wallet
                    await supabaseAdmin
                        .from('wallets')
                        .update({
                            balance: Number(wallet.balance) + amount,
                            updated_at: new Date().toISOString()
                        })
                        .eq('company_id', company_id)
                }

                // Log transaction
                await supabaseAdmin.from('wallet_transactions').insert({
                    wallet_id: company_id,
                    amount: amount,
                    type: 'credit_recharge',
                    description: description || `Admin credit: ₹${amount}`,
                    status: 'success'
                })

                return new Response(
                    JSON.stringify({ success: true, message: `Added ₹${amount} to wallet` }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'edit_subscription': {
                const { company_id, subscription_valid_until, subscription_status, total_licenses } = body
                if (!company_id) throw new Error('company_id required')

                const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
                if (subscription_valid_until !== undefined) updates.subscription_valid_until = subscription_valid_until
                if (subscription_status !== undefined) updates.subscription_status = subscription_status
                if (total_licenses !== undefined) updates.total_licenses = total_licenses

                const { error } = await supabaseAdmin
                    .from('companies')
                    .update(updates)
                    .eq('id', company_id)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Subscription updated' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'toggle_active': {
                const { company_id, is_active } = body
                if (!company_id || is_active === undefined) throw new Error('company_id and is_active required')

                const { error } = await supabaseAdmin
                    .from('companies')
                    .update({ is_active, updated_at: new Date().toISOString() })
                    .eq('id', company_id)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: `Company ${is_active ? 'activated' : 'deactivated'}` }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'get_company_details': {
                const { company_id } = body
                if (!company_id) throw new Error('company_id required')

                // Get company
                const { data: company, error: companyError } = await supabaseAdmin
                    .from('companies')
                    .select('*')
                    .eq('id', company_id)
                    .single()

                if (companyError) throw companyError

                // Get wallet
                const { data: wallet } = await supabaseAdmin
                    .from('wallets')
                    .select('balance, currency')
                    .eq('company_id', company_id)
                    .single()

                // Get products
                const { data: products } = await supabaseAdmin
                    .from('products')
                    .select('*')
                    .eq('company_id', company_id)

                // Get leads count from the company's table
                const tableName = company.custom_leads_table || 'leads'
                let leadsCount = 0

                // Get lead count - try custom table first
                if (company.custom_leads_table) {
                    const { count } = await supabaseAdmin
                        .from(company.custom_leads_table)
                        .select('*', { count: 'exact', head: true })
                        .eq('company_id', company_id)
                    leadsCount = count || 0
                } else {
                    const { count } = await supabaseAdmin
                        .from('leads')
                        .select('*', { count: 'exact', head: true })
                        .eq('company_id', company_id)
                    leadsCount = count || 0
                }

                // Get team members
                const { data: profiles } = await supabaseAdmin
                    .from('profiles')
                    .select('id, full_name, email')
                    .eq('company_id', company_id)

                return new Response(
                    JSON.stringify({
                        company,
                        wallet: wallet || { balance: 0, currency: 'INR' },
                        products: products || [],
                        leads_count: leadsCount,
                        team_members: profiles || []
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'get_all_stats': {
                // Get all companies
                const { data: companies, error: companiesError } = await supabaseAdmin
                    .from('companies')
                    .select('id, name, slug, is_active, total_licenses, used_licenses, subscription_status, subscription_valid_until, created_at')

                if (companiesError) throw companiesError

                // Get all wallets
                const { data: wallets } = await supabaseAdmin
                    .from('wallets')
                    .select('company_id, balance')

                const walletMap = new Map()
                wallets?.forEach(w => walletMap.set(w.company_id, Number(w.balance)))

                // Calculate stats
                const totalCompanies = companies?.length || 0
                const activeCompanies = companies?.filter(c => c.is_active).length || 0
                const totalLicenses = companies?.reduce((acc, c) => acc + (c.total_licenses || 0), 0) || 0
                const usedLicenses = companies?.reduce((acc, c) => acc + (c.used_licenses || 0), 0) || 0
                const totalWalletBalance = wallets?.reduce((acc, w) => acc + Number(w.balance), 0) || 0

                // Expiring soon (within 7 days)
                const now = new Date()
                const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                const expiringSoon = companies?.filter(c => {
                    if (!c.subscription_valid_until) return false
                    const expiry = new Date(c.subscription_valid_until)
                    return expiry > now && expiry <= week
                }).length || 0

                return new Response(
                    JSON.stringify({
                        stats: {
                            totalCompanies,
                            activeCompanies,
                            inactiveCompanies: totalCompanies - activeCompanies,
                            totalLicenses,
                            usedLicenses,
                            availableLicenses: totalLicenses - usedLicenses,
                            totalWalletBalance,
                            expiringSoon
                        },
                        companies: companies?.map(c => ({
                            ...c,
                            wallet_balance: walletMap.get(c.id) || 0
                        }))
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'create_discount_code': {
                const { code, discount_percentage, total_uses, valid_until } = body
                if (!code || !discount_percentage) throw new Error('code and discount_percentage required')

                const { error } = await supabaseAdmin.from('discount_codes').insert({
                    code: code.toUpperCase(),
                    discount_percentage,
                    total_uses: total_uses || 1,
                    uses_count: 0,
                    valid_until: valid_until || null,
                    active: true
                })

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Discount code created' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'delete_discount_code': {
                const { code } = body
                if (!code) throw new Error('code required')

                const { error } = await supabaseAdmin
                    .from('discount_codes')
                    .delete()
                    .eq('code', code)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Discount code deleted' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'toggle_discount_code': {
                const { code, active } = body
                if (!code || active === undefined) throw new Error('code and active required')

                const { error } = await supabaseAdmin
                    .from('discount_codes')
                    .update({ active })
                    .eq('code', code)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: `Code ${active ? 'activated' : 'deactivated'}` }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'get_discount_codes': {
                const { data, error } = await supabaseAdmin
                    .from('discount_codes')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (error) throw error

                return new Response(
                    JSON.stringify({ codes: data || [] }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'create_gift_card': {
                const { code, amount, expires_at } = body
                if (!code || !amount) throw new Error('code and amount required')

                const { error } = await supabaseAdmin.from('gift_cards').insert({
                    code: code.toUpperCase(),
                    amount,
                    expires_at: expires_at || null,
                    active: true,
                    is_redeemed: false
                })

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Gift card created' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'create_bulk_gift_cards': {
                const { amount, count, expires_at } = body
                if (!amount || !count) throw new Error('amount and count required')

                const cards = []
                for (let i = 0; i < count; i++) {
                    const code = `GC${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
                    cards.push({
                        code,
                        amount,
                        expires_at: expires_at || null,
                        active: true,
                        is_redeemed: false
                    })
                }

                const { error } = await supabaseAdmin.from('gift_cards').insert(cards)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: `Created ${count} gift cards`, codes: cards.map(c => c.code) }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'delete_gift_card': {
                const { code } = body
                if (!code) throw new Error('code required')

                const { error } = await supabaseAdmin
                    .from('gift_cards')
                    .delete()
                    .eq('code', code)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Gift card deleted' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'get_gift_cards': {
                const { data, error } = await supabaseAdmin
                    .from('gift_cards')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (error) throw error

                return new Response(
                    JSON.stringify({ cards: data || [] }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'add_product': {
                const { company_id, name, category, price, quantity_available } = body
                if (!company_id || !name || !category) throw new Error('company_id, name, and category required')

                const { error } = await supabaseAdmin.from('products').insert({
                    company_id,
                    name,
                    category,
                    price: price || 0,
                    quantity_available: quantity_available || null
                })

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Product added' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'update_product': {
                const { product_id, name, category, price, quantity_available } = body
                if (!product_id) throw new Error('product_id required')

                const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
                if (name !== undefined) updates.name = name
                if (category !== undefined) updates.category = category
                if (price !== undefined) updates.price = price
                if (quantity_available !== undefined) updates.quantity_available = quantity_available

                const { error } = await supabaseAdmin
                    .from('products')
                    .update(updates)
                    .eq('id', product_id)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Product updated' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'delete_product': {
                const { product_id } = body
                if (!product_id) throw new Error('product_id required')

                const { error } = await supabaseAdmin
                    .from('products')
                    .delete()
                    .eq('id', product_id)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Product deleted' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'get_announcements': {
                const { data, error } = await supabaseAdmin
                    .from('announcements')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (error) throw error

                return new Response(
                    JSON.stringify({ announcements: data || [] }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'create_announcement': {
                const {
                    title, body: annBody, type, target_type,
                    target_company_ids, target_subscription_statuses, scheduled_at
                } = body

                if (!title?.trim() || !annBody?.trim()) throw new Error('title and body are required')
                if (!target_type) throw new Error('target_type is required')

                const { error } = await supabaseAdmin.from('announcements').insert({
                    title: title.trim(),
                    body: annBody.trim(),
                    type: type || 'info',
                    target_type,
                    target_company_ids: target_type === 'specific_companies' ? target_company_ids : null,
                    target_subscription_statuses: target_type === 'subscription_status' ? target_subscription_statuses : null,
                    scheduled_at: scheduled_at || null,
                    is_active: true,
                    created_by: user.id,
                })

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Announcement created' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'update_announcement': {
                const {
                    announcement_id, title, body: annBody, type, target_type,
                    target_company_ids, target_subscription_statuses, scheduled_at, is_active
                } = body

                if (!announcement_id) throw new Error('announcement_id is required')

                const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
                if (title !== undefined) updates.title = title.trim()
                if (annBody !== undefined) updates.body = annBody.trim()
                if (type !== undefined) updates.type = type
                if (target_type !== undefined) {
                    updates.target_type = target_type
                    updates.target_company_ids = target_type === 'specific_companies' ? target_company_ids : null
                    updates.target_subscription_statuses = target_type === 'subscription_status' ? target_subscription_statuses : null
                }
                if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at || null
                if (is_active !== undefined) updates.is_active = is_active

                const { error } = await supabaseAdmin
                    .from('announcements')
                    .update(updates)
                    .eq('id', announcement_id)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Announcement updated' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'toggle_announcement': {
                const { announcement_id, is_active } = body
                if (!announcement_id || is_active === undefined) throw new Error('announcement_id and is_active required')

                const { error } = await supabaseAdmin
                    .from('announcements')
                    .update({ is_active, updated_at: new Date().toISOString() })
                    .eq('id', announcement_id)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: `Announcement ${is_active ? 'activated' : 'deactivated'}` }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'delete_announcement': {
                const { announcement_id } = body
                if (!announcement_id) throw new Error('announcement_id required')

                const { error } = await supabaseAdmin
                    .from('announcements')
                    .delete()
                    .eq('id', announcement_id)

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Announcement deleted' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'get_company_users': {
                const { company_id } = body
                if (!company_id) throw new Error('company_id required')

                // Fetch all profiles for this company (including manager info)
                const { data: profiles, error: profilesError } = await supabaseAdmin
                    .from('profiles')
                    .select('id, email, full_name, phone, manager_id, created_at')
                    .eq('company_id', company_id)

                if (profilesError) throw profilesError

                // Fetch roles for these users
                const profileIds = (profiles || []).map((p: any) => p.id)
                const { data: roles } = await supabaseAdmin
                    .from('user_roles')
                    .select('user_id, role')
                    .in('user_id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000'])

                const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]))

                // Fetch last_sign_in_at from auth.users (service role only)
                const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
                const authMap = new Map(
                    (authUsers?.users || [])
                        .filter((u: any) => profileIds.includes(u.id))
                        .map((u: any) => [u.id, u.last_sign_in_at])
                )

                // Build manager name map
                const managerNameMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || p.email]))

                const users = (profiles || []).map((p: any) => ({
                    id: p.id,
                    email: p.email,
                    full_name: p.full_name,
                    phone: p.phone,
                    role: roleMap.get(p.id) || 'bde',
                    manager_id: p.manager_id,
                    manager_name: p.manager_id ? (managerNameMap.get(p.manager_id) || null) : null,
                    last_sign_in_at: authMap.get(p.id) || null,
                    created_at: p.created_at,
                }))

                return new Response(
                    JSON.stringify({ users }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'delete_company_user': {
                const { user_id: targetUserId } = body
                if (!targetUserId) throw new Error('user_id required')

                // Prevent self-deletion
                if (targetUserId === user.id) throw new Error('Cannot delete your own account')

                // 0. Fetch profile to know company_id
                const { data: targetProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('id, company_id')
                    .eq('id', targetUserId)
                    .maybeSingle()

                const companyId = targetProfile?.company_id

                // 1. Orphan subordinates — set manager_id null (they keep all their data)
                await supabaseAdmin
                    .from('profiles')
                    .update({ manager_id: null })
                    .eq('manager_id', targetUserId)

                // 2. Nullify NULLABLE lead ownership references (preserve the leads)
                await supabaseAdmin.from('leads').update({ pre_sales_owner_id: null }).eq('pre_sales_owner_id', targetUserId)
                await supabaseAdmin.from('leads').update({ sales_owner_id: null }).eq('sales_owner_id', targetUserId)
                await supabaseAdmin.from('leads').update({ post_sales_owner_id: null }).eq('post_sales_owner_id', targetUserId)

                // 3. Reassign leads.created_by_id (NOT NULL) → another company user, so leads survive
                if (companyId) {
                    const { data: fallback } = await supabaseAdmin
                        .from('profiles')
                        .select('id')
                        .eq('company_id', companyId)
                        .neq('id', targetUserId)
                        .limit(1)
                        .maybeSingle()

                    if (fallback?.id) {
                        await supabaseAdmin
                            .from('leads')
                            .update({ created_by_id: fallback.id })
                            .eq('created_by_id', targetUserId)
                    }
                }

                // 4. Delete form definitions created by this user (forms.created_by_id is NOT NULL)
                //    Form submission data is preserved
                await supabaseAdmin.from('forms').delete().eq('created_by_id', targetUserId)

                // 5. Clean up other records
                try { await supabaseAdmin.from('automations').delete().eq('created_by_id', targetUserId) } catch (_) { }
                try { await supabaseAdmin.from('task_leads').delete().eq('user_id', targetUserId) } catch (_) { }
                try { await supabaseAdmin.from('announcement_reads').delete().eq('user_id', targetUserId) } catch (_) { }

                // 6. Delete user_roles
                await supabaseAdmin.from('user_roles').delete().eq('user_id', targetUserId)

                // 7. Delete auth user — cascades to profiles (ON DELETE CASCADE)
                const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)
                if (deleteError) throw deleteError

                return new Response(
                    JSON.stringify({ success: true, message: 'User deleted successfully' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }


            case 'force_password_reset': {
                const { user_email } = body
                if (!user_email) throw new Error('user_email required')

                const { data, error } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'recovery',
                    email: user_email,
                })

                if (error) throw error

                return new Response(
                    JSON.stringify({ success: true, message: 'Password reset link generated', link: data?.properties?.action_link }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'delete_company': {
                const { company_id } = body
                if (!company_id) throw new Error('company_id required')

                // 1. Collect all user IDs in this company
                const { data: companyProfiles } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('company_id', company_id)
                const userIds = (companyProfiles || []).map((p: any) => p.id)

                // 2. Delete leads (has company_id FK)
                await supabaseAdmin.from('leads').delete().eq('company_id', company_id)

                // 3. Delete form_submissions if exists (may have company_id)
                try {
                    await supabaseAdmin.from('form_submissions').delete().eq('company_id', company_id)
                } catch (_) { /* table may not exist */ }

                // 4. Delete wallet transactions before wallets
                const { data: walletRow } = await supabaseAdmin
                    .from('wallets')
                    .select('id')
                    .eq('company_id', company_id)
                    .maybeSingle()

                if (walletRow?.id) {
                    await supabaseAdmin.from('wallet_transactions').delete().eq('wallet_id', walletRow.id)
                    await supabaseAdmin.from('wallets').delete().eq('id', walletRow.id)
                }

                // 5. Delete other company-scoped tables
                for (const table of ['automations', 'products', 'programs', 'api_keys', 'announcements']) {
                    try {
                        await (supabaseAdmin.from(table as any) as any).delete().eq('company_id', company_id)
                    } catch (_) { /* ignore if table doesn't have company_id */ }
                }

                // 6. Delete user_roles then auth users (cascades to profiles)
                if (userIds.length > 0) {
                    await supabaseAdmin.from('user_roles').delete().in('user_id', userIds)
                    await Promise.allSettled(
                        userIds.map((id: string) => supabaseAdmin.auth.admin.deleteUser(id))
                    )
                }

                // 7. Finally delete the company row itself
                const { error: companyError } = await supabaseAdmin
                    .from('companies')
                    .delete()
                    .eq('id', company_id)

                if (companyError) throw companyError

                return new Response(
                    JSON.stringify({ success: true, message: 'Company and all data deleted' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            case 'get_analytics': {


                const now = new Date()

                // ── 1. Companies & wallets ──────────────────────────────
                const { data: companies, error: companiesError } = await supabaseAdmin
                    .from('companies')
                    .select('id, name, slug, is_active, total_licenses, used_licenses, subscription_status, subscription_valid_until, created_at')

                if (companiesError) throw companiesError

                const { data: wallets } = await supabaseAdmin
                    .from('wallets')
                    .select('company_id, balance')

                const walletBalanceMap = new Map<string, number>()
                wallets?.forEach(w => walletBalanceMap.set(w.company_id, Number(w.balance)))

                // ── 2. MRR / Company Growth (last 12 months) ───────────
                // Group companies by the month they were created
                const mrrTrend: Record<string, { month: string; newCompanies: number; activeCompanies: number; estimatedMRR: number }> = {}
                for (let i = 11; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    mrrTrend[key] = {
                        month: key,
                        newCompanies: 0,
                        activeCompanies: 0,
                        estimatedMRR: 0,
                    }
                }

                // Count active subscriptions per month (snapshot: companies active at that month's end)
                companies?.forEach(c => {
                    const created = new Date(c.created_at)
                    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`
                    if (mrrTrend[key]) {
                        mrrTrend[key].newCompanies += 1
                    }
                })

                // Estimate MRR: count companies with active subscription by month
                // We approximate: if a company is active today, it contributes to current month MRR
                // For historical, we count companies created before or during each month that are active
                const MRR_PER_COMPANY = 2999 // ₹2999/month base rate estimate
                Object.keys(mrrTrend).forEach(monthKey => {
                    const monthDate = new Date(monthKey + '-01')
                    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
                    const activeCount = companies?.filter(c => {
                        const created = new Date(c.created_at)
                        return created <= monthEnd && c.subscription_status === 'active'
                    }).length || 0
                    mrrTrend[monthKey].activeCompanies = activeCount
                    mrrTrend[monthKey].estimatedMRR = activeCount * MRR_PER_COMPANY
                })

                const mrrTrendArray = Object.values(mrrTrend)

                // ── 3. Wallet Top-Up History (last 6 months) ───────────
                const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
                const { data: transactions } = await supabaseAdmin
                    .from('wallet_transactions')
                    .select('wallet_id, amount, type, created_at')
                    .gte('created_at', sixMonthsAgo.toISOString())
                    .eq('status', 'success')
                    .in('type', ['credit_recharge', 'credit_gift_card'])

                const walletTopupMap: Record<string, { month: string; totalRecharge: number; count: number }> = {}
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    walletTopupMap[key] = { month: key, totalRecharge: 0, count: 0 }
                }

                transactions?.forEach(t => {
                    const d = new Date(t.created_at)
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    if (walletTopupMap[key]) {
                        walletTopupMap[key].totalRecharge += Number(t.amount)
                        walletTopupMap[key].count += 1
                    }
                })

                const walletTopupHistory = Object.values(walletTopupMap)

                // ── 4. Lead Activity (last 12 weeks by week) ──────────
                const twelveWeeksAgo = new Date(now)
                twelveWeeksAgo.setDate(now.getDate() - 84) // 12 * 7

                const { data: leadActivity } = await supabaseAdmin
                    .from('leads')
                    .select('company_id, created_at')
                    .gte('created_at', twelveWeeksAgo.toISOString())

                // Group by ISO week (YYYY-Www) and company_id
                const leadHeatmapMap: Record<string, Record<string, number>> = {} // weekKey -> companyId -> count
                leadActivity?.forEach(lead => {
                    const d = new Date(lead.created_at)
                    // Get ISO week number
                    const startOfYear = new Date(d.getFullYear(), 0, 1)
                    const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
                    const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
                    if (!leadHeatmapMap[weekKey]) leadHeatmapMap[weekKey] = {}
                    leadHeatmapMap[weekKey][lead.company_id] = (leadHeatmapMap[weekKey][lead.company_id] || 0) + 1
                })

                // Build flat array for heatmap
                const leadHeatmapData: { week: string; companyId: string; companyName: string; count: number }[] = []
                const companyNameMap = new Map<string, string>(companies?.map(c => [c.id, c.name]) || [])
                Object.entries(leadHeatmapMap).forEach(([week, byCompany]) => {
                    Object.entries(byCompany).forEach(([companyId, count]) => {
                        leadHeatmapData.push({
                            week,
                            companyId,
                            companyName: companyNameMap.get(companyId) || companyId,
                            count,
                        })
                    })
                })
                leadHeatmapData.sort((a, b) => a.week.localeCompare(b.week))

                // Total leads last 30 days
                const thirtyDaysAgo = new Date(now)
                thirtyDaysAgo.setDate(now.getDate() - 30)
                const { count: leadsLast30 } = await supabaseAdmin
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', thirtyDaysAgo.toISOString())

                // ── 5. Churn Risk Companies ────────────────────────────
                const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
                const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

                // Get last transaction date per company
                const { data: lastTransactions } = await supabaseAdmin
                    .from('wallet_transactions')
                    .select('wallet_id, created_at')
                    .order('created_at', { ascending: false })

                const lastTransactionMap = new Map<string, Date>()
                lastTransactions?.forEach(t => {
                    if (!lastTransactionMap.has(t.wallet_id)) {
                        lastTransactionMap.set(t.wallet_id, new Date(t.created_at))
                    }
                })

                const churnRiskCompanies = companies?.filter(c => {
                    // Expiring within 30 days
                    if (c.subscription_valid_until) {
                        const expiry = new Date(c.subscription_valid_until)
                        if (expiry > now && expiry <= thirtyDaysFromNow) return true
                    }
                    // Past due
                    if (c.subscription_status === 'past_due') return true
                    // No active users (used_licenses === 0)
                    if (c.is_active && c.used_licenses === 0) return true
                    // No wallet activity in 60 days
                    const lastTx = lastTransactionMap.get(c.id)
                    if (!lastTx || lastTx < sixtyDaysAgo) return true
                    return false
                }).map(c => {
                    const risks: string[] = []
                    if (c.subscription_valid_until) {
                        const expiry = new Date(c.subscription_valid_until)
                        if (expiry > now && expiry <= thirtyDaysFromNow) {
                            const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
                            risks.push(`Expiring in ${daysLeft}d`)
                        }
                    }
                    if (c.subscription_status === 'past_due') risks.push('Past Due')
                    if (c.is_active && c.used_licenses === 0) risks.push('No Active Users')
                    const lastTx = lastTransactionMap.get(c.id)
                    if (!lastTx || lastTx < sixtyDaysAgo) risks.push('No Wallet Activity')
                    return {
                        id: c.id,
                        name: c.name,
                        slug: c.slug,
                        subscription_status: c.subscription_status,
                        subscription_valid_until: c.subscription_valid_until,
                        used_licenses: c.used_licenses,
                        total_licenses: c.total_licenses,
                        wallet_balance: walletBalanceMap.get(c.id) || 0,
                        risks,
                    }
                }) || []

                // ── 6. Top-level KPIs ──────────────────────────────────
                const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                const currentMRR = mrrTrend[currentMonthKey]?.estimatedMRR || 0
                const activeSubscriptions = companies?.filter(c => c.subscription_status === 'active').length || 0
                const rechargeRevenueLast30d = transactions?.filter(t => {
                    return new Date(t.created_at) >= thirtyDaysAgo
                }).reduce((acc, t) => acc + Number(t.amount), 0) || 0

                return new Response(
                    JSON.stringify({
                        kpis: {
                            estimatedMRR: currentMRR,
                            activeSubscriptions,
                            rechargeRevenueLast30d,
                            leadsLast30d: leadsLast30 || 0,
                        },
                        mrrTrend: mrrTrendArray,
                        walletTopupHistory,
                        leadHeatmapData,
                        churnRiskCompanies,
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            default:
                throw new Error(`Unknown action: ${action}`)
        }

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
