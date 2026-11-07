import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {surfaceRuntime} from './surface-test-runtime.mjs';
const {api}=await surfaceRuntime(`export {linkedMirrorSeams} from './src/app/features/panelling/panellingMirroring';export {flattenSeam,seamPath} from './src/app/features/panelling/panellingGeometry';export {insertSeamAnchor,bendSeamSegment,pointOnCurve} from './src/app/features/panelling/panellingSeams';export {SeamFinish} from './src/app/features/panelling/SeamFinish';export {SEAM_FINISHES,SEAM_FINISH_CATEGORIES} from './src/app/features/panelling/seamFinishCatalog';`);
const seam={id:'a',label:'Side insert',construction:'standard',anchors:[{id:'p',x:100,y:100,outgoing:{x:150,y:300}},{id:'q',x:500,y:800,incoming:{x:300,y:650}}]};
assert.strictEqual(api.flattenSeam(seam),api.flattenSeam(seam),'Repeated snapping reuses geometry');
const at=api.pointOnCurve(...seam.anchors,.5),split=api.insertSeamAnchor(seam,at);assert.equal(split.anchors.length,3);
assert.ok(Math.hypot(split.anchors[1].x-at.x,split.anchors[1].y-at.y)<.1);
const bent=api.bendSeamSegment(seam,0,.5,{x:300,y:400});assert.equal(bent.anchors[0].x,100);assert.equal(bent.anchors[1].y,800);
for(const finish of ['plain','topstitch','double','flatlock','exposed','piping','overlock','binding','raw','taped','hidden','zigzag','chain','lapped','coverstitch','mesh']){const styled={...seam,finish,threadColour:'#ffeeaa'};assert.deepEqual(api.flattenSeam(styled),api.flattenSeam(seam),'Finish preserves split geometry');const svg=renderToStaticMarkup(React.createElement('svg',null,React.createElement(api.SeamFinish,{seam:styled})));assert.ok(svg.includes('data-seam-finish="'+finish+'"'));assert.ok(!/NaN|Infinity/.test(svg));assert.deepEqual(JSON.parse(JSON.stringify(styled)),styled);}
console.log('PASS curve splitting, fixed endpoints, cached snapping, 16 saved vector seam finishes.');

const grouped=api.SEAM_FINISH_CATEGORIES.flatMap(c=>c.finishes);assert.equal(new Set(grouped).size,api.SEAM_FINISHES.length);assert.equal(grouped.length,api.SEAM_FINISHES.length);console.log('PASS every finish belongs to exactly one browsing category.');

const pair = { ...seam, id: 'paired', mirrorLinked: true };
const secondPair = { ...seam, id: 'paired-again', mirrorLinked: true };
const solo = { ...seam, id: 'single', mirrorLinked: false };
const savedSeams = JSON.parse(JSON.stringify([pair, solo, secondPair]));
for (const legacyMirror of [false, true]) {
  const visible = api.linkedMirrorSeams(savedSeams, 1024, legacyMirror);
  assert.deepEqual(visible.map(s => s.id), ['paired', 'single', 'paired-again', 'paired:mirror', 'paired-again:mirror']);
  assert.equal(visible[3].anchors[0].outgoing.x, 2048 - pair.anchors[0].outgoing.x);
}
assert.equal(api.linkedMirrorSeams([seam], 1024, true).length, 2, 'Legacy mirrored projects keep their pairs');
assert.equal(api.linkedMirrorSeams([seam], 1024, false).length, 1, 'Legacy singles remain single');
const crosswise = { ...pair, anchors: [{ id: 'a', x: 100, y: 50 }, { id: 'b', x: 1948, y: 50 }] };
assert.equal(api.linkedMirrorSeams([crosswise], 1024).length, 1, 'A symmetric seam is drawn only once');
console.log('PASS persisted mirror pairs, standalone seams, legacy projects and overlapping reflections.');
