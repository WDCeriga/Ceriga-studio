import {DOMMatrix,DOMPoint} from '@napi-rs/canvas';
globalThis.DOMMatrix=DOMMatrix;globalThis.DOMPoint=DOMPoint;
import assert from 'node:assert/strict';
import {surfaceRuntime} from './surface-test-runtime.mjs';
const {api}=await surfaceRuntime(`export {constructOpenings,openingAnchorY,reanchorOpening} from './src/app/data/garmentOpenings';`);
const fabric=[[[[400,100],[1600,100],[1600,1900],[400,1900],[400,100]]]];
const bounds={minX:400,maxX:1600,minY:100,maxY:1900,necklineY:400,openingGeometry:{version:1,fabric,panels:[{id:'base',role:'body',polygons:fabric}]}};
const opening={version:1,closure:'zip',attachment:'neckline',start:{x:1000,y:400},end:{x:1000,y:900},width:40,facingColor:'#888888'};
const detail={id:'zip',type:'zip',fill:'#888888',opening};
const inside=(geometry,x,y)=>geometry.some(p=>p.some(r=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}));
const normal=api.constructOpenings([detail],bounds),polo=api.constructOpenings([detail],{...bounds,polo:true});
assert(!inside(normal.inkCut,1035,410));assert(inside(polo.inkCut,1035,410),'Remove short placket tail beside tape');
assert(!inside(polo.inkCut,1100,410),'Keep collar wings');assert(!inside(polo.inkCut,1035,600),'Keep outline below short placket area');
assert.deepEqual(polo.removed,normal.removed,'Do not remove extra collar or body fabric');
const free=api.constructOpenings([{...detail,opening:{...opening,attachment:'free'}}],{...bounds,polo:true});assert(!inside(free.inkCut,1035,410));
console.log('PASS polo zip clears only local placket ink; collar wings, fabric and free-position zips remain unchanged.');

assert.equal(api.openingAnchorY({...bounds,polo:true,openingGeometry:{...bounds.openingGeometry,poloOpeningY:270}}),270,'Zip starts at throat instead of bottom of old placket');

const legacy={...detail,opening:{...opening,defaults:{...opening}}};
const corrected=api.reanchorOpening(legacy,{...bounds,polo:true,openingGeometry:{...bounds.openingGeometry,poloOpeningY:270}});
assert.equal(corrected.opening.start.y,270,'Saved polo zips without anchors join the collar');
assert.equal(corrected.opening.end.y-corrected.opening.start.y,500,'Keep the chosen zip length');
assert.equal(api.reanchorOpening(corrected,{...bounds,polo:true,openingGeometry:{...bounds.openingGeometry,poloOpeningY:270}}),corrected,'Refresh does not move the zip again');
console.log('PASS legacy polo zipper migration preserves length and remains stable after refresh.');

assert(inside(polo.placketFill,1035,410),'Replace removed placket tails with body fabric');
assert(!inside(polo.placketFill,1000,410),'Keep actual zipper aperture clear');
console.log('PASS placket tail repair fills fabric beside the zip without covering the aperture.');
