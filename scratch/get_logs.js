import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uykdyqdeyilpulaqlqip.supabase.co';
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function check() {
    console.log("Fetching logs from:", supabaseUrl);
    try {
        const resLogs = await fetch(`${supabaseUrl}/rest/v1/ai_caller_logs?select=*&order=created_at.desc&limit=5`, {
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        console.log("ai_caller_logs response status:", resLogs.status);
        const logs = await resLogs.json();
        console.log("\n--- RECENT AI CALLER LOGS ---");
        console.log(JSON.stringify(logs, null, 2));

        const resDebug = await fetch(`${supabaseUrl}/rest/v1/debug_logs?select=*&order=created_at.desc&limit=10`, {
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`
            }
        });
        console.log("\ndebug_logs response status:", resDebug.status);
        const debugLogs = await resDebug.json();
        console.log("\n--- RECENT DEBUG LOGS ---");
        console.log(JSON.stringify(debugLogs, null, 2));
    } catch (err) {
        console.error("Error fetching logs:", err);
    }
}

check();
