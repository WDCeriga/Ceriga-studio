import { createElement, useState } from 'react';
import { collarEditGeometry, editedCollarPoint, editedCollarSvg, validCollarEdits, type CollarHandle, type CollarManualEdits } from '../../src/app/data/customCollarEditing';
import { setCustomCollarEdits } from '../../src/app/data/customAssets';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import '../../src/styles/index.css';
import { acceptedAssetBundle, acceptedDefinition, activeCustomAssets, customAssetTransforms, deriveOppositeSleeve, installCustomAsset, updateCustomAssetTransform, type CustomAssetCategory, type CustomAssetDefinition, type CustomAssetState } from '../../src/app/data/customAssets';
import { DEFAULT_TSHIRT_LAYER_TRANSFORM } from '../../src/app/data/tshirtLayerAssets';
import { copyDetailToOpposite, detailPlacement, detailSvg, resizeGarmentDetail, setDetailTransform, type GarmentDetail } from '../../src/app/data/garmentDetails';
import { detailMeasurements, editAssetDimension } from '../../src/app/components/builder/CustomAssetMeasurements';
import { TshirtSvgPreview } from '../../src/app/components/builder/TshirtSvgPreview';
import { CustomAssetUpload } from '../../src/app/components/builder/CustomAssetUpload';
import { GarmentDetailsPanel } from '../../src/app/components/builder/GarmentDetails';
import { getDefaultGarmentSelection, getGarmentAssetsForFit, resolveGarmentLayers } from '../../src/app/data/garmentSvgCatalog';
import { getLocalProject, saveLocalProject } from '../../src/app/lib/localProjects';
import { filledFabricSilhouette, getPotraceSvgBBox, renderFabricSvg } from '../../src/app/lib/tshirtSvgUtils';
import { measureStitchGeometry, renderStitchStyles } from '../../src/app/data/tshirtStitching';
import { assetUserPlacement, registeredAssetGeometry, setAssetUserTransform } from '../../src/app/data/customAssetEditing';
import { CustomAssetEditorPanel } from '../../src/app/components/builder/CustomAssetEditor';
import type { AssetUserTransform } from '../../src/app/data/customAssetEditing';
import { defaultSleeveEdits, mirroredSleeveEdits, reconstructSleeve, sleeveFromDraft, sleeveGeometry, traceSleeveDraft, validateSleeveReconstruction, type SleeveDraft, type SleeveContourHandle } from '../../src/app/data/sleeveReconstruction';
import { SleeveReconstructionEditor } from '../../src/app/components/builder/SleeveReconstructionEditor';

type ContourDraft = SleeveDraft & { cleanDrawing: string; sleeveIsolation: { normalization: { landmarks: { armhole: number[][]; cuff: number[][] } } } };

export async function verifySleeveContours(draft: ContourDraft) {
  const traced = await traceSleeveDraft(draft, draft.cleanDrawing, draft.sleeveIsolation.normalization.landmarks);
  check(Boolean(traced.stageProvenance.contourStyleId), 'Source contour identity missing');
  for (const side of ['left', 'right'] as const) {
    const asset = sleeveFromDraft(traced, side);
    const model = asset.sleeveReconstruction!;
    const shape = sleeveGeometry(model);
    const sourceGarment = model.detectedStyle.sourceGarment;
    const scale = sourceGarment ? model.socket.bodyWidth! * sourceGarment.armholeToBodyWidth : shape.armhole;
    const shoulder = model.detectedStyle.contours!.outer[0];
    const center = sourceGarment ? [shape.shoulder[0] - scale * (shape.axis[0] * shoulder[0] + shape.across[0] * shoulder[1]),
      shape.shoulder[1] - scale * (shape.axis[1] * shoulder[0] + shape.across[1] * shoulder[1])] : [(shape.shoulder[0] + shape.underarm[0]) / 2, (shape.shoulder[1] + shape.underarm[1]) / 2];
    check(!shape.issues.length, `${draft.fit}/${side}: ${shape.issues.join(', ')}`);
    for (const edge of ['outer', 'inner'] as const) {
      const source = model.style.contours![edge];
      const actual = edge === 'outer' ? shape.outerContour : shape.innerContour;
      for (let index = Math.ceil(source.length * .35); index < source.length; index++) {
        const point = source[index];
        const expected = [center[0] + scale * (shape.axis[0] * point[0] + shape.across[0] * point[1]),
          center[1] + scale * (shape.axis[1] * point[0] + shape.across[1] * point[1])];
        check(actual.some(candidate => Math.hypot(candidate[0] - expected[0], candidate[1] - expected[1]) < 1e-7), 'Source contour changed away from attachment');
      }
    }
    for (const mirror of [false, true]) {
      const initial = { ...model, edits: { ...model.edits, mirror } };
      const before = sleeveGeometry(initial);
      for (const key of ['frontJoin', 'backJoin', 'upperOuter', 'upperInner', 'midOuter', 'midInner', 'cuffTop', 'cuffBottom'] as const) {
        const edits = key === 'cuffTop' || key === 'cuffBottom' ? { ...initial.edits, [key]: [9, 4] as [number, number] }
          : { ...initial.edits, contourOffsets: { [key as SleeveContourHandle]: [9, 4] as [number, number] } };
        const next = sleeveGeometry(validateSleeveReconstruction({ ...initial, edits }));
        check(Math.abs(next[key][0] - before[key][0] - 9) < 1e-7 && Math.abs(next[key][1] - before[key][1] - 4) < 1e-7, `Handle ${key} did not follow pointer`);
      }
    }
    const tilted = sleeveGeometry({ ...model, style: { ...model.style, hemAngle: model.style.hemAngle + 10 } });
    check(tilted.svg !== shape.svg && Math.hypot(tilted.hemTilt[0] - shape.hemTilt[0], tilted.hemTilt[1] - shape.hemTilt[1]) > 1, 'Hem tilt is inactive');
    const longer = sleeveGeometry({ ...model, style: { ...model.style, length: 1.4 } });
    check(Math.abs(longer.length / scale - 1.4) < 1e-9, 'Source length was clamped to a generic class');
    if (sourceGarment) {
      const deeper = structuredClone(model);
      deeper.socket.join = deeper.socket.join.map(point => [point[0], shape.shoulder[1] + (point[1] - shape.shoulder[1]) * 1.6]);
      const fitted = sleeveGeometry(deeper);
      check(Math.abs(fitted.length - shape.length) < 1e-9, 'Target armhole enlarged the sleeve');
      check(JSON.stringify([fitted.cuffTop, fitted.cuffBottom]) === JSON.stringify([shape.cuffTop, shape.cuffBottom]), 'Armhole depth changed the opening');
      const wider = sleeveGeometry({ ...model, socket: { ...model.socket, bodyWidth: model.socket.bodyWidth! * 1.2 } });
      check(Math.abs(wider.length / shape.length - 1.2) < 1e-9, 'Sleeve is not body-proportional');
      const joined = sleeveGeometry({ ...model, edits: { ...model.edits, shoulder: [8, 6], underarm: [5, 9] } });
      check(JSON.stringify([joined.cuffTop, joined.cuffBottom]) === JSON.stringify([shape.cuffTop, shape.cuffBottom]), 'Attachment edits moved the free sleeve');
      for (const silhouette of ['straight', 'flared', 'tapered'] as const) {
        for (const length of [.18, .4, 1.8]) {
          const candidate = { ...model, style: { ...model.style, silhouette, length, openingWidth: model.style.upperWidth * (silhouette === 'flared' ? 1.25 : silhouette === 'tapered' ? .65 : 1) } };
          const first = sleeveGeometry(candidate);
          const second = sleeveGeometry({ ...candidate, socket: deeper.socket });
          check(JSON.stringify([first.length, first.cuffTop, first.cuffBottom]) === JSON.stringify([second.length, second.cuffTop, second.cuffBottom]), `${silhouette}/${length}: target armhole changed free proportions`);
        }
      }
    }
    const edits = { ...model.edits, contourOffsets: { midOuter: [12, 7] as [number, number] } };
    const persisted = acceptedDefinition(JSON.parse(JSON.stringify(reconstructSleeve(asset, { ...model, edits }))));
    check(JSON.stringify(persisted.sleeveReconstruction?.style.contours) === JSON.stringify(model.style.contours), 'Saved source contours changed');
    check(persisted.sleeveReconstruction?.edits.contourOffsets?.midOuter?.[0] === 12, 'Saved control point lost');
    check(JSON.stringify(mirroredSleeveEdits(mirroredSleeveEdits(edits))) === JSON.stringify(edits), 'Linked mirroring does not round-trip');
    const legacy = { ...model, style: { ...model.style, contours: undefined, artwork: undefined, cuff: undefined }, detectedStyle: { ...model.detectedStyle, contours: undefined, artwork: undefined, cuff: undefined }, edits: defaultSleeveEdits() };
    check(Boolean(sleeveGeometry(validateSleeveReconstruction(legacy)).svg), 'Legacy scalar sleeve failed');
  }
  return { fit: draft.fit, contourPreserved: true, controls: true, persistence: true };
}

export async function mountSleeveContourEditor(draft: ContourDraft) {
  removeCustomPreview();
  const traced = await traceSleeveDraft(draft, draft.cleanDrawing, draft.sleeveIsolation.normalization.landmarks);
  let latest = [sleeveFromDraft(traced, 'left'), sleeveFromDraft(traced, 'right')];
  function Fixture() {
    const [assets, setAssets] = useState(latest);
    const [linked, setLinked] = useState(true);
    latest = assets;
    const state = assets.reduce((current, asset) => installCustomAsset(current, asset, 'tshirt', draft.fit, 'front', '#7da8dd'), {} as CustomAssetState);
    return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16, color: 'white' }}>
      <div style={{ flex: '1 1 480px', minWidth: 0 }}>
      <SleeveReconstructionEditor assets={assets} renderPreview={overlay => <TshirtSvgPreview canvasOverlay={overlay} garmentType="tshirt" fit={draft.fit} color="#7da8dd" detailView="front" selection={getDefaultGarmentSelection('tshirt', draft.fit)} customAssetState={state} className="h-full w-full"/>} applyBoth={linked} onApplyBoth={setLinked} onChange={(id, model) => setAssets(current => current.map(asset => asset.id === id ? reconstructSleeve(asset, model) : linked ? reconstructSleeve(asset, { ...asset.sleeveReconstruction!, style: structuredClone(model.style), edits: mirroredSleeveEdits(model.edits) }) : asset))}/>
      </div>
    </div>;
  }
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#171719;overflow:auto';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  flushSync(() => previewRoot!.render(<Fixture/>));
  return { getAssets: () => latest };
}

