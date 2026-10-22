import polygonClipping,{type MultiPolygon} from 'polygon-clipping';
import {preloadTshirtNeckPack} from '../src/app/data/tshirtNeckPack';
import {useState} from 'react';
import {getDefaultGarmentSelection,getGarmentAssetsForFit,applyGarmentSelectionLinks,preloadGarmentSvgAssets,resolveGarmentLayers} from '../src/app/data/garmentSvgCatalog';
import {preloadTshirtSleeveAssets} from '../src/app/data/tshirtLongSleeves';
import {withRegularConstruction,fabricRings} from '../src/app/data/regularConstruction';
import {withTshirtSurfaceQuality} from '../src/app/data/tshirtSurfaceQuality';
import {signedArea,pointInLoop,flattenPathContours} from '../src/app/features/panelling/panellingGeometry';
const polygon=(ring:{x:number;y:number}[]):MultiPolygon=>[[[...ring,ring[0]].map(p=>[Math.round(p.x*1000)/1000,Math.round(p.y*1000)/1000])]];
const area=(polys:MultiPolygon)=>polys.reduce((n,p)=>n+p.reduce((n,r,i)=>n+(i?-1:1)*Math.abs(signedArea(r.map(([x,y])=>({x,y})))),0),0);
const variants=[['Short sleeve',undefined],['Longer short sleeve','longer-short'],['Cap Sleeve','cap'],['Long sleeve','long'],['Layered Long Sleeve','layered-long']] as const;
export function SleeveFamilyChecks(){const [result,setResult]=useState(''),[running,setRunning]=useState(false);
 const run=async()=>{setRunning(true);let passed=0;try{
  for(const fit of ['slim','regular','boxy','oversized'])for(const [name,variant] of variants){
   const base=getDefaultGarmentSelection('tshirt',fit),sleeve=getGarmentAssetsForFit('tshirt','Sleeve length',fit).find(a=>a.displayName.toLowerCase().startsWith(name.toLowerCase())),neck=getGarmentAssetsForFit('tshirt','Neck',fit).find(a=>a.displayName.toLowerCase().startsWith('v-neck'));
   const selection=applyGarmentSelectionLinks('tshirt',{...base,...(sleeve?{'Sleeve length':sleeve.id}:{}),...(neck?{Neck:neck.id}:{})},fit);
   await Promise.all([preloadGarmentSvgAssets(Object.values(selection)),preloadTshirtSleeveAssets(fit,variant)]);
   for(const view of ['front','back'] as const){
    await preloadTshirtNeckPack(fit,'V-neck',view,'ribbed');let before=resolveGarmentLayers({garmentType:'tshirt',fit,view,selection});if(fit==='regular')before=withRegularConstruction(before);
    const after=withTshirtSurfaceQuality(before,fit,'ribbed',view),label=fit+' '+name+' '+view;
    for(const id of ['neck','innerBackNeck']){const a=before.find(l=>l.id===id),b=after.find(l=>l.id===id);if(a&&!b)throw Error(label+': collar missing');if(a&&b){const ra=fabricRings(a.svgRaw),rb=fabricRings(b.svgRaw);if(ra.length!==rb.length)throw Error(label+': collar topology changed');const bounds=(rs:typeof ra)=>{const ps=rs.flat();return [Math.min(...ps.map(p=>p.x)),Math.max(...ps.map(p=>p.x)),Math.min(...ps.map(p=>p.y)),Math.max(...ps.map(p=>p.y))]};if(bounds(ra).some((v,i)=>Math.abs(v-bounds(rb)[i])>7))throw Error(label+': collar proportions changed');}}
    for(const id of ['sleeveLeft','sleeveRight','sleeveHemLeft','sleeveHemRight']){const part=after.find(l=>l.id===id);if(!part||new DOMParser().parseFromString(part.svgRaw,'image/svg+xml').querySelector('parsererror'))throw Error(label+': invalid '+id);const rings=fabricRings(part.svgRaw);if(!rings.length||!rings.some(r=>Math.abs(signedArea(r))>100))throw Error(label+': empty '+id);if(!rings.every(r=>r.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))))throw Error(label+': invalid coordinates');}
    if(fit==='slim'&&(variant==='long'||variant==='longer-short')){const body=after.find(l=>l.id==='base')!.svgRaw;if(!body.includes('data-constructed-slim-torso')||/g mask="url\(#(?:long|longer-short)-sleeve-torso-slim-base/.test(body))throw Error(label+': stale sleeve mask clips reconstructed torso');}
    if(fit==='slim'&&!variant&&!after.find(l=>l.id==='outline')?.svgRaw.includes('data-ink-repair'))throw Error('Slim short missed the shared outline treatment');
    {const a=fabricRings(after.find(l=>l.id==='sleeveLeft')!.svgRaw)[0],b=fabricRings(after.find(l=>l.id==='sleeveRight')!.svgRaw)[0];if(Math.abs(Math.abs(signedArea(a))-Math.abs(signedArea(b)))>1)throw Error(label+': asymmetric sleeve area');if(!after.find(l=>l.id==='sleeveLeft')!.svgRaw.includes('data-sleeve-join'))throw Error(label+': missing continuous attachment');}
    {const baseRings=fabricRings(after.find(l=>l.id==='base')!.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));if(baseRings.slice(1).some(r=>r.some(p=>p.x<=700||p.x>=1348||p.y>=900)))throw Error(label+': detached torso tracing island');}
    {
     const torso=fabricRings(after.find(l=>l.id==='base')!.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)))[0],bodyPoly=polygon(torso);
     if(!variant||variant==='cap'||variant==='layered-long')for(const id of ['sleeveLeft','sleeveRight']){
      const join=new DOMParser().parseFromString(after.find(l=>l.id===id)!.svgRaw,'image/svg+xml').querySelector('[data-sleeve-join]')?.getAttribute('d')??'';
      const points=flattenPathContours(join,1)[0]??[],minY=Math.min(...points.map(p=>p.y));
      if(points.filter(p=>p.y>minY+20).some(p=>!pointInLoop({x:p.x+(id==='sleeveLeft'?5:-5),y:p.y},torso)))throw Error(label+': body fabric missing beside sleeve attachment');
     }
     const hem=fabricRings(after.find(l=>l.id==='bodyHem')!.svgRaw)[0];
     if(area(polygonClipping.difference(polygon(hem),bodyPoly))>3)throw Error(label+': hem protrudes outside torso');
     if(variant==='layered-long'&&!after.filter(l=>/^sleeveHem/.test(l.id)).every(l=>l.svgRaw.includes('data-sleeve-opening')))throw Error(label+': exact sleeve opening outline lost');
     if(variant==='layered-long')for(const id of ['underSleeveLeft','underSleeveRight']){
      const under=fabricRings(after.find(l=>l.id===id)!.svgRaw)[0],left=id==='underSleeveLeft';
      if(area(polygonClipping.intersection(polygon(under),bodyPoly))>1)throw Error(label+': under-sleeve joined to body');
      const xs=under.map(p=>left?p.x:2048-p.x),inner=Math.max(...xs),lowerBody=torso.filter(p=>p.y>Math.min(...under.map(p=>p.y))&&p.x<1024);
      if(Math.min(...lowerBody.map(p=>p.x))-inner<25)throw Error(label+': insufficient under-sleeve clearance');
      const outer=Math.min(...xs),bottom=Math.max(...under.map(p=>p.y)),topAt=(x:number)=>Math.min(...under.filter((_,i)=>Math.abs(xs[i]-x)<.1).map(p=>p.y));
      const straight=polygon([{x:outer,y:topAt(outer)},{x:inner,y:topAt(inner)},{x:inner,y:bottom},{x:outer,y:bottom}]),normalized=polygon(under.map((p,i)=>({x:xs[i],y:p.y})));
      if(area(polygonClipping.xor(straight,normalized))>1)throw Error(label+': under-sleeve has an underarm bulge');
     }
     if(fit==='regular'){
      const reflected=polygon(torso.map(p=>({x:2048-p.x,y:p.y}))),window:MultiPolygon=[[[[700,0],[1348,0],[1348,900],[700,900]]]];
      if(area(polygonClipping.difference(polygonClipping.xor(bodyPoly,reflected),window))>5)throw Error(label+': asymmetric outer shoulders');
     }
    }
    passed++;setResult(passed+'/40 sleeve families valid · collar topology and bounds preserved');
   }
   await new Promise<void>(requestAnimationFrame);
  }
  setResult('PASS: 40 fit/sleeve/view configurations · collar proportions and consistent Slim rendering verified');
 }catch(e){console.error('Sleeve construction regression',e);setResult('FAILED after '+passed+': '+(e instanceof Error?e.stack:String(e)))}finally{setRunning(false)}};
 return <><button disabled={running} onClick={run}>{running?'Checking sleeve families…':'Check sleeve families'}</button><span role="status">{result}</span></>;
}

