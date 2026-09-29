import { createElement } from 'react';
import '../../src/styles/index.css';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TshirtSvgPreview } from '../../src/app/components/builder/TshirtSvgPreview';
import { MeasurementPreview } from '../../src/app/components/builder/MeasurementsStep';
import { detailMeasurements, editAssetDimension, type AssetMeasurementSnapshot } from '../../src/app/components/builder/CustomAssetMeasurements';
import { buildGeometryGuides, sampleMeasurementShapes, measurementHemAt, measurementSideClearance, type MeasurementSource } from '../../src/app/components/builder/measurementGeometry';
import { getDefaultGarmentSelection, getGarmentAssetsForFit } from '../../src/app/data/garmentSvgCatalog';
import { createGarmentDetail, copyDetailToOpposite, detailSvg, detailPlacement, detailGesture, setDetailTransform, type GarmentDetail, type DetailBounds } from '../../src/app/data/garmentDetails';
import { createGarmentLabel } from '../../src/app/data/garmentLabels';
import { DEFAULT_PATCH, PATCH_TYPES, PATCH_SHAPES, readPatchArtwork } from '../../src/app/data/garmentPatches';
import { formatMeasurementDisplay, parseMeasurementInput } from '../../src/app/lib/measurements';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function verifyMeasurementGeometry(fit = 'slim', neckName?: string, raw = false) {
  const host = document.createElement('div');
  host.style.cssText = 'width:700px;height:700px;position:relative';
  document.body.append(host);
  const root = createRoot(host);
  const selection = getDefaultGarmentSelection('tshirt', fit);
  const sleeves = getGarmentAssetsForFit('tshirt', 'Sleeve length', fit).filter(asset => /^(short sleeve|long sleeve)/i.test(asset.displayName));
  const necks = getGarmentAssetsForFit('tshirt', 'Neck', fit).filter(asset => !neckName || asset.displayName.startsWith(neckName));
  let cases = 0;
  let sourceSnapshot: MeasurementSource[] = [];
  const depths: Record<string, number> = {};
  try {
    for (const neck of necks) for (const sleeve of sleeves) for (const view of ['front', 'back'] as const) {
      flushSync(() => root.render(createElement(TshirtSvgPreview, { garmentType: 'tshirt', fit, color: '#5C7FB6', detailView: view,
        neckFinish: raw ? 'raw' : 'ribbed',
        selection: { ...selection, Neck: neck.id, 'Sleeve length': sleeve.id },
        renderMeasurements: sources => { sourceSnapshot = sources; return null; } })));
      const shapes = sampleMeasurementShapes(sourceSnapshot);
      const guides = buildGeometryGuides(shapes);
      const label = `${fit}/${neck.displayName}/${sleeve.displayName}/${view}`;
      check(guides.length === 9, `${label}: missing guides`);
      check(guides.every(guide => [guide.x1, guide.y1, guide.x2, guide.y2].every(Number.isFinite)), `${label}: invalid coordinates`);
      const half = guides.find(guide => guide.id === 'halfLength')!;
      check(Math.abs(half.y2 - measurementHemAt(shapes, half.x1)!) < .01, `${label}: length misses local hem`);
      const chest = guides.find(guide => guide.id === 'chestWidth')!;
      const shoulder = guides.find(guide => guide.id === 'shoulderWidth')!;
      check(chest.x1 > shoulder.x1 && chest.x2 < shoulder.x2, `${label}: chest includes sleeves`);
      const opening = guides.find(guide => guide.id === 'sleeveOpening')!;
      const sleeveGuide = guides.find(guide => guide.id === 'sleeveLength')!;
      check(sleeveGuide.x2 === opening.x1 && sleeveGuide.y2 === opening.y1, `${label}: sleeve does not end at opening`);
      check(Math.hypot(opening.x2 - opening.x1, opening.y2 - opening.y1) > 10, `${label}: collapsed cuff`);
      const drop = guides.find(guide => guide.id === 'neckDrop')!;
      check(drop.y2 > drop.y1, `${label}: invalid neck drop`);
      depths[`${neck.displayName}/${view}`] = drop.y2 - drop.y1;
      cases++;
      await new Promise<void>(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
        channel.port2.postMessage(null);
      });
    }
    check(cases > 0, 'No garment variants exercised');
    const baseline = JSON.stringify(buildGeometryGuides(sampleMeasurementShapes(sourceSnapshot)));
    host.style.transform = 'scale(1.8)';
    check(JSON.stringify(buildGeometryGuides(sampleMeasurementShapes(sourceSnapshot))) === baseline, 'Zoom changed anchors');
    return { fit, cases, depths, zoomInvariant: true };
  } finally { flushSync(() => root.unmount()); host.remove(); }
}