export function mountPhysicalAssetEditor(input: CustomAssetDefinition & { oppositeSleeve: CustomAssetDefinition }) {
  removeCustomPreview();
  const sleeve = acceptedDefinition(input);
  const fit = sleeve.compatibility.fits[0];
  const initial = [sleeve, ...deriveOppositeSleeve([sleeve], input.oppositeSleeve)].reduce((current, asset) => installCustomAsset(current, asset, 'tshirt', fit, 'front', '#7da8dd'), {} as CustomAssetState);
  let latest = initial;
  function EditorFixture() {
    const [state, setState] = useState(initial);
    const [selected, select] = useState<string | null>('sleeveLeft');
    const [canvasSize, setCanvasSize] = useState(2048);
    latest = state;
    const change = (id: string, user?: AssetUserTransform) => setState(previous => ({ ...previous,
      customAssetInstances: setAssetUserTransform(previous, 'tshirt', fit, 'front', id, user, previous.customSleevesLinked !== false) }));
    return <div className="grid h-full grid-cols-1 grid-rows-[minmax(300px,1fr)_auto] md:grid-cols-[300px_minmax(0,1fr)] md:grid-rows-1">
      <aside className="order-2 overflow-auto bg-[#171719] p-4 md:order-1"><CustomAssetEditorPanel state={state} garmentType="tshirt" fit={fit} view="front"
        selectedId={selected} canvasSize={canvasSize} onSelect={select} onChange={change} onOptionsChange={options => setState(previous => ({ ...previous, ...options }))} /></aside>
      <div className="order-1 min-h-0 bg-[#eeeeec] md:order-2"><TshirtSvgPreview garmentType="tshirt" fit={fit} color="#7da8dd" detailView="front"
        selection={getDefaultGarmentSelection('tshirt', fit)} customAssetState={state} className="h-full w-full" selectedLayerId={selected} onSelectedLayerChange={select}
        onCustomAssetTransformChange={change} onCustomAssetCanvasSizeChange={setCanvasSize} onLayerTransformChange={() => {}} /></div>
    </div>;
  }
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#eee;overflow:auto';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  flushSync(() => previewRoot!.render(<EditorFixture />));
  return { getState: () => latest, verify: () => {
    check(JSON.stringify(latest.customAssets) === JSON.stringify(initial.customAssets), 'Editor changed registered geometry');
    return { immutableRegisteredAssets: true, instances: latest.customAssetInstances };
  } };
}

export function verifyAssetUserTransforms() {
  const fixture = componentFixture();
  const sleeve = acceptedDefinition({ ...fixture, category: 'sleeve', detailType: undefined, keepSvg: fixture.svg,
    registration: { version: 1, profile: 'SleeveRegistrationProfile', layerId: 'sleeveLeft', side: 'left', socket: 'test',
      defaultTransform: { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, rotation: 12, x: 8, scaleX: 1.2 } } });
  const [opposite] = deriveOppositeSleeve([sleeve]);
  const state = [sleeve, opposite].reduce((current, asset) => installCustomAsset(current, asset, 'tshirt', 'slim', 'front', '#597db0'), {} as CustomAssetState);
  const original = JSON.stringify(state.customAssets);
  const geometry = registeredAssetGeometry(sleeve)!;
  const anchorPosition = (transform: typeof DEFAULT_TSHIRT_LAYER_TRANSFORM) => {
    const horizontal = (geometry.anchor.x - geometry.center.x) * (transform.scaleX ?? transform.scale);
    const vertical = (geometry.anchor.y - geometry.center.y) * (transform.scaleY ?? transform.scale);
    const radians = transform.rotation * Math.PI / 180;
    return { x: transform.x + horizontal * Math.cos(radians) - vertical * Math.sin(radians),
      y: transform.y + horizontal * Math.sin(radians) + vertical * Math.cos(radians) };
  };
  const before = anchorPosition(sleeve.registration.defaultTransform);
  for (const change of [{ scaleX: 1.8 }, { scaleY: 2 }, { scale: 1.5, scaleX: 1.5, scaleY: 1.5 }, { rotation: 45 }, { mirror: true }]) {
    const after = anchorPosition(assetUserPlacement(sleeve, { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, ...change }));
    check(Math.hypot(after.x - before.x, after.y - before.y) < 1e-8, 'Attachment moved during a physical edit');
  }
  const user = { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, x: 31, y: 22, rotation: 18, scaleX: 1.4 };
  const edited = { ...state, customAssetInstances: setAssetUserTransform(state, 'tshirt', 'slim', 'front', 'sleeveLeft', user) };
  const atFullSize = customAssetTransforms(edited, 'tshirt', 'slim', 'front').sleeveLeft!;
  const atHalfSize = customAssetTransforms(edited, 'tshirt', 'slim', 'front', undefined, 1024).sleeveLeft!;
  check(Math.abs((atHalfSize.x - 8) * 2 - (atFullSize.x - 8)) < 1e-8, 'Physical edits depend on preview size');
  const legacyUpdated = { ...edited, customAssetInstances: updateCustomAssetTransform(edited, 'tshirt', 'slim', 'front', 'sleeveLeft', atHalfSize) };
  const legacyPlacement = customAssetTransforms(legacyUpdated, 'tshirt', 'slim', 'front', undefined, 1024).sleeveLeft!;
  check(Object.keys(atHalfSize).every(key => Math.abs(legacyPlacement[key as keyof typeof legacyPlacement]! - atHalfSize[key as keyof typeof atHalfSize]!) < 1e-8), 'Legacy updater misread a versioned transform');
  check(edited.customAssetInstances!['front:sleeveRight'].userTransform.x === -31, 'Linked movement is not symmetric');
  check(edited.customAssetInstances!['front:sleeveRight'].userTransform.rotation === -18, 'Linked rotation is not symmetric');
  const unlinked = setAssetUserTransform(edited, 'tshirt', 'slim', 'front', 'sleeveLeft', { ...user, x: 55 }, false)!;
  check(unlinked['front:sleeveRight'] === edited.customAssetInstances!['front:sleeveRight'], 'Unlinked editing changed the opposite sleeve');
  const restored = setAssetUserTransform(edited, 'tshirt', 'slim', 'front', 'sleeveLeft')!;
  check(JSON.stringify(assetUserPlacement(sleeve, restored['front:sleeveLeft'].userTransform)) === JSON.stringify(sleeve.registration.defaultTransform), 'Reset changed registered placement');
  check(JSON.stringify(edited.customAssets) === original, 'Physical edits changed registered SVG or metadata');
  check(JSON.parse(JSON.stringify(edited)).customAssetInstances['front:sleeveLeft'].userTransformVersion === 2, 'Transform version did not persist');
  return { anchoredResize: true, anchoredRotation: true, mirror: true, linked: true, unlinked: true, reset: true, immutableRegistration: true, persistence: true };
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const fixtures = new Map<string, CustomAssetDefinition>();
export async function verifySleeveAdaptationState(input?: CustomAssetDefinition) {
  const base = componentFixture();
  const sleeve = acceptedDefinition(input ?? { ...base, category: 'sleeve', detailType: undefined, name: 'Adapted sleeve', keepSvg: base.svg,
    registration: { version: 1, profile: 'SleeveRegistrationProfile', layerId: 'sleeveLeft', side: 'left', socket: 'test',
      defaultTransform: DEFAULT_TSHIRT_LAYER_TRANSFORM, status: 'Needs review', adaptation: { capFraction: .2, scaleReduction: .425, minimumScaleReduction: .4, uniformScale: 1.3, rotation: 75, bodyArmholeAdjusted: false, rigidPixels: 10000 } } });
  const [opposite] = deriveOppositeSleeve([sleeve]);
  check(opposite.registration.status === sleeve.registration.status && opposite.provenance === 'derived', 'Mirrored status or provenance lost');
  check(opposite.id !== sleeve.id && opposite.registration.side === 'right', 'Opposite identity or orientation lost');
  const left = getPotraceSvgBBox(sleeve.svg)!;
  const right = getPotraceSvgBBox(opposite.svg)!;
  check(Math.abs(right.minX - (2048 - left.maxX)) < .01 && Math.abs(right.maxY - left.maxY) < .01, 'Mirrored bounds incorrect');
  const pixels = async (svg: string) => {
    const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 512, 512);
    return context.getImageData(0, 0, 512, 512).data;
  };
  const original = await pixels(sleeve.svg), mirrored = await pixels(opposite.svg);
  let mismatch = 0, filled = 0;
  for (let row = 0; row < 512; row++) for (let column = 0; column < 512; column++) {
    const alpha = original[(row * 512 + column) * 4 + 3];
    filled += alpha > 128 ? 1 : 0;
    mismatch += Math.abs(alpha - mirrored[(row * 512 + 511 - column) * 4 + 3]) > 40 ? 1 : 0;
  }
  check(filled > 50 && mismatch < filled * .02, 'Rendered mirror is blank or geometrically different');
  const fit = sleeve.compatibility.fits[0];
  let state: CustomAssetState = [sleeve, opposite].reduce((current, asset) => installCustomAsset(current, asset, 'tshirt', fit, 'front', '#597db0'), {});
  state = { ...state, customAssetInstances: updateCustomAssetTransform(state, 'tshirt', fit, 'front', 'sleeveLeft', { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, x: 42, rotation: 15, scaleX: 1.1 }) };
  check(customAssetTransforms(state, 'tshirt', fit, 'front').sleeveRight!.x === 0, 'Editing changed the other sleeve');
  state = { ...state, customAssetInstances: updateCustomAssetTransform(state, 'tshirt', fit, 'front', 'sleeveLeft') };
  check(JSON.stringify(customAssetTransforms(state, 'tshirt', fit, 'front').sleeveLeft) === JSON.stringify(sleeve.registration.defaultTransform), 'Reset did not restore registered position');
  const persisted = acceptedDefinition(JSON.parse(JSON.stringify(sleeve)));
  check(JSON.stringify(persisted.registration) === JSON.stringify(sleeve.registration), 'Registered default did not survive persistence');
  return { mirroredPixels: filled, bothSleeves: true, independentTransforms: true, reset: true, persistedStatus: true };
}

function componentFixture(): CustomAssetDefinition {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g transform="translate(0,1000) scale(1,-1)" fill="#000000"><path d="M100 300H350V700H100Z"/></g><g transform="translate(0,1000) scale(1,-1)" fill="#141414"><path d="M100 300H350V304H100Z"/></g></svg>';
  return { version: 1, id: 'parent', category: 'pocket', detailType: 'pocket', name: 'Pocket', svg,
    source: 'photo', provenance: 'front', analysis: { category: 'pocket', name: 'Pocket', construction: 'seams', provider: 'astra' },
    compatibility: { garmentTypes: ['tshirt'], fits: ['slim'], views: ['front'] },
    registration: { version: 1, profile: 'PocketPlacementProfile', layerId: 'pocket', socket: 'free-placement-v1', defaultTransform: { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, x: .7, y: .4 }, width: .2, ratio: 1 },
    validation: { version: 1, status: 'passed', checks: ['boundary', 'trace', 'registration'] }, colorBindings: { fabric: '#000000', ink: '#141414' } };
}

export function mountComponentUploadTest() {
  const primary = componentFixture();
  const additional = { ...primary, id: 'zip', name: 'Pocket zip', detailType: 'zip' as const,
    registration: { ...primary.registration, relativePlacement: { parentId: primary.id, x: .5, y: .2, width: .8 } } };
  const host = document.createElement('div');
  host.id = 'component-upload-test';
  host.style.cssText = 'position:fixed;inset:0;z-index:1;background:#171719;color:white;padding:24px;overflow:auto';
  document.body.append(host);
  const root = createRoot(host);
  flushSync(() => root.render(createElement(CustomAssetUpload, { category: 'pocket', garmentType: 'tshirt', fit: 'slim', view: 'front', assets: [], selectedIds: [],
    onAccept: (asset, extra = []) => { host.dataset.accepted = JSON.stringify([asset, ...extra].map(item => ({ id: item.id, type: item.detailType }))); },
    onRemove: () => {}, onRename: () => {}, renderPreview: (asset, extra = []) => createElement('div', { 'aria-label': 'Component preview', className: 'flex gap-2' },
      [asset, ...extra].map(item => createElement('img', { key: item.id, alt: item.name, src: `data:image/svg+xml,${encodeURIComponent(item.svg)}`, width: 120, height: 120 }))) })));
  return { ...primary, additionalAssets: [additional], cleanDrawing: referenceFixture('pocket') };
}

