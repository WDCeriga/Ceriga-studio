import { strict as assert } from 'node:assert';
import { createGarmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';
import { generateEstimatedBack } from '../../src/app/data/importedGarmentBack';
import { importedGarmentSvg } from '../../src/app/data/importedGarmentExport';

const garment = createGarmentRegressionFixture('tee');
const body = garment.parts.find(part => part.semanticType === 'body')!;
body.svg = '<svg viewBox="0 0 2048 2048"><g fill="#000000" stroke="none"><path d="M600,500L1400,500L1400,1800L600,1800Z"/></g><g data-texture="rib" fill="none" stroke="#141414" opacity="0.16"><path d="M1000,600V1700"/></g></svg>';
const before = JSON.stringify(garment);
const colors = { [body.id]: '#224466' };
const technical = importedGarmentSvg(garment, 'front', 'technical', colors);
assert.ok(technical.includes('data-texture="rib"'));
assert.ok(technical.includes('#224466'));
const outline = importedGarmentSvg(garment, 'front', 'outline', colors);
assert.ok(!outline.includes('data-texture="rib"'));
assert.ok(outline.includes('#ffffff'));
assert.ok(!outline.includes('#224466'));
const overlay = importedGarmentSvg(garment, 'front', 'construction', colors);
assert.ok(overlay.includes('<g fill="none" stroke="#177b70" stroke-width="3"><path d="M'));
assert.ok(!technical.includes('<image'));
assert.equal(JSON.stringify(garment), before);
const back = generateEstimatedBack(garment);
assert.ok(back.available);
if (back.available) {
  const svg = importedGarmentSvg(back.garment, 'back', 'technical');
  assert.ok(svg.includes('Estimated back — inferred from front geometry'));
  assert.ok(svg.includes('Hidden construction remains uncertain'));
  assert.ok(!svg.includes('data-texture="rib"'), 'Front texture must not be mistaken for back construction');
}
body.stitchSvg = '<svg><g fill="#000000" stroke="none"><path stroke="#000000" stroke-width="1" d="M700,1700H1300"/></g></svg>';
garment.stitches = { visible: true, color: '#778899', weight: 2 };
const stitched = importedGarmentSvg(garment, 'front', 'technical');
assert.ok(stitched.includes('<path stroke="#778899" stroke-width="20" stroke-linejoin="round" d="M700,1700H1300"/>'));
assert.ok(!importedGarmentSvg(garment, 'front', 'outline').includes('M700,1700H1300'));
garment.stitches.visible = false;
assert.ok(!importedGarmentSvg(garment, 'front', 'technical').includes('M700,1700H1300'));
console.log('15 garment drawing export checks passed');