export function verifyDetailMeasurements() {
  const bounds: DetailBounds = { minX: 400, maxX: 1600, minY: 200, maxY: 1800 };
  const pocket = createGarmentDetail('pocket', [], '#5C7F86');
  const duplicate = { ...pocket, id: 'second-pocket', name: 'Pocket 2', x: .3, scaleX: 1.4, scaleY: .8, rotation: 35 };
  const zip = createGarmentDetail('zip', [], '#5C7F86');
  const rear = { ...pocket, id: 'rear-pocket', view: 'back' as const };
  const initial = detailMeasurements([pocket, duplicate, zip, rear], 'front', bounds, [], 50);
  check(initial.length === 3 && new Set(initial.map(row => row.id)).size === 3, 'Independent assets merged');
  check(Math.abs(initial[0].width - 10) < .001 && Math.abs(initial[0].height - 11) < .001, 'Pocket dimensions disagree with placement');
  check(Math.abs(initial[1].width - 14) < .001 && Math.abs(initial[1].height - 8.8) < .001 && Math.abs(initial[1].rotation - 35) < .001, 'Independent resize/rotation lost');
  const moved = detailMeasurements([{ ...pocket, x: .3, y: .65 }], 'front', bounds, [], 50)[0];
  check(moved.id === initial[0].id && moved.left !== initial[0].left && moved.top !== initial[0].top, 'Move or stable ID lost');
  check(detailMeasurements([rear], 'front', bounds, [], 50).length === 0, 'Back asset leaked onto front');
  check(detailMeasurements([], 'front', bounds, [], 50).length === 0, 'Deleted asset remains');
  return { independentAssets: 3, resize: true, rotation: true, move: true, deletion: true, viewIsolation: true };
}