export function verifyComponentBundles() {
  const base = componentFixture();
  const svg = base.svg;
  const child = (id: string, type: 'button' | 'zip', parentId = 'parent'): CustomAssetDefinition => ({ ...base, id, name: type, detailType: type,
    registration: { ...base.registration, ratio: type === 'button' ? 1 : .2, relativePlacement: { parentId, x: .25, y: .5, width: .15 } } });
  const bounds = { minX: 400, minY: 200, maxX: 1600, maxY: 1800 };
  const initial = { garmentDetails: [] as GarmentDetail[] };
  const bundle = acceptedAssetBundle({ ...base, additionalAssets: [child('zip', 'zip')] });
  const state = bundle.reduce((next, asset) => installCustomAsset(next, asset, 'tshirt', 'slim', 'front', '#D45873', bounds), initial);
  check(state.garmentDetails.map(detail => detail.type).join(',') === 'pocket,zip', 'Composite did not create separate detail types');
  const recolored = state.garmentDetails.map(detail => detail.type === 'zip' ? { ...detail, fill: '#336699' } : detail);
  check(detailSvg(recolored[1]).includes('#336699') && detailSvg(recolored[0]).toLowerCase().includes('#d45873'), 'Component colours are not independent');
  check(recolored[0] === state.garmentDetails[0], 'Recolouring changed the parent');
  check(detailPlacement(recolored[1], bounds).left > detailPlacement(recolored[0], bounds).left, 'Zip lost parent placement');
  const sleeve: CustomAssetDefinition = { ...base, category: 'sleeve', detailType: undefined, name: 'Sleeve', keepSvg: svg,
    registration: { version: 1, profile: 'SleeveRegistrationProfile', layerId: 'sleeveLeft', side: 'left', socket: 'test', defaultTransform: DEFAULT_TSHIRT_LAYER_TRANSFORM } };
  const sleeves = acceptedAssetBundle({ ...sleeve, additionalAssets: [child('button-1', 'button'), { ...child('button-2', 'button'), registration: { ...child('button-2', 'button').registration, relativePlacement: { parentId: 'parent', x: .25, y: .75, width: .15 } } }] });
  const sleeveState = sleeves.reduce((next, asset) => installCustomAsset(next, asset, 'tshirt', 'slim', 'front', '#D45873', bounds), initial);
  const button = sleeveState.garmentDetails[0];
  const placement = detailPlacement(button, bounds);
  check(placement.left < bounds.minX && button.placementArea === 'canvas', 'Sleeve button was clamped onto the torso');
  check(sleeveState.garmentDetails[1].y !== button.y, 'Buttons overlap at the default position');
  const moved = setDetailTransform(button, bounds, { x: button.x + .01 });
  check(moved.x > button.x && detailPlacement(moved, bounds).left < bounds.minX, 'Sleeve button cannot move independently');
  check(resizeGarmentDetail(button, bounds, 1, 1, 5, 5).scaleX! > 1, 'Sleeve button cannot resize');
  for (const invalid of [{ ...base, additionalAssets: [child('parent', 'zip')] }, { ...base, additionalAssets: [child('zip', 'zip', 'wrong-parent')] }]) {
    let rejected = false;
    try { acceptedAssetBundle(invalid); } catch { rejected = true; }
    check(rejected, 'Malformed bundle accepted');
  }
  const restored = JSON.parse(JSON.stringify(sleeveState));
  check(acceptedDefinition(restored.garmentDetails[0].customAsset).detailType === 'button' && restored.garmentDetails[0].placementArea === 'canvas', 'Component state cannot round-trip');
  const host = document.createElement('div');
  const root = createRoot(host);
  let selected: string | null = null;
  try {
    flushSync(() => root.render(createElement(GarmentDetailsPanel, { details: [...recolored, ...sleeveState.garmentDetails], selectedId: null,
      onSelect: id => { selected = id; }, onChange: () => {}, color: '#D45873', bounds })));
    check(host.querySelector('[aria-label="Added pockets"]')?.textContent?.includes('Pocket'), 'Pocket section missing');
    check(host.querySelector('[aria-label="Added zips"]')?.textContent?.includes('zip'), 'Zip section missing');
    const buttonSection = host.querySelector('[aria-label="Added buttons"]');
    check(buttonSection?.querySelectorAll('button[aria-pressed]').length === 2, 'Buttons not listed separately');
    flushSync(() => buttonSection!.querySelector<HTMLButtonElement>('button[aria-pressed]')!.click());
    check(selected === button.id, 'Button section did not select its own asset');
  } finally { flushSync(() => root.unmount()); }
  const measurements = detailMeasurements(recolored, 'front', bounds, [], 50);
  check(measurements[1].kind === 'Custom zip', 'Zip measurement mislabeled as pocket');
  return { separatePocketAndZip: true, separateSleeveButtons: true, independentColours: true, sleevePlacement: true, movement: true, resizing: true, invalidBundlesRejected: true, editorSections: true, persistence: true };
}

export function verifyCustomPatch() {
  const fixture = componentFixture();
  const asset = acceptedDefinition({ ...fixture, detailType: 'patch', name: 'Uploaded patch', analysis: { ...fixture.analysis, category: 'patch' } });
  const state = installCustomAsset({ garmentDetails: [] as GarmentDetail[] }, asset, 'tshirt', 'slim', 'front', '#336699');
  const detail = state.garmentDetails[0];
  check(detail.type === 'patch', 'Upload installed as the wrong detail type');
  const svg = detailSvg(detail);
  check(svg.includes('M100 300H350V700H100Z') && svg.includes('#336699'), 'Uploaded patch artwork or colour was replaced');
  check(detailSvg({ ...detail, fill: '#996633' }).includes('#996633'), 'Uploaded patch cannot be recoloured');
  check(acceptedDefinition(JSON.parse(JSON.stringify(detail.customAsset))).detailType === 'patch', 'Uploaded patch cannot round-trip');
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(GarmentDetailsPanel, { details: [detail], selectedId: detail.id, onSelect: () => {}, onChange: () => {}, color: '#336699' })));
    check(host.querySelector('[aria-label="Added patches"]')?.textContent?.includes('Uploaded patch'), 'Uploaded patch missing from Patches');
    check(host.querySelector('[aria-label="Detail colours"]'), 'Uploaded patch colour controls missing');
    check(!host.querySelector('[aria-label="Patch construction"]'), 'Procedural patch controls shown for traced artwork');
  } finally { flushSync(() => root.unmount()); }
  return { patchType: true, originalArtwork: true, editableColour: true, patchSection: true, persistence: true };
}

export function referenceFixture(category: CustomAssetCategory) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'white'; context.fillRect(0, 0, 1024, 1024);
  context.strokeStyle = 'black'; context.lineWidth = category === 'collar' ? 2 : 6;
  if (category === 'collar') {
    for (const [centerX, centerY, radiusX, radiusY] of [[512, 500, 332, 200], [512, 495, 302, 165]]) {
      context.beginPath(); context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2); context.stroke();
    }
  } else if (category === 'pocket') context.strokeRect(200, 200, 500, 600);
  else {
    context.beginPath(); context.moveTo(760, 200); context.lineTo(760, 780); context.lineTo(560, 660); context.lineTo(560, 520); context.closePath(); context.stroke();
  }
  return canvas.toDataURL('image/png');
}

export async function processFixture(category: CustomAssetCategory, fit = 'slim', side = 'left', garmentType = category === 'collar' ? 'tshirtTest' : 'tshirt', image = referenceFixture(category)) {
  const response = await fetch('/api/custom-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    image: image.split(',')[1], category, contextCategory: category, fit, side, source: 'drawing', view: 'front', crop: [0, 0, 1, 1], garmentType,
  }) });
  const messages = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
  const error = messages.find(message => message.type === 'error');
  check(!error, error?.error);
  const result = messages.find(message => message.type === 'result')?.asset;
  check(response.ok && result, `${category}: missing completed asset`);
  check(result.cleanDrawing.startsWith('data:image/png;base64,'), 'Invalid drawing preview');
  const asset = acceptedDefinition(result);
  fixtures.set(`${category}:${fit}:${side}`, asset);
  return { category, fit, side, svgBytes: asset.svg.length, stages: messages.filter(message => message.type === 'progress').map(message => message.step) };
}

export async function verifyCustomAssetState() {
  const original: CustomAssetState & { garmentDetails: GarmentDetail[]; prints: [] } = { garmentDetails: [], prints: [] };
  const before = JSON.stringify(original);
  for (const category of ['collar', 'sleeve', 'pocket'] as const) {
    const asset = fixtures.get(`${category}:slim:left`);
    check(asset, `Run ${category} fixture first`);
    const garment = asset.compatibility.garmentTypes[0];
    let state = installCustomAsset(original, asset, garment, 'slim', 'front', '#D45873');
    check(JSON.stringify(original) === before, 'Installation mutated the original state');
    check(!('cleanDrawing' in state.customAssets![0]), 'Preview persisted');
    if (category === 'pocket') {
      state = installCustomAsset(state, asset, garment, 'slim', 'front', '#D45873');
      check(state.garmentDetails.length === 2 && state.garmentDetails[0].id !== state.garmentDetails[1].id, 'Pocket duplicate identity lost');
      const bounds = { minX: 400, maxX: 1600, minY: 200, maxY: 1800 };
      const rows = detailMeasurements(state.garmentDetails, 'front', bounds, [], 50);
      for (const [field, value] of [['width', 8], ['height', 12], ['rotation', 25], ['left', 28]] as const) {
        const edit = editAssetDimension(state, rows[0], field, value);
        check(!edit.error && edit.changes?.garmentDetails, `Pocket ${field}: ${edit.error}`);
        check(edit.changes.garmentDetails[1] === state.garmentDetails[1], 'Measurement changed another pocket');
      }
      check(detailSvg(state.garmentDetails[0]).toLowerCase().includes('#d45873'), 'Custom pocket fabric does not tint');
      const copied = copyDetailToOpposite(state.garmentDetails, state.garmentDetails[0], 'front');
      check(copied.some(detail => detail.view === 'back' && detail.customAsset?.provenance === 'derived'), 'Cross-view copy is not derived');
    } else {
      const layer = asset.registration.layerId;
      const moved = { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, x: 55, scaleX: 1.2, rotation: 12 };
      state = { ...state, customAssetInstances: updateCustomAssetTransform(state, garment, 'slim', 'front', layer, moved) };
      check(customAssetTransforms(state, garment, 'slim', 'front')[layer]?.x === 55, 'User transform lost');
      const replaced = installCustomAsset(state, { ...asset, id: `${asset.id}-replacement` }, garment, 'slim', 'front', '#D45873');
      check(customAssetTransforms(replaced, garment, 'slim', 'front', { [layer]: moved })[layer]?.x === 0, 'Replacement inherited stale offset');
      if (category === 'collar') check(customAssetTransforms(replaced, garment, 'slim', 'front', { base: moved }).base?.x === 0, 'Paired collar body inherited stale offset');
      state = { ...state, customAssetInstances: updateCustomAssetTransform(state, garment, 'slim', 'front', layer) };
      check(customAssetTransforms(state, garment, 'slim', 'front')[layer]?.rotation === 0, 'Reset lost registration');
      check(activeCustomAssets(state, garment, 'slim', 'back').length === 0, 'Front structural asset leaked onto back');
      const layers = resolveGarmentLayers({ garmentType: garment, fit: 'slim', view: 'front', color: '#D45873', selection: getDefaultGarmentSelection(garment, 'slim'), customAssetState: state });
      check(layers.some(item => item.id === layer && item.assetId === asset.id), 'Structural override missing');
      if (category === 'collar') check(layers.some(item => item.id === 'base' && item.svgRaw.includes('data-collar-body-patch')), 'Matching collar body missing');
      else check(!layers.some(item => item.id === 'sleeveHemLeft'), 'Old cuff remains');
      if (category === 'collar' && garment === 'tshirt') {
        check(layers.some(item => item.id === 'innerBackNeck' && item.assetId === asset.id && item.colorBinding === 'body'), 'Custom collar backing missing');
        check(layers.filter(item => ['outline', 'stitching'].includes(item.id)).every(item => item.svgRaw.includes('custom-collar-')), 'Original neckline artwork is not masked');
      }
    }
    const id = `test-custom-${crypto.randomUUID()}`;
    try {
      await saveLocalProject({ id, name: category, product_id: 'ts-001', current_step: 6, state });
      check(JSON.stringify((await getLocalProject(id))?.state) === JSON.stringify(state), 'Saved asset changed on reload');
    } finally {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('ceriga-local-projects', 1);
        request.onsuccess = () => { const database = request.result; const transaction = database.transaction('projects', 'readwrite'); transaction.objectStore('projects').delete(id); transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onerror = () => { database.close(); reject(transaction.error); }; };
        request.onerror = () => reject(request.error);
      });
    }
  }
  return { categories: 3, independentPockets: true, measurementEdits: 4, replacement: true, reset: true, frontBackIsolation: true, persistence: true };
}

