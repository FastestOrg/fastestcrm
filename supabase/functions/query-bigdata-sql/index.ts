import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";




interface QueryRequest {
    action: 'list_tables' | 'get_schema' | 'query_data' | 'get_count';
    tableName?: string;
    filters?: Record<string, any>;
    phoneSearch?: string;
    limit?: number;
    offset?: number;
}

// Helper function to convert BigInt to string for JSON serialization
function convertBigIntToString(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map(convertBigIntToString);
    if (typeof obj === 'object') {
        const converted: any = {};
        for (const [key, value] of Object.entries(obj)) {
            converted[key] = convertBigIntToString(value);
        }
        return converted;
    }
    return obj;
}

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
        const bigdataDbUrl = Deno.env.get("BIGDATA_DATABASE_URL");

        if (!bigdataDbUrl) {
            throw new Error("BIGDATA_DATABASE_URL not configured");
        }

        const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // Verify user is authenticated
        const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''));
        if (userError || !user) {
            throw new Error("Unauthorized");
        }

        // Verify user is company admin
        const { data: profile } = await supabaseAuth
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!profile?.company_id) {
            throw new Error("User not associated with a company");
        }

        const { data: company } = await supabaseAuth
            .from('companies')
            .select('admin_id')
            .eq('id', profile.company_id)
            .single();

        if (!company || company.admin_id !== user.id) {
            throw new Error("Access denied: Only company admins can access Bigdata SQL");
        }

        // Parse request body
        const requestBody: QueryRequest = await req.json();
        const { action, tableName, filters, phoneSearch, limit = 100, offset = 0 } = requestBody;

        // Connect to CockroachDB
        const client = new Client(bigdataDbUrl);
        await client.connect();

        try {
            let result;

            switch (action) {
                case 'list_tables':
                    // Query to list all tables in the database
                    result = await client.queryObject(
                        `SELECT table_name 
             FROM information_schema.tables 
             WHERE table_schema = 'public' 
             ORDER BY table_name`
                    );

                    await client.end();

                    return new Response(
                        JSON.stringify({ data: convertBigIntToString(result.rows) }),
                        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );

                case 'get_schema':
                    if (!tableName) {
                        throw new Error("Table name required for get_schema action");
                    }
                    // Get column information for a specific table
                    result = await client.queryObject(
                        `SELECT column_name, data_type, is_nullable
             FROM information_schema.columns
             WHERE table_name = $1 AND table_schema = 'public'
             ORDER BY ordinal_position`,
                        [tableName]
                    );

                    await client.end();

                    return new Response(
                        JSON.stringify({ data: convertBigIntToString(result.rows) }),
                        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );

                case 'get_count':
                    if (!tableName) {
                        throw new Error("Table name required for get_count action");
                    }

                    // Sanitize table name
                    const sanitizedCountTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
                    const countQuery = `SELECT COUNT(*) as count FROM "${sanitizedCountTableName}"`;

                    try {
                        const countResult = await client.queryObject(countQuery);
                        await client.end();

                        const count = (countResult.rows[0] as any).count;

                        return new Response(
                            JSON.stringify({ count: convertBigIntToString(count) }),
                            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        );
                    } catch (countError: any) {
                        console.error('Count query error:', countError);
                        await client.end();
                        throw new Error(`Count query failed: ${countError.message}`);
                    }

                case 'query_data':
                    if (!tableName) {
                        throw new Error("Table name required for query_data action");
                    }

                    // Sanitize and quote table name for CockroachDB
                    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
                    // Build dynamic query with filters - use double quotes for table name
                    let query = `SELECT * FROM "${sanitizedTableName}"`;
                    const params: any[] = [];
                    const conditions: string[] = [];
                    let paramIndex = 1;

                    // Add phone search if provided
                    if (phoneSearch) {
                        // Assuming phone number is stored in a column that contains 'phone' in its name
                        const schemaResult = await client.queryObject(
                            `SELECT column_name 
               FROM information_schema.columns
               WHERE table_name = $1 AND column_name ILIKE '%phone%'
               LIMIT 1`,
                            [tableName]
                        );

                        if (schemaResult.rows.length > 0) {
                            const phoneColumn = (schemaResult.rows[0] as any).column_name;
                            conditions.push(`"${phoneColumn}"::text ILIKE $${paramIndex}`);
                            params.push(`%${phoneSearch}%`);
                            paramIndex++;
                        }
                    }

                    // Add other filters
                    if (filters && Object.keys(filters).length > 0) {
                        for (const [column, value] of Object.entries(filters)) {
                            if (value !== null && value !== undefined && value !== '') {
                                // Sanitize column name (basic protection)
                                const sanitizedColumn = column.replace(/[^a-zA-Z0-9_]/g, '');
                                conditions.push(`"${sanitizedColumn}"::text ILIKE $${paramIndex}`);
                                params.push(`%${value}%`);
                                paramIndex++;
                            }
                        }
                    }

                    if (conditions.length > 0) {
                        query += ' WHERE ' + conditions.join(' AND ');
                    }

                    // Add pagination - fetch limit + 1 to check if there are more results
                    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
                    params.push(limit + 1, offset); // Fetch one extra to check for more

                    try {
                        result = await client.queryObject(query, params);
                    } catch (queryError: any) {
                        console.error('Database query error:', queryError);
                        await client.end();
                        throw new Error(`Database query failed: ${queryError.message}`);
                    }

                    // Check if there are more results
                    const hasMore = result.rows.length > limit;
                    const records = hasMore ? result.rows.slice(0, limit) : result.rows;

                    await client.end();

                    return new Response(
                        JSON.stringify({
                            data: convertBigIntToString(records),
                            hasMore,
                            limit,
                            offset
                        }),
                        {
                            status: 200,
                            headers: { ...corsHeaders, "Content-Type": "application/json" }
                        }
                    );

                default:
                    throw new Error(`Unknown action: ${action}`);
            }

        } catch (dbError: any) {
            await client.end();
            throw new Error(`Database error: ${dbError.message}`);
        }

    } catch (error: any) {
        console.error("Query bigdata SQL error:", error);
        return new Response(
            JSON.stringify({
                error: error.message || "Internal server error",
                details: error.toString(),
                stack: error.stack
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});
