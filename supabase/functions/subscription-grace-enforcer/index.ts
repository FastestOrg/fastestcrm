import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSystemEmail, getEmailTemplate } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Milestone days at which we send warning emails (days REMAINING before deletion)
const EMAIL_MILESTONES = [170, 150, 120, 90, 60, 30, 14, 7, 3, 1];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const appUrl = Deno.env.get("APP_URL") || "https://fastestcrm.com";

    const now = new Date();
    let deletedCount = 0;
    let deactivatedCount = 0;
    let emailsSent = 0;

    console.log(
      `[Grace Enforcer] Running at ${now.toISOString()}`
    );

    // ─── PHASE 1: Delete companies past 180-day grace period ─────────────
    const { data: expiredCompanies, error: expiredError } = await supabaseAdmin
      .from("companies")
      .select("id, name, admin_id, data_deletion_scheduled_at")
      .not("grace_period_start", "is", null)
      .lt("data_deletion_scheduled_at", now.toISOString());

    if (expiredError) {
      console.error("[Grace Enforcer] Error fetching expired companies:", expiredError);
    }

    for (const company of expiredCompanies || []) {
      console.log(
        `[Grace Enforcer] DELETING company ${company.id} (${company.name}) - grace period expired`
      );

      // Send final notification to admin before deletion
      try {
        const { data: adminProfile } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name")
          .eq("id", company.admin_id)
          .single();

        if (adminProfile?.email) {
          const emailBody = `
            <p>Hello ${adminProfile.full_name || "Admin"},</p>
            <p>This is to inform you that the 180-day grace period for <strong>${company.name}</strong> has ended.</p>
            <p>As per our policy, all company data has been <strong>permanently deleted</strong>. This action is irreversible.</p>
            <div class="info-box">
              <div class="info-item"><span class="info-label">Company:</span> ${company.name}</div>
              <div class="info-item"><span class="info-label">Deletion Date:</span> ${now.toLocaleDateString("en-IN", { dateStyle: "long" })}</div>
              <div class="info-item"><span class="info-label">Reason:</span> Subscription not renewed within 180-day grace period</div>
            </div>
            <p>If you believe this is an error, please contact our support team immediately at <strong>support@fastestcrm.com</strong>.</p>
            <p>We hope to serve you again in the future.</p>
          `;

          const emailHtml = getEmailTemplate(
            "Account Data Deleted",
            emailBody,
            undefined,
            undefined,
            "danger"
          );

          await sendSystemEmail({
            to: adminProfile.email,
            subject: `[FINAL] Your ${company.name} data has been permanently deleted`,
            html: emailHtml,
          });
        }
      } catch (emailErr) {
        console.error(
          `[Grace Enforcer] Failed to send deletion email for company ${company.id}:`,
          emailErr
        );
      }

      // Delete the company (CASCADE will remove all related data)
      const { error: deleteError } = await supabaseAdmin
        .from("companies")
        .delete()
        .eq("id", company.id);

      if (deleteError) {
        console.error(
          `[Grace Enforcer] CRITICAL: Failed to delete company ${company.id}:`,
          deleteError
        );

        // Log to debug_logs for audit
        await supabaseAdmin.from("debug_logs").insert({
          message: `GRACE_ENFORCER_DELETE_FAILED`,
          details: JSON.stringify({
            company_id: company.id,
            company_name: company.name,
            error: deleteError.message,
            scheduled_at: company.data_deletion_scheduled_at,
          }),
        });
      } else {
        deletedCount++;
        console.log(
          `[Grace Enforcer] Successfully deleted company ${company.id} (${company.name})`
        );

        // Audit log
        await supabaseAdmin.from("debug_logs").insert({
          message: `GRACE_ENFORCER_COMPANY_DELETED`,
          details: JSON.stringify({
            company_id: company.id,
            company_name: company.name,
            deletion_date: now.toISOString(),
          }),
        });
      }
    }

    // ─── PHASE 2: Enforce deactivation of non-admin users ────────────────
    const { data: graceCompanies, error: graceError } = await supabaseAdmin
      .from("companies")
      .select("id, name, admin_id, grace_period_start, data_deletion_scheduled_at")
      .not("grace_period_start", "is", null)
      .gte("data_deletion_scheduled_at", now.toISOString())
      .in("subscription_status", ["past_due", "canceled"]);

    if (graceError) {
      console.error("[Grace Enforcer] Error fetching grace period companies:", graceError);
    }

    for (const company of graceCompanies || []) {
      // Deactivate any non-admin users who may have been reactivated
      const { data: activeNonAdmins, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("company_id", company.id)
        .neq("id", company.admin_id)
        .or("is_deactivated.eq.false,is_deactivated.is.null");

      if (!profilesError && activeNonAdmins && activeNonAdmins.length > 0) {
        const ids = activeNonAdmins.map((p) => p.id);
        const { error: deactError } = await supabaseAdmin
          .from("profiles")
          .update({ is_deactivated: true, updated_at: new Date().toISOString() })
          .in("id", ids);

        if (!deactError) {
          deactivatedCount += ids.length;
          console.log(
            `[Grace Enforcer] Deactivated ${ids.length} non-admin user(s) for company ${company.id}`
          );
        }
      }

      // ─── PHASE 3: Send milestone emails ────────────────────────────────
      const deletionDate = new Date(company.data_deletion_scheduled_at);
      const daysRemaining = Math.ceil(
        (deletionDate.getTime() - now.getTime()) / (1000 * 3600 * 24)
      );

      // Check if today matches any milestone
      const milestone = EMAIL_MILESTONES.find((m) => m === daysRemaining);
      if (milestone) {
        try {
          const { data: adminProfile } = await supabaseAdmin
            .from("profiles")
            .select("email, full_name")
            .eq("id", company.admin_id)
            .single();

          if (adminProfile?.email) {
            const urgency =
              daysRemaining <= 7
                ? "danger"
                : daysRemaining <= 30
                ? "warning"
                : "info";

            const renewalUrl = `${appUrl}/dashboard/company`;

            const emailBody = `
              <p>Hello ${adminProfile.full_name || "Admin"},</p>
              <p>Your subscription for <strong>${company.name}</strong> has expired and your account is in a grace period.</p>
              <p style="font-size: 24px; font-weight: 700; color: ${
                daysRemaining <= 7
                  ? "#EF4444"
                  : daysRemaining <= 30
                  ? "#F59E0B"
                  : "#6B7280"
              }; text-align: center; margin: 24px 0;">
                ⏰ ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining
              </p>
              <div class="info-box">
                <div class="info-item"><span class="info-label">Company:</span> ${company.name}</div>
                <div class="info-item"><span class="info-label">Grace Period Started:</span> ${new Date(company.grace_period_start).toLocaleDateString("en-IN", { dateStyle: "long" })}</div>
                <div class="info-item"><span class="info-label">Data Deletion Date:</span> ${deletionDate.toLocaleDateString("en-IN", { dateStyle: "long" })}</div>
                <div class="info-item"><span class="info-label">Team Members:</span> All non-admin users are currently locked out</div>
              </div>
              <p><strong>What happens if you don't renew?</strong></p>
              <ul>
                <li>All your leads, contacts, and customer data will be <strong>permanently deleted</strong></li>
                <li>All forms, quotations, and invoices will be removed</li>
                <li>All team member accounts will be deleted</li>
                <li>This action is <strong>irreversible</strong></li>
              </ul>
              <p>To prevent data loss, please log in and renew your subscription immediately.</p>
            `;

            const emailHtml = getEmailTemplate(
              `⚠️ ${daysRemaining} Days Until Data Deletion`,
              emailBody,
              "Renew Subscription Now",
              renewalUrl,
              urgency as any
            );

            const result = await sendSystemEmail({
              to: adminProfile.email,
              subject: `⚠️ ${daysRemaining} days left: Renew ${company.name} subscription to prevent data loss`,
              html: emailHtml,
            });

            if (result.success) {
              emailsSent++;
              console.log(
                `[Grace Enforcer] Milestone email sent to ${adminProfile.email} (${daysRemaining} days remaining)`
              );
            }
          }
        } catch (emailErr) {
          console.error(
            `[Grace Enforcer] Failed to send milestone email for company ${company.id}:`,
            emailErr
          );
        }
      }
    }

    // ─── Summary ─────────────────────────────────────────────────────────
    const summary = {
      success: true,
      timestamp: now.toISOString(),
      companies_in_grace_period: graceCompanies?.length || 0,
      companies_deleted: deletedCount,
      users_deactivated: deactivatedCount,
      milestone_emails_sent: emailsSent,
    };

    console.log("[Grace Enforcer] Summary:", JSON.stringify(summary));

    // Audit log
    await supabaseAdmin.from("debug_logs").insert({
      message: "GRACE_ENFORCER_RUN_COMPLETE",
      details: JSON.stringify(summary),
    });

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Grace Enforcer] Fatal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
