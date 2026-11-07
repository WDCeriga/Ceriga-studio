import assert from 'node:assert/strict';
import {surfaceRuntime} from './surface-test-runtime.mjs';
const {api}=await surfaceRuntime(`export {splitArtworkRegion,pathPolygons,shapeWorldPath} from './src/app/lib/artworkPathOperations';`);
const shape={id:'square',type:'shape',content:'rect',shapeGeometry:'bounds',borderWidth:0,shapeFilled:true,shapeFillColor:'#a00000',x:100,y:100,width:100,height:100,rotation:0};
const area=e=>api.pathPolygons(api.shapeWorldPath(e)).reduce((sum,poly)=>sum+poly.reduce((s,ring,i)=>s+(i?-1:1)*Math.abs(ring.slice(0,-1).reduce((a,p,j)=>a+p[0]*ring[j+1][1]-ring[j+1][0]*p[1],0)/2),0),0);
for(const cut of [{closed:false,nodes:[{x:105,y:49},{x:90,y:90,out:{x:70,y:110}},{x:120,y:151}]},{closed:true,nodes:[{x:75,y:75},{x:125,y:75},{x:100,y:125}]}]){const parts=api.splitArtworkRegion(shape,cut);assert.equal(parts.length,2);assert.ok(parts.every(p=>p.shapeFilled&&area(p)>0));assert.ok(Math.abs(parts.reduce((s,e)=>s+area(e),0)-10000)<.1);assert.notEqual(parts[0].id,parts[1].id);}
console.log('PASS: curved edge cut and enclosed region create separate filled vectors and preserve total area.');

