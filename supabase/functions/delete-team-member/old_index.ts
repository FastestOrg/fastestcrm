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

    // 1. Handle reassignment of forms created by the user
    if (reassignToId) {
      const { error: formsError } = await supabaseAdmin
        .from("forms")
        .update({ created_by_id: reassignToId })
        .eq("created_by_id", targetUserId);

      if (formsError) {
        console.error("Error reassigning user forms:", formsError);
        throw new Error("Failed to reassign user forms: " + formsError.message);
      }
    } else {
      // If "Unassigned", the column must be nullable. Assuming it's nullable or we just leave it alone?
      // "forms" may have created_by_id as nullable or not. Let's make it explicitly null if requested unassigned.
      const { error: formsError } = await supabaseAdmin
        .from("forms")
        .update({ created_by_id: null })
        .eq("created_by_id", targetUserId);

      if (formsError) {
          // Fallback if not nullable, we can't do much, leave as is or throw
          console.error("Error setting forms to unassigned:", formsError);
      }
    }

    // 2. Handle reassignment of leads
    // Leads can have `assigned_to` and potentially `post_sales_owner_id` (used by realtime leads)
    const { error: leadAssignError } = await supabaseAdmin
        .from("leads")
        .update({ assigned_to: reassignToId })
        .eq("assigned_to", targetUserId);
    
    if (leadAssignError) {
        console.error("Error reassigning leads:", leadAssignError);
    }
    
    const { error: leadPostSalesAssignError } = await supabaseAdmin
        .from("leads")
        .update({ post_sales_owner_id: reassignToId })
        .eq("post_sales_owner_id", targetUserId);
    
    if (leadPostSalesAssignError) {
        console.error("Error reassigning post-sales leads:", leadPostSalesAssignError);
    }

    // 3. Handle reassignment of users reporting to the deleted manager
    const { error: profilesManagerError } = await supabaseAdmin
        .from("profiles")
        .update({ manager_id: reassignToId })
        .eq("manager_id", targetUserId);
        
    if (profilesManagerError) {
        console.error("Error reassigning direct reports:", profilesManagerError);
    }

    // 4. Delete user from auth (this will cascade to profiles due to FK)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      throw new Error("Failed to delete user: " + deleteError.message);
    }

    // Also clean up user_roles (might not cascade automatically)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);

    console.log(`User ${targetUserId} deleted by ${requester.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Delete member error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
