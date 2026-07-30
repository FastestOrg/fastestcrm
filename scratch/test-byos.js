import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://api.fastestcrm.com';
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function run() {
    console.log("Calling byos-manage status endpoint...");
    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/byos-manage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`
            },
            body: JSON.stringify({ action: 'diagnostics' })
        });
        
        console.log("Response status:", response.status);
        console.log("Response headers:", Object.fromEntries(response.headers.entries()));
        const body = await response.text();
        console.log("Response body:", body);
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

run();
