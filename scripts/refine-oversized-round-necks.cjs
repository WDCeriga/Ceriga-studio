const fs=require('node:fs');
const path=require('node:path');
const svgpath=require('svgpath');
// Lower the raised shoulder junction and flatten oversized round necklines.
// Warp every registered surface together so opening, band, body and ink stay sealed.
for(const kind of ['scoop','thincrew']) {
 for(const file of fs.readdirSync('src/assets/tshirt-necks').filter(f=>f.startsWith(`oversized.${kind}.`)&&f.endsWith('.svg'))) {
  const target=path.join('src/assets/tshirt-necks',file);
  let source=fs.readFileSync(target,'utf8');
  if(source.includes('data-oversized-round-refinement')) continue;
  const stack=[1];
  source=source.replace(/<g\b[^>]*>|<\/g>|<path\b[^>]*>/g,tag=>{
   if(tag.startsWith('</g')){stack.pop();return tag;}
   if(tag.startsWith('<g')){const scale=Number(tag.match(/transform="scale\(([^)]+)\)"/)?.[1]??1);stack.push(stack.at(-1)*scale);return tag;}
   const scale=stack.at(-1);
   return tag.replace(/\bd="([^"]*)"/,(_,d)=>{
    const p=svgpath(d).abs().unshort().unarc();
    p.iterate((seg,index,x,y)=>{
     if(seg[0]==='H') seg.splice(0,seg.length,'L',seg[1],y);
     if(seg[0]==='V') seg.splice(0,seg.length,'L',x,seg[1]);
     for(let i=1;i+1<seg.length;i+=2){
      const wx=seg[i]*scale,wy=seg[i+1]*scale;
      const lateral=Math.max(0,Math.min(1,(430-Math.abs(wx-1024))/160));
      const vertical=Math.max(0,Math.min(1,(730-wy)/100));
      const weight=lateral*lateral*(3-2*lateral)*vertical*vertical*(3-2*vertical);
      const anchor=kind==='scoop'?298:296;
      const delta=(kind==='scoop'?32:24)-(wy-anchor)*.22;
      seg[i+1]=(wy+delta*weight)/scale;
     }
    });
    return `d="${p.round(3).toString()}"`;
   });
  }).replace('<svg ','<svg data-oversized-round-refinement="true" ');
  fs.writeFileSync(target,source);
 }
}

// Match the external shoulder slope to the oversized V-neck registration.
const shoulderProfiles={"thincrew": {"left": 825, "right": 1219, "deltas": [[500, 1], [508, 2], [516, 1], [524, 2], [532, 1], [540, 1], [548, 1], [556, 2], [564, 1], [572, 0], [580, 2], [588, 1], [596, 0], [604, 0], [612, 0], [620, 0], [628, 1], [636, 1], [644, 1], [652, 1], [660, 0], [668, 1], [676, 1], [684, 1], [692, 0], [700, -2], [708, -4], [716, -4], [724, -5], [732, -6], [740, -7], [748, -8], [756, -8], [764, -10], [772, -10], [780, -11], [788, -10], [796, -5], [804, 0], [812, 2], [820, 1], [825, 0], [1219, -1], [1227, 0], [1235, 1], [1243, -1], [1251, -5], [1259, -8], [1267, -11], [1275, -10], [1283, -8], [1291, -9], [1299, -8], [1307, -7], [1315, -6], [1323, -5], [1331, -3], [1339, -2], [1347, -2], [1355, -2], [1363, -1], [1371, 0], [1379, 0], [1387, 1], [1395, 1], [1403, 1], [1411, 1], [1419, 1], [1427, 0], [1435, 0], [1443, 0], [1451, 2], [1459, 0], [1467, 0], [1475, 0], [1483, 2], [1491, 2], [1499, 1], [1507, 2], [1515, 3], [1523, 2], [1531, 3], [1539, 2], [1547, 3]]}, "scoop": {"left": 799, "right": 1259, "deltas": [[500, 1], [508, 2], [516, 1], [524, 2], [532, 1], [540, 1], [548, 1], [556, 2], [564, 1], [572, 0], [580, 2], [588, 1], [596, 0], [604, 0], [612, 0], [620, 0], [628, 0], [636, -1], [644, -1], [652, -1], [660, -3], [668, -3], [676, -3], [684, -4], [692, -7], [700, -8], [708, -10], [716, -11], [724, -13], [732, -14], [740, -15], [748, -16], [756, -16], [764, -18], [772, -18], [780, -20], [788, -16], [796, -13], [799, -11], [1259, -17], [1267, -19], [1275, -19], [1283, -17], [1291, -18], [1299, -16], [1307, -16], [1315, -14], [1323, -13], [1331, -11], [1339, -9], [1347, -8], [1355, -7], [1363, -6], [1371, -5], [1379, -3], [1387, -2], [1395, -2], [1403, -1], [1411, 0], [1419, 0], [1427, 0], [1435, 0], [1443, 0], [1451, 2], [1459, 0], [1467, 0], [1475, 0], [1483, 2], [1491, 2], [1499, 1], [1507, 2], [1515, 3], [1523, 2], [1531, 3], [1539, 2], [1547, 3]]}};

for(const kind of ['scoop','thincrew']){
 const samples=shoulderProfiles[kind].deltas;
 const deltaAt=x=>{if(x<samples[0][0]||x>samples.at(-1)[0])return 0;let i=1;while(i<samples.length&&samples[i][0]<x)i++;const a=samples[i-1],b=samples[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);};
 for(const file of fs.readdirSync('src/assets/tshirt-necks').filter(f=>f.startsWith(`oversized.${kind}.`)&&f.endsWith('.svg'))){
  const target=path.join('src/assets/tshirt-necks',file);let source=fs.readFileSync(target,'utf8');if(source.includes('data-shoulder-registration'))continue;
  const stack=[1];source=source.replace(/<g\b[^>]*>|<\/g>|<path\b[^>]*>/g,tag=>{
   if(tag.startsWith('</g')){stack.pop();return tag;}if(tag.startsWith('<g')){stack.push(stack.at(-1)*Number(tag.match(/transform="scale\(([^)]+)\)"/)?.[1]??1));return tag;}
   const scale=stack.at(-1);return tag.replace(/\bd="([^"]*)"/,(_,d)=>{const p=svgpath(d).abs().unshort().unarc();p.iterate((seg,index,x,y)=>{if(seg[0]==='H')seg.splice(0,seg.length,'L',seg[1],y);if(seg[0]==='V')seg.splice(0,seg.length,'L',x,seg[1]);for(let i=1;i+1<seg.length;i+=2){const wx=seg[i]*scale,wy=seg[i+1]*scale;const fade=Math.max(0,Math.min(1,(720-wy)/200));seg[i+1]=(wy+deltaAt(wx)*fade*fade*(3-2*fade))/scale;}});return `d="${p.round(3).toString()}"`;});
  }).replace('<svg ','<svg data-shoulder-registration="oversized-vneck" ');fs.writeFileSync(target,source);
 }
}