export async function verifyMeasurementPreview() {
  const host = document.createElement('div');
  host.style.cssText = 'width:700px;height:700px;position:relative';
  document.body.append(host);
  const root = createRoot(host);
  const pocket = createGarmentDetail('pocket', [], '#5C7F86');
  let snapshot: AssetMeasurementSnapshot = { view: 'front', assets: [] };
  let notify = () => {};
  const onAssetMeasurementsChange = (next: AssetMeasurementSnapshot) => { snapshot = next; notify(); };
  const waitForAssets = (count: number) => new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Expected ${count} assets, got ${snapshot.assets.length}`)), 10000);
    notify = () => { if (snapshot.assets.length === count) { clearTimeout(timeout); resolve(); } };
    notify();
  });
  const prints = [{ id: 'test-print', type: 'image' as const, content: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="60"%3E%3Crect width="100" height="60" fill="red"/%3E%3C/svg%3E', x: 260, y: 240, width: 100, height: 60, rotation: 25 }];
  const props = { garmentType: 'tshirt', fit: 'slim', garmentDetails: [pocket], prints, onAssetMeasurementsChange };
  try {
    flushSync(() => root.render(createElement(MeasurementPreview, props)));
    await document.fonts.ready;
    await waitForAssets(2);
    const rows = snapshot.assets;
    check(rows.length === 2, `Expected detail and artwork, got ${rows.length}`);
    const artwork = rows.find(row => row.kind === 'Print frame')!;
    check(Math.abs(artwork.width / artwork.height - 100 / 60) < .001, 'Print aspect ratio changed');
    check(Math.abs(artwork.rotation - 25) < .001, 'Print rotation ignored');
    host.style.transform = 'scale(1.7)';
    flushSync(() => root.render(createElement(MeasurementPreview, { ...props, selectedAssetId: rows[0].id })));
    check(JSON.stringify(snapshot.assets) === JSON.stringify(rows), `Zoom changed asset measurements: ${JSON.stringify({ before: rows, after: snapshot.assets })}`);
    check(host.querySelector(`[data-asset-measurement="${rows[0].id}"]`)?.getAttribute('aria-pressed') === 'true', 'Asset selection not highlighted');
    check(host.querySelector('[data-measurement-guide="chestWidth"]')?.getAttribute('opacity') === '0.22', 'Garment guides not faded');
    flushSync(() => root.render(createElement(MeasurementPreview, { ...props, selectedAssetId: rows[0].id, highlightedMeasurementId: 'chestWidth' })));
    check(host.querySelector('[data-measurement-guide="chestWidth"]')?.getAttribute('opacity') === '0.92', 'Garment hover lost precedence');
    flushSync(() => root.render(createElement(MeasurementPreview, { ...props, garmentDetails: [], prints: [] })));
    await waitForAssets(0);
    check(snapshot.assets.length === 0, 'Removed assets remain in section');
    return { assets: rows.length, printFrame: true, selection: true, hoverPriority: true, deletion: true, zoomInvariant: true };
  } finally { flushSync(() => root.unmount()); host.remove(); }
}

export function verifyEditableMeasurements() {
  const bounds: DetailBounds = { minX: 400, maxX: 1600, minY: 200, maxY: 1800 };
  const rowFor = (detail: GarmentDetail, details = [detail]) => detailMeasurements(details, detail.view ?? 'front', bounds, [], 50).find(row => row.sourceId === detail.id)!;
  for (const type of ['pocket', 'zip', 'patch'] as const) {
    let detail = createGarmentDetail(type, [], '#aaa');
    const original = rowFor(detail);
    const widthEdit = editAssetDimension({ garmentDetails: [detail], prints: [] }, original, 'width', original.width * 1.2);
    check(!widthEdit.error, `${type}: width edit rejected`);
    detail = widthEdit.changes!.garmentDetails![0];
    check(Math.abs(rowFor(detail).width - original.width * 1.2) < .001 && Math.abs(rowFor(detail).height - original.height) < .001, `${type}: independent width failed`);
    const heightEdit = editAssetDimension({ garmentDetails: [detail], prints: [] }, rowFor(detail), 'height', original.height * 1.1);
    check(!heightEdit.error, `${type}: height edit rejected`);
    detail = heightEdit.changes!.garmentDetails![0];
    check(Math.abs(rowFor(detail).height - original.height * 1.1) < .001 && Math.abs(rowFor(detail).width - original.width * 1.2) < .001, `${type}: independent height failed`);
    const moved = detailGesture(detail, bounds, [], 35, 50).detail;
    check(rowFor(moved).left !== rowFor(detail).left && rowFor(moved).id === original.id, `${type}: move/identity failed`);
    const rotated = setDetailTransform(moved, bounds, { rotation: 25 });
    check(Math.abs(rowFor(rotated).rotation - 25) < .001, `${type}: rotation not measured`);
    check(!!editAssetDimension({ garmentDetails: [detail], prints: [] }, rowFor(detail), 'width', 500).error, `${type}: invalid size accepted`);
  }
  const button = createGarmentDetail('button', [], '#aaa');
  let patch = createGarmentDetail('patch', [], '#aaa');
  for (const [field, value] of [['left', 22], ['top', 30], ['rotation', -25], ['rotation', 0]] as const) {
    const result = editAssetDimension({ garmentDetails: [patch], prints: [] }, rowFor(patch), field, value);
    check(!result.error, `Patch ${field} edit rejected`);
    patch = result.changes!.garmentDetails![0];
    check(Math.abs(rowFor(patch)[field] - (field === 'rotation' ? (value + 360) % 360 : value)) < .001, `Patch ${field} not synchronized`);
  }
  check(!!editAssetDimension({ garmentDetails: [patch], prints: [] }, rowFor(patch), 'left', 0).error, 'Out-of-bounds patch position silently clamped');
  const seam = measurementSideClearance([{ id: 'base', contours: [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 90, y: 100 }, { x: 10, y: 100 }]] }], [{ x: 20, y: 30 }, { x: 40, y: 30 }, { x: 40, y: 50 }, { x: 20, y: 50 }]);
  check(seam !== undefined && Math.abs(seam - 15) < .001, 'Side seam clearance missed tapered outline');
  let buttons = editAssetDimension({ garmentDetails: [button], prints: [] }, rowFor(button), 'count', 3).changes?.garmentDetails;
  check(buttons?.length === 3, 'Button count not connected');
  buttons = editAssetDimension({ garmentDetails: buttons, prints: [] }, rowFor(buttons[0], buttons), 'spacing', 3).changes?.garmentDetails;
  check(buttons?.length === 3 && Math.abs(rowFor(buttons[0], buttons).spacing! - 3) < .001, 'Button spacing not connected');
  buttons = editAssetDimension({ garmentDetails: buttons, prints: [] }, rowFor(buttons[0], buttons), 'diameter', 1.5).changes?.garmentDetails;
  check(buttons?.every(detail => Math.abs(rowFor(detail).width - 1.5) < .001 && Math.abs(rowFor(detail).height - 1.5) < .001), 'Arrangement diameter not connected');
  const print = { id: 'artwork', type: 'image' as const, content: '', x: 10, y: 10, width: 100, height: 80, rotation: 20 };
  const printRow = { ...rowFor(button), id: 'print:front:artwork', sourceId: print.id, printCmPerPixel: .1, width: 10, height: 8 };
  const printResult = editAssetDimension({ prints: [print] }, printRow, 'width', 12).changes?.prints?.[0];
  check(printResult?.width === 120 && printResult.height === 80, 'Print dimensions not written to transform');
  const label = createGarmentLabel('tag');
  const labelRow = { ...rowFor(button), id: 'label:front:label', sourceId: label.id, width: label.widthMm / 10, height: label.heightMm / 10, labelSizing: { effective: label, maxWidthMm: 150, maxHeightMm: 250 } };
  const labelResult = editAssetDimension({ prints: [], garmentLabels: [label] }, labelRow, 'width', 4).changes?.garmentLabels?.[0];
  check(labelResult?.widthMm === 40 && labelResult.heightMm === label.heightMm, 'Label dimensions not written to model');
  const inches = formatMeasurementDisplay('12.7', 'in');
  check(Math.abs(Number(parseMeasurementInput(inches, 'in')) - 12.7) < .001, 'Unit round trip changes size');
  return { detailTypes: 3, independentDimensions: true, buttonArrangement: true, print: true, label: true, units: true };
}

export async function verifyPatches() {
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 100;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#EF4B43'; context.fillRect(20, 10, 120, 80);
  context.fillStyle = '#fff'; context.font = 'bold 32px sans-serif'; context.fillText('C', 65, 62);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!)));
  const artwork = await readPatchArtwork(new File([blob], 'patch.png', { type: 'image/png' }));
  check(artwork.contour && artwork.contour.length > 4 && artwork.contour.length <= 180, 'Transparent contour missing or unbounded');
  const jpegBlob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/jpeg'));
  const jpeg = await readPatchArtwork(new File([jpegBlob], 'patch.jpg', { type: 'image/jpeg' }));
  check(!jpeg.contour, 'Opaque JPEG should use shape fallback');
  const svg = await readPatchArtwork(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><circle cx="60" cy="40" r="30" fill="red"/></svg>'], 'patch.svg', { type: 'image/svg+xml' }));
  check(svg.artwork?.startsWith('data:image/png;base64,'), 'SVG was not rasterized');
  let rejected = false;
  try { await readPatchArtwork(new File(['not an image'], 'broken.png', { type: 'image/png' })); } catch { rejected = true; }
  check(rejected, 'Invalid artwork accepted');
  const patch = { ...createGarmentDetail('patch', [], '#BDC6B7'), patch: { ...DEFAULT_PATCH, ...artwork } };
  const outputs: string[] = [];
  for (const material of Object.keys(PATCH_TYPES) as (keyof typeof PATCH_TYPES)[]) {
    const rendered = detailSvg({ ...patch, patch: { ...patch.patch, material } });
    check(!new DOMParser().parseFromString(rendered, 'image/svg+xml').querySelector('parsererror'), `${material}: malformed SVG`);
    const image = new Image();
    const url = URL.createObjectURL(new Blob([rendered], { type: 'image/svg+xml' }));
    try { image.src = url; await image.decode(); context.clearRect(0, 0, 160, 100); context.drawImage(image, 0, 0, 160, 100); outputs.push(canvas.toDataURL()); }
    finally { URL.revokeObjectURL(url); }
  }
  check(new Set(outputs).size === Object.keys(PATCH_TYPES).length, 'Patch materials are visually identical');
  for (const shape of Object.keys(PATCH_SHAPES) as (keyof typeof PATCH_SHAPES)[]) {
    check(!new DOMParser().parseFromString(detailSvg({ ...patch, patch: { ...patch.patch, shape } }), 'image/svg+xml').querySelector('parsererror'), `${shape}: invalid shape`);
  }
  const bounds = { minX: 400, maxX: 1600, minY: 200, maxY: 1800 };
  const circle = setDetailTransform({ ...patch, patch: { ...patch.patch, shape: 'circle' } }, bounds, { height: 190 });
  const resized = detailGesture(circle, bounds, [], 35, 10, { x: 1, y: 1 }).detail;
  check(Math.abs(detailPlacement(resized, bounds).width - detailPlacement(resized, bounds).height) < .001, 'Circle stretched');
  const square = setDetailTransform({ ...patch, patch: { ...patch.patch, shape: 'square' } }, bounds, { height: 190 });
  const squareResized = detailGesture(square, bounds, [], 35, 10, { x: 1, y: 1 }).detail;
  check(Math.abs(detailPlacement(squareResized, bounds).width - detailPlacement(squareResized, bounds).height) < .001, 'Square stretched');
  const copied = copyDetailToOpposite([patch], patch, 'front');
  check(copied.length === 2 && copied[1].id !== patch.id && copied[1].view === 'back', 'Patch copy lost identity/view');
  const restored: GarmentDetail[] = JSON.parse(JSON.stringify(copied));
  check(restored[1].patch?.artwork === artwork.artwork && detailSvg(restored[1]) === detailSvg(copied[1]), 'Patch serialization changed rendering');
  return { materials: outputs.length, uniqueRasterOutputs: new Set(outputs).size, shapes: Object.keys(PATCH_SHAPES).length, png: true, jpeg: true, svg: true, invalidRejected: true, circle: true, copy: true, serialization: true };
}