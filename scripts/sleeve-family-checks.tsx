import {useState} from 'react';
import {getDefaultGarmentSelection,getGarmentAssetsForFit,applyGarmentSelectionLinks,preloadGarmentSvgAssets,resolveGarmentLayers} from '../src/app/data/garmentSvgCatalog';
import {preloadTshirtSleeveAssets} from '../src/app/data/tshirtLongSleeves';
import {withRegularConstruction,fabricRings} from '../src/app/data/regularConstruction';
import {withTshirtSurfaceQuality} from '../src/app/data/tshirtSurfaceQuality';
import {signedArea} from '../src/app/features/panelling/panellingGeometry';
const variants=[['Short sleeve',undefined],['Longer short sleeve','longer-short'],['Cap Sleeve','cap'],['Long sleeve','long'],['Layered Long Sleeve','layered-long']] as const;
export function SleeveFamilyChecks(){const [result,setResult]=useState(''),[running,setRunning]=useState(false);
 const run=async()=>{setRunning(true);let passed=0;try{
  for(const fit of ['slim','regular','boxy','oversized'])for(const [name,variant] of variants){
   const base=getDefaultGarmentSelection('tshirt',fit),sleeve=getGarmentAssetsForFit('tshirt','Sleeve length',fit).find(a=>a.displayName.toLowerCase().startsWith(name.toLowerCase())),neck=getGarmentAssetsForFit('tshirt','Neck',fit).find(a=>a.displayName.toLowerCase().startsWith('v-neck'));
   const selection=applyGarmentSelectionLinks('tshirt',{...base,...(sleeve?{'Sleeve length':sleeve.id}:{}),...(neck?{Neck:neck.id}:{})},fit);
   await Promise.all([preloadGarmentSvgAssets(Object.values(selection)),preloadTshirtSleeveAssets(fit,variant)]);
   for(const view of ['front','back'] as const){
    let before=resolveGarmentLayers({garmentType:'tshirt',fit,view,selection});if(fit==='regular')before=withRegularConstruction(before);
    const after=withTshirtSurfaceQuality(before,fit),label=fit+' '+name+' '+view;
    for(const id of ['neck','innerBackNeck'])if(before.find(l=>l.id===id)!==after.find(l=>l.id===id))throw Error(label+': source collar changed');
    for(const id of ['sleeveLeft','sleeveRight','sleeveHemLeft','sleeveHemRight']){const part=after.find(l=>l.id===id);if(!part||new DOMParser().parseFromString(part.svgRaw,'image/svg+xml').querySelector('parsererror'))throw Error(label+': invalid '+id);const rings=fabricRings(part.svgRaw);if(!rings.length||!rings.some(r=>Math.abs(signedArea(r))>100))throw Error(label+': empty '+id);if(!rings.every(r=>r.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))))throw Error(label+': invalid coordinates');}
    if(fit==='slim'&&!variant&&after!==before)throw Error('Approved Slim short geometry was changed');
    if(!(fit==='slim'&&!variant)){const a=fabricRings(after.find(l=>l.id==='sleeveLeft')!.svgRaw)[0],b=fabricRings(after.find(l=>l.id==='sleeveRight')!.svgRaw)[0];if(Math.abs(Math.abs(signedArea(a))-Math.abs(signedArea(b)))>1)throw Error(label+': asymmetric sleeve area');if(!after.find(l=>l.id==='sleeveLeft')!.svgRaw.includes('data-sleeve-join'))throw Error(label+': missing continuous attachment');}
    if(!(fit==='slim'&&!variant)){const baseRings=fabricRings(after.find(l=>l.id==='base')!.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));if(baseRings.slice(1).some(r=>r.some(p=>p.x<=700||p.x>=1348||p.y>=900)))throw Error(label+': detached torso tracing island');}
    passed++;setResult(passed+'/40 sleeve families valid · source collars unchanged');
   }
   await new Promise<void>(requestAnimationFrame);
  }
  setResult('PASS: 40 fit/sleeve/view configurations · original collars and Slim short preserved');
 }catch(e){setResult('FAILED after '+passed+': '+String(e))}finally{setRunning(false)}};
 return <><button disabled={running} onClick={run}>{running?'Checking sleeve families…':'Check sleeve families'}</button><span role="status">{result}</span></>;
}
