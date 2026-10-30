import assert from 'node:assert/strict';import{build}from'esbuild';import{pathToFileURL}from'node:url';
const out='node_modules/.cache/pen-precision.mjs';
await build({stdin:{contents:"export * from './src/app/lib/penGeometry';export * from './src/app/lib/shapePathEditing';",resolveDir:process.cwd()},outfile:out,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const p=await import(pathToFileURL(process.cwd()+'/'+out));
const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const browserPoint=Object.create({get x(){return 15},get y(){return 24}});assert.deepEqual({...p.copyPenPoint(browserPoint)},{x:15,y:24});
const node={x:10,y:20,in:{x:0,y:20},out:{x:25,y:20}},independent=p.dragPenHandle(node,{x:10,y:40},'out',false);assert.deepEqual(independent.in,node.in);assert.deepEqual(independent.out,{x:10,y:40});
const linked=p.dragPenHandle(node,{x:10,y:40},'out',true);assert.deepEqual(linked.in,{x:10,y:10});assert.deepEqual(node.in,{x:0,y:20});
const moved=p.offsetPenNode(node,{x:35,y:-20});assert.deepEqual(moved,{x:45,y:0,in:{x:35,y:0},out:{x:60,y:0}});close(Math.hypot(moved.in.x-moved.x,moved.in.y-moved.y),10);
const angled=p.constrainPenPoint({x:10,y:10},{x:36,y:32});close(angled.x-10,angled.y-10);close(Math.hypot(angled.x-10,angled.y-10),Math.hypot(26,22));
assert.deepEqual(p.snapPenPoint({x:99,y:48},[{x:100,y:50}],4).point,{x:100,y:50});assert.deepEqual(p.snapPenPoint({x:97,y:54},[],5,10).point,{x:100,y:50});assert.deepEqual(p.snapPenPoint({x:97,y:54},[],2,10).point,{x:97,y:54});
const path={closed:false,nodes:[{x:0,y:0,out:{x:20,y:80}},{x:100,y:10,in:{x:80,y:-20}}]},reversed=p.reversePenPath(path),divided=p.splitShapeSegment(path,0,.37),removed=p.deleteShapePoints(divided,[1]);assert.equal(removed.nodes.length,2);
for(let i=0;i<=100;i++){const t=i/100,a=p.pathSegmentPoint(path.nodes[0],path.nodes[1],t),b=p.pathSegmentPoint(reversed.nodes[0],reversed.nodes[1],1-t),c=p.pathSegmentPoint(removed.nodes[0],removed.nodes[1],t);close(a.x,b.x);close(a.y,b.y);close(a.x,c.x);close(a.y,c.y);}
assert.deepEqual(p.reversePenPath(reversed).nodes,path.nodes.map(n=>({...n,in:n.in,out:n.out})));
console.log('Pen precision: DOM-point coordinates, independent/linked handles, repositioning, angle constraints, alignment/grid snapping, path reversal and add/remove-anchor curve preservation passed.');

const openEnds={closed:false,nodes:[{x:0,y:0},{x:30,y:60},{x:90,y:60}]},smoothed=p.smoothShapePoints(openEnds,[0,2],true);assert.deepEqual(smoothed.nodes[0].out,{x:10,y:20});assert.equal(smoothed.nodes[0].in,undefined);assert.deepEqual(smoothed.nodes[2].in,{x:70,y:60});assert.equal(smoothed.nodes[2].out,undefined);console.log('Open endpoint smoothing follows the adjacent segment, without wrapping across the path.');
