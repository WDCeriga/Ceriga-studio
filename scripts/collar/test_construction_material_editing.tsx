import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TshirtSvgPreview } from '../../src/app/components/builder/TshirtSvgPreview';
import { BuilderGarmentPreview } from '../../src/app/components/builder/BuilderGarmentPreview';
import { MATERIAL_DRAG_TYPE, readMaterialDrop, type MaterialDrop } from '../../src/app/components/builder/materialDrop';
import { resolveGarmentColours, setPartColours } from '../../src/app/data/garmentMaterialColours';
import { assignFabric, fabricPartsFromLayers, initializeFabricDefaults, type FabricPart } from '../../src/app/data/garmentFabrics';
import { importedGarmentLayers, type ImportedGarment } from '../../src/app/data/importedGarment';
import { getDefaultGarmentSelection } from '../../src/app/data/garmentSvgCatalog';
import { installCustomAsset, type CustomAssetDefinition } from '../../src/app/data/customAssets';
import { DEFAULT_TSHIRT_LAYER_TRANSFORM } from '../../src/app/data/tshirtLayerAssets';

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export function verifyMaterialColourModel() {
  const parts: FabricPart[] = [
    { id: 'base', label: 'Body', role: 'body' },
    { id: 'left', label: 'Left sleeve', role: 'sleeve', group: 'sleeves' },
    { id: 'right', label: 'Right sleeve', role: 'sleeve', group: 'sleeves' },
    { id: 'back', label: 'Estimated back', role: 'body', defaultFromId: 'base' },
    { id: 'panel', label: 'Body panel', role: 'panel', parentId: 'base' },
    { id: 'neck', label: 'Neckband', role: 'neck', fallbackFromId: 'base' },
  ];
  const original = { base: '#123456', left: '#cc0000' };
  const defaults = { categoryDefaults: { sleeves: '#00cc00' }, unlinkedGroups: [] };
  const colours = resolveGarmentColours(parts, '#ffffff', original, defaults);
  check(colours.back === original.base && colours.panel === original.base, 'Source colour inheritance failed');
  check(colours.left === original.left && colours.right === '#00cc00', 'Category / explicit precedence failed');
  check(colours.neck === original.base, 'Neckband did not inherit body colour');
  const neckDefaults = { categoryDefaults: { neck: '#445566', body: '#abcdef' }, unlinkedGroups: [] };
  check(resolveGarmentColours(parts, '#ffffff', original, neckDefaults).neck === '#445566', 'Neck category must win over body fallback');
  check(resolveGarmentColours(parts, '#ffffff', { ...original, neck: '#112233' }, neckDefaults).neck === '#112233', 'Explicit neck colour must win');
  check(resolveGarmentColours(parts, '#ffffff', {}, { categoryDefaults: { body: '#abcdef' }, unlinkedGroups: [] }).neck === '#abcdef', 'Neck did not inherit body category colour');
  check(resolveGarmentColours([{ id: 'loop', label: 'Loop', role: 'neck', fallbackFromId: 'loop' }], '#ffffff').loop === '#ffffff', 'Fallback colour cycle handling failed');
  const edited = setPartColours(original, ['back'], '#abcdef');
  check(resolveGarmentColours(parts, '#ffffff', edited, defaults).back === '#abcdef', 'Back override lost');
  check(resolveGarmentColours(parts, '#ffffff', setPartColours(edited, ['back']), defaults).back === original.base, 'Reset did not restore inheritance');
  check(JSON.stringify(original) === '{"base":"#123456","left":"#cc0000"}', 'Resolver mutated sparse overrides');
  check(resolveGarmentColours([{ id: 'loop', label: 'Loop', role: 'body', defaultFromId: 'loop' }], '#ffffff').loop === '#ffffff', 'Cycle handling failed');
  for (const input of ['', 'not json', '{"kind":"colour","colour":"red"}', '{"kind":"fabric","fabricId":"<script>"}']) {
    check(!readMaterialDrop({ getData: () => input }), 'Unsafe material payload accepted');
  }
  check(readMaterialDrop({ getData: () => '{"kind":"colour","colour":"#ff0000"}' })?.kind === 'colour', 'Valid colour payload rejected');
  check(readMaterialDrop({ getData: () => '{"kind":"fabric","fabricId":"mesh"}' })?.kind === 'fabric', 'Valid fabric payload rejected');
  return { checks: 18 };
}