let previewRoot: Root | undefined;
let previewHost: HTMLDivElement | undefined;

export async function verifyCustomCollarComposite(mockNeck = false, registered?: Pick<CustomAssetDefinition, 'svg' | 'bodySvg' | 'registration' | 'compatibility'>) {
  const asset: CustomAssetDefinition | undefined = registered
    ? { ...componentFixture(), ...registered, id: 'collar-composite-test', category: 'collar', detailType: undefined }
    : fixtures.get('collar:slim:left');
  check(asset, 'Process collar fixture first');
  const selection = getDefaultGarmentSelection('tshirt', 'slim');
  selection.Neck = getGarmentAssetsForFit('tshirt', 'Neck', 'slim').find(asset => asset.displayName.startsWith('Scoop neck'))!.id;
  const state = installCustomAsset({}, asset, 'tshirt', 'slim', 'front', '#597db0');
  const input = { garmentType: 'tshirt' as const, fit: 'slim', view: 'front' as const, selection, color: '#597db0', neckTrimColor: '#cc2d24' };
  const original = resolveGarmentLayers(input);
  const layers = resolveGarmentLayers({ ...input, customAssetState: state });
  const backing = layers.find(layer => layer.id === 'innerBackNeck');
  check(backing?.colorBinding === 'body', 'Backing is not bound to body fabric');
  check(backing.zIndex < layers.find(layer => layer.id === 'neck')!.zIndex, 'Rear fabric overlays collar ink');
  check(layers.find(layer => layer.id === 'bodyHem')?.svgRaw === original.find(layer => layer.id === 'bodyHem')?.svgRaw, 'Collar replaced the selected bottom hem');
  const bodyTransform = { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, y: 12, scaleY: 1.1 };
  check(JSON.stringify(customAssetTransforms(state, 'tshirt', 'slim', 'front', { base: bodyTransform }).base) === JSON.stringify(bodyTransform), 'Collar moved the body away from its hem');
  check(layers.find(layer => layer.id === 'neck')?.svgRaw === asset.svg, 'Custom collar drawing changed');
  const pixels = async (svg: string, size = 2048) => {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, size, size);
    return context.getImageData(0, 0, size, size).data;
  };
  const bounds = getPotraceSvgBBox(asset.svg)!;
  for (const size of [253, 341, 729, 1200]) {
    const before = await pixels(renderFabricSvg(original.find(layer => layer.id === 'base')!.svgRaw, '#597db0'), size);
    const after = await pixels(renderFabricSvg(layers.find(layer => layer.id === 'base')!.svgRaw, '#597db0'), size);
    for (let offset = 0; offset < before.length; offset += 4) {
      if (before[offset + 3] !== 255) continue;
      check(after[offset + 3] === 255, `Neck patch has a transparent seam at preview size ${size}`);
      check(after[offset] === before[offset] && after[offset + 1] === before[offset + 1] && after[offset + 2] === before[offset + 2],
        `Neck patch adds a coloured outline at preview size ${size}`);
    }
  }
  for (const layerId of ['base', 'outline', 'stitching']) {
    const before = await pixels(original.find(layer => layer.id === layerId)!.svgRaw);
    const after = await pixels(layers.find(layer => layer.id === layerId)!.svgRaw);
    for (let offset = 1500 * 2048 * 4; offset < before.length; offset++) {
      check(before[offset] === after[offset], `Collar changed bottom hem pixels in ${layerId}`);
    }
  }
  const fabric = await pixels(renderFabricSvg(backing.svgRaw, '#6d8db9'));
  const center = (Math.round(bounds.centerY) * 2048 + Math.round(bounds.centerX)) * 4;
  check(fabric[center] === 109 && fabric[center + 1] === 141 && fabric[center + 2] === 185 && fabric[center + 3] === 255, 'Opening is not filled with lighter rear fabric');
  if (collarEditGeometry(asset.svg)) {
    const rawBody = layers.find(layer => layer.id === 'base')!.svgRaw;
    const bodyDocument = new DOMParser().parseFromString(rawBody, 'image/svg+xml');
    const patch = bodyDocument.querySelector('[data-collar-body-patch]');
    check(patch && !patch.querySelector('[fill="#141414"]'), 'Generated body duplicates construction ink');
    const bodyBefore = await pixels(original.find(layer => layer.id === 'base')!.svgRaw);
    const bodyAfter = await pixels(rawBody);
    const patchId = patch.getAttribute('clip-path')!.slice(5, -1);
    const patchShape = new Path2D(bodyDocument.getElementById(patchId)!.querySelector('path')!.getAttribute('d')!);
    const context = document.createElement('canvas').getContext('2d')!;
    for (let row = 0; row < 2048; row++) for (let column = 0; column < 2048; column++) {
      if (context.isPointInPath(patchShape, column + .5, row + .5)) continue;
      const alpha = (row * 2048 + column) * 4 + 3;
      check(Math.abs(bodyBefore[alpha] - bodyAfter[alpha]) <= 1, 'Custom neck changed body outside its patch');
    }
    const collarPixels = await pixels(asset.svg);
    let openingPixels = 0;
    for (let row = Math.ceil(bounds.minY); row < bounds.maxY; row++) for (let column = Math.ceil(bounds.minX); column < bounds.maxX; column++) {
      const offset = (row * 2048 + column) * 4;
      if (collarPixels[offset + 3] || fabric[offset + 3] !== 255) continue;
      openingPixels++;
      check(fabric[offset] === 109 && fabric[offset + 1] === 141 && fabric[offset + 2] === 185, 'Opening contains dark body colour');
    }
    check(openingPixels > 100, 'Rear backing does not fill the opening');
  }
  if (mockNeck) {
    const collarPixels = await pixels(renderFabricSvg(asset.svg, '#cc2d24'));
    const sample = (fraction: number) => (Math.round(bounds.minY + (bounds.maxY - bounds.minY) * fraction) * 2048 + Math.round(bounds.centerX)) * 4;
    const opening = sample(.12);
    const panel = sample(.46);
    check(collarPixels[opening + 3] === 0, 'Head opening incorrectly contains collar fabric');
    check(fabric[opening] === 109 && fabric[opening + 1] === 141 && fabric[opening + 2] === 185 && fabric[opening + 3] === 255, 'Upper opening lacks lighter rear backing');
    check(collarPixels[panel] === 204 && collarPixels[panel + 1] === 45 && collarPixels[panel + 2] === 36 && collarPixels[panel + 3] === 255, 'Upright panel does not take the red collar colour');
    const outline = layers.find(layer => layer.id === 'outline')!;
    const joins = new DOMParser().parseFromString(outline.svgRaw, 'image/svg+xml').querySelectorAll('[data-custom-shoulder-join]');
    check(joins.length === 2, 'Both shoulder joins must reach the uploaded collar');
    const geometry = await measureStitchGeometry(layers, 'slim');
    check(geometry.rows.neckline.length === 0 && geometry.rows.shoulder.length === 2, 'Preset neckline stitches remain beside the mock collar');
    const stitchPixels = await pixels(renderStitchStyles(layers.find(layer => layer.id === 'stitching')!, geometry, {}));
    const bodyPixels = await pixels(renderFabricSvg(layers.find(layer => layer.id === 'base')!.svgRaw, '#597db0'));
    const presetBounds = getPotraceSvgBBox(original.find(layer => layer.id === 'neck')!.svgRaw)!;
    for (let row = Math.ceil(bounds.maxY + 8); row < presetBounds.maxY; row++) {
      for (let column = Math.ceil(presetBounds.minX); column < presetBounds.maxX; column++) {
        check(stitchPixels[(row * 2048 + column) * 4 + 3] === 0, 'Rendered Scoop stitches remain below the custom collar');
        check(bodyPixels[(row * 2048 + column) * 4 + 3] === 255, 'Old neckline perforations remain in the body fabric');
      }
    }
  }
  const ring = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#000000"><path d="M10 10h80v80h-80z m20 20v40h40v-40z"/></g><g fill="#141414"><path d="M0 0h1v1z"/></g></svg>';
  const silhouette = new DOMParser().parseFromString(filledFabricSilhouette(ring), 'image/svg+xml');
  check(silhouette.querySelectorAll('g').length === 1 && silhouette.querySelectorAll('path')[1].getAttribute('d')?.startsWith('M30 30'), 'Relative closed contour was displaced');
  const oldNeck = getPotraceSvgBBox(original.find(layer => layer.id === 'neck')!.svgRaw)!;
  const left = Math.min(oldNeck.minX, bounds.minX);
  const right = Math.max(oldNeck.maxX, bounds.maxX);
  const before = await pixels(original.find(layer => layer.id === 'outline')!.svgRaw);
  const after = await pixels(layers.find(layer => layer.id === 'outline')!.svgRaw);
  let shoulderPixels = 0;
  for (let row = 0; row < Math.ceil(Math.max(oldNeck.maxY, bounds.maxY)); row++) {
    for (const start of [Math.floor(left) - 7, Math.ceil(right) + 1]) {
      for (let column = start; column < start + 6; column++) {
        const offset = (row * 2048 + column) * 4 + 3;
        if (before[offset] > 200) { shoulderPixels++; check(after[offset] > 200, 'Shoulder end clipped by collar mask'); }
      }
    }
  }
  check(shoulderPixels > 0, 'Shoulder sample missed the outline');
  const moved = { ...state, customAssetInstances: updateCustomAssetTransform(state, 'tshirt', 'slim', 'front', 'neck', { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, x: 12 }) };
  check(customAssetTransforms(moved, 'tshirt', 'slim', 'front').innerBackNeck?.x === 12, 'Backing does not follow collar transform');
  return { bodyFabricFill: true, collarUnchanged: true, relativeContours: true, shoulderPixels, backingTransform: true };
}

export function mockNeckReferenceFixture() {
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 320;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'white'; context.fillRect(0, 0, 400, 400);
  context.strokeStyle = 'black'; context.lineWidth = 2;
  for (const points of [
    [[120, 50], [160, 54], [240, 54], [275, 50], [270, 60], [250, 72], [238, 87], [217, 98], [190, 99], [173, 94], [158, 83], [150, 68], [120, 50]],
    [[120, 50], [108, 113], [85, 155], [110, 178], [150, 198], [200, 210], [250, 198], [290, 178], [315, 155], [291, 113], [275, 50]],
    [[40, 190], [85, 155]], [[315, 155], [360, 190]], [[165, 202], [200, 265], [235, 202]],
  ]) {
    context.beginPath(); context.moveTo(points[0][0], points[0][1]);
    for (const [left, top] of points.slice(1)) context.lineTo(left, top);
    context.stroke();
  }
  return canvas.toDataURL('image/png');
}

