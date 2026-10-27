import fs from 'node:fs/promises';
const marker='-- Audit security and routing (20261022050000)';
let schema=await fs.readFile('supabase/schema.sql','utf8');
schema=schema.slice(0,schema.indexOf(marker)>=0?schema.indexOf(marker):schema.length).trimEnd();
for(const file of(await fs.readdir('supabase/migrations')).filter(file=>/^202610(?:22\d+_audit_|24\d+_dashboard_|25\d+_smart_)/.test(file)).sort()){
 const stamp=file.slice(0,14);schema+='\n\n'+(stamp==='20261022050000'?marker:`-- Audit features (${stamp})`)+'\n'+await fs.readFile('supabase/migrations/'+file,'utf8');
}
await fs.writeFile('supabase/schema.sql',schema+'\n');
