// Vercel serverless proxy for submit-external-lead
// Injects the required Supabase API key so callers only need to POST JSON.
export default async function handler(req, res) {
    // Only allow POST (and OPTIONS for CORS preflight)
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://uykdyqdeyilpulaqlqip.supabase.co';
    const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!ANON_KEY) {
        return res.status(500).json({ error: 'Missing Supabase publishable/anon key in environment variables' });
    }

    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/submit-external-lead`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${ANON_KEY}`,
                },
                body: JSON.stringify(req.body),
            }
        );

        const data = await response.json();

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(response.status).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Proxy error: ' + error.message });
    }
}
