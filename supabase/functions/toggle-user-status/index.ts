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
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get requesting user
    const {
      data: { user: requester },
      error: userError,
    } = await supabaseAuth.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''));
    if (userError || !requester) {
      throw new Error("Unauthorized");
    }

    const { targetUserId, deactivate } = await req.json();
    if (!targetUserId || typeof deactivate !== "boolean") {
      throw new Error("Missing targetUserId or deactivate (boolean)");
    }

    // Prevent self-deactivation
    if (targetUserId === requester.id) {
      throw new Error("You cannot deactivate yourself");
    }

    // ── Permission check (same as delete-team-member) ──
    const ROLE_LEVELS: Record<string, number> = {
      company: 1, company_subadmin: 2,
      level_3: 3, level_4: 4, level_5: 5, level_6: 6, level_7: 7,
      level_8: 8, level_9: 9, level_10: 10, level_11: 11, level_12: 12,
      level_13: 13, level_14: 14, level_15: 15, level_16: 16, level_17: 17,
      level_18: 18, level_19: 19, level_20: 20,
      cbo: 3, vp: 4, avp: 5, dgm: 6, agm: 7, sm: 8, tl: 9,
      bde: 10, intern: 11, ca: 12,
    };

    const [requesterRoleResult, targetRoleResult] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", requester.id).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", targetUserId).maybeSingle(),
    ]);

    const requesterLevel = ROLE_LEVELS[requesterRoleResult.data?.role || ""] ?? 99;
    const targetLevel = ROLE_LEVELS[targetRoleResult.data?.role || ""] ?? 99;

    if (requesterLevel >= targetLevel) {
      throw new Error("You can only deactivate/reactivate team members below your level");
    }

    // ── Update profiles table ──
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({
        is_deactivated: deactivate,
        deactivated_at: deactivate ? new Date().toISOString() : null,
      })
      .eq("id", targetUserId);

    if (profileErr) {
      throw new Error("Failed to update profile: " + profileErr.message);
    }

    // ── Ban / Un-ban the auth user to invalidate sessions ──
    if (deactivate) {
      // Ban for ~100 years (effectively permanent until reactivated)
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "876000h",
      });
      if (banErr) {
        console.error("Auth ban error:", banErr.message);
        // Rollback profile change
        await supabaseAdmin
          .from("profiles")
          .update({ is_deactivated: false, deactivated_at: null })
          .eq("id", targetUserId);
        throw new Error("Failed to deactivate user auth: " + banErr.message);
      }
    } else {
      // Un-ban: set ban_duration to "none" to lift the ban
      const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      });
      if (unbanErr) {
        console.error("Auth un-ban error:", unbanErr.message);
        // Rollback profile change
        await supabaseAdmin
          .from("profiles")
          .update({ is_deactivated: true, deactivated_at: new Date().toISOString() })
          .eq("id", targetUserId);
        throw new Error("Failed to reactivate user auth: " + unbanErr.message);
      }
    }

    const action = deactivate ? "deactivated" : "reactivated";
    console.log(`User ${targetUserId} ${action} by ${requester.id}`);

    return new Response(
      JSON.stringify({ success: true, action }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Toggle user status error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
