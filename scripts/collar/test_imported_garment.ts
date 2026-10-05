import { canAcceptImportedConstruction, importedControlGroups, importedGarmentLayers, importedPartDimensions, recolorImportedParts, type ImportedGarment, type ImportedPart } from '../../src/app/data/importedGarment';
import { mergeImportedParts, reshapeImportedPart, reviseImportedGarment, splitImportedPart } from '../../src/app/data/importedGarmentEditing';
import { importedMeasurementGuides } from '../../src/app/data/importedGarmentMeasurements';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function rectangle(horizontal: number, width: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><rect x="${horizontal}" y="200" width="${width}" height="1000" fill="#000000"/></svg>`;
}

function fixture(): ImportedGarment {
  const part = (id: string, horizontal: number, partner: string): ImportedPart => ({
    id, name: id, semanticType: 'panel', material: 'denim', evidence: 'Synthetic test geometry',
    colorable: true, structural: true, bounds: [horizontal / 2048, 200 / 2048, (horizontal + 800) / 2048, 1200 / 2048],
    seed: [(horizontal + 400) / 2048, 700 / 2048], attachmentTo: null, symmetryPartner: partner,
    svg: rectangle(horizontal, 800), constructionSvg: rectangle(horizontal + 100, 4), stitchSvg: rectangle(horizontal + 120, 4),
    area: 200000, color: '#62788b', parentGarment: 'synthetic-shorts', layerOrder: horizontal,
    view: 'front', geometryBounds: [horizontal / 2048, 200 / 2048, (horizontal + 800) / 2048, 1200 / 2048],
    measurement: { unit: 'relative', width: 800 / 2048, height: 1000 / 2048 },
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  });
  const parts = [part('left', 200, 'right'), part('right', 1000, 'left')];
  const manifest: ImportedGarment['manifest'] = { garmentType: 'shorts', material: 'denim', subtype: 'Synthetic shorts', fit: 'Unknown',
    construction: 'Two adjacent test panels', materialEvidence: 'Test fixture only', confidence: 1, view: 'front', uncertainties: [], regions: parts };
  return { source: 'azure-garment-reconstruction-v1', parts, lineArtSvg: rectangle(300, 4), stitchSvg: rectangle(320, 4),
    partCount: 2, manifest, sourceManifest: manifest, sourceImage: '', cleanDrawing: '', reviewNotes: [],
    provenance: { sourceImageHash: 'test-source', analysisId: 'test-analysis', drawingId: 'test-drawing', segmentationId: 'test-segmentation', garmentVersion: 'test-garment' },
    accepted: true, reviewed: true };
}

async function alphaAt(raw: string, horizontal: number, vertical: number) {
  const image = new Image();
  image.src = `data:image/svg+xml,${encodeURIComponent(raw)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2048;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  return context.getImageData(horizontal, vertical, 1, 1).data[3];
}

export async function verifyImportedGarmentEditing() {
  const garment = fixture();
  const original = JSON.stringify(garment);
  check(!canAcceptImportedConstruction(garment), 'Legacy partitions can be accepted as construction');
  const construction: ImportedGarment = { ...garment, constructionVersion: 2, parts: garment.parts.map(part => ({ ...part,
    outline: [[.1, .1], [.9, .1], [.9, .9]], boundary: { boundaryType: 'panel-edge', confidence: .9, evidence: 'Synthetic seam' },
    layerKind: 'structural', builderCategory: 'fabric-colour', userFacingName: 'Main body', colourGroup: 'main-body', editableIndependently: false })) };
  check(canAcceptImportedConstruction(construction), 'Evidenced construction rejected');
  check(importedControlGroups(construction).length === 1 && importedControlGroups(construction)[0].parts.length === 2, 'Paired legs produced separate controls');
  check(recolorImportedParts(construction, 'left', '#223344', 'group').right === '#223344', 'Main body colours not linked');
  const unlinked = { ...construction, parts: construction.parts.map(part => part.id === 'right' ? { ...part, colourGroup: 'right', editableIndependently: true } : part) };
  check(!recolorImportedParts(unlinked, 'left', '#223344', 'group').right && importedControlGroups(unlinked).length === 2, 'Explicit unlink ignored');
  let rejected = false;
  try { await splitImportedPart(construction, 'left', [[190, 190], [600, 190], [600, 1210], [190, 1210]]); }
  catch (failure) { rejected = failure instanceof Error && failure.message.includes('seam evidence'); }
  check(rejected, 'Construction split accepted without seam evidence');
  const seamSplit = await splitImportedPart(construction, 'left', [[190, 190], [600, 190], [600, 1210], [190, 1210]], { boundaryType: 'seam', confidence: 1, evidence: 'Synthetic sewn seam' });
  const seamMerge = await mergeImportedParts(seamSplit, 'left', seamSplit.parts[1].id);
  check(await alphaAt(seamMerge.parts[0].constructionSvg, 600, 500) === 0, 'Deleted boundary ink remains inside merged fabric');
  const part = garment.parts[0];
  check(importedPartDimensions(garment, part) === null, 'Uncalibrated garment inferred millimetres');
  const calibrated = { ...garment, calibration: { partId: part.id, axis: 'width' as const, millimetres: 400 } };
  const dimensions = importedPartDimensions(calibrated, part);
  check(dimensions?.width === 400 && dimensions.height === 500, 'Calibration scale changed');
  check(importedPartDimensions({ ...calibrated, calibration: { ...calibrated.calibration, millimetres: NaN } }, part) === null, 'Invalid calibration accepted');
  const single = recolorImportedParts(garment, 'left', '#112233', 'part');
  check(single.left === '#112233' && !single.right, 'Part colour leaked');
  const linked = recolorImportedParts(garment, 'left', '#334455', 'symmetry');
  check(linked.left === linked.right, 'Symmetry colour not linked');
  const material = recolorImportedParts(garment, 'left', '#556677', 'material');
  check(material.right === '#556677', 'Material colour not applied');
  const hardware = { ...garment, parts: [...garment.parts, { ...part, id: 'button', semanticType: 'button' as const, colorable: false, material: 'metal' }] };
  check(!recolorImportedParts(hardware, 'button', '#ffffff', 'part').button, 'Hardware was recoloured');
  const layers = importedGarmentLayers(hardware, 'front', material);
  check(layers.length === 3 && layers[0].tint === '#556677' && layers[2].washable === false, 'Semantic renderer lost colour or wash policy');
  check(importedGarmentLayers(garment, 'back').length === 0, 'Unobserved view fabricated');
  const withDetails: ImportedGarment = { ...construction, detailLayers: [{ id: 'detail-pocket', partId: 'uncommitted-pocket', name: 'Pocket opening',
    builderCategory: 'pockets-zips', userFacingName: 'Front pockets', view: 'front', constructionSvg: rectangle(600, 4), stitchSvg: rectangle(620, 4), visibleEdges: [] }] };
  const detailLayer = importedGarmentLayers(withDetails, 'front').at(-1)!;
  const pocketGroup = importedControlGroups(withDetails).find(group => group.name === 'Front pockets');
  check(pocketGroup?.details.length === 1 && pocketGroup.parts.length === 0, 'Pocket detail lost its friendly control or became a fabric region');
  check(importedGarmentLayers({ ...withDetails, hiddenDetailGroups: ['pockets-zips:Front pockets'] }, 'front').length === 2, 'Detail visibility ignored');
  check(detailLayer.kind === 'detail' && !detailLayer.washable && detailLayer.zIndex > construction.parts[1].layerOrder, 'Uncommitted fabric detail disappeared or became washable fabric');
  check(await alphaAt(detailLayer.svgRaw, 601, 500) > 0, 'Visible pocket opening lost in native layers');
  const detailMerged = await mergeImportedParts(withDetails, 'left', 'right');
  check(detailMerged.detailLayers?.[0].constructionSvg === withDetails.detailLayers![0].constructionSvg, 'Fabric merge erased independent detail');
  check(!importedGarmentLayers({ ...withDetails, stitches: { visible: false, color: '#112233', weight: 1 } }, 'front').at(-1)!.stitchSvg, 'Independent detail ignored thread visibility');
  check(importedGarmentLayers({ ...garment, stitches: { visible: false, color: '#112233', weight: 2 } }, 'front').every(layer => !layer.stitchSvg), 'Hidden stitches rendered');
  const measured: ImportedGarment = { ...withDetails, parts: [
    { ...construction.parts[0], outline: [[.25, .2], [.5, .2], [.5, .5], [.45, .9], [.1, .85]], seed: [.3, .5] },
    { ...construction.parts[1], outline: [[.5, .2], [.75, .2], [.9, .85], [.55, .9], [.5, .5]], seed: [.7, .5] },
    { ...construction.parts[0], id: 'waistband', semanticType: 'waistband', outline: [[.25, .1], [.75, .1], [.75, .2], [.25, .2]] },
  ], detailLayers: [{ ...withDetails.detailLayers![0], partId: 'left', visibleEdges: [
    { id: 'hem', boundaryType: 'hem-edge', confidence: .95, evidence: 'Synthetic hem', style: 'solid', points: [[.1, .85], [.45, .9]] },
    { id: 'pocket', boundaryType: 'pocket-edge', confidence: .9, evidence: 'Synthetic opening', style: 'solid', points: [[.3, .25], [.27, .35], [.2, .4]] },
  ] }] };
  const uncalibratedGuides = importedMeasurementGuides(measured);
  check(uncalibratedGuides.length === 8 && uncalibratedGuides.every(guide => guide.length > 0 && guide.millimetres === null), 'Automatic shorts landmarks missing or inferred physical dimensions');
  const independentColours = { ...measured, sourceManifest: { ...measured.sourceManifest, regions: measured.parts }, parts: measured.parts.map(part => ({ ...part, colourGroup: part.id, editableIndependently: true })) };
  check(importedMeasurementGuides(independentColours).every((guide, index) => guide.length === uncalibratedGuides[index].length), 'Unlinking colours changed anatomical measurements');
  const supplied = importedMeasurementGuides({ ...measured, measurementCalibration: { measurementId: 'waist', millimetres: 400 } });
  check(supplied.find(guide => guide.id === 'waist')?.millimetres === 400 && supplied.find(guide => guide.id === 'waist')?.status === 'supplied', 'Known waist measurement lost');
  check(supplied.find(guide => guide.id === 'waistband-height')?.millimetres === 80 && supplied.filter(guide => guide.status === 'estimated').length === 7, 'One measurement did not calibrate other anatomical guides');
  check(importedMeasurementGuides({ ...measured, measurementCalibration: { measurementId: 'waist', millimetres: NaN } }).every(guide => guide.millimetres === null), 'Invalid anatomical calibration accepted');
  check(importedMeasurementGuides({ ...measured, detailLayers: [] }).find(guide => guide.id === 'pocket-opening')?.status === 'unavailable', 'Hidden pocket geometry was invented');
  const measuredScale: ImportedGarment = { ...measured, measurementCalibration: { measurementId: 'waist', millimetres: 400 } };
  check(reviseImportedGarment(measuredScale, measured.parts.map(part => ({ ...part, name: `${part.name} renamed` }))).measurementCalibration?.millimetres === 400, 'Metadata edit erased scale');
  check(!reviseImportedGarment(measuredScale, measured.parts.slice(1)).measurementCalibration, 'Changed geometry retained stale scale');
  const expanded = await reshapeImportedPart(garment, 'left', [[190, 190], [1300, 190], [1300, 1210], [190, 1210]]);
  check(await alphaAt(expanded.parts[0].constructionSvg, 1101, 500) > 0, 'Transferred construction ink lost');
  check(await alphaAt(expanded.parts[0].stitchSvg, 1121, 500) > 0, 'Transferred stitching lost');
  check(await alphaAt(expanded.parts[1].svg, 1101, 500) === 0, 'Expanded regions overlap');
  const split = await splitImportedPart(garment, 'left', [[190, 190], [600, 190], [600, 1210], [190, 1210]]);
  check(split.parts.length === 3 && new Set(split.parts.map(item => item.id)).size === 3, 'Split IDs not unique');
  check(split.parts[1].attachmentTo === 'left' && split.parts[1].symmetryPartner === null, 'Split graph invalid');
  const merged = await mergeImportedParts(split, 'left', split.parts[1].id);
  check(merged.parts.length === 2 && merged.parts[0].id === 'left', 'Merge lost stable identity');
  check(!merged.accepted && !merged.reviewed && merged.revision === 2, 'Local geometry edit retained approval');
  check(merged.parts.every(item => !item.attachmentTo || merged.parts.some(parent => parent.id === item.attachmentTo)), 'Merge left dangling attachment');
  check(JSON.stringify(garment) === original, 'Editing mutated the source garment');
  return { calibration: true, colourScopes: 4, constructionGroups: true, legacyAcceptanceBlocked: true, layerPolicies: true, inkTransfer: true, splitMerge: true, immutable: true };
}