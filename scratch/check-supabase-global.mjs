import fs from 'node:fs';

const code = fs.readFileSync('C:/Users/LENOVO/TaniSM/js/lib/supabase.js', 'utf8');
globalThis.window = globalThis;
(0, eval)(code);
console.log('typeof global supabase     :', typeof globalThis.supabase);
console.log('typeof window.supabase     :', typeof globalThis.window.supabase);
if (typeof globalThis.supabase === 'object') {
  console.log('has createClient           :', typeof globalThis.supabase.createClient);
}
