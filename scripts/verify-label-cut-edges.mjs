import assert from 'node:assert/strict';import {surfaceRuntime} from './surface-test-runtime.mjs';
const {api}=await surfaceRuntime(`export * from './src/app/lib/cleanSketchCurves';export {pathSegmentPoint} from './src/app/lib/shapePathEditing';`);
// A long ticket edge meets a rounded notch. Neighbouring curve tangents must not bow the edge.
const points=[{x:0,y:0},{x:200,y:0},{x:200,y:70},{x:160,y:70},{x:158,y:67},{x:155,y:66},{x:152,y:67},{x:150,y:70},{x:0,y:70}];
for(const angle of [0,.42,-.31]){const c=Math.cos(angle),s=Math.sin(angle),rot=p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c}),path=api.fitVectorContour(points.map(rot),true,.5,.87,40),edge=path.nodes.findIndex(p=>Math.hypot(p.x-rot(points[7]).x,p.y-rot(points[7]).y)<1e-6);assert(edge>=0);for(let t=0;t<=1;t+=.05){const p=api.pathSegmentPoint(path.nodes[edge],path.nodes[(edge+1)%path.nodes.length],t),y=-p.x*s+p.y*c;assert(Math.abs(y-70)<1e-6,'The lower ticket edge must remain a straight line');}}
console.log('PASS: straight cut edges beside curved notches remain straight at every rotation');