export function verifyCustomAssetOption(asset: CustomAssetDefinition) {
  const host = document.createElement('div');
  const root = createRoot(host);
  let acceptedId = '';
  const render = (view: 'front' | 'back') => flushSync(() => root.render(createElement(CustomAssetUpload, {
    category: asset.category, garmentType: 'tshirt', fit: 'slim', view, assets: [asset], selectedIds: [asset.id],
    onAccept: selected => { acceptedId = selected.id; }, onRemove: () => {}, onRename: () => {}, renderPreview: () => null,
  })));
  try {
    render('front');
    const option = host.querySelector<HTMLButtonElement>('button[aria-pressed]');
    check(option && !option.disabled && option.getAttribute('aria-pressed') === 'true', 'Custom option selected state missing');
    option.querySelector('img')!.click();
    check(acceptedId === asset.id, 'Thumbnail does not select the custom asset');
    render('back');
    check(host.querySelector<HTMLButtonElement>('button[aria-pressed]')?.disabled, 'Incompatible option is selectable');
    return { thumbnailSelection: true, selectedState: true, incompatibleDisabled: true };
  } finally { flushSync(() => root.unmount()); }
}

export function layeredVReferenceFixture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'white'; context.fillRect(0, 0, 1024, 1024);
  context.scale(2.56, 2.56); context.strokeStyle = 'black'; context.lineWidth = 2;
  const lines = [
    [[50, 75], [95, 50], [150, 80], [250, 80], [305, 50], [350, 75]],
    [[50, 75], [80, 210], [200, 350], [320, 210], [350, 75]],
    [[95, 50], [105, 120], [135, 215], [200, 295], [265, 215], [295, 120], [305, 50]],
    [[105, 120], [160, 135], [240, 135], [295, 120]],
    [[200, 295], [200, 350]], [[175, 102], [185, 103]],
  ];
  for (const line of lines) {
    context.beginPath(); context.moveTo(line[0][0], line[0][1]);
    for (const [left, top] of line.slice(1)) context.lineTo(left, top);
    context.stroke();
  }
  return canvas.toDataURL('image/png');
}

export function verifyRegisteredSleevePairs(inputs: (CustomAssetDefinition & { oppositeSleeve: CustomAssetDefinition })[]) {
  return inputs.map(input => {
    const sleeve = acceptedDefinition(input);
    const [opposite] = deriveOppositeSleeve([sleeve], input.oppositeSleeve);
    check(opposite.svg === input.oppositeSleeve.svg && opposite.keepSvg === input.oppositeSleeve.keepSvg, 'Registered right geometry was replaced by a screen-space mirror');
    const fit = sleeve.compatibility.fits[0];
    let state: CustomAssetState = [sleeve, opposite].reduce((current, asset) => installCustomAsset(current, asset, 'tshirt', fit, 'front', '#7da8dd'), {});
    const initial = JSON.stringify(state);
    for (const asset of [sleeve, opposite]) {
      const layerId = asset.registration.layerId;
      check(JSON.stringify(customAssetTransforms(state, 'tshirt', fit, 'front')[layerId]) === JSON.stringify(asset.registration.defaultTransform), 'Acceptance requires a user offset');
      const otherId = asset === sleeve ? opposite.registration.layerId : sleeve.registration.layerId;
      const otherBefore = JSON.stringify(customAssetTransforms(state, 'tshirt', fit, 'front')[otherId]);
      const moved = { ...asset.registration.defaultTransform, x: 42, y: 18, scaleX: 1.2, scaleY: .8, rotation: 15 };
      state = { ...state, customAssetInstances: updateCustomAssetTransform(state, 'tshirt', fit, 'front', layerId, moved) };
      check(JSON.stringify(customAssetTransforms(state, 'tshirt', fit, 'front')[layerId]) === JSON.stringify(moved), 'Move/resize/rotate was lost');
      check(JSON.stringify(customAssetTransforms(state, 'tshirt', fit, 'front')[otherId]) === otherBefore, 'Editing one side moved the other');
      state = JSON.parse(JSON.stringify(state));
      check(JSON.stringify(customAssetTransforms(state, 'tshirt', fit, 'front')[layerId]) === JSON.stringify(moved), 'Edited placement did not survive persistence');
      state = { ...state, customAssetInstances: updateCustomAssetTransform(state, 'tshirt', fit, 'front', layerId) };
      check(JSON.stringify(state) === initial, 'Reset changed the registered default or geometry');
    }
    for (const asset of state.customAssets!) check(JSON.stringify(acceptedDefinition(JSON.parse(JSON.stringify(asset)))) === JSON.stringify(asset), 'Registered asset failed validation after reload');
    let rejected = false;
    try { deriveOppositeSleeve([sleeve], sleeve); } catch { rejected = true; }
    check(rejected, 'Invalid opposite side was accepted');
    return { fit, registeredBoth: true, reset: true, persistence: true, independentEdits: true };
  });
}

export function mountRegisteredSleeveFits(inputs: (CustomAssetDefinition & { oppositeSleeve: CustomAssetDefinition })[]) {
  removeCustomPreview();
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#eee;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));overflow:auto';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  flushSync(() => previewRoot!.render(createElement('div', { style: { display: 'contents' } }, inputs.map(input => {
    const sleeve = acceptedDefinition(input);
    const fit = sleeve.compatibility.fits[0];
    const state = [sleeve, ...deriveOppositeSleeve([sleeve], input.oppositeSleeve)].reduce((current, asset) => installCustomAsset(current, asset, 'tshirt', fit, 'front', '#7da8dd'), {} as CustomAssetState);
    return createElement('section', { key: fit, 'aria-label': `${fit} registered sleeves`, style: { display: 'flex', flexDirection: 'column', minHeight: 0 } },
      createElement('h2', { style: { textAlign: 'center', color: '#111', fontSize: 16, margin: 4 } }, fit),
      createElement(TshirtSvgPreview, { garmentType: 'tshirt', fit, color: '#7da8dd', detailView: 'front', selection: getDefaultGarmentSelection('tshirt', fit), customAssetState: state, className: 'min-h-0 flex-1 w-full' }));
  }))));
}

export function mountSleeveNormalizationReview(input: CustomAssetDefinition & { oppositeSleeve: CustomAssetDefinition; cleanDrawing: string; sleeveIsolation: { rawIsolation: string; overlay?: string }; stageProvenance?: Record<string, string> }, original?: string, mode?: string) {
  removeCustomPreview();
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#eeeeec;color:#171719;overflow:auto;padding:24px';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  const sleeve = acceptedDefinition(input);
  const fit = sleeve.compatibility.fits[0];
  const state = [sleeve, ...deriveOppositeSleeve([sleeve], input.oppositeSleeve)].reduce((current, asset) => installCustomAsset(current, asset, 'tshirt', fit, 'front', '#7da8dd'), {} as CustomAssetState);
  const stages = [
    ...(original ? [{ title: 'Original', content: createElement('img', { src: original, alt: 'Original reference', style: { width: '100%', height: '100%', objectFit: 'contain' } }) }] : []),
    ...(input.sleeveIsolation.overlay ? [{ title: 'Detected Sleeve', content: createElement('img', { src: input.sleeveIsolation.overlay, alt: 'Detected sleeve area', style: { width: '100%', height: '100%', objectFit: 'contain' } }) }] : []),
    { title: 'Raw Isolation', content: createElement('img', { src: input.sleeveIsolation.rawIsolation, alt: 'Raw isolated sleeve', style: { width: '100%', height: '100%', objectFit: 'contain' } }) },
    { title: 'Normalized Asset', content: createElement('img', { src: input.cleanDrawing, alt: 'Normalized sleeve, armhole top and cuff bottom', style: { width: '100%', height: '100%', objectFit: 'contain' } }) },
    { title: 'Final Asset', content: createElement(TshirtSvgPreview, { garmentType: 'tshirt', fit, color: '#7da8dd', detailView: 'front', selection: getDefaultGarmentSelection('tshirt', fit), customAssetState: state, className: 'h-full w-full' }) },
  ];
  flushSync(() => previewRoot!.render(createElement('div', null,
    mode ? createElement('p', { style: { fontSize: 13, marginBottom: 20 } }, mode) : null,
    createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 16 } }, stages.map(stage =>
    createElement('section', { key: stage.title, 'aria-label': stage.title },
      createElement('h2', { style: { fontSize: 16, marginBottom: 12 } }, stage.title),
      createElement('div', { style: { height: 'min(50vh,430px)', minHeight: 240 } }, stage.content),
      stage.title === 'Final Asset' ? createElement('p', null, input.registration.status) : null))),
    input.stageProvenance ? createElement('dl', { style: { fontSize: 11, marginTop: 20, overflowWrap: 'anywhere' } }, Object.entries(input.stageProvenance).map(([key, value]) =>
      createElement('div', { key, style: { marginBottom: 6 } }, createElement('dt', null, key === 'tracedSvgId' ? 'tracedSvgId (after registration)' : key), createElement('dd', { style: { fontFamily: 'monospace' } }, value)))) : null)));
}

export function mountSleeveUploadFixture() {
  removeCustomPreview();
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:20;background:#171719;padding:24px';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  let accepted: CustomAssetState = {};
  let preview: CustomAssetState = {};
  const install = (asset: CustomAssetDefinition, additionalAssets: CustomAssetDefinition[] = []) =>
    [asset, ...additionalAssets].reduce((state, definition) => installCustomAsset(state, definition, 'tshirt', 'slim', 'front', '#7da8dd'), {} as CustomAssetState);
  flushSync(() => previewRoot!.render(createElement(CustomAssetUpload, {
    category: 'sleeve', garmentType: 'tshirt', fit: 'slim', view: 'front', assets: [], selectedIds: [],
    onAccept: (asset, additionalAssets) => { accepted = install(asset, additionalAssets); }, onRemove: () => {}, onRename: () => {},
    renderPreview: (asset, additionalAssets, canvasOverlay) => {
      preview = install(asset, additionalAssets);
      return createElement(TshirtSvgPreview, {
        canvasOverlay, garmentType: 'tshirt', fit: 'slim', color: '#7da8dd', detailView: 'front',
        selection: getDefaultGarmentSelection('tshirt', 'slim'), customAssetState: preview, className: 'h-full w-full',
      });
    },
  })));
  return () => ({ accepted: Object.keys(accepted.customAssetInstances ?? {}), preview: Object.keys(preview.customAssetInstances ?? {}) });
}

export function collarReviewFixture(status: 'Good Match' | 'Needs Review' | 'Rejected' = 'Good Match') {
  const base = componentFixture();
  const observations = { construction: 'High mock neck', texture: 'Smooth knit', opening: 'Soft folded opening', height: 'Tall collar', attachment: 'Curved neckline', seams: 'Single visible attachment seam' };
  const review = { status, confidence: 'high' as const, reference: observations, generated: { ...observations },
    differences: status === 'Good Match' ? [] : [{ feature: 'Inner collar texture', referenceEvidence: 'The inner back face is smooth.', drawingEvidence: 'Dense vertical lines cover the inner back face.',
      severity: status === 'Rejected' ? 'major' as const : 'moderate' as const, confidence: 'high' as const, basis: 'visible' as const }] };
  const asset = { ...base, category: 'collar' as const, detailType: undefined, name: 'Smooth mock neck', bodySvg: base.svg,
    registration: { version: 1 as const, profile: 'CollarRegistrationProfile', layerId: 'neck', socket: 'test', defaultTransform: DEFAULT_TSHIRT_LAYER_TRANSFORM },
    validation: { ...base.validation, checks: [...base.validation.checks, 'drawing-fidelity'] }, collarReview: review, cleanDrawing: referenceFixture('collar') };
  return { asset, review, sourceCrop: mockNeckReferenceFixture(), cleanDrawing: asset.cleanDrawing };
}