export function NecklineChecks(){const [result,setResult]=useState(''),[running,setRunning]=useState(false);
 const run=async()=>{setRunning(true);let n=0;try{for(const fit of ['slim','regular','boxy','oversized'])for(const name of ['Crew neck','V-neck','Deep V-neck','Thin crew neck','Scoop neck','Polo collar']){
 const base=getDefaultGarmentSelection('tshirt',fit),neck=getGarmentAssetsForFit('tshirt','Neck',fit).find(a=>a.displayName.toLowerCase().startsWith(name.toLowerCase()));if(!neck)throw Error('Missing '+name);
 const selection=applyGarmentSelectionLinks('tshirt',{...base,Neck:neck.id},fit);await preloadGarmentSvgAssets(Object.values(selection));
 for(const view of ['front','back'] as const){await preloadTshirtNeckPack(fit,name,view,'ribbed');const before=resolveGarmentLayers({garmentType:'tshirt',fit,view,selection}),after=withTshirtSurfaceQuality(before,fit,'ribbed',view);
 for(const id of ['neck','innerBackNeck']){const a=before.find(l=>l.id===id),b=after.find(l=>l.id===id);if(a&&!b)throw Error(fit+name+view+': missing collar');if(!a||!b)continue;
 const ra=fabricRings(a.svgRaw),rb=fabricRings(b.svgRaw);if(ra.length!==rb.length)throw Error(fit+name+view+': altered contour count');
 if(new DOMParser().parseFromString(b.svgRaw,'image/svg+xml').querySelector('parsererror'))throw Error('Invalid collar SVG');
 const bounds=(rs:typeof ra)=>{const ps=rs.flat();return [Math.min(...ps.map(p=>p.x)),Math.max(...ps.map(p=>p.x)),Math.min(...ps.map(p=>p.y)),Math.max(...ps.map(p=>p.y))]};if(bounds(ra).some((v,i)=>Math.abs(v-bounds(rb)[i])>7))throw Error(fit+name+view+': collar dimensions changed');
 if(/polo/i.test(name)&&a!==b)throw Error('Polo construction changed');}
 const ink=after.find(l=>l.id==='outline')?.svgRaw??'';if(/NaN|undefined/.test(ink)||new DOMParser().parseFromString(ink,'image/svg+xml').querySelector('parsererror'))throw Error(fit+name+view+': invalid collar ink');
 n++;setResult(n+'/48 neck views valid');}
 await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
 setResult('PASS: 48 neckline fit/style/view combinations · topology and dimensions preserved');}catch(e){setResult('FAILED '+n+': '+e)}finally{setRunning(false)}};
 return <><button disabled={running} onClick={run}>Check necklines</button><span role="status">{result}</span></>;
}
