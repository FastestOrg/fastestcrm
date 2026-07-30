/**
 * ─── BYOS Management Edge Function ──────────────────────────────────────────
 * Central function for all Bring Your Own Supabase operations:
 *   validate  – Test customer's Supabase credentials
 *   connect   – Save encrypted credentials
 *   migrate   – Run migration bundle on customer's Supabase
 *   health    – Ping customer's Supabase
 *   disconnect– Migrate data back to platform, then remove connection
 *   status    – Get current BYOS status
 * ────────────────────────────────────────────────────────────────────────────
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import {
  getPlatformAdminClient,
  logBYOSAudit,
  ORG_SCOPED_TABLES,
} from "../_shared/byos-client.ts";

import { BYOS_MIGRATION_SQL } from "../_shared/byos-migration-bundle.ts";
const MIGRATION_VERSION = "1.0.0";

// ─── JWT Parser Helper ───────────────────────────────────────────────────────
function parseJwtPayload(token: string) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (_e) {
    return null;
  }
}

// ─── Debug Log Helper ────────────────────────────────────────────────────────
async function writeDebugLog(message: string, details: any) {
  try {
    const platform = getPlatformAdminClient();
    await platform.from("debug_logs").insert({
      message,
      details: typeof details === "string" ? details : JSON.stringify(details, null, 2)
    });
  } catch (e) {
    console.error("Failed to write debug log:", e);
  }
}

// ─── Auth helper ────────────────────────────────────────────────────────────
async function authenticateAdmin(req: Request, body?: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    await writeDebugLog("authenticateAdmin failed: Missing Authorization header", {});
    throw new Error("Missing Authorization header");
  }

  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    await writeDebugLog("authenticateAdmin failed: Invalid token format", { authHeader });
    throw new Error("Invalid Authorization token format");
  }

  const platform = getPlatformAdminClient();

  let userId: string | null = null;
  let userEmail: string | null = null;

  // Method A: Supabase auth.getUser
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser(jwt);
    if (user) {
      userId = user.id;
      userEmail = user.email || null;
    }
  } catch (e: any) {
    await writeDebugLog("getUser method threw error", { error: e.message });
  }

  // Method B: Parse JWT payload fallback
  if (!userId) {
    const payload = parseJwtPayload(jwt);
    if (payload) {
      userId = payload.sub || payload.id || null;
      userEmail = payload.email || null;
      await writeDebugLog("Decoded JWT payload fallback", { payload });
    } else {
      await writeDebugLog("parseJwtPayload failed to decode payload", { jwt: jwt.slice(0, 30) + "..." });
    }
  }

  await writeDebugLog("Resolved user credentials", { userId, userEmail, body });

  if (!userId && !userEmail) {
    throw new Error("Unauthorized: Invalid user session token");
  }

  let company: any = null;

  // Lookup 1: By companies.admin_id
  if (userId) {
    const { data } = await platform.from("companies").select("id, admin_id, byos_enabled").eq("admin_id", userId).maybeSingle();
    await writeDebugLog("Lookup 1: by admin_id result", { data });
    if (data) company = data;
  }

  // Lookup 2: By profiles.company_id (using userId)
  if (!company && userId) {
    const { data: prof } = await platform.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    await writeDebugLog("Lookup 2: profiles company_id by userId result", { prof });
    if (prof?.company_id) {
      const { data } = await platform.from("companies").select("id, admin_id, byos_enabled").eq("id", prof.company_id).maybeSingle();
      await writeDebugLog("Lookup 2: company by company_id result", { data });
      if (data) company = data;
    }
  }

  // Lookup 3: By profiles.company_id (using userEmail)
  if (!company && userEmail) {
    const { data: prof } = await platform.from("profiles").select("company_id").eq("email", userEmail).maybeSingle();
    await writeDebugLog("Lookup 3: profiles company_id by userEmail result", { prof });
    if (prof?.company_id) {
      const { data } = await platform.from("companies").select("id, admin_id, byos_enabled").eq("id", prof.company_id).maybeSingle();
      await writeDebugLog("Lookup 3: company by company_id result", { data });
      if (data) company = data;
    }
  }

  // Lookup 4: By body.company_id
  if (!company && body?.company_id) {
    const { data } = await platform.from("companies").select("id, admin_id, byos_enabled").eq("id", body.company_id).maybeSingle();
    await writeDebugLog("Lookup 4: by body.company_id result", { data, bodyCompanyId: body.company_id });
    if (data) company = data;
  }

  // Lookup 5: Fallback for platform superadmins
  if (!company && userId) {
    const { data: isPrivileged } = await platform.from("platform_admins").select("id").eq("user_id", userId).maybeSingle();
    await writeDebugLog("Lookup 5: platform_admins check", { isPrivileged });
    if (isPrivileged) {
      const { data } = await platform.from("companies").select("id, admin_id, byos_enabled").eq("slug", "fastestcrm").maybeSingle();
      await writeDebugLog("Lookup 5: superadmin default company", { data });
      if (data) company = data;
    }
  }

  if (!company) {
    await writeDebugLog("No company associated for userId and userEmail", { userId, userEmail });
    console.error(`[byos-manage] No company associated for userId: ${userId}, userEmail: ${userEmail}`);
    throw new Error(`No company associated with this user account (ID: ${userId}, Email: ${userEmail})`);
  }

  const resolvedUserId = userId || company.admin_id;
  await writeDebugLog("authenticateAdmin successful", { resolvedUserId, companyId: company.id });
  return { userId: resolvedUserId, companyId: company.id, company };
}

// ─── Action: Validate ───────────────────────────────────────────────────────
async function handleValidate(body: any) {
  const { supabase_url, supabase_anon_key, supabase_service_role_key } = body;
  if (!supabase_url || !supabase_anon_key || !supabase_service_role_key) {
    throw new Error("Missing required fields: supabase_url, supabase_anon_key, supabase_service_role_key");
  }

  const cleanUrl = supabase_url.trim().replace(/\/+$/, "");

  // 1. Test Anon Key
  try {
    const testClient = createClient(cleanUrl, supabase_anon_key);
    const { error: anonErr } = await testClient.from("_byos_health").select("count").limit(1);
    if (anonErr) {
      const msg = (anonErr.message || "").toLowerCase();
      if (msg.includes("invalid api key") || msg.includes("jwt") || anonErr.code === "PGRST301") {
        throw new Error("Invalid Supabase Anon / Public Key");
      }
    }
  } catch (e: any) {
    if (e.message?.includes("Invalid Supabase")) throw e;
    if (e.message?.includes("fetch") || e.message?.includes("network") || e.message?.includes("DNS")) {
      throw new Error(`Cannot reach Supabase project at ${cleanUrl}. Please check the project URL.`);
    }
  }

  // 2. Test Service Role Key
  try {
    const adminClient = createClient(cleanUrl, supabase_service_role_key);
    const { error: adminErr } = await adminClient.from("_byos_health").select("count").limit(1);
    if (adminErr) {
      const msg = (adminErr.message || "").toLowerCase();
      if (msg.includes("invalid api key") || msg.includes("jwt") || adminErr.code === "PGRST301") {
        throw new Error("Invalid Supabase Service Role Key");
      }
    }
  } catch (e: any) {
    if (e.message?.includes("Invalid Supabase")) throw e;
  }

  return { valid: true, message: "Connection validated successfully" };
}

// ─── Action: Connect ────────────────────────────────────────────────────────
async function handleConnect(companyId: string, userId: string, body: any) {
  const { supabase_url, supabase_anon_key, supabase_service_role_key } = body;

  // Validate first
  await handleValidate(body);

  const platform = getPlatformAdminClient();

  // Encrypt the service role key
  const { data: encrypted, error: encErr } = await platform.rpc("byos_encrypt_key", {
    plain_key: supabase_service_role_key,
  });
  if (encErr) throw new Error("Failed to encrypt service role key: " + encErr.message);

  // Upsert the connection
  const { error } = await platform
    .from("byos_connections")
    .upsert(
      {
        company_id: companyId,
        supabase_url,
        supabase_anon_key,
        supabase_service_role_key_encrypted: encrypted,
        status: "validated",
        health_status: "healthy",
        last_health_check: new Date().toISOString(),
      },
      { onConflict: "company_id" }
    );

  if (error) throw new Error("Failed to save connection: " + error.message);

  await logBYOSAudit(companyId, "connect", "success", { supabase_url }, userId);
  return { success: true, message: "Connection saved. Ready to migrate." };
}

// ─── Action: Migrate ────────────────────────────────────────────────────────
async function handleMigrate(companyId: string, userId: string, body?: any) {
  const platform = getPlatformAdminClient();

  // Get the connection (with decrypted key)
  const { data: conn } = await platform
    .from("byos_connections")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (!conn) throw new Error("No BYOS connection found. Please connect first.");

  // Update status
  await platform
    .from("byos_connections")
    .update({ status: "migration_running" })
    .eq("company_id", companyId);

  await logBYOSAudit(companyId, "migrate", "started", {}, userId);

  try {
    // Decrypt the service role key
    const { data: serviceKey } = await platform.rpc("byos_decrypt_key", {
      encrypted_key: conn.supabase_service_role_key_encrypted,
    });
    if (!serviceKey) throw new Error("Failed to decrypt service role key");

    // 0. Automated SQL Schema Creation if access token is provided
    const accessToken = body?.supabase_access_token?.trim();
    if (accessToken) {
      const projectRef = extractProjectRef(conn.supabase_url);
      if (projectRef) {
        console.log(`[BYOS Migrate] Running automated SQL schema creation on project ${projectRef}...`);
        const sqlRes = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ query: BYOS_MIGRATION_SQL }),
          }
        );
        if (!sqlRes.ok) {
          const errText = await sqlRes.text();
          console.warn("[BYOS Migrate] Automated SQL warning:", errText);
        } else {
          console.log("[BYOS Migrate] Automated SQL schema migration succeeded!");
        }
      }
    }

    // Create admin client for customer's Supabase
    const customerAdmin = createClient(conn.supabase_url, serviceKey as string);

    // Verify if CRM tables exist on customer's Supabase
    const { error: tableCheckErr } = await customerAdmin.from("leads").select("id").limit(1);
    if (tableCheckErr && (tableCheckErr.code === "42P01" || tableCheckErr.message?.includes("does not exist") || tableCheckErr.message?.includes("relation"))) {
      const projectRef = extractProjectRef(conn.supabase_url);
      if (accessToken && projectRef) {
        console.log(`[BYOS Migrate] Creating database schema on project ${projectRef}...`);
        const sqlRes = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ query: BYOS_MIGRATION_SQL }),
          }
        );
        if (!sqlRes.ok) {
          const errText = await sqlRes.text();
          throw new Error(`Schema setup failed on customer Supabase: ${errText}`);
        }
      } else {
        throw new Error(
          "SCHEMA_MISSING: CRM tables do not exist on your connected Supabase project yet. Please click 'Copy Migration SQL' in BYOS settings, run it in your Supabase SQL Editor, and try again."
        );
      }
    }

    // 1. Sync profiles from platform to customer's Supabase
    await syncProfilesToCustomer(platform, customerAdmin, companyId, conn.supabase_url, serviceKey as string);

    // 2. Sync all existing org data (leads, invoices, products, forms, etc.) to customer's Supabase
    const syncReport = await syncOrgDataToCustomer(platform, customerAdmin, companyId, conn.supabase_url, serviceKey as string);

    // 3. Mark BYOS connection as active
    await platform
      .from("byos_connections")
      .update({
        status: "active",
        migration_version: MIGRATION_VERSION,
        last_health_check: new Date().toISOString(),
        health_status: "healthy",
        error_log: null,
      })
      .eq("company_id", companyId);

    // 4. Enable BYOS on the company record
    await platform
      .from("companies")
      .update({ byos_enabled: true })
      .eq("id", companyId);

    await logBYOSAudit(companyId, "migrate", "success", { version: MIGRATION_VERSION, syncReport }, userId);
    return { success: true, message: "Migration complete. BYOS is now active and live.", syncReport };
  } catch (e: any) {
    // Rollback status on failure
    await platform
      .from("byos_connections")
      .update({
        status: "migration_failed",
        error_log: [
          ...((conn.error_log as any[]) || []),
          { time: new Date().toISOString(), error: e.message },
        ],
      })
      .eq("company_id", companyId);

    await logBYOSAudit(companyId, "migrate", "failed", { error: e.message }, userId);
    throw new Error("Migration failed: " + e.message);
  }
}

// ─── Action: Health Check ───────────────────────────────────────────────────
async function handleHealthCheck(companyId: string) {
  const platform = getPlatformAdminClient();
  const { data: conn } = await platform
    .from("byos_connections")
    .select("supabase_url, supabase_anon_key, status")
    .eq("company_id", companyId)
    .single();

  if (!conn) return { health: "not_configured" };

  try {
    const testClient = createClient(conn.supabase_url, conn.supabase_anon_key);
    const { error } = await testClient.from("leads").select("id").limit(1);

    const isHealthy = !error || !error.message?.toLowerCase().includes("invalid api key");
    const health = isHealthy ? "healthy" : "degraded";

    await platform
      .from("byos_connections")
      .update({ last_health_check: new Date().toISOString(), health_status: health })
      .eq("company_id", companyId);

    return { health, status: conn.status, lastCheck: new Date().toISOString() };
  } catch {
    await platform
      .from("byos_connections")
      .update({ last_health_check: new Date().toISOString(), health_status: "unreachable" })
      .eq("company_id", companyId);
    return { health: "unreachable", status: conn.status };
  }
}

// ─── Action: Disconnect (migrate data back) ─────────────────────────────────
async function handleDisconnect(companyId: string, userId: string) {
  const platform = getPlatformAdminClient();

  const { data: conn } = await platform
    .from("byos_connections")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (!conn) throw new Error("No BYOS connection found");

  await platform
    .from("byos_connections")
    .update({ status: "migrating_back" })
    .eq("company_id", companyId);

  await logBYOSAudit(companyId, "disconnect", "started", {}, userId);

  try {
    // Decrypt service role key
    const { data: serviceKey } = await platform.rpc("byos_decrypt_key", {
      encrypted_key: conn.supabase_service_role_key_encrypted,
    });

    if (serviceKey) {
      const customerAdmin = createClient(conn.supabase_url, serviceKey as string);

      // Migrate each org-scoped table back to platform
      for (const table of ORG_SCOPED_TABLES) {
        try {
          // Fetch all rows from customer's Supabase (no company_id filter since it's single-tenant and some tables don't have it)
          let allRows: any[] = [];
          let offset = 0;
          const batchSize = 1000;
          let hasMore = true;

          while (hasMore) {
            const rows = await checkedSelect(
              customerAdmin
                .from(table)
                .select("*")
                .range(offset, offset + batchSize - 1)
            );

            if (rows.length === 0) {
              hasMore = false;
            } else {
              allRows = [...allRows, ...rows];
              offset += batchSize;
              if (rows.length < batchSize) hasMore = false;
            }
          }

          if (allRows.length > 0) {
            // Get platform table columns to filter out extra columns on customer's DB
            const allowedCols = await getPlatformTableColumns(table);

            // Upsert into our platform (conflict on id)
            const CHUNK = 500;
            for (let i = 0; i < allRows.length; i += CHUNK) {
              const batch = allRows.slice(i, i + CHUNK).map(row => {
                const sanitized: Record<string, any> = {};
                if (allowedCols) {
                  for (const key of allowedCols) {
                    if (key in row) sanitized[key] = row[key];
                  }
                } else {
                  Object.assign(sanitized, row);
                }
                if ("company_id" in sanitized) {
                  sanitized.company_id = companyId;
                }
                return sanitized;
              });
              await checkedUpsert(
                platform
                  .from(table as any)
                  .upsert(batch, { onConflict: "id", ignoreDuplicates: false })
              );
            }
            console.log(`[BYOS Disconnect] Migrated ${allRows.length} rows from ${table}`);
          }
        } catch (tableErr: any) {
          console.error(`[BYOS Disconnect] Error migrating table ${table}:`, tableErr.message || tableErr);
          await writeDebugLog(`Disconnect table migrate error for ${table}`, { error: tableErr.message || String(tableErr) });
          // Continue with other tables — don't block the entire disconnect
        }
      }
    }

    // Disable BYOS
    await platform
      .from("companies")
      .update({ byos_enabled: false })
      .eq("id", companyId);

    // Remove the connection
    await platform
      .from("byos_connections")
      .delete()
      .eq("company_id", companyId);

    await logBYOSAudit(companyId, "disconnect", "success", {}, userId);
    return { success: true, message: "Data migrated back. BYOS disconnected." };
  } catch (e) {
    await platform
      .from("byos_connections")
      .update({ status: "error", error_log: [...((conn.error_log as any[]) || []), { time: new Date().toISOString(), error: e.message }] })
      .eq("company_id", companyId);

    await logBYOSAudit(companyId, "disconnect", "failed", { error: e.message }, userId);
    throw new Error("Disconnect failed: " + e.message);
  }
}

// ─── Action: Unlock (One-Time Paid Fee Rs 1,00,000) ─────────────────────────
const UNLOCK_COST = 100000;

async function handleUnlock(companyId: string, userId: string) {
  const platform = getPlatformAdminClient();

  // 1. Check if already unlocked
  const { data: existing } = await platform
    .from("features_unlocked")
    .select("id")
    .eq("company_id", companyId)
    .eq("feature_name", "byos")
    .maybeSingle();

  if (existing) {
    return { success: true, message: "BYOS feature is already unlocked." };
  }

  // 2. Check Wallet
  const { data: wallet } = await platform
    .from("wallets")
    .select("balance")
    .eq("company_id", companyId)
    .single();

  const currentBalance = wallet ? Number(wallet.balance) : 0;
  if (currentBalance < UNLOCK_COST) {
    throw new Error(`Insufficient wallet balance. Required: ₹${UNLOCK_COST.toLocaleString()}, Available: ₹${currentBalance.toLocaleString()}. Please add money to your wallet.`);
  }

  // 3. Deduct Balance
  const { error: walletError } = await platform
    .from("wallets")
    .update({ balance: currentBalance - UNLOCK_COST, updated_at: new Date().toISOString() })
    .eq("company_id", companyId);

  if (walletError) throw new Error("Wallet deduction failed: " + walletError.message);

  // 4. Log Transaction
  await platform.from("wallet_transactions").insert({
    wallet_id: companyId,
    amount: UNLOCK_COST,
    type: "debit_manual_adjustment",
    description: "Unlocked Feature: Bring Your Own Supabase (BYOS)",
    status: "success",
  });

  // 5. Register feature as unlocked
  const { error: unlockErr } = await platform.from("features_unlocked").insert({
    company_id: companyId,
    feature_name: "byos",
    amount_paid: UNLOCK_COST,
    unlocked_by: userId,
  });

  if (unlockErr) {
    // Refund if unlock logging fails
    await platform.from("wallets").update({ balance: currentBalance }).eq("company_id", companyId);
    throw new Error("Failed to record feature unlock: " + unlockErr.message);
  }

  await logBYOSAudit(companyId, "connect", "success", { action: "unlock_purchased", amount: UNLOCK_COST }, userId);
  return { success: true, message: "Bring Your Own Supabase (BYOS) unlocked successfully!" };
}

// ─── Action: Status ─────────────────────────────────────────────────────────
async function handleStatus(companyId: string) {
  const platform = getPlatformAdminClient();

  const { data: conn } = await platform
    .from("byos_connections")
    .select("id, supabase_url, status, migration_version, last_health_check, health_status, error_log, created_at, updated_at")
    .eq("company_id", companyId)
    .maybeSingle();

  const { data: company } = await platform
    .from("companies")
    .select("byos_enabled")
    .eq("id", companyId)
    .single();

  const { data: unlocked } = await platform
    .from("features_unlocked")
    .select("id, unlocked_at")
    .eq("company_id", companyId)
    .eq("feature_name", "byos")
    .maybeSingle();

  const { data: logs } = await platform
    .from("byos_audit_log")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    connection: conn || null,
    byos_enabled: company?.byos_enabled || false,
    is_unlocked: !!unlocked,
    unlocked_at: unlocked?.unlocked_at || null,
    audit_log: logs || [],
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function extractProjectRef(url: string): string {
  // https://xxxxx.supabase.co → xxxxx
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] || "";
}

function chunkSQL(sql: string): string[] {
  // Split on semicolons followed by newline, keeping logical blocks together
  const blocks: string[] = [];
  let current = "";

  for (const line of sql.split("\n")) {
    current += line + "\n";
    // End of a statement block (simplified heuristic)
    if (line.trim().endsWith(";") && !line.trim().startsWith("--")) {
      blocks.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) blocks.push(current.trim());

  // Group into chunks of ~5 statements for batch execution
  const chunks: string[] = [];
  let chunk = "";
  let count = 0;
  for (const block of blocks) {
    chunk += block + "\n\n";
    count++;
    if (count >= 5) {
      chunks.push(chunk);
      chunk = "";
      count = 0;
    }
  }
  if (chunk.trim()) chunks.push(chunk);
  return chunks;
}

// Cache OpenAPI definitions per migration/sync function call
let cachedSpec: any = null;
let platformCachedSpec: any = null;

async function getPlatformTableColumns(tableName: string): Promise<string[] | null> {
  try {
    if (!platformCachedSpec) {
      const platformUrl = Deno.env.get("SUPABASE_URL") || "";
      const platformServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const cleanUrl = platformUrl.trim().replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/rest/v1/`, {
        headers: {
          "apikey": platformServiceKey,
          "Authorization": `Bearer ${platformServiceKey}`,
        },
      });
      if (res.ok) {
        platformCachedSpec = await res.json();
      } else {
        const text = await res.text();
        console.warn(`[BYOS Platform OpenAPI] Failed to fetch OpenAPI spec: ${res.status} ${text}`);
      }
    }
    const properties = platformCachedSpec?.definitions?.[tableName]?.properties;
    if (properties) {
      return Object.keys(properties);
    }
  } catch (e: any) {
    console.error(`[BYOS] Failed to fetch platform columns for ${tableName} via OpenAPI:`, e.message);
  }
  return null;
}

async function getCustomerTableColumns(supabaseUrl: string, serviceKey: string, tableName: string): Promise<string[] | null> {
  try {
    if (!cachedSpec) {
      const cleanUrl = supabaseUrl.trim().replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/rest/v1/`, {
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
      });
      if (res.ok) {
        cachedSpec = await res.json();
      } else {
        const text = await res.text();
        console.warn(`[BYOS OpenAPI] Failed to fetch OpenAPI spec: ${res.status} ${text}`);
      }
    }
    const properties = cachedSpec?.definitions?.[tableName]?.properties;
    if (properties) {
      return Object.keys(properties);
    }
  } catch (e: any) {
    console.error(`[BYOS] Failed to fetch table columns for ${tableName} via OpenAPI:`, e.message);
  }
  return null;
}

// Helper to perform a select and throw if there's a client or database error
async function checkedSelect(queryPromise: any): Promise<any[]> {
  const { data, error } = await queryPromise;
  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }
  return data || [];
}

// Helper to perform an upsert and throw if there's an error
async function checkedUpsert(upsertPromise: any): Promise<void> {
  const { error } = await upsertPromise;
  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }
}

async function syncProfilesToCustomer(
  platform: ReturnType<typeof createClient>,
  customerAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supabaseUrl: string,
  serviceKey: string
) {
  // Get profiles for this company (or fallback to all profiles if company_id is null)
  let profiles: any[] = [];
  try {
    profiles = await checkedSelect(
      platform
        .from("profiles")
        .select("id, email, full_name, phone, avatar_url, company_id, manager_id, incentive_percent")
        .eq("company_id", companyId)
    );
  } catch (e: any) {
    console.error(`[BYOS Sync] Error querying company profiles from platform:`, e.message);
  }

  if (profiles.length === 0) {
    try {
      const allProf = await checkedSelect(
        platform
          .from("profiles")
          .select("id, email, full_name, phone, avatar_url, company_id, manager_id, incentive_percent")
          .limit(100)
      );
      profiles = allProf.map((p) => ({ ...p, company_id: p.company_id || companyId }));
    } catch (e: any) {
      console.error(`[BYOS Sync] Fallback profiles query failed:`, e.message);
    }
  }

  if (profiles.length > 0) {
    // Get profiles table columns from OpenAPI spec to prevent column mismatch failure
    const allowedCols = await getCustomerTableColumns(supabaseUrl, serviceKey, "profiles");
    const sanitizedProfiles = allowedCols
      ? profiles.map((p) => {
          const sanitized: Record<string, any> = {};
          for (const key of allowedCols) {
            if (key in p) sanitized[key] = p[key];
          }
          return sanitized;
        })
      : profiles;

    const userIds = profiles.map((p) => p.id);
    let roles: any[] = [];
    try {
      roles = await checkedSelect(
        platform
          .from("user_roles")
          .select("*")
          .in("user_id", userIds)
      );
    } catch (e: any) {
      console.error(`[BYOS Sync] Error fetching user roles:`, e.message);
    }

    // Pass 1: Upsert profiles without manager_id to avoid foreign key dependency loop
    const profilesNoManager = sanitizedProfiles.map((p) => ({ ...p, manager_id: null }));
    await checkedUpsert(customerAdmin.from("profiles").upsert(profilesNoManager, { onConflict: "id" }));

    // Pass 2: Upsert profiles with manager_id
    await checkedUpsert(customerAdmin.from("profiles").upsert(sanitizedProfiles, { onConflict: "id" }));

    // Upsert roles
    if (roles.length > 0) {
      const allowedRolesCols = await getCustomerTableColumns(supabaseUrl, serviceKey, "user_roles");
      const roleProperty = cachedSpec?.definitions?.user_roles?.properties?.role;
      const allowedRoleValues: string[] | null = Array.isArray(roleProperty?.enum) ? roleProperty.enum : null;

      const sanitizedRoles = roles
        .filter((r) => !allowedRoleValues || allowedRoleValues.includes(r.role))
        .map((r) => {
          const sanitized: Record<string, any> = {};
          const cols = allowedRolesCols || Object.keys(r);
          for (const key of cols) {
            if (key in r) sanitized[key] = r[key];
          }
          return sanitized;
        });

      if (sanitizedRoles.length > 0) {
        const { error: rolesErr } = await customerAdmin
          .from("user_roles")
          .upsert(sanitizedRoles, { onConflict: "id" });
        if (rolesErr) {
          console.warn(`[BYOS Sync] Warning upserting user roles:`, rolesErr.message);
        }
      }
    }

    console.log(`[BYOS] Synced ${profiles.length} profiles to customer's Supabase`);
  }
}

async function syncOrgDataToCustomer(
  platform: ReturnType<typeof createClient>,
  customerAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ syncedCounts: Record<string, number>; warnings: string[] }> {
  const syncedCounts: Record<string, number> = {};
  const warnings: string[] = [];

  // Fetch OpenAPI spec to build columns map
  const allowedColumnsMap = new Map<string, string[]>();
  try {
    const cleanUrl = supabaseUrl.trim().replace(/\/+$/, "");
    const res = await fetch(`${cleanUrl}/rest/v1/`, {
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
    });
    if (res.ok) {
      const spec = await res.json();
      if (spec?.definitions) {
        for (const [tbl, def] of Object.entries(spec.definitions)) {
          const props = (def as any)?.properties;
          if (props) {
            allowedColumnsMap.set(tbl, Object.keys(props));
          }
        }
      }
    } else {
      console.warn(`[BYOS Sync] OpenAPI spec fetch failed with status: ${res.status}`);
    }
  } catch (e: any) {
    console.error("[BYOS Sync] Failed to fetch OpenAPI columns map:", e.message);
  }

  // 1. Fetch company profile user IDs
  let companyUserIds: string[] = [];
  try {
    const companyProfiles = await checkedSelect(
      platform
        .from("profiles")
        .select("id")
        .eq("company_id", companyId)
    );
    companyUserIds = companyProfiles.map((p) => p.id);
  } catch (e: any) {
    warnings.push(`Fetch central profiles failed: ${e.message}`);
  }

  const syncedIdsMap = new Map<string, string[]>();

  // Helper to chunk upsert with single-row fallback and strict column sanitization
  const upsertRows = async (tableName: string, rows: any[]): Promise<number> => {
    if (!rows || rows.length === 0) return 0;
    const CHUNK = 100;
    let count = 0;
    const tableSyncedIds: string[] = [];

    const allowedColumns = allowedColumnsMap.get(tableName);
    const sanitizedRows = allowedColumns
      ? rows.map((row) => {
          const sanitized: Record<string, any> = {};
          for (const key of allowedColumns) {
            if (key in row) {
              sanitized[key] = row[key];
            }
          }
          return sanitized;
        })
      : rows;

    for (let i = 0; i < sanitizedRows.length; i += CHUNK) {
      const batch = sanitizedRows.slice(i, i + CHUNK);
      const { error } = await customerAdmin
        .from(tableName as any)
        .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

      if (!error) {
        count += batch.length;
        batch.forEach(r => tableSyncedIds.push(r.id));
      } else {
        console.warn(`[BYOS Sync] Batch upsert warning for ${tableName}, falling back to row-by-row:`, error.message);
        for (const singleRow of batch) {
          const { error: singleErr } = await customerAdmin
            .from(tableName as any)
            .upsert(singleRow, { onConflict: "id", ignoreDuplicates: false });

          if (!singleErr) {
            count++;
            tableSyncedIds.push(singleRow.id);
          } else {
            console.warn(`[BYOS Sync] Row skip on ${tableName} row ${singleRow.id}:`, singleErr.message);
            warnings.push(`Skip row ${singleRow.id} on ${tableName}: ${singleErr.message}`);
          }
        }
      }
    }

    if (tableSyncedIds.length > 0) {
      syncedIdsMap.set(tableName, tableSyncedIds);
    }
    return count;
  };

  const leadTables = [
    "leads",
    "leads_real_estate",
    "leads_saas",
    "leads_healthcare",
    "leads_insurance",
    "leads_travel",
  ];

  const allMigratedLeadIds = new Set<string>();

  // 2. Sync all Lead Tables
  for (const table of leadTables) {
    try {
      const map = new Map<string, any>();

      // Query by company_id
      try {
        const byCompany = await checkedSelect(
          platform
            .from(table as any)
            .select("*")
            .eq("company_id", companyId)
        );
        byCompany.forEach((row) => map.set(row.id, row));
      } catch (e: any) {
        console.warn(`[BYOS Sync] query by company_id note for ${table}:`, e?.message);
      }

      // Query by created_by_id if companyUserIds present
      if (companyUserIds.length > 0) {
        try {
          const byCreator = await checkedSelect(
            platform
              .from(table as any)
              .select("*")
              .in("created_by_id", companyUserIds)
          );
          byCreator.forEach((row) => map.set(row.id, row));
        } catch (e: any) {
          // ignore column missing
        }

        try {
          const bySales = await checkedSelect(
            platform
              .from(table as any)
              .select("*")
              .in("sales_owner_id", companyUserIds)
          );
          bySales.forEach((row) => map.set(row.id, row));
        } catch (e: any) {
          // ignore column missing
        }
      }

      // Fallback query: if 0 leads found, fetch all leads from table (in case company_id is NULL)
      if (map.size === 0) {
        try {
          const fallbackLeads = await checkedSelect(
            platform
              .from(table as any)
              .select("*")
              .limit(1000)
          );
          fallbackLeads.forEach((row: any) => {
            if (!row.company_id || row.company_id === companyId) {
              map.set(row.id, row);
            }
          });
        } catch (e: any) {
          // ignore
        }
      }

      const rows = Array.from(map.values()).map((row) => ({
        ...row,
        company_id: row.company_id || companyId,
      }));

      rows.forEach((r) => allMigratedLeadIds.add(r.id));
      const count = await upsertRows(table, rows);
      syncedCounts[table] = count;
      console.log(`[BYOS Sync] Synced ${count} rows to ${table}`);
    } catch (e: any) {
      warnings.push(`Lead table ${table}: ${e.message}`);
    }
  }

  // 3. Sync lead_history
  try {
    const leadIdArray = Array.from(allMigratedLeadIds);
    const map = new Map<string, any>();

    if (leadIdArray.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < leadIdArray.length; i += CHUNK) {
        const chunk = leadIdArray.slice(i, i + CHUNK);
        try {
          const historyData = await checkedSelect(
            platform
              .from("lead_history")
              .select("*")
              .in("lead_id", chunk)
          );
          historyData.forEach((row) => map.set(row.id, row));
        } catch (e: any) {
          warnings.push(`lead_history batch: ${e.message}`);
        }
      }
    }

    if (companyUserIds.length > 0) {
      try {
        const historyByUser = await checkedSelect(
          platform
            .from("lead_history")
            .select("*")
            .in("changed_by", companyUserIds)
        );
        historyByUser.forEach((row) => map.set(row.id, row));
      } catch (e: any) {
        // ignore
      }
    }

    const rows = Array.from(map.values());
    const count = await upsertRows("lead_history", rows);
    syncedCounts["lead_history"] = count;
  } catch (e: any) {
    warnings.push(`lead_history: ${e.message}`);
  }

  // 4. Sync other standard company-scoped tables
  const otherTables = [
    "company_lead_statuses",
    "real_estate_properties",
    "products",
    "invoices",
    "quotations",
    "forms",
    "form_responses",
    "tasks",
    "notifications",
    "automations",
    "lead_statuses",
    "landing_pages",
    "calendar_bookings",
    "integration_api_keys",
    "invoice_settings",
    "lg_links",
    "whatsapp_accounts",
    "whatsapp_campaigns",
    "whatsapp_campaign_recipients",
    "whatsapp_message_log",
    "email_accounts",
    "email_campaigns",
    "email_campaign_sequences",
    "email_campaign_recipients",
    "email_campaign_logs",
    "email_threads",
    "email_messages",
    "email_integrations",
    "ai_employees",
    "ai_caller_logs",
    "agentic_workflows",
    "agentic_workflow_runs",
  ];

  const migratedInvoiceIds = new Set<string>();
  const migratedQuotationIds = new Set<string>();

  for (const table of otherTables) {
    try {
      const map = new Map<string, any>();
      const byCompany = await checkedSelect(
        platform
          .from(table as any)
          .select("*")
          .eq("company_id", companyId)
      );
      byCompany.forEach((row) => map.set(row.id, row));

      const rows = Array.from(map.values()).map((r) => ({
        ...r,
        company_id: r.company_id || companyId,
      }));

      if (table === "invoices") rows.forEach((r) => migratedInvoiceIds.add(r.id));
      if (table === "quotations") rows.forEach((r) => migratedQuotationIds.add(r.id));

      const count = await upsertRows(table, rows);
      syncedCounts[table] = count;
    } catch (e: any) {
      warnings.push(`Table ${table}: ${e.message}`);
    }
  }

  // 5. Sync invoice_items
  try {
    const invIds = Array.from(migratedInvoiceIds);
    if (invIds.length > 0) {
      const items = await checkedSelect(
        platform
          .from("invoice_items")
          .select("*")
          .in("invoice_id", invIds)
      );
      const count = await upsertRows("invoice_items", items);
      syncedCounts["invoice_items"] = count;
    }
  } catch (e: any) {
    warnings.push(`invoice_items: ${e.message}`);
  }

  // 6. Sync quotation_items
  try {
    const quotIds = Array.from(migratedQuotationIds);
    if (quotIds.length > 0) {
      const items = await checkedSelect(
        platform
          .from("quotation_items")
          .select("*")
          .in("quotation_id", quotIds)
      );
      const count = await upsertRows("quotation_items", items);
      syncedCounts["quotation_items"] = count;
    }
  } catch (e: any) {
    warnings.push(`quotation_items: ${e.message}`);
  }

  // 7. Sync invoice_payments
  try {
    const payments = await checkedSelect(
      platform
        .from("invoice_payments")
        .select("*")
        .eq("company_id", companyId)
    );
    const count = await upsertRows("invoice_payments", payments);
    syncedCounts["invoice_payments"] = count;
  } catch (e: any) {
    warnings.push(`invoice_payments: ${e.message}`);
  }

  // 8. Sync push_subscriptions
  try {
    if (companyUserIds.length > 0) {
      const subs = await checkedSelect(
        platform
          .from("push_subscriptions")
          .select("*")
          .in("user_id", companyUserIds)
      );
      const count = await upsertRows("push_subscriptions", subs);
      syncedCounts["push_subscriptions"] = count;
    }
  } catch (e: any) {
    warnings.push(`push_subscriptions: ${e.message}`);
  }

  // 9. Clean up platform database space for migrated records
  try {
    // Delete child records first to avoid foreign key/referential violations
    const leadHistIds = syncedIdsMap.get("lead_history");
    if (leadHistIds && leadHistIds.length > 0) {
      await platform.from("lead_history").delete().in("id", leadHistIds);
    }
    const invItemIds = syncedIdsMap.get("invoice_items");
    if (invItemIds && invItemIds.length > 0) {
      await platform.from("invoice_items").delete().in("id", invItemIds);
    }
    const quotItemIds = syncedIdsMap.get("quotation_items");
    if (quotItemIds && quotItemIds.length > 0) {
      await platform.from("quotation_items").delete().in("id", quotItemIds);
    }
    const pushSubIds = syncedIdsMap.get("push_subscriptions");
    if (pushSubIds && pushSubIds.length > 0) {
      await platform.from("push_subscriptions").delete().in("id", pushSubIds);
    }

    // Now delete parent/independent records
    const tablesToDelete = [
      ...leadTables,
      ...otherTables,
      "invoice_payments"
    ];

    for (const table of tablesToDelete) {
      const ids = syncedIdsMap.get(table);
      if (ids && ids.length > 0) {
        // Chunk deletes to avoid very large IN arrays in PG queries
        const DEL_CHUNK = 500;
        for (let i = 0; i < ids.length; i += DEL_CHUNK) {
          const chunkIds = ids.slice(i, i + DEL_CHUNK);
          const { error: delErr } = await platform
            .from(table as any)
            .delete()
            .in("id", chunkIds);
          if (delErr) {
            console.warn(`[BYOS Clean] Warning deleting migrated records from platform table ${table}:`, delErr.message);
          }
        }
      }
    }
    console.log(`[BYOS Clean] Successfully freed up platform database space for synced records.`);
  } catch (cleanErr: any) {
    console.error(`[BYOS Clean] Failed to clear platform database records:`, cleanErr.message);
  }

  return { syncedCounts, warnings };
}

// ─── Action: Sync Data Only ──────────────────────────────────────────────────
async function handleSyncData(companyId: string, userId: string) {
  const platform = getPlatformAdminClient();
  const { data: conn } = await platform
    .from("byos_connections")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (!conn) throw new Error("No BYOS connection found. Please connect first.");

  const { data: serviceKey } = await platform.rpc("byos_decrypt_key", {
    encrypted_key: conn.supabase_service_role_key_encrypted,
  });
  if (!serviceKey) throw new Error("Failed to decrypt service role key");

  const customerAdmin = createClient(conn.supabase_url, serviceKey as string);

  // Check if CRM tables exist on customer Supabase
  const { error: tableCheckErr } = await customerAdmin.from("leads").select("id").limit(1);
  if (tableCheckErr && (tableCheckErr.code === "42P01" || tableCheckErr.message?.includes("does not exist") || tableCheckErr.message?.includes("relation"))) {
    throw new Error(
      "SCHEMA_MISSING: The CRM tables (leads, leads_healthcare, etc.) do not exist in your connected Supabase project yet. Please click 'Copy Migration SQL' in BYOS settings, run it in your Supabase SQL Editor, and click Sync again."
    );
  }

  await syncProfilesToCustomer(platform, customerAdmin, companyId, conn.supabase_url, serviceKey as string);
  const syncReport = await syncOrgDataToCustomer(platform, customerAdmin, companyId, conn.supabase_url, serviceKey as string);

  await logBYOSAudit(companyId, "migrate", "success", { syncReport }, userId);
  return {
    success: true,
    message: "Data sync to customer Supabase complete.",
    syncReport,
  };
}

// ─── Main Handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    
    // Bypass authentication for diagnostics check
    if (body.action === "diagnostics") {
      const envKeys = Object.keys(Deno.env.toObject());
      const envDiagnostics: Record<string, any> = {};
      for (const key of envKeys) {
        if (key.includes("SUPABASE") || key.includes("KEY") || key.includes("URL") || key.includes("SECRET")) {
          const val = Deno.env.get(key) || "";
          envDiagnostics[key] = {
            exists: true,
            length: val.length,
            preview: val.length > 8 ? val.slice(0, 4) + "..." + val.slice(-4) : "short"
          };
        }
      }

      // Query database via platform client to see if it works
      let companyQueryRes: any = null;
      let profileQueryRes: any = null;
      try {
        const platform = getPlatformAdminClient();
        companyQueryRes = await platform
          .from("companies")
          .select("id, admin_id, byos_enabled")
          .eq("admin_id", "96468d8f-e07d-4363-b80b-fe006a1d9842");
          
        profileQueryRes = await platform
          .from("profiles")
          .select("company_id")
          .eq("id", "96468d8f-e07d-4363-b80b-fe006a1d9842");
      } catch (dbErr: any) {
        companyQueryRes = { error: dbErr.message };
      }

      return new Response(JSON.stringify({ 
        success: true, 
        envDiagnostics, 
        companyQueryRes, 
        profileQueryRes,
        body 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, companyId } = await authenticateAdmin(req, body);
    const action = body.action;

    let result: any;

    switch (action) {
      case "validate":
        result = await handleValidate(body);
        break;
      case "connect":
        result = await handleConnect(companyId, userId, body);
        break;
      case "migrate":
        result = await handleMigrate(companyId, userId, body);
        break;
      case "sync-data":
        result = await handleSyncData(companyId, userId);
        break;
      case "health":
        result = await handleHealthCheck(companyId);
        break;
      case "disconnect":
        result = await handleDisconnect(companyId, userId);
        break;
      case "unlock":
        result = await handleUnlock(companyId, userId);
        break;
      case "status":
        result = await handleStatus(companyId);
        break;
      default:
        throw new Error(`Unknown action: ${action}. Valid actions: unlock, validate, connect, migrate, sync-data, health, disconnect, status`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[byos-manage] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
