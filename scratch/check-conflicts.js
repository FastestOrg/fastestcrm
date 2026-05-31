import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConflicts() {
  const userId = '3391ee18-32f1-4d69-af22-23e8c618487c';
  console.log(`Fetching calendar events for user ${userId}...`);
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${data.length} events:`);
    for (const e of data) {
      console.log({
        id: e.id,
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
        status: e.status
      });
    }
  }
}

checkConflicts().catch(console.error);
