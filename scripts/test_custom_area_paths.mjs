import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/app/lib/customAreaGeometry.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const g = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }];
const bezier = (a, b, t) => ({ x: (1-t)**3*a.x + 3*(1-t)**2*t*(a.out ?? a).x + 3*(1-t)*t*t*(b.in ?? b).x+t**3*b.x, y: (1-t)**3*a.y+3*(1-t)**2*t*(a.out ?? a).y+3*(1-t)*t*t*(b.in ?? b).y+t**3*b.y });
const near = (a,b) => { assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-7, `${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
test('Legacy areas remain closed; cubic subdivision preserves every sampled point', () => {
  assert.equal(g.customAreaPath(square), 'M 0 0 L 100 0 L 100 80 L 0 80 L 0 0 Z');
  const curve = g.setCustomAreaPointType(square, [0,1,2,3], true);
  assert(g.customAreaPath(curve).includes(' C '));
  for (const split of [.005,.23,.5,.98]) {
    const next = g.splitCustomAreaSegment(curve,0,split);
    for(let i=0;i<=100;i++) { const t=i/100; near(bezier(curve[0],curve[1],t), t<=split ? bezier(next[0],next[1],t/split) : bezier(next[1],next[2],(t-split)/(1-split))); }
  }
  assert.equal(g.customAreaPath(square,false).endsWith('Z'),false);
});
test('Handles link independently; multiple points translate anchors and controls', () => {
  const smooth = g.setCustomAreaPointType(square,[0,1],true);
  const linked = g.moveCustomAreaHandle(smooth,0,'out',{x:30,y:20});
  const node=linked[0];
  assert(Math.abs((node.out.x-node.x)*(node.in.y-node.y)-(node.out.y-node.y)*(node.in.x-node.x))<1e-8);
  const unlinked=g.linkCustomAreaHandles(linked,[0],false);
  near(g.moveCustomAreaHandle(unlinked,0,'out',{x:25,y:35})[0].in,unlinked[0].in);
  const moved=g.moveCustomAreaPoints(smooth,[0,1],{x:13,y:-4});
  near(moved[0],{x:13,y:-4}); near(moved[1].out,{x:smooth[1].out.x+13,y:smooth[1].out.y-4});
  assert.deepEqual(moved[2],smooth[2]);
  const corner=g.setCustomAreaPointType(smooth,[0],false)[0]; assert.equal(corner.in,undefined); assert.equal(corner.out,undefined);
});
test('Dragging a segment bends exactly under the pointer without moving endpoints', () => {
  for (const t of [.1,.4,.8]) {
    const delta={x:12,y:40}, original=bezier(square[0],square[1],t), next=g.bendCustomAreaSegment(square,0,t,delta);
    near(next[0],square[0]); near(next[1],square[1]);
    near(bezier(next[0],next[1],t),{x:original.x+delta.x,y:original.y+delta.y});
    assert.equal(next[0].linked,false);
  }
});
test('Rebasing retains every world-space anchor and handle under resize, rotation and both flips', () => {
  const curve=g.setCustomAreaPointType(square,[0,1,2,3],true);
  const area={id:'test',type:'customArea',content:'',x:230,y:140,width:270,height:125,rotation:32,customAreaPoints:square,customAreaViewWidth:100,customAreaViewHeight:80,flipHorizontal:true,flipVertical:true};
  const world=(element,p)=>{const v=g.customAreaViewport(element);let x=(p.x/v.width-.5)*element.width*(element.flipHorizontal?-1:1),y=(p.y/v.height-.5)*element.height*(element.flipVertical?-1:1);const r=element.rotation*Math.PI/180;return {x:element.x+x*Math.cos(r)-y*Math.sin(r),y:element.y+x*Math.sin(r)+y*Math.cos(r)};};
  const next={...area,...g.customAreaGeometryPatch(curve,area)};
  for(let i=0;i<curve.length;i++) for(const key of [null,'in','out']) near(world(area,key?curve[i][key]:curve[i]),world(next,key?next.customAreaPoints[i][key]:next.customAreaPoints[i]));
  const inserted=g.splitCustomAreaSegment(square,0,.4), patch=g.customAreaGeometryPatch(inserted,area);
  assert.equal(patch.width,undefined,'Subdivision must not move or rescale the fill');
  assert.equal(patch.x,undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(next)).customAreaPoints,next.customAreaPoints);
});
