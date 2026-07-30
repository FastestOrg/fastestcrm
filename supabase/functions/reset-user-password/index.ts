import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ROLE_LEVELS: Record<string, number> = {
  platform_admin: 0,
  company: 1, company_subadmin: 2,
  level_3: 3, level_4: 4, level_5: 5, level_6: 6, level_7: 7,
  level_8: 8, level_9: 9, level_10: 10, level_11: 11, level_12: 12,
  level_13: 13, level_14: 14, level_15: 15, level_16: 16, level_17: 17,
  level_18: 18, level_19: 19, level_20: 20,
  cbo: 3, vp: 4, avp: 5, dgm: 6, agm: 7, sm: 8, tl: 9,
  bde: 10, intern: 11, ca: 12,
};

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
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const {
      data: { user: requester },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !requester) {
      throw new Error("Unauthorized");
    }

    const body = await req.json();
    const { targetUserId, newPassword } = body || {};

    if (!targetUserId || typeof targetUserId !== "string") {
      throw new Error("Missing or invalid targetUserId");
    }

    if (!newPassword || typeof newPassword !== "string") {
      throw new Error("Missing or invalid newPassword");
    }

    if (newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    if (newPassword.length > 72) {
      throw new Error("Password must be less than 72 characters");
    }

    // Fetch requester role & profile and target role & profile
    const [
      requesterRoleResult,
      requesterProfileResult,
      targetRoleResult,
      targetProfileResult,
    ] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", requester.id).maybeSingle(),
      supabaseAdmin.from("profiles").select("company_id").eq("id", requester.id).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", targetUserId).maybeSingle(),
      supabaseAdmin.from("profiles").select("company_id").eq("id", targetUserId).maybeSingle(),
    ]);

    const requesterRole = requesterRoleResult.data?.role || "";
    const targetRole = targetRoleResult.data?.role || "";

    const requesterCompanyId = requesterProfileResult.data?.company_id;
    const targetCompanyId = targetProfileResult.data?.company_id;

    const requesterLevel = ROLE_LEVELS[requesterRole] ?? 99;
    const targetLevel = ROLE_LEVELS[targetRole] ?? 99;

    // Check company scope unless platform admin
    if (requesterRole !== "platform_admin") {
      if (!requesterCompanyId || !targetCompanyId || requesterCompanyId !== targetCompanyId) {
        throw new Error("You can only reset passwords for users within your company");
      }

      if (requesterLevel >= targetLevel) {
        throw new Error("You can only reset passwords for team members below your role level");
      }
    }

    // Perform password reset using Supabase Auth Admin API
    const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (resetErr) {
      console.error("Password reset error:", resetErr.message);
      throw new Error("Failed to reset password: " + resetErr.message);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Password updated successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "An error occurred while resetting password" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
