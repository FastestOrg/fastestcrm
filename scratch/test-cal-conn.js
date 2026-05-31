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

async function testCalConn() {
  console.log('Fetching booking pages...');
  const { data: bpList, error: bpErr } = await supabase
    .from('booking_pages')
    .select('*');

  if (bpErr) {
    console.error('Error fetching booking pages:', bpErr);
    return;
  }

  console.log(`Found ${bpList.length} booking pages.`);
  for (const bp of bpList) {
    console.log(`\nBooking Page ID: ${bp.id}, Slug: ${bp.slug}, User ID: ${bp.user_id}`);
    
    // Query calendar connection
    const { data: conn, error: connErr } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', bp.user_id);

    if (connErr) {
      console.error(`  Error fetching calendar connection for user ${bp.user_id}:`, connErr);
    } else {
      console.log(`  Found ${conn.length} calendar connections:`);
      for (const c of conn) {
        console.log({
          id: c.id,
          provider: c.provider,
          is_active: c.is_active,
          has_access_token: !!c.access_token,
          has_refresh_token: !!c.refresh_token,
          token_expires_at: c.token_expires_at,
          calendar_id: c.calendar_id,
          updated_at: c.updated_at
        });
      }
    }
  }
}

testCalConn().catch(console.error);
