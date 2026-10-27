import fs from 'node:fs/promises';
import path from 'node:path';
export async function exportSandboxViewer(root){
 let html=await fs.readFile(new URL('./order-sandbox-viewer.html',import.meta.url),'utf8');
 const snapshot=await fs.readFile(path.join(root,'snapshot.json'),'utf8');
 html=html.replace('<script>',()=>'<script id="seed-data" type="application/json">'+snapshot.replace(/</g,'\\u003c')+'</script><script>');
 html=html.replace("fetch('/api/data').then(r=>{if(!r.ok)throw Error('Unable to load persisted sandbox snapshot');return r.json()})","Promise.resolve(JSON.parse(document.getElementById('seed-data').textContent))").replaceAll('/media/qc-evidence/','storage/qc-evidence/');
 new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 await fs.writeFile(path.join(root,'viewer.html'),html);
}
