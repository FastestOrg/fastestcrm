import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uykdyqdeyilpulaqlqip.supabase.co';
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function check() {
    console.log("Fetching policies from:", supabaseUrl);
    try {
        const resLogs = await fetch(`${supabaseUrl}/rest/v1/temp_debug_policies?select=*`, {
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        console.log("Response status:", resLogs.status);
        const policies = await resLogs.json();
        console.log("\n--- ACTIVE POLICIES ---");
        console.log(JSON.stringify(policies, null, 2));
    } catch (err) {
        console.error("Error fetching policies:", err);
    }
}

check();