export function verifySchematicConstructionSelection() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-2000px';
  document.body.append(host);
  const root = createRoot(host);
  let selected: string | null = null, dropped: string | null = null;
  const render = () => flushSync(() => root.render(<BuilderGarmentPreview garmentType="hoodie" color="#ffffff"
    selectedPartId={selected} onSelectPart={id => { selected = id; }} onMaterialDrop={id => { dropped = id; }} />));
  try {
    render();
    const ids = Array.from(host.querySelectorAll('[data-construction-region-hit]')).map(element => element.getAttribute('data-construction-region-hit')!);
    check(ids.length > 3, 'Schematic construction parts missing');
    for (const id of ids) {
      flushSync(() => host.querySelector(`[data-construction-region-hit="${id}"]`)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
      render();
      const target = host.querySelector(`[data-construction-region-hit="${id}"]`)!;
      check(selected === id && target.getAttribute('fill') === '#38bdf84d', `${id}: schematic selection failed`);
      const dataTransfer = new DataTransfer();
      dataTransfer.setData(MATERIAL_DRAG_TYPE, JSON.stringify({ kind: 'fabric', fabricId: 'mesh' }));
      flushSync(() => target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })));
      check(dropped === id, `${id}: schematic drop failed`);
    }
    return { parts: ids.length, selectionAndDrops: true };
  } finally { flushSync(() => root.unmount()); host.remove(); }
}

export async function verifyImportedConstructionMaterials(garment: ImportedGarment) {
  let checks = 0;
  const verify = (value: unknown, message: string) => { check(value, message); checks++; };
  const before = JSON.stringify(garment);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-2000px;width:600px;height:600px';
  document.body.append(host);
  const root = createRoot(host);
  const type = garment.manifest.garmentType;
  const parts = fabricPartsFromLayers([...importedGarmentLayers(garment, 'front'), ...importedGarmentLayers(garment, 'back')], type);
  const regions = garment.manifest.frontView?.constructionRegions?.regions ?? garment.constructionRegions?.regions ?? [];
  let selected: string | null = null;
  let colours: Record<string, string> = {};
  let fabrics = initializeFabricDefaults(type);
  const render = () => flushSync(() => root.render(<TshirtSvgPreview
    garmentType={type} fit="slim" color="#ffffff" detailView="front"
    customAssetState={{ importedGarment: garment }} fabricAssignments={fabrics}
    partColors={resolveGarmentColours(parts, '#ffffff', colours)} selectedLayerId={selected}
    onSelectedLayerChange={id => { selected = id; }}
    onMaterialDrop={(id, material) => {
      if (material.kind === 'colour') colours = setPartColours(colours, [id], material.colour);
      else fabrics = assignFabric(fabrics, parts, id, material.fabricId, 'part');
    }} />));
  const geometry = () => Array.from(host.querySelectorAll('[data-layer-id] path')).map(path => path.getAttribute('d')).join('|');
  try {
    render();
    const originalGeometry = geometry();
    const editable = regions.filter(region => region.editableIndependently && parts.some(part => part.id === region.id));
    verify(editable.length > 2, 'Imported fixture lacks independently editable construction');
    for (const region of editable) {
      const target = host.querySelector(`[data-construction-region-hit="${region.id}"]`);
      verify(target?.getAttribute('d') === region.path, `${region.id}: selection changed authoritative seam geometry`);
      flushSync(() => target!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      render();
      verify(selected === region.id && host.querySelector(`[data-construction-region-hit="${region.id}"]`)?.getAttribute('aria-pressed') === 'true', `${region.id}: exact imported selection failed`);
    }
    for (const region of editable.filter(region => ['body', 'sleeve'].includes(region.semanticType)).slice(0, 3)) {
      for (const material of [{ kind: 'colour', colour: '#cb3456' }, { kind: 'fabric', fabricId: 'mesh' }]) {
        const dataTransfer = new DataTransfer(); dataTransfer.setData(MATERIAL_DRAG_TYPE, JSON.stringify(material));
        flushSync(() => host.querySelector(`[data-construction-region-hit="${region.id}"]`)!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })));
        render();
      }
      verify(colours[region.id] === '#cb3456' && fabrics.assignments[region.id] === 'mesh', `${region.id}: independent colour/fabric drop failed`);
      verify(host.querySelector(`[data-layer-id="${region.id}"]`)?.getAttribute('data-fabric-id') === 'mesh', `${region.id}: imported fabric did not render`);
    }
    verify(geometry() === originalGeometry, 'Imported material edit changed source geometry or ink');
    verify(JSON.stringify(garment) === before, 'Imported fixture was mutated');
    return { checks, regions: editable.length, geometryPreserved: true };
  } finally { flushSync(() => root.unmount()); host.remove(); }
}

