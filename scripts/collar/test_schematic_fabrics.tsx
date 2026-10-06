import { createHash } from 'node:crypto';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuilderGarmentPreview, type BuilderGarmentPreviewProps } from '../../src/app/components/builder/BuilderGarmentPreview';
import { schematicFabricParts } from '../../src/app/data/schematicFabricParts';
import { fabricSourceRecord } from '../../src/app/lib/fabricTextureScans';
import { FABRIC_LIBRARY, applyFabricPreset, assignFabric, setFabricGroupLinked, type FabricAssignments } from '../../src/app/data/garmentFabrics';

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const garmentTypes = ['tshirt', 'hoodie', 'sweatshirt', 'jacket', 'dress', 'skirt', 'trousers', 'shorts'] as const;
const base = { color: '#5c7fb6', neckTrimColor: '#cc3388', sleeveTrimColor: '#11bb88', pocketTrimColor: '#993300', stitchingColor: '#ffbbcc' };

export function schematicCases(): BuilderGarmentPreviewProps[] {
  const cases: BuilderGarmentPreviewProps[] = [];
  for (const garmentType of garmentTypes) {
    const standard = { ...base, garmentType };
    cases.push(standard);
    for (const neckType of ['crew', 'vneck', 'mock', 'scoop', 'square', 'shirt', 'zip', 'hood-single', 'hood-double', 'fullzip', 'halfzip']) cases.push({ ...standard, neckType });
    for (const sleeveType of ['set-in', 'raglan', 'dropped', 'sleeveless']) {
      for (const sleeveLength of ['short', 'three-quarter', 'long']) {
        for (const cuffType of ['ribbed', 'banded', 'raw', 'elasticated']) cases.push({ ...standard, sleeveType, sleeveLength, cuffType });
      }
    }
    for (const hemType of ['straight', 'ribbed', 'curved', 'split', 'raw']) {
      for (const pocketType of ['none', 'patch', 'kangaroo', 'welt', 'side-seam']) cases.push({ ...standard, hemType, pocketType });
    }
    for (const zipType of ['none', 'full', 'half', 'concealed', 'chest']) cases.push({ ...standard, zipType, stitchingType: 'double', fadingType: 'snow' });
    for (const fadingType of ['light', 'medium', 'heavy', 'acid', 'ombré', 'localised', 'snow']) cases.push({ ...standard, fadingType, stitchingType: 'bartack', hemType: 'ribbed' });
  }
  return cases;
}

function normalizeIds(markup: string): string {
  return markup.replace(/(?:garment-light|fade)-[^"\s)]+/g, match => `${match.startsWith('fade-') ? 'fade' : 'garment-light'}-ID`);
}

function removeTexture(markup: string): string {
  return markup.replace(/<defs><pattern\b[\s\S]*?<\/pattern><\/defs>/g, '').replace(/<(path|rect|ellipse)\b[^>]*data-fabric-part="[^"]*"[^>]*>/g, shape => {
    const fill = shape.match(/data-fabric-base="([^"]*)"/)?.[1];
    check(fill, 'Textured shape lost its original colour');
    return shape.replace(/fill="url\(#[^"]*\)"/, `fill="${fill}"`).replace(/ data-fabric-(?:part|base)="[^"]*"/g, '');
  });
}

const render = (props: BuilderGarmentPreviewProps) => renderToStaticMarkup(createElement(BuilderGarmentPreview, props));

/** Hash of the pre-fabric renderer, normalizing only React-generated gradient IDs. */
export function schematicGeometryDigest(Component: ComponentType<BuilderGarmentPreviewProps> = BuilderGarmentPreview): string {
  const hash = createHash('sha256');
  for (const props of schematicCases()) hash.update(normalizeIds(renderToStaticMarkup(createElement(Component, props))));
  return hash.digest('hex');
}

