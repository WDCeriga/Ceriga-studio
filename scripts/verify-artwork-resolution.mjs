import assert from 'node:assert/strict';import {build} from 'esbuild';import {pathToFileURL} from 'node:url';import {mkdir} from 'node:fs/promises';await mkdir('node_modules/.cache/print-checks',{recursive:true});const outfile='node_modules/.cache/print-checks/artwork-resolution.mjs';await build({entryPoints:['src/app/lib/artworkResolution.ts'],outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent'});const{artworkPixelRatio:r}=await import(pathToFileURL(process.cwd()+'/'+outfile));assert.equal(r(200,100),2);assert.equal(r(200,100,2,2),4);assert.equal(r(200,100,1.5,2),3);for(const[w,h]of[[8000,4000],[10000,1000],[4000,4000],[1,1],[0,0]]){const ratio=r(w,h,3,3);assert(Number.isFinite(ratio)&&ratio>0);assert(Math.max(w,h)*ratio<=4096+1e-8);assert(w*h*ratio*ratio<=8_000_000+1e-8)}assert(Number.isFinite(r(NaN,Infinity)));console.log('Artwork resolution: baseline supersampling, zoom/HiDPI scaling, 4K dimension cap and 8MP memory budget passed.');

const warpOutput = 'node_modules/.cache/print-checks/warp-identity.mjs';
await build({entryPoints:['src/app/lib/warpGeometry.ts'],outfile:warpOutput,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {createWarpSettings, isIdentityWarp, resizeWarpGrid} = await import(pathToFileURL(process.cwd()+'/'+warpOutput));
const freeform = {...createWarpSettings(), mode:'freeform'};
assert(isIdentityWarp(freeform));
assert(isIdentityWarp({...freeform, gridSize:4, points:resizeWarpGrid(freeform,4)}));
assert(!isIdentityWarp({...freeform,points:freeform.points.map((p,i)=>i===4?{...p,x:p.x+.05}:p)}));
assert(isIdentityWarp({...createWarpSettings(),bend:0}));
assert(!isIdentityWarp(createWarpSettings()));
console.log('Warp identity: untouched meshes preserve pixels; displaced meshes and actual presets deform.');