export function verifyCollarReviewState() {
  for (const status of ['Good Match', 'Needs Review'] as const) {
    const { asset } = collarReviewFixture(status);
    check(acceptedDefinition(JSON.parse(JSON.stringify(asset))).collarReview?.status === status, 'Collar review lost on reload');
  }
  const rejected = collarReviewFixture('Rejected').asset;
  for (const asset of [rejected, { ...rejected, collarReview: { ...rejected.collarReview, status: 'Good Match' as const } },
    { ...rejected, collarReview: { ...rejected.collarReview, reference: { ...rejected.collarReview.reference, texture: '' } } }]) {
    let blocked = false;
    try { acceptedDefinition(asset); } catch { blocked = true; }
    check(blocked, 'Rejected or malformed collar evidence accepted');
  }
  const legacy = { ...collarReviewFixture().asset, collarReview: undefined };
  check(!acceptedDefinition(legacy).collarReview, 'Legacy collars must remain loadable');
  return { roundTrip: true, rejectedBlocked: true, inconsistentStatusBlocked: true, malformedBlocked: true, legacyCompatible: true };
}

export function mountRegisteredCollarReview(input: Pick<CustomAssetDefinition, 'svg' | 'bodySvg' | 'registration' | 'compatibility'> & {
  cleanDrawing: string;
  attachmentOverlay: string;
  collarTopology: { previews: Record<string, string> };
}) {
  removeCustomPreview();
  const asset: CustomAssetDefinition = { ...componentFixture(), ...input,
    id: 'approved-standing-collar-preview', category: 'collar', detailType: undefined,
    name: 'Approved standing collar', analysis: { category: 'collar', name: 'Standing collar', construction: 'Approved drawing', provider: 'technical' },
  };
  const state = installCustomAsset({}, asset, 'tshirt', 'slim', 'front', '#b6cbd3');
  const layerInput = { garmentType: 'tshirt' as const, fit: 'slim', view: 'front' as const,
    selection: getDefaultGarmentSelection('tshirt', 'slim'), color: '#b6cbd3' };
  const layers = resolveGarmentLayers({ ...layerInput, customAssetState: state });
  check(layers.find(layer => layer.id === 'innerBackNeck')!.zIndex < layers.find(layer => layer.id === 'neck')!.zIndex, 'Rear fabric must sit behind the collar');
  check(layers.find(layer => layer.id === 'neck')?.svgRaw === input.svg, 'Registered collar geometry changed');
  const legacyAsset = { ...asset, svg: asset.svg.replace('data-topology="collar-fabric-minus-opening"', '') };
  const legacyState = installCustomAsset({}, legacyAsset, 'tshirt', 'slim', 'front', '#b6cbd3');
  check(resolveGarmentLayers({ ...layerInput, customAssetState: legacyState }).some(layer => layer.id === 'innerBackNeck'), 'Legacy collar backing changed');
  const closeup = new DOMParser().parseFromString(renderFabricSvg(input.svg, '#b6cbd3'), 'image/svg+xml');
  const bounds = getPotraceSvgBBox(input.svg);
  check(bounds, 'Registered collar has no visible bounds');
  closeup.documentElement.setAttribute('viewBox', `${bounds.minX - 12} ${bounds.minY - 12} ${bounds.maxX - bounds.minX + 24} ${bounds.maxY - bounds.minY + 24}`);
  const closeupUrl = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(closeup))}`;
  const images = [
    ['Approved Drawing', input.cleanDrawing], ['Registered Collar', closeupUrl],
    ['Fabric', input.collarTopology.previews.fabric], ['Transparent Opening', input.collarTopology.previews.opening],
    ['Attachment Edge', input.collarTopology.previews.attachment], ['Construction Ink', input.collarTopology.previews.constructionInk],
    ['Socket (red) / Attachment (green)', input.attachmentOverlay],
  ];
  previewHost = document.createElement('main'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:20;background:#f5f6f7;color:#202428;overflow:auto;padding:20px;font-family:inherit';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  flushSync(() => previewRoot!.render(<>
    <h1 style={{ fontSize: 22, marginBottom: 18 }}>Registered Collar</h1>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 24 }}>
      <section aria-label="Registered shirt">
        <h2 style={{ fontSize: 14, marginBottom: 12 }}>Slim Tee / Front</h2>
        <div style={{ height: 'min(75vh,740px)', minHeight: 380, background: '#fff' }}>
          <TshirtSvgPreview garmentType="tshirt" fit="slim" color="#b6cbd3" detailView="front"
            selection={getDefaultGarmentSelection('tshirt', 'slim')} customAssetState={state} className="h-full w-full"/>
        </div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 18 }}>
        {images.map(([label, source]) => <figure key={label} style={{ margin: 0 }}>
          <figcaption style={{ fontSize: 12, marginBottom: 8 }}>{label}</figcaption>
          <img alt={label} src={source} style={{ display: 'block', width: '100%', height: 200, objectFit: 'contain', background: '#fff' }}/>
        </figure>)}
      </div>
    </div>
  </>));
  return { assetId: asset.id, saved: false };
}

export function verifyManualCollarEditing(input: Pick<CustomAssetDefinition, 'svg' | 'bodySvg' | 'registration' | 'compatibility'>) {
  const source = input.svg;
  const geometry = collarEditGeometry(source);
  check(geometry, 'Registered collar geometry is unavailable');
  const attachment = geometry.paths.filter(path => path.element.closest('[data-topology="attachmentInk"]')).flatMap(path => path.points.map(item => item.point));
  const results: string[] = [];
  for (const handle of Object.keys(geometry.handles) as CollarHandle[]) {
    for (const direction of [-1, 1]) {
      const edits: CollarManualEdits = { version: 1, offsets: { [handle]: {
        x: handle === 'height' || handle === 'dip' ? 0 : direction * 5,
        y: handle === 'scale' || handle === 'rotate' ? 0 : direction * 5,
      } } };
      check(validCollarEdits(geometry, edits), `${handle} edit rejected`);
      const svg = editedCollarSvg(source, edits);
      check(svg !== source, `${handle} did not change rendered collar`);
      if (!handle.startsWith('attachment')) {
        check(attachment.every(point => {
          const mapped = editedCollarPoint(geometry, edits, point);
          return mapped.x === point.x && mapped.y === point.y;
        }), `${handle} detached attachment ink`);
      } else {
        const opposite = geometry.handles[handle === 'attachmentLeft' ? 'attachmentRight' : 'attachmentLeft'];
        const mapped = editedCollarPoint(geometry, edits, opposite);
        check(Math.hypot(mapped.x - opposite.x, mapped.y - opposite.y) < 1e-8, 'Unselected attachment endpoint moved');
      }
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
      check(!document.querySelector('parsererror'), 'Edited SVG is invalid');
      const fabric = document.querySelector('[data-topology="collar-fabric-minus-opening"]');
      check(fabric?.getAttribute('fill-rule') === 'evenodd' || fabric?.querySelector('[fill-rule="evenodd"]'), 'Transparent opening fill rule lost');
      for (const name of ['outerBoundary', 'innerBoundary', 'attachmentInk', 'constructionInk']) {
        const ink = document.querySelector(`[data-topology="${name}"]`);
        check(ink?.getAttribute('fill') === 'none', `${name} is no longer stroke-only`);
      }
    }
    results.push(handle);
  }
  const asset: CustomAssetDefinition = { ...componentFixture(), ...input, id: 'manual-collar-test', category: 'collar', detailType: undefined };
  const state = installCustomAsset({}, asset, 'tshirt', 'slim', 'front', '#b6cbd3');
  const edited = setCustomCollarEdits(state, 'tshirt', 'slim', 'front', 'neck', { version: 1, offsets: { height: { x: 0, y: -12 } } });
  const reloaded = JSON.parse(JSON.stringify(edited)) as CustomAssetState;
  const layerInput = { garmentType: 'tshirt' as const, fit: 'slim', view: 'front' as const, selection: getDefaultGarmentSelection('tshirt', 'slim'), color: '#b6cbd3' };
  check(resolveGarmentLayers({ ...layerInput, customAssetState: reloaded }).find(layer => layer.id === 'neck')?.svgRaw !== source, 'Saved manual edit not rendered');
  const reset = setCustomCollarEdits(reloaded, 'tshirt', 'slim', 'front', 'neck');
  check(resolveGarmentLayers({ ...layerInput, customAssetState: reset }).find(layer => layer.id === 'neck')?.svgRaw === source, 'Reset did not restore exact registered SVG');
  check(input.svg === source && reloaded.customAssets?.find(item => item.id === asset.id)?.svg === source, 'Registered definition was mutated');
  check(!validCollarEdits(geometry, { version: 1, offsets: { height: { x: 0, y: Infinity } } }), 'Non-finite edit accepted');
  check(!validCollarEdits(geometry, { version: 1, offsets: { scale: { x: geometry.width, y: 0 } } }), 'Out-of-range edit accepted');
  const placement: CollarManualEdits = { version: 1, offsets: {}, translation: { x: 60, y: 40 } };
  check(validCollarEdits(geometry, placement), 'Direct placement rejected');
  for (const path of geometry.paths) for (const item of path.points) {
    const mapped = editedCollarPoint(geometry, placement, item.point);
    check(Math.abs(mapped.x - item.point.x - 60) < 1e-8 && Math.abs(mapped.y - item.point.y - 40) < 1e-8, 'Direct movement distorted collar');
  }
  const parser = new DOMParser();
  const paths = (svg: string) => Array.from(parser.parseFromString(svg, 'image/svg+xml').querySelectorAll('path')).map(path => path.getAttribute('d'));
  check(JSON.stringify(paths(editedCollarSvg(source, placement))) === JSON.stringify(paths(source)), 'Translation resampled source paths');
  check(!validCollarEdits(geometry, { ...placement, translation: { x: Infinity, y: 0 } }), 'Non-finite placement accepted');
  const moved = JSON.parse(JSON.stringify(setCustomCollarEdits(state, 'tshirt', 'slim', 'front', 'neck', placement))) as CustomAssetState;
  const movedLayers = resolveGarmentLayers({ ...layerInput, customAssetState: moved });
  check(movedLayers.find(layer => layer.id === 'neck')?.svgRaw === editedCollarSvg(source, placement), 'Placement lost on reload');
  const context = document.createElement('canvas').getContext('2d')!;
  for (const layerId of ['outline', 'stitching']) {
    const layer = parser.parseFromString(movedLayers.find(layer => layer.id === layerId)!.svgRaw, 'image/svg+xml');
    const maskUrl = layer.querySelector('mask image')!.getAttribute('href')!;
    const mask = parser.parseFromString(atob(maskUrl.split(',')[1]), 'image/svg+xml');
    const keep = new Path2D(mask.querySelector('path')!.getAttribute('d')!);
    check(context.isPointInPath(keep, 10, 2000, 'evenodd'), `${layerId} mask removed unrelated garment area`);
    for (const path of geometry.paths) for (const item of path.points) {
      const mapped = editedCollarPoint(geometry, placement, item.point);
      check(!context.isPointInPath(keep, mapped.x, mapped.y, 'evenodd'), `${layerId} mask missed moved collar`);
    }
  }
  const backing = parser.parseFromString(movedLayers.find(layer => layer.id === 'innerBackNeck')!.svgRaw, 'image/svg+xml');
  check(backing.querySelectorAll('path').length > paths(source).length - 4, 'Rear fabric is missing filled contours');
  check(Array.from(backing.querySelectorAll('path')).every(path => path.closest('[data-topology="collar-fabric-minus-opening"]')), 'Rear fabric duplicated construction ink');
  return { handles: results, directPlacement: true, attachmentPinned: true, strokeOnlyInk: true, transparentOpening: true, persisted: true, resetExact: true, sourceUnchanged: true };
}

export function mountManualCollarEditor(input: Pick<CustomAssetDefinition, 'svg' | 'bodySvg' | 'registration' | 'compatibility'>) {
  removeCustomPreview();
  const asset: CustomAssetDefinition = { ...componentFixture(), ...input, id: 'manual-standing-collar-preview', category: 'collar', detailType: undefined, name: 'Standing collar' };
  function Fixture() {
    const [state, setState] = useState(() => installCustomAsset({}, asset, 'tshirt', 'slim', 'front', '#b6cbd3'));
    const [selected, setSelected] = useState<string | null>('neck');
    return <main style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f2f5f5', color: '#202428', fontFamily: 'inherit' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #cbd4d5' }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>Standing collar</h1>
        <button type="button" onClick={() => setSelected(selected ? null : 'neck')} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #9daeb0', borderRadius: 4 }}>
          {selected ? 'Garment' : 'Edit collar'}
        </button>
      </header>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <TshirtSvgPreview garmentType="tshirt" fit="slim" color="#b6cbd3" detailView="front"
          selection={getDefaultGarmentSelection('tshirt', 'slim')} customAssetState={state} className="h-full w-full"
          selectedLayerId={selected} onSelectedLayerChange={setSelected} onLayerTransformChange={() => {}}
          onCustomAssetTransformChange={() => {}}
          onCustomCollarEditsChange={(id, edits) => setState(current => setCustomCollarEdits(current, 'tshirt', 'slim', 'front', id, edits))} />
      </div>
    </main>;
  }
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:20';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  flushSync(() => previewRoot!.render(<Fixture />));
  return { assetId: asset.id, saved: false };
}

export function mountCollarUploadFixture() {
  removeCustomPreview();
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:20;background:#171719;padding:24px';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  let accepted: CustomAssetState = {};
  let preview: CustomAssetState = {};
  const install = (asset: CustomAssetDefinition, edits?: CollarManualEdits) => {
    const installed = installCustomAsset({}, asset, 'tshirt', 'slim', 'front', '#7da8dd');
    return setCustomCollarEdits(installed, 'tshirt', 'slim', 'front', asset.registration.layerId, edits);
  };
  flushSync(() => previewRoot!.render(createElement(CustomAssetUpload, {
    category: 'collar', garmentType: 'tshirt', fit: 'slim', view: 'front', assets: [], selectedIds: [], previewColor: '#7da8dd',
    onAccept: (asset, _additional, edits) => { accepted = install(asset, edits); previewHost!.dataset.accepted = asset.id; }, onRemove: () => {}, onRename: () => {},
    renderPreview: (asset, _additional, _overlay, editor) => {
      preview = install(asset, editor?.edits);
      return createElement(TshirtSvgPreview, {
      garmentType: 'tshirt', fit: 'slim', color: '#7da8dd', detailView: 'front',
      selection: getDefaultGarmentSelection('tshirt', 'slim'),
      customAssetState: preview,
      selectedLayerId: editor ? 'neck' : undefined, onSelectedLayerChange: editor ? () => {} : undefined,
      onLayerTransformChange: editor ? () => {} : undefined, onCustomAssetTransformChange: editor ? () => {} : undefined,
      onCustomCollarEditsChange: editor ? (_id, edits) => editor.onChange(edits) : undefined,
      className: 'h-full w-full',
    }); },
  })));
  return () => ({ accepted, preview });
}

export async function verifyPreAcceptCollarEditing(input: Pick<CustomAssetDefinition, 'svg' | 'bodySvg' | 'registration' | 'compatibility'>) {
  const fixture = collarReviewFixture();
  const asset = { ...fixture.asset, ...input };
  const originalFetch = window.fetch;
  let requests = 0;
  window.fetch = async (resource, options) => {
    if (resource !== '/api/custom-assets' || options?.method !== 'POST') return originalFetch(resource, options);
    const { requestId } = JSON.parse(String(options.body));
    requests++;
    return new Response([
      { type: 'collar-review', requestId, review: fixture.review, sourceCrop: fixture.sourceCrop, cleanDrawing: fixture.cleanDrawing },
      { type: 'result', requestId, asset },
    ].map(message => JSON.stringify(message)).join('\n'));
  };
  const inspect = mountCollarUploadFixture();
  const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(element => element.textContent?.trim() === text)!;
  const click = (text: string) => { const element = button(text); check(element && !element.disabled, `${text} unavailable`); flushSync(() => element.click()); };
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`Upload did not settle: ${document.querySelector('[role="alert"]')?.textContent ?? ''}`);
  };
  const edit = () => flushSync(() => document.querySelector('[role="dialog"] [data-collar-handle="height"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true })));
  const instance = (state: CustomAssetState) => Object.values(state.customAssetInstances ?? {})[0];
  const openAndProcess = async () => {
    const trigger = previewHost!.querySelector<HTMLButtonElement>('button')!;
    flushSync(() => trigger.click());
    const transfer = new DataTransfer();
    transfer.items.add(new File([await originalFetch(fixture.sourceCrop).then(response => response.blob())], 'collar-reference.png', { type: 'image/png' }));
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fileInput.files = transfer.files;
    flushSync(() => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
    await waitFor(() => Boolean(button('Process') && !button('Process').disabled));
    click('Process');
    await waitFor(() => document.querySelectorAll('[role="dialog"] [data-collar-handle]').length === 11 && !button('Accept')?.disabled);
  };
  try {
    await openAndProcess();
    check(document.querySelector('[role="dialog"] [role="tab"][aria-selected="true"]')?.textContent === 'FINAL ASSET', 'Final Asset was not selected');
    check(!instance(inspect().accepted), 'Preview installed an asset before Accept');
    check(inspect().preview.customAssets?.[0].svg === input.svg, 'Preview changed registered base');
    edit();
    check(instance(inspect().preview)?.collarEdits?.offsets.height?.y === -5, 'Pre-accept handle edit missing');
    const reset = document.querySelector<SVGElement>('[role="dialog"] [aria-label="Reset collar to registered default"]')!;
    flushSync(() => reset.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    check(!instance(inspect().preview)?.collarEdits, 'Reset did not clear draft');
    check(editedCollarSvg(input.svg, instance(inspect().preview)?.collarEdits) === input.svg, 'Reset changed registered SVG');
    edit();
    click('Retry');
    await waitFor(() => document.querySelectorAll('[role="dialog"] [data-collar-handle]').length === 11 && !button('Accept')?.disabled);
    check(!instance(inspect().preview)?.collarEdits, 'Retry reused stale edits');
    edit();
    click('Cancel');
    check(!instance(inspect().accepted), 'Cancel accepted draft');
    await openAndProcess();
    check(!instance(inspect().preview)?.collarEdits, 'Reopen reused cancelled edits');
    edit();
    const expected = JSON.stringify(instance(inspect().preview)?.collarEdits);
    click('Accept');
    const saved = JSON.parse(JSON.stringify(inspect().accepted)) as CustomAssetState;
    check(saved.customAssets?.[0].svg === input.svg, 'Accept modified registered SVG');
    check(JSON.stringify(instance(saved)?.collarEdits) === expected, 'Accept lost manual edits');
    check(editedCollarSvg(input.svg, instance(saved)?.collarEdits) !== input.svg, 'Accepted edits do not render');
    return { defaultGarment: true, handles: 11, resetExact: true, retryCleared: true, cancelDiscarded: true, acceptPreservedBaseAndEdits: true, requests };
  } finally { window.fetch = originalFetch; removeCustomPreview(); }
}

export function removeCustomPreview() { if (previewRoot) flushSync(() => previewRoot!.unmount()); previewRoot = undefined; previewHost?.remove(); previewHost = undefined; }
export function mountCustomPreview(category: CustomAssetCategory, fit = 'slim', side = 'left', custom = true) {
  removeCustomPreview();
  const asset = fixtures.get(`${category}:${fit}:${side}`);
  check(asset, 'Process fixture first');
  const garment = asset.compatibility.garmentTypes[0];
  const state = custom ? installCustomAsset({ garmentDetails: [] as GarmentDetail[] }, asset, garment, fit, 'front', '#597db0') : {};
  const selection = getDefaultGarmentSelection(garment, fit);
  if (category === 'collar' && garment === 'tshirt') selection.Neck = getGarmentAssetsForFit(garment, 'Neck', fit).find(asset => asset.displayName.startsWith('Scoop neck'))!.id;
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#eee;display:flex;align-items:center;justify-content:center';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  flushSync(() => previewRoot!.render(createElement(TshirtSvgPreview, { garmentType: garment, fit, color: '#597db0', neckTrimColor: '#cc2d24', detailView: 'front', selection, customAssetState: state, garmentDetails: state.garmentDetails })));
  return { category, fit, side, custom };
}

export async function verifySleeveConstructionPreservation() {
  const { referenceSleeveStyle, sleeveGeometry, defaultSleeveEdits, validateSleeveReconstruction, reconstructSleeve } = await import('../../src/app/data/sleeveReconstruction');
  const { tintPotraceSvg } = await import('../../src/app/lib/tshirtSvgUtils');
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 520;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff'; context.fillRect(0, 0, 240, 520);
  context.strokeStyle = '#141414'; context.lineWidth = 3;
  context.beginPath(); context.moveTo(35, 25); context.lineTo(195, 25); context.lineTo(158, 485);
  context.quadraticCurveTo(115, 504, 72, 485); context.closePath(); context.stroke();
  context.beginPath(); context.moveTo(67, 425); context.quadraticCurveTo(115, 447, 163, 425); context.stroke();
  context.beginPath(); context.moveTo(75, 450); context.quadraticCurveTo(115, 467, 158, 450); context.stroke();
  context.beginPath(); context.moveTo(62, 260); context.quadraticCurveTo(83, 300, 88, 320); context.stroke();
  const style = referenceSleeveStyle({ version: 1, lengthClass: 'long', sleeveType: 'cuffed', construction: 'set-in', constructionNotes: 'Smooth band cuff with curved seam and visible fold.',
    length: 3, openingWidth: .5, upperWidth: 1, taper: .5, hemAngle: 0, cuffStyle: 'band', looseness: 1, silhouette: 'tapered', confidence: 'high',
    measurementBasis: 'armhole-relative', method: 'test', sourceMeasurements: { length: 470, openingWidth: 86, upperWidth: 160 }, needsReview: true },
    context.getImageData(0, 0, 240, 520), { armhole: [[35, 25], [195, 25]], cuff: [[72, 485], [158, 485]] });
  check('artwork' in style && !!style.artwork, 'Uploaded sleeve construction ink was discarded');
  check('cuff' in style && !!style.cuff, 'Separate source cuff was not detected');
  const model = { version: 1 as const, fit: 'slim', sourceImageHash: 'a'.repeat(64), style, detectedStyle: structuredClone(style),
    socket: { side: 'left' as const, join: [[600, 300], [740, 530]] as [number, number][], keepSvg: componentFixture().svg }, edits: defaultSleeveEdits() };
  const geometry = sleeveGeometry(model);
  check('cuffSvg' in geometry && !!geometry.cuffSvg, 'Cuff was not rendered as its own sub-part');
  check(style.cuff!.depth > .25 && style.cuff!.depth < .4, 'Cuff depth differs from source');
  check(style.contours!.opening!.some(point => point[0] > style.length + .04), 'Curved source opening was flattened');
  check(style.artwork!.polygons.length >= 3 && !geometry.svg.includes('stroke-width="3"'), 'Source construction was replaced with synthetic seams');
  const colored = { ...model, edits: { ...model.edits, bodyColor: '#187ca2', cuffColor: '#e67e92' } };
  check(!!getPotraceSvgBBox(sleeveGeometry(colored).svg), 'Independently colored sleeve lost measurable geometry');
  const coloredGeometry = sleeveGeometry(validateSleeveReconstruction(JSON.parse(JSON.stringify(colored))));
  const tinted = tintPotraceSvg(coloredGeometry.svg, '#ffffff');
  check(tinted.includes('rgb(24,124,162)') && tinted.includes('rgb(230,126,146)'), 'Garment tint overwrote independent sleeve colors');
  check(!tintPotraceSvg(geometry.svg, '#abcdef').includes('fill="#000000"'), 'Default cuff did not inherit garment color');
  const base = componentFixture();
  const saved = acceptedDefinition(reconstructSleeve({ ...base, category: 'sleeve', detailType: undefined, keepSvg: base.svg,
    registration: { version: 1, profile: 'SleeveRegistrationProfile', layerId: 'sleeveLeft', side: 'left', socket: 'test', defaultTransform: DEFAULT_TSHIRT_LAYER_TRANSFORM } }, colored));
  check(saved.sleeveReconstruction?.edits.cuffColor === '#e67e92' && !!saved.sleeveReconstruction.style.cuff, 'Saved sleeve lost editable cuff');
  const { withCustomAssets } = await import('../../src/app/data/customAssets');
  const state = installCustomAsset({} as CustomAssetState, saved, 'tshirt', 'slim', 'front', '#7da8dd');
  const sleeveLayer = { id: 'sleeveLeft' as const, category: 'Left sleeve', assetId: 'test', displayName: 'Sleeve', svgRaw: geometry.svg, kind: 'solid' as const, zIndex: 4 };
  const override = withCustomAssets([{ ...sleeveLayer, tint: '#ec4899' }], state, 'tshirt', 'slim', 'front')[0];
  check(override.svgRaw.includes('rgb(236,72,153)') && override.svgRaw.includes('rgb(230,126,146)'), 'Part colour failed to override uploaded sleeve while preserving cuff colour');
  check(withCustomAssets([sleeveLayer], state, 'tshirt', 'slim', 'front')[0].svgRaw === saved.svg, 'Clearing part colour did not restore uploaded sleeve');
  check(saved.sleeveReconstruction.edits.bodyColor === '#187ca2', 'Part colour mutated the saved sleeve');
  const { availableHemRegions } = await import('../../src/app/data/tshirtHemStyles');
  const cuffLayers = withCustomAssets([sleeveLayer], state, 'tshirt', 'slim', 'front', { editing: { regions: { sleeveHemLeft: { color: '#ffffff', stitchColor: '#336699' } } } });
  const cuffLayer = cuffLayers.find(layer => layer.id === 'sleeveHemLeft')!;
  check(availableHemRegions(cuffLayers, 'tshirt').some(region => region.id === 'sleeveHemLeft' && region.source === 'uploaded'), 'Uploaded cuff missing from hem editor');
  check(cuffLayer.tint === '#ffffff' && cuffLayer.svgRaw.includes('#336699'), 'Uploaded cuff colours did not resolve');
  check(!!getPotraceSvgBBox(cuffLayer.svgRaw), 'Uploaded cuff lost measurable geometry');
  check(!renderFabricSvg(cuffLayer.svgRaw, '#ffffff').includes('fill="#000000"'), 'Uploaded cuff fabric ignored its colour');
  const moved = { ...state, customAssetInstances: setAssetUserTransform(state, 'tshirt', 'slim', 'front', 'sleeveLeft',
    { x: 42, y: -15, scale: 1, scaleX: 1.2, scaleY: .8, rotation: 23, mirror: true }, false) };
  const sleeveBounds = getPotraceSvgBBox(saved.svg)!;
  const cuffBounds = getPotraceSvgBBox(cuffLayer.svgRaw)!;
  for (const canvasSize of [512, 2048]) {
    const transforms = customAssetTransforms(moved, 'tshirt', 'slim', 'front', undefined, canvasSize);
    const project = (transform: typeof DEFAULT_TSHIRT_LAYER_TRANSFORM, bounds: typeof cuffBounds) => {
      const horizontal = (cuffBounds.centerX - bounds.centerX) * (transform.scaleX ?? transform.scale);
      const vertical = (cuffBounds.centerY - bounds.centerY) * (transform.scaleY ?? transform.scale);
      const radians = transform.rotation * Math.PI / 180;
      return [bounds.centerX + horizontal * Math.cos(radians) - vertical * Math.sin(radians) + transform.x * 2048 / canvasSize,
        bounds.centerY + horizontal * Math.sin(radians) + vertical * Math.cos(radians) + transform.y * 2048 / canvasSize];
    };
    const parentPoint = project(transforms.sleeveLeft!, sleeveBounds);
    const cuffPoint = project(transforms.sleeveHemLeft!, cuffBounds);
    check(parentPoint.every((value, index) => Math.abs(value - cuffPoint[index]) < .001), 'Uploaded cuff detached when sleeve moved, scaled, rotated or mirrored');
  }
  const plain = referenceSleeveStyle({ ...style, cuffStyle: 'plain' }, context.getImageData(0, 0, 240, 520), { armhole: [[35, 25], [195, 25]], cuff: [[72, 485], [158, 485]] });
  check(!plain.cuff && !sleeveGeometry({ ...model, style: plain, detectedStyle: plain }).cuffSvg, 'Plain hem acquired an artificial cuff');
  const mirrored = sleeveGeometry({ ...colored, edits: { ...colored.edits, mirror: true, length: .9, openingWidth: 1.1 } });
  check(!!mirrored.cuffSvg && !mirrored.svg.includes('NaN'), 'Mirroring or editing broke cuff construction');
  const sourceCuff = { style: 'band' as const, confidence: 'high' as const, evidence: 'Smooth curved cuff seam.' };
  check(validateSleeveReconstruction({ ...colored, style: { ...style, sourceCuff } }).style.sourceCuff?.evidence === sourceCuff.evidence, 'Source cuff evidence lost');
  for (const invalid of [{ ...colored, style: { ...style, sourceCuff: { ...sourceCuff, evidence: ' ' } } }, { ...colored, edits: { ...colored.edits, cuffColor: 'url(test)' } }, { ...colored, style: { ...style, cuff: { ...style.cuff!, depth: -1 } } }]) {
    let rejected = false; try { validateSleeveReconstruction(invalid); } catch { rejected = true; }
    check(rejected, 'Invalid cuff metadata accepted');
  }
  return { style, source: canvas.toDataURL(), geometry: coloredGeometry, asset: saved, constructionPreserved: true, plainHemPreserved: true, independentColors: true, persisted: true };
}

export async function mountUploadedCuffEditor() {
  const { HemCuffsPanel } = await import('../../src/app/components/builder/HemCuffsPanel');
  const { availableHemRegions } = await import('../../src/app/data/tshirtHemStyles');
  const fixture = await verifySleeveConstructionPreservation();
  const left = fixture.asset;
  const model = left.sleeveReconstruction!;
  const right = reconstructSleeve({ ...left, id: crypto.randomUUID(), provenance: 'derived',
    registration: { ...left.registration, side: 'right', layerId: 'sleeveRight' } },
    { ...model, socket: { ...model.socket, side: 'right', join: model.socket.join.map(([horizontal, vertical]) => [2048 - horizontal, vertical]) }, edits: mirroredSleeveEdits(model.edits) });
  const state = [left, right].reduce((current, asset) => installCustomAsset(current, asset, 'tshirt', 'slim', 'front', '#7da8dd'), {} as CustomAssetState);
  const partColors = { sleeveLeft: '#ec4899', sleeveRight: '#ffffff' };
  let latest: import('../../src/app/data/tshirtHemStyles').TshirtHemStyles = { editing: { applyAll: false } };
  function EditorFixture() {
    const [styles, setStyles] = useState(latest);
    const [selected, setSelected] = useState('sleeveHemLeft');
    const [closeUp, setCloseUp] = useState(false);
    latest = styles;
    const layers = resolveGarmentLayers({ garmentType: 'tshirt', fit: 'slim', view: 'front', selection: getDefaultGarmentSelection('tshirt', 'slim'), customAssetState: state, partColors, tshirtHemStyles: styles });
    const regions = availableHemRegions(layers, 'tshirt');
    return <div className="grid h-full grid-cols-1 grid-rows-[minmax(280px,1fr)_minmax(0,1fr)] md:grid-cols-[320px_minmax(0,1fr)] md:grid-rows-1">
      <aside className="order-2 overflow-auto bg-[#171719] p-4 md:order-1"><HemCuffsPanel regions={regions} styles={styles} selectedId={selected}
        closeUp={closeUp} fabricColor="#7da8dd" onChange={setStyles} onSelect={setSelected} onCloseUp={setCloseUp} /></aside>
      <div className="order-1 min-h-0 bg-white md:order-2"><TshirtSvgPreview garmentType="tshirt" fit="slim" color="#7da8dd" detailView="front"
        selection={getDefaultGarmentSelection('tshirt', 'slim')} customAssetState={state} partColors={partColors} tshirtHemStyles={styles}
        hemEditor={{ regions, region: selected, closeUp, onSelect: setSelected }} className="h-full w-full" /></div>
    </div>;
  }
  removeCustomPreview();
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:99990;background:white;overflow:auto';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  flushSync(() => previewRoot!.render(<EditorFixture />));
  return { getStyles: () => latest, getLayers: () => resolveGarmentLayers({ garmentType: 'tshirt', fit: 'slim', view: 'front',
    selection: getDefaultGarmentSelection('tshirt', 'slim'), customAssetState: state, partColors, tshirtHemStyles: latest }) };
}

export function verifySleeveDrawingReviewState() {
  const base = componentFixture();
  const reference = { lengthRatio: .4, upperWidthRatio: 2.5, cuffWidthRatio: 2.25, armholeWidthRatio: 2.5, taperRatio: .9, aspectRatio: .4, confidence: 'high' as const };
  const relativeDrift = { lengthRatio: 0, upperWidthRatio: 0, cuffWidthRatio: .3, armholeWidthRatio: 0, taperRatio: .3, aspectRatio: 0 };
  const sleeve = acceptedDefinition({ ...base, category: 'sleeve', detailType: undefined, keepSvg: base.svg,
    registration: { version: 1, profile: 'SleeveRegistrationProfile', layerId: 'sleeveLeft', side: 'left', socket: 'test', defaultTransform: DEFAULT_TSHIRT_LAYER_TRANSFORM },
    sleeveReview: { status: 'Needs review', reference, generated: { ...reference, cuffWidthRatio: 2.925, taperRatio: 1.17 }, relativeDrift,
      thresholds: { goodMatch: .2, majorMismatch: .5 }, issues: [], rejections: [] } });
  const [opposite] = deriveOppositeSleeve([sleeve]);
  check(JSON.stringify(opposite.sleeveReview) === JSON.stringify(sleeve.sleeveReview), 'Opposite lost canonical review');
  check(acceptedDefinition(JSON.parse(JSON.stringify(sleeve))).sleeveReview?.status === 'Needs review', 'Review status lost on reload');
  for (const invalid of [{ ...sleeve.sleeveReview!, status: 'Rejected' as const }, { ...sleeve.sleeveReview!, rejections: ['missing opening'] },
    { ...sleeve.sleeveReview!, reference: { ...reference, lengthRatio: Number.NaN } }]) {
    let rejected = false;
    try { acceptedDefinition({ ...sleeve, sleeveReview: invalid }); } catch { rejected = true; }
    check(rejected, 'Invalid or rejected review was accepted');
  }
  return { sleeve, canonicalReviewPreserved: true, moderateAccepted: true, rejectedBlocked: true };
}