export function verifySchematicFabrics() {
  const cases = schematicCases();
  const digest = schematicGeometryDigest();
  check(digest === '7a92262a6f263c73716c4c694764d222f16048e50a5b51ba9d6220046b046e0f', `Original schematic geometry, colours, ink or details changed: ${digest}`);
  for (const props of cases) {
    const parts = schematicFabricParts(props);
    const assignments: FabricAssignments = { assignments: Object.fromEntries(parts.map((part, index) => [part.id, FABRIC_LIBRARY[index % FABRIC_LIBRARY.length].id])), unlinkedGroups: ['sleeves', 'cuffs'] };
    const original = render(props), textured = render({ ...props, fabricAssignments: assignments });
    check(normalizeIds(removeTexture(textured)) === normalizeIds(original), `Fabric changed geometry, colour, ink or order: ${JSON.stringify(props)}`);
    const renderedIds = new Set(Array.from(textured.matchAll(/data-fabric-part="([^"]*)"/g), match => match[1]));
    check(renderedIds.size === parts.length && parts.every(part => renderedIds.has(part.id)), `Parts list differs from actual filled surfaces: ${JSON.stringify(props)}`);
    check(!parts.some(part => part.role === 'pocket' || /zip|hardware/.test(part.id)), 'Unfilled pocket or hardware exposed as fabric');
    check(!textured.match(/<(?:path|rect|ellipse)[^>]*fill="none"[^>]*data-fabric-part/), 'Construction ink was textured');
    check(normalizeIds(render({ ...props, fabricAssignments: { assignments: { base: 'missing-fabric' }, unlinkedGroups: [] } })) === normalizeIds(original), 'Unknown fabric changed legacy rendering');
  }

  const sweatshirt: BuilderGarmentPreviewProps = { ...base, garmentType: 'sweatshirt', sleeveLength: 'long', cuffType: 'ribbed', hemType: 'ribbed' };
  const parts = schematicFabricParts(sweatshirt);
  const initial = applyFabricPreset(undefined, parts, 'jersey-mesh');
  const independent = assignFabric(setFabricGroupLinked(initial, parts, 'sleeves', false), parts, 'sleeveLeft', 'denim-twill');
  check(independent.assignments.sleeveLeft === 'denim-twill' && independent.assignments.sleeveRight === 'mesh', 'Split sleeve assignment leaked');
  check(independent.assignments.neck === 'rib-1x1' && independent.assignments.sleeveHemLeft === 'rib-1x1', 'Preset failed on fallback trim roles');
  const onePart = render({ ...sweatshirt, fabricAssignments: { assignments: { sleeveLeft: 'mesh', sleeveHemRight: 'rib-2x2' }, unlinkedGroups: ['sleeves', 'cuffs'] } });
  check((onePart.match(/data-fabric-part=/g) ?? []).length === 2 && onePart.includes('data-fabric-part="sleeveLeft"') && onePart.includes('data-fabric-part="sleeveHemRight"'), 'Per-part materials affected unassigned surfaces');
  for (const fabric of FABRIC_LIBRARY) {
    const markup = render({ ...sweatshirt, fabricAssignments: { assignments: { base: fabric.id }, unlinkedGroups: [] } });
    check(markup.includes(`data-fabric-texture="${fabric.id}"`) && !markup.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, '').includes('NaN'), `Fabric failed: ${fabric.id}`);
    const record = fabricSourceRecord(fabric);
    check(markup.includes(`data-fabric-status="${record.sourceStatus}"`), `Missing material source status: ${fabric.id}`);
    check(record.sourceStatus !== 'unresolved' ? markup.includes('data-fabric-scan=') && markup.includes('data:image/png;base64,') : markup.includes('data-fabric-unavailable='), `Missing material or silent fallback: ${fabric.id}`);
  }
  const hoodie = render({ ...base, garmentType: 'hoodie', fabricAssignments: { assignments: { hoodInterior: 'french-terry', hood: 'french-terry' }, unlinkedGroups: [] } });
  check(hoodie.includes('data-fabric-surface="loops"') && hoodie.includes('data-fabric-surface="face"'), 'Visible hood interior/face distinction lost');
  const withoutSleeves = schematicFabricParts({ garmentType: 'dress', sleeveType: 'sleeveless', cuffType: 'ribbed', hemType: 'raw' });
  check(withoutSleeves.length === 2 && !withoutSleeves.some(part => part.group || part.role === 'hem'), 'Absent sleeve/cuff or unfilled hem exposed');
  const dormant = render({ ...sweatshirt, sleeveType: 'sleeveless', hemType: 'raw', fabricAssignments: { assignments: { sleeveLeft: 'mesh', sleeveHemRight: 'rib-2x2', hem: 'rib-1x1', pocket: 'cotton-twill', zip: 'denim-twill' }, unlinkedGroups: [] } });
  check(!dormant.includes('data-fabric-part='), 'Dormant assignments invented absent surfaces');
  const beforeState = JSON.stringify(independent);
  for (const color of ['#ffffff', '#000000', '#ef3340']) {
    const coloured = { ...sweatshirt, color, neckTrimColor: '#ffee33', sleeveTrimColor: '#224466', stitchingColor: '#11ddcc' };
    const textured = render({ ...coloured, fabricAssignments: independent });
    check(normalizeIds(removeTexture(textured)) === normalizeIds(render(coloured)), 'Material altered independent body/trim/thread colours');
    check(textured.includes('data-fabric-texture="denim-twill"') && textured.includes('data-fabric-texture="mesh"'), 'Colour edit lost materials');
  }
  check(JSON.stringify(independent) === beforeState, 'Rendering mutated persisted assignments');
  const paired = renderToStaticMarkup(createElement('div', null, createElement(BuilderGarmentPreview, { ...sweatshirt, fabricAssignments: independent }), createElement(BuilderGarmentPreview, { ...sweatshirt, fabricAssignments: independent })));
  const ids = Array.from(paired.matchAll(/<pattern id="([^"]*)"/g), match => match[1]);
  check(ids.length > 0 && new Set(ids).size === ids.length, 'Fabric pattern IDs collide between previews');
  return { cases: cases.length, fabrics: FABRIC_LIBRARY.length, digest, checks: 'legacy geometry, colours, ink, exact filled surfaces, absent parts, hardware, independent sleeves/cuffs, presets, hood interior, unique IDs' };
}