export async function verifyUnifiedConstructionSelection() {
  let checks = 0;
  function check(value: unknown, message: string): asserts value { checks++; if (!value) throw new Error(message); }
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-2000px;top:0;width:600px;height:600px';
  document.body.append(host);
  const root = createRoot(host);
  let selected: string | null = null, transforms = 0;
  const drops: { id: string; material: MaterialDrop }[] = [];
  const props = {
    garmentType: 'tshirt' as const, fit: 'slim', color: '#ffffff', detailView: 'front' as const,
    selection: getDefaultGarmentSelection('tshirt', 'slim'), fabricAssignments: initializeFabricDefaults('tshirt'),
    onSelectedLayerChange: (id: string | null) => { selected = id; },
    onLayerTransformChange: () => { transforms++; }, onCustomAssetTransformChange: () => { transforms++; },
    onCustomCollarEditsChange: () => { transforms++; },
    onMaterialDrop: (id: string, material: MaterialDrop) => drops.push({ id, material }),
    className: 'h-full w-full',
  };
  const render = (extra: Partial<React.ComponentProps<typeof TshirtSvgPreview>> = {}) => flushSync(() => root.render(<TshirtSvgPreview {...props} {...extra} />));
  try {
    render();
    await new Promise(resolve => setTimeout(resolve, 60));
    const outline = host.querySelector('[data-layer-id="outline"]')?.innerHTML;
    for (const id of ['base', 'sleeveLeft', 'sleeveRight', 'neck', 'innerBackNeck']) {
      const target = host.querySelector<HTMLElement>(`[data-tshirt-hit-target="${id}"]`);
      check(target?.querySelector('path'), `Missing exact ${id} geometry`);
      flushSync(() => target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 150 })));
      check(selected === id, `${id} selection not routed`);
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 280, clientY: 260 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      render({ selectedLayerId: id });
      check(host.querySelector(`[data-tshirt-hit-target="${id}"]`)?.getAttribute('aria-pressed') === 'true', `${id} not highlighted`);
      check(host.querySelector(`[data-tshirt-hit-target="${id}"] [fill="#38bdf84d"]`), 'Selection is not blue');
      check(!host.querySelector('[data-tshirt-selection], [data-collar-handle]'), 'Accepted structural part exposes transform handles');
    }
    check(transforms === 0, 'Structural drag modified registered geometry');
    check(host.querySelector('[data-layer-id="outline"]')?.innerHTML === outline, 'Selection changed construction ink');
    check(host.querySelector('[data-layer-id="base"]')?.getAttribute('data-fabric-id') === 'single-jersey', 'Body lacks jersey default');
    check(host.querySelector('[data-layer-id="neck"]')?.getAttribute('data-fabric-id') === 'rib-1x1', 'Neck lacks rib default');
    check(host.querySelector('[data-layer-id="innerBackNeck"]')?.getAttribute('data-fabric-id') === 'single-jersey', 'Visible inside back must use body reverse, not neck rib');
    const left = host.querySelector('[data-tshirt-hit-target="sleeveLeft"]')!;
    for (const material of [{ kind: 'colour', colour: '#ff0000' }, { kind: 'fabric', fabricId: 'mesh' }]) {
      const dataTransfer = new DataTransfer(); dataTransfer.setData(MATERIAL_DRAG_TYPE, JSON.stringify(material));
      flushSync(() => left.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })));
    }
    check(drops.length === 2 && drops.every(drop => drop.id === 'sleeveLeft'), 'Drops escaped exact selected sleeve');
    render({ technicalView: true });
    check(!host.querySelector('[data-layer-id][data-fabric-id]'), 'Technical view retains texture');
    render();
    check(host.querySelector('[data-layer-id="base"]')?.getAttribute('data-fabric-id') === 'single-jersey', 'Technical view destroyed assignment');
    const asset: CustomAssetDefinition = {
      version: 1, id: 'registered-collar-test', category: 'collar', name: 'Registered collar', source: 'photo', provenance: 'front',
      analysis: { category: 'collar', name: 'Collar', construction: 'seams', provider: 'astra' },
      compatibility: { garmentTypes: ['tshirt'], fits: ['slim'], views: ['front'] },
      registration: { version: 1, profile: 'CollarRegistrationProfile', layerId: 'neck', socket: 'test', defaultTransform: DEFAULT_TSHIRT_LAYER_TRANSFORM },
      validation: { version: 1, status: 'passed', checks: ['boundary', 'trace', 'registration'] },
      colorBindings: { fabric: '#000000', ink: '#141414' },
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g transform="translate(0,1000) scale(1,-1)"><path data-topology="collar-fabric-minus-opening" fill="#000000" fill-rule="evenodd" d="M800 400 Q1024 320 1248 400 L1248 560 Q1024 650 800 560 Z M830 420 Q1024 350 1218 420 Q1024 510 830 420 Z"/></g></svg>' };
    asset.bodySvg = asset.svg;
    const customAssetState = installCustomAsset({}, asset, 'tshirt', 'slim', 'front', '#ffffff');
    const before = JSON.stringify(customAssetState);
    render({ customAssetState, selectedLayerId: 'neck' });
    check(host.querySelector('[data-tshirt-hit-target="neck"]'), 'Accepted custom neck cannot be selected');
    check(!host.querySelector('[data-collar-handle], [data-tshirt-selection]'), 'Accepted custom neck remains editable');
    render({ customAssetState, selectedLayerId: 'neck', creationEditing: true });
    check(host.querySelectorAll('[data-collar-handle]').length > 0, 'Creation flow lost geometry handles');
    check(JSON.stringify(customAssetState) === before, 'Viewing collar altered saved registration');
    return { checks, defaults: true, exactSelection: true, structuralLock: true, drops: true, creationOnly: true };
  } finally { flushSync(() => root.unmount()); host.remove(); }
}
