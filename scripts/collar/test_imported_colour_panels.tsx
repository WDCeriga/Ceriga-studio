import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import polygonClipping, { type MultiPolygon } from 'polygon-clipping';
import { importedControlGroups, importedGarmentLayers, recolorImportedParts, type ImportedGarment, type ImportedPart, type ImportedPoint } from '../../src/app/data/importedGarment';
import { colourPanelArea, importedColourPanels, importedColourParts, splitColourPanel } from '../../src/app/data/importedGarmentColourPanels';
import { ImportedGarmentEditor } from '../../src/app/components/builder/ImportedGarmentEditor';
import { TshirtSvgPreview } from '../../src/app/components/builder/TshirtSvgPreview';
import { renderFabricSvg } from '../../src/app/lib/tshirtSvgUtils';

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const svg = (points: ImportedPoint[], ink = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><path d="M${points.map(([x, y]) => `${x * 2048},${y * 2048}`).join('L')}${ink ? '' : 'Z'}" fill="${ink ? 'none' : '#000000'}"${ink ? ' stroke="#141414" stroke-width="5"' : ''}/></svg>`;

export function colourPanelFixture(): ImportedGarment {
  const part = (id: string, category: ImportedPart['builderCategory'], outline: ImportedPoint[]): ImportedPart => ({
    id, name: id === 'body' ? 'Body' : id === 'left-sleeve' ? 'Left sleeve' : 'Right sleeve', semanticType: id === 'body' ? 'body' : 'sleeve',
    material: 'cotton', evidence: 'Synthetic colour regression only', colorable: true, structural: true, bounds: [.1, .1, .9, .9],
    seed: [.5, .5], attachmentTo: null, symmetryPartner: null, outline, boundary: { boundaryType: 'silhouette', confidence: 1, evidence: 'Synthetic' },
    layerKind: 'structural', builderCategory: category, userFacingName: category === 'sleeves' ? 'Sleeves' : 'Body', colourGroup: category,
    view: 'front', svg: svg(outline), constructionSvg: '', stitchSvg: '', area: 10000, color: '#8d969c',
    parentGarment: 'synthetic', layerOrder: 1, geometryBounds: [.1, .1, .9, .9], measurement: { unit: 'relative', width: .4, height: .6 },
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  });
  const parts = [part('body', 'fabric-colour', [[.3, .2], [.7, .2], [.7, .85], [.3, .85]]),
    part('left-sleeve', 'sleeves', [[.3, .2], [.1, .35], [.08, .8], [.25, .8]]),
    part('right-sleeve', 'sleeves', [[.7, .2], [.9, .35], [.92, .8], [.75, .8]])];
  const manifest: ImportedGarment['manifest'] = { garmentType: 'hoodie', subtype: 'Synthetic seam colouring regression', material: 'cotton', materialEvidence: 'Synthetic', fit: 'Unknown', construction: 'Unsplit body and sleeves with visible seams', confidence: 1, view: 'front', uncertainties: [], regions: parts };
  const edge = (partId: string, points: ImportedPoint[], id: string) => ({ id, partId: 'proposed-' + partId, name: id, userFacingName: 'Seam lines — review', builderCategory: parts.find(part => part.id === partId)!.builderCategory!, view: 'front' as const,
    constructionSvg: svg(points, true), stitchSvg: '', visibleEdges: [{ id, points, style: 'solid' as const, boundaryType: 'seam' as const, confidence: .65, evidence: 'Synthetic visible seam; not promoted to structural geometry' }] });
  return { source: 'azure-garment-reconstruction-v1', constructionVersion: 2, manifest, sourceManifest: manifest, parts, partCount: parts.length,
    sourceImage: '', cleanDrawing: '', lineArtSvg: '', stitchSvg: '', reviewNotes: [], accepted: true, reviewed: true,
    detailLayers: [edge('body', [[.3, .45], [.4, .42], [.5, .47], [.6, .42], [.7, .45]], 'chest-seam'),
      edge('body', [[.5, .2], [.5, .85]], 'body-centre'),
      edge('left-sleeve', [[.09, .575], [.15, .59], [.269, .565]], 'left-sleeve-seam'),
      edge('right-sleeve', [[.731, .565], [.85, .59], [.91, .575]], 'right-sleeve-seam')],
    provenance: { sourceImageHash: 'synthetic', analysisId: 'synthetic', drawingId: 'synthetic', segmentationId: 'synthetic', garmentVersion: 'synthetic' } };
}

export async function verifyImportedColourPanels() {
  const square: MultiPolygon = [[[[.1, .1], [.9, .1], [.9, .9], [.1, .9], [.1, .1]]]];
  const cuts: [string, ImportedPoint[], number][] = [
    ['straight', [[.1, .5], [.9, .5]], 2], ['curved', [[.1, .5], [.3, .3], [.6, .7], [.9, .5]], 2],
    ['registration gap', [[.108, .5], [.892, .5]], 2], ['outside crossing', [[0, .5], [1, .5]], 2],
    ['dangling', [[.1, .5], [.6, .5]], 1], ['interior', [[.3, .5], [.6, .5]], 1], ['silhouette', [[.1, .1], [.9, .1]], 1],
    ['closed', [[.3, .3], [.6, .3], [.6, .6], [.3, .6], [.3, .3]], 2],
    ['same edge curve', [[.1, .3], [.4, .5], [.1, .7]], 2], ['invalid', [[NaN, .1], [.8, .9]], 1],
  ];
  for (const [name, seam, count] of cuts) {
    const pieces = splitColourPanel(square, seam);
    check(pieces.length === count, `${name}: expected ${count}, got ${pieces.length}`);
    check(Math.abs(pieces.reduce((sum, piece) => sum + colourPanelArea(piece), 0) - colourPanelArea(square)) < 1e-8, `${name}: area changed`);
    if (pieces.length > 1) check(colourPanelArea(polygonClipping.intersection(...pieces as [MultiPolygon, ...MultiPolygon[]])) < 1e-8, `${name}: overlap`);
  }
  const garment = colourPanelFixture(), before = JSON.stringify(garment), panels = importedColourPanels(garment);
  check(panels.length === 8, `Expected four body panels and two on each sleeve, got ${panels.length}`);
  for (const part of garment.parts) {
    const children = panels.filter(panel => panel.partId === part.id);
    const original: MultiPolygon = [[part.outline!]];
    check(colourPanelArea(polygonClipping.difference(original, ...children.map(child => child.polygons))) < 1e-8, 'Missing fabric');
    for (let i = 0; i < children.length; i++) for (let j = i + 1; j < children.length; j++)
      check(colourPanelArea(polygonClipping.intersection(children[i].polygons, children[j].polygons)) < 1e-8, 'Panel overlap');
  }
  const seamOwner = garment.detailLayers![0];
  const withEdges = (paths: ImportedPoint[][]) => ({ ...garment, detailLayers: [{ ...seamOwner, visibleEdges: paths.map((points, index) => ({ ...seamOwner.visibleEdges[0], id: `edge-${index}`, points })) }] });
  check(importedColourPanels(withEdges([[[.3, .4], [.5, .4]], [[.5, .4], [.7, .4]]])).length === 2, 'Connected seam fragments were not joined');
  check(importedColourPanels(withEdges([[[.3, .4], [.5, .4]], [[.5, .4], [.5, .2]], [[.5, .85], [.5, .4]]])).length === 3, 'T junction depended on seam order');
  const reordered = { ...garment, detailLayers: [...garment.detailLayers!].reverse() };
  check(importedColourPanels(reordered).map(panel => panel.id).join() === panels.map(panel => panel.id).join(), 'Detail order changed saved colour IDs');
  check(importedControlGroups(garment, true).flatMap(group => group.parts).length === 8, 'Colour controls not split');
  check(importedControlGroups(garment).flatMap(group => group.parts).length === 3, 'Construction controls changed');
  const colors = recolorImportedParts(garment, panels[0].id, '#ff0000', 'group', { body: '#224466' });
  check(colors[panels[0].id] === '#ff0000' && !colors[panels[1].id], 'Individual panel colour leaked');
  const layers = importedGarmentLayers(garment, 'front', colors);
  check(layers.find(layer => layer.id === 'body')!.colourPanels!.filter(panel => panel.tint === '#224466').length === 3, 'Parent colour not inherited');
  check(importedColourParts(garment, colors).find(part => part.id === panels[1].id)!.color === '#224466', 'Swatch inheritance mismatch');
  const global = recolorImportedParts(garment, panels[0].id, '#123456', 'material', colors);
  check(panels.every(panel => global[panel.id] === '#123456'), 'Material recolour missed panels');
  const parent = recolorImportedParts(garment, 'body', '#abcdef', 'part', colors);
  check(panels.filter(panel => panel.partId === 'body').every(panel => parent[panel.id] === '#abcdef'), 'Whole-part recolour missed panels');
  const saved = JSON.parse(JSON.stringify({ importedGarment: garment, partColors: colors }));
  check(JSON.stringify(importedColourPanels(saved.importedGarment).map(panel => panel.id)) === JSON.stringify(panels.map(panel => panel.id)), 'Panel IDs changed after project reload');
  check(importedGarmentLayers(saved.importedGarment, 'front', saved.partColors)[0].colourPanels![0].tint === '#ff0000', 'Saved colour not restored');
  check(JSON.stringify(garment) === before && layers[0].svgRaw === garment.parts[0].svg, 'Structural source was modified');
  check(importedGarmentLayers(garment, 'back', colors).length === 0, 'Front panels leaked into back');
  const hidden = { ...garment, hiddenDetailGroups: ['fabric-colour:Seam lines — review', 'sleeves:Seam lines — review'] };
  check(importedColourPanels(hidden).length === 8, 'Hiding linework destroyed saved colour areas');
  for (const boundaryType of ['pocket-edge', 'overlay-edge', 'hardware-edge', 'hem-edge'] as const) {
    const ignored = { ...garment, detailLayers: garment.detailLayers!.map(detail => ({ ...detail, visibleEdges: detail.visibleEdges.map(edge => ({ ...edge, boundaryType })) })) };
    check(!importedColourPanels(ignored).length, `${boundaryType} invented colour panels`);
  }
  check(!importedColourPanels({ ...garment, detailLayers: garment.detailLayers!.map(detail => ({ ...detail, view: 'back' as const })) }).length, 'Back seams cut front fabric');
  check(!importedColourPanels({ ...garment, detailLayers: garment.detailLayers!.map(detail => ({ ...detail, visibleEdges: detail.visibleEdges.map(edge => ({ ...edge, style: 'stitch' as const })) })) }).length, 'Stitching cut fabric');
  check(!importedColourPanels({ ...garment, constructionVersion: undefined }).length, 'Legacy garment changed');
  const image = new Image();
  image.src = `data:image/svg+xml,${encodeURIComponent(renderFabricSvg(panels[0].svg, '#ff0000'))}`;
  await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2048;
  const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 2048, 2048);
  const pixels = context.getImageData(0, 0, 2048, 2048).data;
  let coloured = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] === 255) { check(pixels[i] === 255 && pixels[i + 1] === 0 && pixels[i + 2] === 0, 'SVG tint changed the clip instead of the fabric'); coloured++; }
  check(coloured > 10000, 'Colour panel not visible');
  return { geometryCases: cuts.length, panels: panels.length, controls: 8, preservedConstructionParts: garment.parts.length, persistence: 'passed', svgPixels: coloured };
}

export function mountColourPanelReview(container: HTMLElement) {
  function Review() {
    const [garment, setGarment] = useState(colourPanelFixture);
    const [colors, setColors] = useState<Partial<Record<string, string>>>({});
    const [selected, setSelected] = useState<string | null>(null);
    return <div style={{ display: 'grid', gridTemplateColumns: '380px 680px', gap: 24 }}>
      <ImportedGarmentEditor value={garment} onChange={setGarment} step={2} view="front" selectedId={selected} onSelect={setSelected} colors={colors}
        onColor={(id, color, scope) => setColors(previous => recolorImportedParts(garment, id, color, scope, previous))} onResetColors={() => setColors({})}/>
      <div style={{ width: 680, height: 680 }}><TshirtSvgPreview garmentType="hoodie" color="#8d969c" detailView="front" customAssetState={{ importedGarment: garment }} partColors={colors} className="h-full w-full"/></div>
    </div>;
  }
  createRoot(container).render(<Review/>);
}
