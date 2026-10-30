import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiled=await build({stdin:{contents:"export {registeredTorsoSide} from './src/app/data/tshirtSleeveConstruction';export * from './src/app/lib/garmentArtworkCamera';export {roundedShoulderRing} from './src/app/data/tshirtShoulderGeometry';export {flattenConstructionSeam,insetConstructionRow} from './src/app/data/constructionStitchRows';export {shoulderSeam,partitionShoulderFabric,completeShoulderJoin} from './src/app/data/shoulderConstruction';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'assets',setup(b){b.onResolve({filter:/\.(svg|png)(\?raw)?$/},a=>({path:a.path,namespace:'asset'}));b.onLoad({filter:/.*/,namespace:'asset'},()=>({contents:'export default ""'}))}}]});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
for(const unit of [.5,1,2])for(const scale of [1,1.8,3.4])for(const camera of [{x:1024,y:1024},{x:1024,y:430},{x:700,y:1800}]){
 const root={x:80,y:45},zone={x:40,y:42},side=700*unit,left=50*unit,top=0;
 const canvas={x:root.x+left+(1-scale)*side/2+(1024-camera.x)/2048*side*scale,y:root.y+top+(1-scale)*side/2+(1024-camera.y)/2048*side*scale,width:side*scale};
 const value=api.garmentArtworkCamera({root,parent:{x:root.x,y:root.y,width:800*unit,height:700*unit},canvas,zone,unit});
 if(!value){assert.equal(scale,1);assert.deepEqual(camera,{x:1024,y:1024});continue;}
 const [tx,ty,s]=value.match(/-?[\d.]+/g).map(Number);
 for(const point of [{x:360,y:260},{x:90,y:430}]){
  const x=zone.x+tx+s*point.x,y=zone.y+ty+s*point.y;
  assert(Math.abs(x-((canvas.x-root.x)/unit+((zone.x+point.x)-50)*scale))<1e-3);
  assert(Math.abs(y-((canvas.y-root.y)/unit+(zone.y+point.y)*scale))<1e-3);
 }
}
console.log('Close-up registration: chest, neckline and hem cameras preserve artwork coordinates at phone, desktop and zoomed scales.');
for(const kind of ['raglan','saddle','drop'])for(const [start,end] of [[ [820,350],[630,850] ],[[770,330],[660,900]],[[580,520],[710,930]]]){
 const curve=api.shoulderSeam(kind,start,end);if(kind==='saddle')assert(curve[24][1]-start[1]>=(end[1]-start[1])*.3,'Saddle has a substantial shoulder strip');assert.deepEqual(curve[0],start);assert.deepEqual(curve.at(-1),end);
 assert(curve.flat().every(Number.isFinite));
 for(let i=1;i<curve.length-1;i++){const a=curve[i-1],b=curve[i],c=curve[i+1];const dot=((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))/(Math.hypot(b[0]-a[0],b[1]-a[1])*Math.hypot(c[0]-b[0],c[1]-b[1]));assert(dot>.97,kind+' seam must turn smoothly');}
}
console.log('Shoulders: finite endpoint registration and smooth saddle/raglan/drop tangents across fit proportions.');

for(const path of ['M10 20L80 120','M10 20C10 60 60 80 80 120','M10 20Q80 20 80 120']){
 const row=api.flattenConstructionSeam(path);assert(row.length>2);assert.deepEqual(row[0],{x:10,y:20});assert.deepEqual(row.at(-1),{x:80,y:120});
 assert(row.slice(1).every((p,i)=>Math.hypot(p.x-row[i].x,p.y-row[i].y)<8),'An open attachment must not acquire a closing stitch row');
}
for(const mirror of [false,true]){
 const row=[{x:mirror?160:40,y:20},{x:mirror?140:60,y:80},{x:mirror?120:80,y:140}];
 const inside=p=>mirror?p.x<160-(p.y-20)/3:p.x>40+(p.y-20)/3;
 const inset=api.insetConstructionRow(row,inside);assert(inset.every(inside));for(let i=0;i<row.length;i++)assert(Math.abs(Math.hypot(inset[i].x-row[i].x,inset[i].y-row[i].y)-14)<1e-6);
}
console.log('Construction stitching: open straight, cubic and quadratic seams remain open; both sides offset 14 units into their owning fabric.');
const block=[{x:400,y:200},{x:600,y:100},{x:800,y:200},{x:900,y:600},{x:850,y:1400},{x:350,y:1400},{x:300,y:600}];
const rounded=api.roundedShoulderRing(block,550,650,500);
assert(rounded.some(p=>p.x===600&&p.y===100),'Keep the collar unchanged');assert(rounded.some(p=>p.x===350&&p.y===1400),'Keep the hem unchanged');
for(const cap of [block[0],block[2]])assert(!rounded.some(p=>p.x===cap.x&&p.y===cap.y),'Replace the pointed shoulder vertex with a round transition');
assert(rounded.flatMap(p=>[p.x,p.y]).every(Number.isFinite));
console.log('Shoulder silhouette: convex cap tips are rounded while collar and hem vertices stay exact.');

for(const kind of ['raglan','saddle','drop']){
 const seam=api.shoulderSeam(kind,[820,350],[630,850]);
 assert.deepEqual(api.completeShoulderJoin(seam,[640,900]).at(-1),[640,900],'Short sleeves connect to the inner cuff corner');
 assert.equal(api.completeShoulderJoin(seam,[630,850]),seam,'Long sleeves end at their authored underarm');
 assert.equal(api.completeShoulderJoin(seam),seam);
}
console.log('Every alternate shoulder closes its short-sleeve underarm join without extending long-sleeve seams to the wrist.');

for(const sign of [1,-1]){
 const x=v=>sign===1?v:2048-v,join={x:x(640),y:900};
 const points=[{x:x(660),y:860},{x:x(665),y:920},{x:x(670),y:1000},{x:x(680),y:1240},{x:x(720),y:1500}];
 const result=api.registeredTorsoSide(points,join);
 assert(!result.some(p=>p.y<join.y),'Old attachment must not hook upward inside the torso');
 assert.equal(result[0].x,join.x);assert.equal(result[1].x,join.x);
 assert.deepEqual(result.at(-1),points.at(-1),'Lower fit shape remains unchanged');
 assert.deepEqual(result.at(-2),points.at(-2),'Transition rejoins the authored waist');
}
console.log('Body side seams meet the sleeve cuff without an inward step on either side, preserving the lower fit.');

for(const mirror of [false,true]){
 const x=v=>mirror?200-v:v,row=Array.from({length:16},(_,i)=>({x:x(40),y:20+i*8}));
 const contains=p=>{const px=x(p.x);return px>40||(p.y<65&&px>20)};
 const inset=api.insetConstructionRow(row,contains);
 assert(inset.every(p=>Math.abs(x(p.x)-54)<1e-6),'Shoulder overlap must not flip the armhole stitch to the sleeve side');
 assert(inset.slice(1).every((p,i)=>Math.hypot(p.x-inset[i].x,p.y-inset[i].y)<9),'Armhole thread has no sideways jump');
}
console.log('Left/right armhole thread stays on one owning side through ambiguous shoulder overlap.');
