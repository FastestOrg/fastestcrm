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

async function testQuery() {
  console.log('Testing booking page query using anon client...');
  // Let's first list all booking pages (this will be subject to is_active = true)
  const { data: allBookingPages, error: err1 } = await supabase
    .from('booking_pages')
    .select('*');
    
  if (err1) {
    console.error('Error fetching all booking pages:', err1);
  } else {
    console.log('All booking pages (anonymous client):', allBookingPages);
  }

  // Let's query companies
  const { data: allCompanies, error: err2 } = await supabase
    .from('companies')
    .select('id, name, slug');
    
  if (err2) {
    console.error('Error fetching companies:', err2);
  } else {
    console.log('All companies:', allCompanies);
  }

  // Let's fetch one profile
  if (allBookingPages && allBookingPages.length > 0) {
    const userId = allBookingPages[0].user_id;
    const { data: profile, error: err3 } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
      
    if (err3) {
      console.error('Error fetching profile:', err3);
    } else {
      console.log('Profile associated with first booking page:', profile);
    }

    // Try the composite query
    const { data: joinedData, error: err4 } = await supabase
      .from('booking_pages')
      .select(`
        *, 
        profiles:user_id(full_name, avatar_url), 
        companies!inner(name, logo_url, slug)
      `)
      .eq('slug', allBookingPages[0].slug)
      .eq('companies.slug', allCompanies.find(c => c.id === allBookingPages[0].company_id)?.slug || '')
      .eq('is_active', true)
      .maybeSingle();

    if (err4) {
      console.error('Error in joined query:', err4);
    } else {
      console.log('Joined query results:', joinedData);
    }
  }
}

testQuery().catch(console.error);
