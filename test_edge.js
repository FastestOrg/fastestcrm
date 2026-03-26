import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const companyId = 'c1b84f9b-6b22-482a-aef2-bc0cced1ab96'; // From user command history

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing SUPABASE env vars.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Invoking Edge Function...');
  try {
    const { data, error } = await supabase.functions.invoke('generate-ai-insights', {
      body: { company_id: companyId }
    });
    
    console.log('\n--- DATA ---');
    console.log(data);
    
    console.log('\n--- ERROR ---');
    console.log(error);
  } catch(e) {
    console.error('\n--- EXCEPTION ---');
    console.error(e);
  }
}

test();
