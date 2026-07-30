import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOrgAdminClient } from "../_shared/byos-client.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { companyId, tableName = "leads", search, statusFilter } = await req.json();

    if (!companyId) {
      return new Response(JSON.stringify({ error: "Missing companyId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client } = await getOrgAdminClient(companyId);

    // Build lead query
    let query = client
      .from(tableName as any)
      .select("id, name, email, phone, status, created_at, custom_data")
      .order("created_at", { ascending: false })
      .limit(50000);

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: leads, error } = await query;
    if (error) throw error;

    // Convert to CSV lines
    const headers = ["ID", "Name", "Email", "Phone", "Status", "Created At", "Custom Data"];
    const csvRows = [headers.join(",")];

    for (const lead of leads || []) {
      const row = [
        `"${lead.id || ""}"`,
        `"${(lead.name || "").replace(/"/g, '""')}"`,
        `"${(lead.email || "").replace(/"/g, '""')}"`,
        `"${(lead.phone || "").replace(/"/g, '""')}"`,
        `"${lead.status || ""}"`,
        `"${lead.created_at || ""}"`,
        `"${JSON.stringify(lead.custom_data || {}).replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tableName}_export.csv"`,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
