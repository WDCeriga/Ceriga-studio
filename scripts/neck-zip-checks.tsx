import type {ResolvedGarmentLayer} from '../src/app/data/garmentSvgCatalog';
import {getDefaultGarmentSelection,getGarmentAssetsForFit,applyGarmentSelectionLinks,preloadGarmentSvgAssets,resolveGarmentLayers} from '../src/app/data/garmentSvgCatalog';
import {preloadTshirtNeckPack} from '../src/app/data/tshirtNeckPack';
import {withTshirtSurfaceQuality} from '../src/app/data/tshirtSurfaceQuality';
import {compileOpeningGeometry,createOpening,constructOpenings,openingArea,openingLayerClip,validateOpening} from '../src/app/data/garmentOpenings';
import {createGarmentDetail,type DetailBounds} from '../src/app/data/garmentDetails';
import {getPotraceSvgBBox} from '../src/app/lib/tshirtSvgUtils';
import {useState} from 'react';
export function NeckZipChecks(){const [result,setResult]=useState(''),[running,setRunning]=useState(false);const run=async()=>{setRunning(true);let n=0;try{
for(const fit of ['slim','regular','boxy','oversized'])for(const name of ['Crew neck','V-neck','Deep V-neck','Thin crew neck','Scoop neck','Polo collar'])for(const finish of (name==='Polo collar'?['ribbed']:['ribbed','raw']) as ('ribbed'|'raw')[]){
 const neck=getGarmentAssetsForFit('tshirt','Neck',fit).find(a=>a.displayName.startsWith(name))!;
 const selection=applyGarmentSelectionLinks('tshirt',{...getDefaultGarmentSelection('tshirt',fit),Neck:neck.id},fit);
 await Promise.all([preloadGarmentSvgAssets(Object.values(selection)),preloadTshirtNeckPack(fit,name,'front',finish)]);
 const layers=withTshirtSurfaceQuality(resolveGarmentLayers({garmentType:'tshirt',fit,view:'front',selection,neckFinish:finish}),fit,finish,'front');
 const geometry=compileOpeningGeometry(layers.filter(l=>['base','neck','bodyHem'].includes(l.id)).map(l=>({id:l.id,raw:l.svgRaw,role:l.id==='base'?'body' as const:l.id==='neck'?'neck' as const:'hem' as const})));
 if(!geometry.fabric.length||geometry.unavailableReason)throw Error(fit+' '+name+': unsupported zip geometry');
 const bbox=getPotraceSvgBBox(layers.find(l=>l.id==='base')!.svgRaw);if(!bbox)throw Error('Missing body bounds');
 const bounds:DetailBounds={...bbox,openingGeometry:geometry};const zip=createOpening(createGarmentDetail('zip',[],'#888888','zip-05'),bounds,'neckline');const validation=validateOpening(zip,bounds),cut=constructOpenings([zip],bounds);
 if(validation.status==='Invalid'||openingArea(cut.removed)<1||!openingLayerClip(cut.inkCut))throw Error(fit+' '+name+' '+finish+': neck zip failed '+validation.reasons.join(';'));
 if(finish==='ribbed'&&!cut.panels.neck?.length)throw Error('Collar did not survive local zip insertion');
 if(Math.abs(openingArea(cut.remaining)+openingArea(cut.removed)-openingArea(geometry.fabric))>.2)throw Error('Zip cut does not conserve fabric');
 n++;setResult(n+'/44 neck zip combinations verified');await new Promise<void>(r=>requestAnimationFrame(()=>r()));
}
setResult('PASS: 44 fit/neck/finish zip insertions and collar clipping');}catch(e){setResult('FAILED '+n+': '+e)}finally{setRunning(false)}};return <><button disabled={running} onClick={run}>Check neck zips</button><span role="status">{result}</span></>}
