import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




interface InviteRequest {
  email: string;
  fullName: string;
  password: string;
  role: string;
}

const ROLE_LEVELS: Record<string, number> = {
  company: 1, company_subadmin: 2, cbo: 3, vp: 4, avp: 5,
  dgm: 6, agm: 7, sm: 8, tl: 9, bde: 10, intern: 11, ca: 12,
  level_3: 3, level_4: 4, level_5: 5, level_6: 6, level_7: 7, level_8: 8,
  level_9: 9, level_10: 10, level_11: 11, level_12: 12, level_13: 13,
  level_14: 14, level_15: 15, level_16: 16, level_17: 17, level_18: 18,
  level_19: 19, level_20: 20
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get and validate authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client for verifying the requester
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Admin client for creating users
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get the requesting user
    const { data: { user: requester }, error: userError } = await supabaseAuth.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''));
    if (userError || !requester) {
      console.error("Auth error:", userError);
      throw new Error("Unauthorized: " + (userError?.message || "User not found"));
    }

    // PARALLEL: Fetch Profile, Role, and Owned Company simultaneously
    const [profileResult, roleResult, ownedCompanyResult] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, company_id, full_name, email, manager_id")
        .eq("id", requester.id)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", requester.id)
        .maybeSingle(),
      supabaseAdmin
        .from("companies")
        .select("id")
        .eq("admin_id", requester.id)
        .maybeSingle()
    ]);

    const { data: requesterProfile, error: requesterProfileError } = profileResult;
    let { data: requesterRoleData, error: roleError } = roleResult;
    const { data: ownedCompany, error: ownedCompanyError } = ownedCompanyResult;

    if (ownedCompanyError) {
      console.error("Owned company fetch error:", ownedCompanyError);
    }

    if (requesterProfileError) {
      console.error("Requester profile fetch error:", requesterProfileError);
      throw new Error("Could not verify your profile: " + requesterProfileError.message);
    }

    if (roleError) {
      console.error("Role fetch error:", roleError);
      throw new Error("Could not verify your role");
    }

    // Determine Company ID: Prefer Profile, fallback to Owned Company
    let requesterCompanyId: string | null = requesterProfile?.company_id ?? ownedCompany?.id ?? null;

    if (!requesterCompanyId) {
      throw new Error("Your account is not linked to a company.");
    }

    // Determine Role: Prefer explicit role, fallback to 'company' if they are the Admin of the target company
    if (!requesterRoleData) {
      // Check if they are the admin of the company they are trying to act within
      if (ownedCompany && ownedCompany.id === requesterCompanyId) {
        console.log("User is validated as company admin (fallback). Defaulting to 'company' role.");
        requesterRoleData = { role: 'company' };
      } else {
        throw new Error("You do not have a role assigned.");
      }
    }

    // Create the requester's profile row if missing (prevents FK failure when inviting someone)
    if (!requesterProfile) {
      const requesterFullName = (requester.user_metadata as Record<string, unknown> | null)?.["full_name"];

      const { error: ensureRequesterProfileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: requester.id,
          email: requester.email,
          full_name: typeof requesterFullName === "string" ? requesterFullName : null,
          manager_id: null,
          company_id: requesterCompanyId,
        });

      if (ensureRequesterProfileError) {
        console.error("Ensure requester profile error:", ensureRequesterProfileError);
        throw new Error("Could not create your profile record: " + ensureRequesterProfileError.message);
      }
    }

    // Parse and validate request body
    const body: InviteRequest = await req.json();
    console.log("Invite request received:", JSON.stringify(body));
    const { email, fullName, password, role } = body;

    // Input validation
    if (!email || !fullName || !password || !role) {
      throw new Error("Missing required fields");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Validate full name length
    if (fullName.length > 100) {
      throw new Error("Full name must be less than 100 characters");
    }

    // Validate password
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Validate role is in allowed list - O(1) lookup
    // Using hasOwnProperty to ensure we don't pick up prototype properties, though not strict here
    // Also ensuring it maps to a valid level number
    if (ROLE_LEVELS[role] === undefined) {
      throw new Error("Invalid role");
    }

    const requesterLevel = ROLE_LEVELS[requesterRoleData.role] || 99;
    const targetLevel = ROLE_LEVELS[role] || 99;

    // Server-side validation: requester can only assign roles below their level
    if (requesterLevel >= targetLevel) {
      console.log(`Permission denied: requester level ${requesterLevel} cannot assign level ${targetLevel}`);
      throw new Error("You cannot assign this role. You can only assign roles below your level.");
    }

    console.log(`Creating user ${email} with role ${role} requested by ${requester.email}`);

    // Create the user with admin client
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        manager_id: requester.id
      }
    });

    if (signUpError) {
      console.error("Signup error:", signUpError);
      throw new Error(signUpError.message);
    }

    const newUserId = signUpData.user?.id;
    if (!newUserId) {
      throw new Error("Failed to create user (no ID returned)");
    }

    // Ensure the new user is added to profiles with correct manager_id + company_id
    // PARALLEL: Create Profile and Assign Role simultaneously
    // Both depend on 'newUserId' but are independent of each other.
    const [upsertProfileResult, insertRoleResult] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: newUserId,
            email,
            full_name: fullName,
            manager_id: requester.id,
            company_id: requesterCompanyId,
          },
          { onConflict: "id" }
        ),
      supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newUserId, role }, { onConflict: "user_id" })
    ]);

    const { error: upsertProfileError } = upsertProfileResult;
    const { error: upsertRoleError } = insertRoleResult;

    // Handle errors (Rollback if needed)
    if (upsertProfileError || upsertRoleError) {
      console.error("Error during parallel creation:", { upsertProfileError, upsertRoleError });

      // If ANY failed, we should probably delete the user to keep things clean.
      // Ideally we would revert the successful one too, but deleting the user usually cascades if setup correctly,
      // or effectively "disables" them since they won't be able to login without a profile/role often.
      await supabaseAdmin.auth.admin.deleteUser(newUserId);

      const errorMessage = upsertProfileError?.message || upsertRoleError?.message || "Failed to setup user details";
      throw new Error(errorMessage);
    }

    console.log(`Successfully invited ${email} as ${role} by ${requester.email}`);

    // Auto-create email alias if company has active email integration
    let aliasCreated = false;
    try {
      const { data: emailIntegration } = await supabaseAdmin
        .from("email_integrations")
        .select("id, is_active, admin_email, access_token, refresh_token, token_expires_at")
        .eq("company_id", requesterCompanyId)
        .eq("is_active", true)
        .maybeSingle();

      if (emailIntegration?.admin_email) {
        const domain = emailIntegration.admin_email.split("@")[1];
        if (domain) {
          // Generate alias from email prefix or full name
          const aliasPrefix = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
          const aliasEmail = `${aliasPrefix}@${domain}`;

          // Check if alias already exists
          const { data: existingAlias } = await supabaseAdmin
            .from("email_aliases")
            .select("id")
            .eq("alias_email", aliasEmail)
            .eq("company_id", requesterCompanyId)
            .maybeSingle();

          if (!existingAlias) {
            // Save alias in DB
            const { error: aliasError } = await supabaseAdmin
              .from("email_aliases")
              .insert({
                company_id: requesterCompanyId,
                user_id: newUserId,
                alias_email: aliasEmail,
                display_name: fullName,
              });

            if (aliasError) {
              console.error("Auto-alias creation DB error:", aliasError);
            } else {
              aliasCreated = true;
              console.log(`Auto-created email alias ${aliasEmail} for ${fullName}`);

              // Try to add alias in Microsoft Graph as proxy address
              try {
                let accessToken = emailIntegration.access_token;
                const expiresAt = new Date(emailIntegration.token_expires_at);

                // Refresh token if expired
                if (expiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
                  const CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
                  const CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");
                  if (CLIENT_ID && CLIENT_SECRET && emailIntegration.refresh_token) {
                    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
                      method: "POST",
                      headers: { "Content-Type": "application/x-www-form-urlencoded" },
                      body: new URLSearchParams({
                        client_id: CLIENT_ID,
                        client_secret: CLIENT_SECRET,
                        refresh_token: emailIntegration.refresh_token,
                        grant_type: "refresh_token",
                        scope: "openid profile email offline_access Mail.Read Mail.Send Mail.ReadWrite User.Read User.ReadWrite.All",
                      }),
                    });
                    const tokenData = await tokenRes.json();
                    if (tokenRes.ok) {
                      accessToken = tokenData.access_token;
                      await supabaseAdmin
                        .from("email_integrations")
                        .update({
                          access_token: tokenData.access_token,
                          refresh_token: tokenData.refresh_token || emailIntegration.refresh_token,
                          token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
                        })
                        .eq("id", emailIntegration.id);
                    }
                  }
                }

                if (accessToken) {
                  // Find Microsoft user matching the new member's email
                  const usersRes = await fetch(
                    `https://graph.microsoft.com/v1.0/users?$filter=mail eq '${email}' or userPrincipalName eq '${email}'&$select=id,proxyAddresses`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                  );
                  const usersData = await usersRes.json();
                  const msUser = usersData.value?.[0];

                  if (msUser) {
                    const currentProxies = msUser.proxyAddresses || [];
                    const newProxy = `smtp:${aliasEmail}`;
                    if (!currentProxies.includes(newProxy)) {
                      await fetch(`https://graph.microsoft.com/v1.0/users/${msUser.id}`, {
                        method: "PATCH",
                        headers: {
                          Authorization: `Bearer ${accessToken}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ proxyAddresses: [...currentProxies, newProxy] }),
                      });
                    }
                  }
                }
              } catch (graphErr) {
                console.error("Graph API auto-alias error (non-blocking):", graphErr);
              }
            }
          }
        }
      }
    } catch (aliasErr) {
      console.error("Auto-alias creation error (non-blocking):", aliasErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: newUserId,
        aliasCreated,
        message: `${fullName} has been added successfully.${aliasCreated ? ' Email alias was auto-created.' : ''}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
