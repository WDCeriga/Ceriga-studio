import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
await mkdir('node_modules/.cache/print-checks',{recursive:true});
const outfile='node_modules/.cache/print-checks/shape-studio.mjs';
await build({stdin:{contents:`export * from './src/app/lib/shapeGeometry';export * from './src/app/lib/studioShapePresets';export {SHAPE_ASSETS} from './src/app/components/builder/printsStudio/studioAssets';export {pathSegmentPoint} from './src/app/lib/shapePathEditing';`,resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {shapeToEditablePath,studioShapeDefaults,SHAPE_ASSETS,shapePathData,pathSegmentPoint}=await import(pathToFileURL(process.cwd()+'/'+outfile));
for(const asset of SHAPE_ASSETS){const element={content:asset.id,...studioShapeDefaults(asset.id)},original=structuredClone(element),path=shapeToEditablePath(element);assert(path.nodes.length,asset.id);assert(!/NaN|Infinity/.test(shapePathData(path)),asset.id);const visit=p=>{p.nodes.slice(0,p.closed?undefined:-1).forEach((a,i)=>{const b=p.nodes[(i+1)%p.nodes.length];for(let j=0;j<=100;j++){const n=pathSegmentPoint(a,b,j/100);assert(n.x>=-1e-6&&n.x<=100+1e-6&&n.y>=-1e-6&&n.y<=100+1e-6,asset.id+' must fit its selection bounds')}});p.subpaths?.forEach(visit)};visit(path);assert.deepEqual(element,original);assert.deepEqual(shapeToEditablePath(element),path)}
assert.equal(shapeToEditablePath({content:'rect',...studioShapeDefaults('rect')}).nodes.length,4,'Rectangles have four editable corners');
assert.equal(shapeToEditablePath({content:'star',...studioShapeDefaults('star')}).nodes.length,10);
assert.equal(shapeToEditablePath({content:'ring',...studioShapeDefaults('ring')}).subpaths.length,1);
assert.equal(shapeToEditablePath({content:'ellipse'}).nodes[0].x,92,'Existing ellipse geometry stays unchanged');
const oldStar=shapeToEditablePath({content:'star'});assert.deepEqual({x:oldStar.nodes[0].x,y:oldStar.nodes[0].y},{x:50,y:8},'Existing hand-drawn star stays unchanged');
const saved={closed:true,nodes:[{x:2,y:4},{x:80,y:5},{x:70,y:95}]};assert.deepEqual(shapeToEditablePath({content:'star',...studioShapeDefaults('star'),shapePath:saved}),saved,'Saved edited paths are preserved');
console.log(`${SHAPE_ASSETS.length} new shape profiles: finite, deterministic, inside bounds and immutable. Legacy shapes, editable corners and saved paths preserved.`);
