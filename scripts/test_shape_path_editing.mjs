import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['src/app/lib/shapePathEditing.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { splitShapeSegment, pathSegmentPoint, moveShapePoints, deleteShapePoints, smoothShapePoints, shapePointMapping } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const path = { closed: true, nodes: [{x:10,y:10,out:{x:30,y:0}}, {x:90,y:10,in:{x:70,y:30}}, {x:90,y:90}, {x:10,y:90}], subpaths: [{closed:true,nodes:[{x:40,y:40},{x:60,y:40},{x:50,y:60}]}] };
const divided = splitShapeSegment(path, 0, .37);
assert.equal(divided.nodes.length, 5);
assert.deepEqual(divided.subpaths, path.subpaths);
for (let i = 0; i <= 100; i++) {
  const t = i / 100;
  const expected = pathSegmentPoint(path.nodes[0], path.nodes[1], t);
  const actual = t <= .37 ? pathSegmentPoint(divided.nodes[0], divided.nodes[1], t / .37) : pathSegmentPoint(divided.nodes[1], divided.nodes[2], (t - .37) / .63);
  assert(Math.hypot(actual.x - expected.x, actual.y - expected.y) < 1e-8);
}
const moved = moveShapePoints(path, [0,1], {x:5,y:-10});
assert.deepEqual(moved.nodes[0], {x:15,y:0,out:{x:35,y:-10},in:undefined});
assert.equal(moved.nodes[2], path.nodes[2]);
assert.equal(deleteShapePoints(path,[0]).nodes.length,3);
assert.equal(deleteShapePoints(path,[0,1]),path,'Closed paths retain at least three nodes');
assert.equal(deleteShapePoints({...path,closed:false},[0,1]).nodes.length,2);
assert(smoothShapePoints(path,[2],true).nodes[2].out);
assert.equal(smoothShapePoints(path,[0],false).nodes[0].out,undefined);
assert.equal(path.nodes[0].x,10,'Editing must not mutate source');
for (const flips of [{},{flipHorizontal:true},{flipVertical:true},{flipHorizontal:true,flipVertical:true}]) {
  for (const warped of [false,true]) {
    const el = { ...flips, perspective:[{x:.1,y:.1},{x:.9,y:0},{x:1,y:.9},{x:0,y:1}], warp: warped ? {mode:'preset',preset:'wave',bend:30,horizontalDistortion:15,verticalDistortion:10,gridSize:3,points:[]} : undefined };
    const map = shapePointMapping(el);
    for (const p of [{x:20,y:20},{x:40,y:55},{x:70,y:80}]) {
      const back = map.inverse(map.project(p));
      assert(Math.hypot(back.x-p.x,back.y-p.y)<.001,JSON.stringify({p,back,flips,warped}));
    }
  }
}
console.log('Shape path editing passed: curve-preserving splits, multi-point moves, handles, deletion limits, compounds, inverse warp/perspective/flip.');
