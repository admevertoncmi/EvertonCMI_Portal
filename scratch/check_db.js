
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'materiais' });
  if (error) {
    console.error('Error fetching table info:', error);
    // Fallback: try to select one row
    const { data: row, error: rowError } = await supabase.from('materiais').select('*').limit(1);
    if (rowError) console.error('Error selecting row:', rowError);
    else console.log('Sample row:', row);
  } else {
    console.log('Table info:', data);
  }
}

checkSchema();
