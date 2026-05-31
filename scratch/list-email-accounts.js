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

async function listEmailAccounts() {
  console.log('Fetching all email accounts...');
  const { data, error } = await supabase
    .from('email_accounts')
    .select('*');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('All email accounts:', data.map(d => ({
      id: d.id,
      email_address: d.email_address,
      provider: d.provider,
      status: d.status,
      has_access_token: !!d.access_token,
      has_refresh_token: !!d.refresh_token,
      token_expires_at: d.token_expires_at
    })));
  }
}

listEmailAccounts().catch(console.error);
