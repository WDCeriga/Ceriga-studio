import fs from 'node:fs';
import {build} from 'esbuild';
// Derive tiny fit previews from existing artwork, dropping traced stitch/texture fragments.
await build({entryPoints:['src/app/features/panelling/panellingGeometry.ts'],bundle:true,platform:'node',format:'esm',outfile:'node_modules/.cache/fit-thumbnail-geometry.mjs'});
const {flattenAbsolutePath}=await import('../node_modules/.cache/fit-thumbnail-geometry.mjs');
const directory='src/assets/studio-tshirt/fit-thumbnails';fs.mkdirSync(directory,{recursive:true});
const bounds=p=>({left:Math.min(...p.map(v=>v.x)),right:Math.max(...p.map(v=>v.x)),top:Math.min(...p.map(v=>v.y)),bottom:Math.max(...p.map(v=>v.y))});
for(const [fit,file]of Object.entries({slim:'slim-vneck-lineart.svg',regular:'regular-tshirt-lineart.svg',boxy:'boxy-tshirt-lineart.svg',oversized:'oversized-tshirt-lineart.svg'})){
 const raw=fs.readFileSync('src/assets/studio-tshirt/'+file,'utf8');
 const contours=[...raw.matchAll(/\bd="([^"]+)"/g)].flatMap(m=>m[1].match(/M[^M]*/g)??[]).map(d=>{const p=flattenAbsolutePath(d,2);return{p,area:Math.abs(p.reduce((a,v,i)=>{const n=p[(i+1)%p.length];return a+v.x*n.y-n.x*v.y},0)/2)}}).filter(v=>v.p.length>2).sort((a,b)=>b.area-a.area);
 const outer=contours[0],box=bounds(outer.p),width=box.right-box.left,height=box.bottom-box.top,cx=(box.left+box.right)/2;
 const neck=contours.find(c=>{const b=bounds(c.p);return c.area<outer.area*.1&&c.area>outer.area*.0005&&Math.abs((b.left+b.right)/2-cx)<width*.15&&b.bottom<box.top+height*.4&&b.right-b.left<width*.5});
 const path=p=>'M'+p.map(v=>v.x.toFixed(1)+','+v.y.toFixed(1)).join('L')+'Z';
 const pad=width*.04,stroke=height*.018;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+[box.left-pad,box.top-pad,width+pad*2,height+pad*2].join(' ')+'"><path d="'+path(outer.p)+'" fill="#ffffff" stroke="#283448" stroke-width="'+stroke+'" stroke-linejoin="round"/>'+(neck?'<path d="'+path(neck.p)+'" fill="none" stroke="#283448" stroke-width="'+stroke*.8+'" stroke-linejoin="round"/>':'')+'</svg>';
 fs.writeFileSync(directory+'/'+fit+'.svg',svg);console.log(fit,neck?'outline + neckline':'outline');
}
