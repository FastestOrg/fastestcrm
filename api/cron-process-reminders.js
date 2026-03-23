// Cron handler – invokes the Supabase process-reminders edge function.
// Designed to be triggered by external cron services like cron-job.org every minute.
// Setup requires a GET request to this endpoint with Authorization: Bearer <CRON_SECRET>.
export default async function handler(req, res) {
    // Cron calls with GET; also allow POST for manual triggers
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify the request comes from Vercel Cron (optional but recommended)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const SUPABASE_URL = 'https://uykdyqdeyilpulaqlqip.supabase.co';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SERVICE_ROLE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY not set');
        return res.status(500).json({ error: 'Missing service role key' });
    }

    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/process-reminders`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({}),
            }
        );

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Cron error:', error);
        return res.status(500).json({ error: 'Failed to invoke process-reminders: ' + error.message });
    }
}
