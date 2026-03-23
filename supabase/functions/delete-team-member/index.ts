import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get requesting user
    const { data: { user: requester }, error: userError } = await supabaseAuth.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''));
    if (userError || !requester) {
      throw new Error("Unauthorized");
    }

    const { targetUserId, reassignToId = null } = await req.json();
    if (!targetUserId) {
      throw new Error("Missing targetUserId");
    }

    // Prevent self-deletion
    if (targetUserId === requester.id) {
      throw new Error("You cannot delete yourself");
    }

    // Prevent circular reassignment
    if (targetUserId === reassignToId) {
      throw new Error("You cannot reassign leads/forms to the user being deleted");
    }

    // Fetch requester info and target info in parallel
    const [requesterRoleResult, targetProfileResult] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", requester.id).maybeSingle(),
      supabaseAdmin.from("profiles").select("id, company_id, manager_id").eq("id", targetUserId).maybeSingle()
    ]);

    const requesterRole = requesterRoleResult.data?.role;
    const targetProfile = targetProfileResult.data;

    if (!targetProfile) {
      throw new Error("Target user not found");
    }

    // Check if requester is company admin or in hierarchy above target
    const ROLE_LEVELS: Record<string, number> = {
      company: 1, company_subadmin: 2, level_3: 3, level_4: 4, level_5: 5,
      level_6: 6, level_7: 7, level_8: 8, level_9: 9, level_10: 10,
      level_11: 11, level_12: 12, level_13: 13, level_14: 14, level_15: 15,
      level_16: 16, level_17: 17, level_18: 18, level_19: 19, level_20: 20,
      cbo: 3, vp: 4, avp: 5, dgm: 6, agm: 7, sm: 8, tl: 9, bde: 10, intern: 11, ca: 12
    };

    // Simple permission: Only company admins can delete, or managers can delete their direct/indirect reports
    const requesterLevel = ROLE_LEVELS[requesterRole || ''] ?? 99;

    // Get target's role
    const { data: targetRoleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const targetLevel = ROLE_LEVELS[targetRoleData?.role || ''] ?? 99;

    // Only allow deletion if requester has higher authority
    if (requesterLevel >= targetLevel) {
      throw new Error("You can only delete team members below your level");
    }

    // Determine the fallback ID for mandatory fields (like created_by_id) when reassignToId is null
    const mandatoryReassignId = reassignToId || requester.id;
    const errors: string[] = [];

    // ========================================================
    // GROUP 1: Reassign leads across ALL industry tables
    // Leads are NEVER deleted — only reassigned.
    // created_by_id is NOT NULL so uses mandatoryReassignId;
    // owner columns are nullable so use reassignToId (may be null).
    // ========================================================
    const leadTables = [
      "leads",
      "leads_healthcare",
      "leads_insurance",
      "leads_real_estate",
      "leads_saas",
      "leads_travel",
    ];

    for (const table of leadTables) {
      // created_by_id (NOT NULL — must have a value)
      const { error: e1 } = await supabaseAdmin
        .from(table)
        .update({ created_by_id: mandatoryReassignId })
        .eq("created_by_id", targetUserId);
      if (e1) { console.error(`[${table}] created_by_id:`, e1.message); errors.push(`${table}.created_by_id`); }

      // sales_owner_id (nullable)
      const { error: e2 } = await supabaseAdmin
        .from(table)
        .update({ sales_owner_id: reassignToId })
        .eq("sales_owner_id", targetUserId);
      if (e2) { console.error(`[${table}] sales_owner_id:`, e2.message); errors.push(`${table}.sales_owner_id`); }

      // pre_sales_owner_id (nullable)
      const { error: e3 } = await supabaseAdmin
        .from(table)
        .update({ pre_sales_owner_id: reassignToId })
        .eq("pre_sales_owner_id", targetUserId);
      if (e3) { console.error(`[${table}] pre_sales_owner_id:`, e3.message); errors.push(`${table}.pre_sales_owner_id`); }

      // post_sales_owner_id (nullable)
      const { error: e4 } = await supabaseAdmin
        .from(table)
        .update({ post_sales_owner_id: reassignToId })
        .eq("post_sales_owner_id", targetUserId);
      if (e4) { console.error(`[${table}] post_sales_owner_id:`, e4.message); errors.push(`${table}.post_sales_owner_id`); }
    }

    // ========================================================
    // GROUP 2: Reassign forms and lg_links ownership
    // ========================================================
    const { error: formsErr } = await supabaseAdmin
      .from("forms")
      .update({ created_by_id: mandatoryReassignId })
      .eq("created_by_id", targetUserId);
    if (formsErr) { console.error("[forms]:", formsErr.message); errors.push("forms.created_by_id"); }

    const { error: lgLinksErr } = await supabaseAdmin
      .from("lg_links")
      .update({ created_by_id: mandatoryReassignId })
      .eq("created_by_id", targetUserId);
    if (lgLinksErr) { console.error("[lg_links]:", lgLinksErr.message); errors.push("lg_links.created_by_id"); }

    // ========================================================
    // GROUP 3: Reassign direct reports (manager_id)
    // ========================================================
    const { error: mgrErr } = await supabaseAdmin
      .from("profiles")
      .update({ manager_id: reassignToId })
      .eq("manager_id", targetUserId);
    if (mgrErr) { console.error("[profiles.manager_id]:", mgrErr.message); errors.push("profiles.manager_id"); }

    // ========================================================
    // GROUP 4: Delete user-owned auxiliary data
    // These are non-critical records that belong solely to the user.
    // ========================================================
    const deleteTables = [
      "automations",
      "booking_pages",
      "calendar_connections",
      "calendar_events",
      "email_aliases",
      "notifications",
      "announcement_reads",
      "user_stats",
      "integration_api_keys",
    ];

    for (const table of deleteTables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("user_id", targetUserId);
      if (error) { console.error(`[${table}] delete:`, error.message); errors.push(`${table} delete`); }
    }

    // features_unlocked: set unlocked_by to null (preserve purchase record)
    const { error: featErr } = await supabaseAdmin
      .from("features_unlocked")
      .update({ unlocked_by: null })
      .eq("unlocked_by", targetUserId);
    if (featErr) { console.error("[features_unlocked]:", featErr.message); errors.push("features_unlocked"); }

    // ========================================================
    // GROUP 5: Final cleanup — delete user_roles, profile, auth user
    // Order matters: user_roles → profiles → auth.users
    // We delete profiles explicitly so the auth cascade doesn't
    // trip over remaining FK references.
    // ========================================================
    const { error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId);
    if (rolesErr) { console.error("[user_roles]:", rolesErr.message); errors.push("user_roles"); }

    // Explicitly delete the profile row before auth deletion
    const { error: profileDeleteErr } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", targetUserId);
    if (profileDeleteErr) {
      console.error("[profiles] delete:", profileDeleteErr.message);
      // This is critical — if profile can't be deleted, auth delete will also fail
      throw new Error("Failed to delete user profile: " + profileDeleteErr.message);
    }

    // Delete from Supabase Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      console.error("Auth delete error:", deleteError);
      throw new Error("Failed to delete user from auth: " + deleteError.message);
    }

    // Decrement used_licenses count for the company
    if (targetProfile.company_id) {
      const { error: licErr } = await supabaseAdmin.rpc("decrement_used_licenses", {
        _company_id: targetProfile.company_id,
      });
      if (licErr) {
        console.error("[decrement_used_licenses]:", licErr.message);
        // Non-critical: user is already deleted, just log it
      }
    }

    console.log(`User ${targetUserId} deleted by ${requester.id}. Non-critical issues: [${errors.join(", ")}]`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Delete member error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
