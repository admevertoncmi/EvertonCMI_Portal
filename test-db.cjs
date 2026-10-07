const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('materiais').select('roteiro, titulo, id').order('created_at', {ascending: false}).limit(5);
  console.log('Error:', error);
  if (data) {
    data.forEach((d, i) => {
      console.log(`\n--- Roteiro ${i+1}: ${d.titulo} (${d.id}) ---`);
      console.log(JSON.stringify(d.roteiro));
    });
  }
}
run();
