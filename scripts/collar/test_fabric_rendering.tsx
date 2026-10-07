import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { FABRIC_LIBRARY, applyFabricPreset, assignFabric, fabricPartsFromLayers, setFabricGroupLinked } from '../../src/app/data/garmentFabrics';
import { getDefaultGarmentSelection, resolveGarmentLayers } from '../../src/app/data/garmentSvgCatalog';
import { createGarmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';
import { TshirtSvgPreview, type TshirtSvgPreviewProps } from '../../src/app/components/builder/TshirtSvgPreview';
import { renderTexturedFabricSvg } from '../../src/app/lib/fabricRendering';
import { fabricSourceRecord, fabricScanSurface, fabricMaterial, FABRIC_SOURCE_RESEARCH } from '../../src/app/lib/fabricTextureScans';
import { verifyFabricSources } from './test_fabric_sources';
import { renderFabricSvg } from '../../src/app/lib/tshirtSvgUtils';
import { check, verifyFabricModel } from './test_garment_fabrics';
import { colourPanelFixture } from './test_imported_colour_panels';

const ring = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g transform="translate(0,2048) scale(.1,-.1)" fill="#000000"><path fill-rule="evenodd" d="M1800 1800H18680V18680H1800ZM7800 7800V12680H12680V7800Z"/></g><g data-ink="true" fill="none" stroke="#141414" stroke-width="18"><path d="M300 500H1748M300 1548H1748"/></g></svg>`;
const pixels = async (markup: string, size = 296) => {
  const image = new Image();
  image.src = `data:image/svg+xml,${encodeURIComponent(markup)}`;
  await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, size, size);
  return context.getImageData(0, 0, size, size).data;
};

function comparePixels(before: Uint8ClampedArray, after: Uint8ClampedArray) {
  let colourDelta = 0, opaque = 0, changed = 0, silhouetteChanges = 0, inkChanges = 0;
  let textureSamples = 0, sum = 0, sumSquared = 0, visible = 0, maximumDelta = 0;
  for (let i = 0; i < before.length; i += 4) {
    if ((before[i + 3] > 127) !== (after[i + 3] > 127)) silhouetteChanges++;
    if (before[i + 3] === 0) check(after[i + 3] === 0, 'Texture escaped the exact solid mask or filled an opening');
    if (before[i + 3] === 255 && after[i + 3] === 255) {
      opaque++;
      const delta = Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]);
      colourDelta += delta / 3;
      if (delta) changed++;
      const isInk = before[i] === 20 && before[i + 1] === 20 && before[i + 2] === 20;
      if (isInk && delta) inkChanges++;
      if (!isInk) {
        const signedDelta = (after[i] - before[i] + after[i + 1] - before[i + 1] + after[i + 2] - before[i + 2]) / 3;
        textureSamples++; sum += signedDelta; sumSquared += signedDelta * signedDelta;
        if (delta / 3 >= 2) visible++;
        maximumDelta = Math.max(maximumDelta, delta / 3);
      }
    }
  }
  check(silhouetteChanges === 0, `Silhouette changed by ${silhouetteChanges} pixels`);
  check(inkChanges === 0, `Construction ink changed by ${inkChanges} pixels`);
  // Guard against returning to bold patterns, not just against invisible materials.
  check(colourDelta / Math.max(1, opaque) < 5, `Texture overwhelmed the selected colour: mean channel delta ${colourDelta / Math.max(1, opaque)}`);
  const count = Math.max(1, textureSamples);
  const textureContrast = Math.sqrt(Math.max(0, sumSquared / count - (sum / count) ** 2));
  return { changed, meanChannelDelta: +(colourDelta / Math.max(1, opaque)).toFixed(3), textureContrast: +textureContrast.toFixed(3), visibleFraction: +(visible / count).toFixed(3), maximumDelta: +maximumDelta.toFixed(3), silhouetteChanges, inkChanges };
}

function detailedHoodieFixture() {
  const garment = createGarmentRegressionFixture('hoodie');
  const template = garment.parts.find(part => part.semanticType === 'body')!;
  // This supplemental import fixture has explicit sewn bands; the legacy hoodie pack does not.
  const add = (id: string, category: 'cuff' | 'waistband', points: [number, number][]) => {
    const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
    const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    garment.parts.push({ ...template, id, name: id.replace(/-/g, ' '), semanticType: category, structuralRole: category,
      bounds, geometryBounds: bounds, outline: points, layerOrder: garment.parts.length,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g transform="translate(0,0)" fill="#000000"><polygon points="${points.map(([x, y]) => `${x * 2048},${y * 2048}`).join(' ')}"/></g></svg>`,
      color: '#766783', constructionSvg: '', stitchSvg: '' });
  };
  add('left-cuff', 'cuff', [[.14, .68], [.23, .72], [.215, .765], [.125, .725]]);
  add('right-cuff', 'cuff', [[.86, .68], [.77, .72], [.785, .765], [.875, .725]]);
  add('waistband', 'waistband', [[.35, .77], [.65, .77], [.65, .82], [.35, .82]]);
  return garment;
}

function cases(): { label: string; props: TshirtSvgPreviewProps; preset: string }[] {
  return [
    { label: 'Real regular tee', preset: 'jersey-mesh', props: { garmentType: 'tshirt', selection: getDefaultGarmentSelection('tshirt', 'regular'), fit: 'regular', color: '#749d97', neckTrimColor: '#715c7d', partColors: { sleeveLeft: '#8795ba', sleeveRight: '#8795ba' } } },
    { label: 'Real hoodie pack · combined sleeve source', preset: 'terry-fleece', props: { garmentType: 'hoodie', selection: getDefaultGarmentSelection('hoodie'), color: '#a18d7d', neckTrimColor: '#a18d7d', layerTransforms: { sleeveLeft: { x: -6, y: 3, scale: 1.03, rotation: -3 }, sleeveRight: { x: 6, y: 3, scale: 1.03, rotation: 3 } } } },
    { label: 'Supplemental synthetic imported hoodie · explicit cuffs and waistband', preset: 'terry-fleece', props: { garmentType: 'hoodie', selection: {}, color: '#86a9a2', customAssetState: { importedGarment: detailedHoodieFixture() } } },
    { label: 'Seam panels without colour overrides', preset: 'jersey-mesh', props: { garmentType: 'hoodie', selection: {}, customAssetState: { importedGarment: colourPanelFixture() } } },
  ];
}

const reviewTee: TshirtSvgPreviewProps = { garmentType: 'tshirt', selection: getDefaultGarmentSelection('tshirt', 'regular'), fit: 'regular', color: '#c4cbd1', neckTrimColor: '#c4cbd1' };
const materialReviews: { name: string; assignments: Record<string, string>; unlinkedGroups?: string[] }[] = [
  { name: 'No fabric · baseline', assignments: {} },
  ...FABRIC_LIBRARY.map(fabric => ({ name: `Body = ${fabric.name}`, assignments: { base: fabric.id } })),
  { name: 'Body = jersey · neck = rib 1×1', assignments: { base: 'single-jersey', neck: 'rib-1x1' } },
  { name: 'Mixed body / neck / independent sleeves', assignments: { base: 'single-jersey', neck: 'rib-1x1', sleeveLeft: 'mesh', sleeveRight: 'waffle' }, unlinkedGroups: ['sleeves'] },
];

export async function verifyFabricSurfaces() {
  const model = verifyFabricModel(), sources = verifyFabricSources();
  check(FABRIC_LIBRARY.length === 14 && sources.verified.length === 1 && sources.verified[0] === 'denim-twill' && sources.procedural.length === 13 && sources.reviewRequired.length === 13 && sources.unresolved.length === 0, 'Expected all 14 surfaces: one verified denim source and 13 review-required procedural constructions');
  const baseline = renderFabricSvg(ring, '#76988d');
  check(renderTexturedFabricSvg(ring, '#76988d', undefined, 'old') === baseline, 'Unassigned preview changed');
  const unavailable = renderTexturedFabricSvg(ring, '#76988d', { ...FABRIC_LIBRARY[0], id: 'unregistered-test-material' }, 'missing');
  check(unavailable.includes('data-fabric-unavailable="true"') && unavailable.includes('Texture unavailable'), 'Missing material silently rendered as plain SVG');
  const originalPixels = await pixels(baseline), raster: Record<string, ReturnType<typeof comparePixels>> = {};
  for (const fabric of FABRIC_LIBRARY) {
    const rendered = renderTexturedFabricSvg(ring, '#76988d', fabric, 'test');
    check(rendered === renderTexturedFabricSvg(ring, '#76988d', fabric, 'test'), 'Texture is not deterministic');
    const doc = new DOMParser().parseFromString(rendered, 'image/svg+xml');
    check(doc.querySelector('[data-fabric-surface]')?.getAttribute('data-fabric-surface') === 'face', 'Reverse texture leaked to exterior');
    check(doc.querySelector('[data-ink]')?.outerHTML === new DOMParser().parseFromString(baseline, 'image/svg+xml').querySelector('[data-ink]')?.outerHTML, 'Inline ink mutated');
    raster[fabric.id] = comparePixels(originalPixels, await pixels(rendered));
    const image = doc.querySelector('pattern image[data-fabric-scan]');
    const record = fabricSourceRecord(fabric), surface = fabricScanSurface(fabric);
    const available = record.status === 'verified' || record.status === 'review-required';
    check(!!surface === available, `Source availability disagrees with status: ${fabric.id}`);
    check(doc.querySelector('pattern')?.getAttribute('data-fabric-status') === record.status, `Missing actual source status: ${fabric.id}`);
    if (available) {
      check(image?.getAttribute('href')?.startsWith('data:image/png;base64,'), `Fabric is not a bundled raster map: ${fabric.id}`);
      check(doc.querySelector('pattern')?.getAttribute('data-fabric-source-type') === record.sourceType, `Missing source type: ${fabric.id}`);
      check(surface?.sourceStatus === record.status && surface?.sourceType === record.sourceType, `Surface provenance mismatch: ${fabric.id}`);
    } else check(!image && !doc.querySelector('pattern image'), `Unresolved fabric borrowed a map: ${fabric.id}`);
    check(!doc.querySelector('pattern ellipse, pattern circle, pattern path'), 'Decorative vector motifs returned');
    const maxContrast = ['mesh', 'single-jersey', 'interlock-jersey'].includes(fabric.id) ? 3 : 8;
    for (const [fill, size] of [['#76988d', 296], ['#e7dfcd', 296], ['#171717', 296], ['#76988d', 1184]] as const) {
      const metrics = fill === '#76988d' && size === 296 ? raster[fabric.id]
        : comparePixels(await pixels(renderFabricSvg(ring, fill), size), await pixels(renderTexturedFabricSvg(ring, fill, fabric, 'visibility'), size));
      raster[`${fabric.id}:${fill}:${size}`] = metrics;
      const minimumContrast = fabric.id === 'denim-twill' ? 2.8 : size === 1184 ? .5 : .15;
      check(available ? metrics.changed > 0 && metrics.textureContrast >= minimumContrast && metrics.textureContrast <= maxContrast : metrics.changed === 0, `Texture/fallback outside bounds: ${fabric.id} ${fill} ${size}px ${JSON.stringify(metrics)}`);
      if (available && fabric.id === 'denim-twill') check(metrics.visibleFraction >= .3, `Denim is effectively flat at ${size}px: ${JSON.stringify(metrics)}`);
      check(metrics.maximumDelta <= (fabric.id === 'mesh' ? 14 : 34), `Harsh surface marks: ${fabric.id}`);
    }
    if (fabric.interiorTexture) {
      const reverse = fabricScanSurface(fabric, true);
      const inside = renderTexturedFabricSvg(ring, '#76988d', fabric, 'test', true);
      const insideDoc = new DOMParser().parseFromString(inside, 'image/svg+xml');
      const reverseImage = insideDoc.querySelector('pattern image[data-fabric-scan]');
      check(insideDoc.querySelector('[data-fabric-surface]')?.getAttribute('data-fabric-surface') === fabric.interiorTexture, `Wrong reverse surface: ${fabric.id}`);
      check(!!reverse === !!record.reverse, `Reverse availability disagrees with source record: ${fabric.id}`);
      if (available) check(reverse && record.reverse, `Dedicated reverse map missing: ${fabric.id}`);
      if (reverse) {
        check(reverse.image !== surface?.image && record.reverse?.normalizedFile !== record.source?.normalizedFile, `Reverse reuses exterior face: ${fabric.id}`);
        check(reverseImage?.getAttribute('href') === reverse.image, `Dedicated reverse map not rendered: ${fabric.id}`);
        check(insideDoc.querySelector('pattern')?.getAttribute('data-fabric-status') === reverse.sourceStatus, `Reverse source status mismatch: ${fabric.id}`);
        for (const size of [296, 1184]) {
          const metrics = comparePixels(await pixels(baseline, size), await pixels(inside, size));
          raster[`${fabric.id}:reverse:${size}`] = metrics;
          check(metrics.textureContrast >= (size === 1184 ? .5 : .15) && metrics.textureContrast <= 8, `Reverse texture outside bounds: ${fabric.id} ${size}px ${JSON.stringify(metrics)}`);
        }
      } else {
        check(!reverseImage && inside.includes('data-fabric-unavailable="true"'), `Unresolved reverse borrowed a map or failed silently: ${fabric.id}`);
      }
    }
  }
  // Identical dark fabric and ink colours must not turn the separate ink group into fabric.
  const dark = renderTexturedFabricSvg(ring.replace('fill="none" stroke="#141414"', 'fill="#141414" stroke="#141414"'), '#141414', FABRIC_LIBRARY.find(fabric => fabric.id === 'denim-twill')!, 'dark');
  check(!new DOMParser().parseFromString(dark, 'image/svg+xml').querySelector('[data-ink] [data-fabric-base]'), 'Dark inline ink was textured');
  return { model, sources, raster };
}

export async function verifyFabricRendering() {
  const { model, sources, raster } = await verifyFabricSurfaces();
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-10000px;width:512px;height:512px'; document.body.append(host);
  const root = createRoot(host);
  const previews: string[] = [];
  try {
    for (const item of materialReviews) {
      flushSync(() => root.render(<TshirtSvgPreview {...reviewTee} fabricAssignments={{ assignments: item.assignments, unlinkedGroups: item.unlinkedGroups ?? [] }} />));
      const actual = Object.fromEntries(Array.from(host.querySelectorAll('[data-layer-id][data-fabric-id]')).map(element => [element.getAttribute('data-layer-id'), element.getAttribute('data-fabric-id')]));
      const expected = { ...item.assignments };
      if (expected.base && !expected.innerBackNeck) expected.innerBackNeck = expected.base;
      check(JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(expected).sort()), `Material escaped its requested region or matching body reverse: ${item.name}`);
      for (const [partId, fabricId] of Object.entries(item.assignments)) {
        const element = host.querySelector(`[data-layer-id="${partId}"]`);
        const record = fabricSourceRecord(FABRIC_LIBRARY.find(fabric => fabric.id === fabricId)!);
        check(element?.querySelector('pattern')?.getAttribute('data-fabric-status') === record.status, `Actual garment lost source status: ${partId}`);
        check(element?.querySelector('image[data-fabric-scan]')?.getAttribute('href')?.startsWith('data:image/png;base64,'), `Actual garment lost its embedded map: ${partId}`);
      }
      previews.push(item.name);
    }
    for (const item of cases().flatMap(item => [false, true].map(verifiedPass => ({ ...item, verifiedPass })))) {
      const layers = resolveGarmentLayers(item.props), layerSnapshot = JSON.stringify(layers);
      const parts = fabricPartsFromLayers(layers, item.props.garmentType);
      const assignment = item.verifiedPass
        ? { assignments: Object.fromEntries(parts.map(part => [part.id, 'denim-twill'])), unlinkedGroups: [] }
        : applyFabricPreset(undefined, parts, item.preset);
      flushSync(() => root.render(<TshirtSvgPreview {...item.props} />));
      const oldLayers = Array.from(host.querySelectorAll('[data-layer-id]')).map(element => `${element.getAttribute('data-layer-id')}|${element.getAttribute('style')}`);
      const oldGeometry = Array.from(host.querySelectorAll('[data-layer-id] svg path:not(defs path),[data-layer-id] svg polygon:not(defs polygon)')).filter(element => !element.closest('defs')).map(element => element.getAttribute('d') ?? element.getAttribute('points'));
      flushSync(() => root.render(<TshirtSvgPreview {...item.props} fabricAssignments={JSON.parse(JSON.stringify(assignment))} />));
      check(JSON.stringify(oldLayers) === JSON.stringify(Array.from(host.querySelectorAll('[data-layer-id]')).map(element => `${element.getAttribute('data-layer-id')}|${element.getAttribute('style')}`)), 'Fabric changed layer order or transforms');
      const newGeometry = Array.from(host.querySelectorAll('[data-layer-id] svg path:not(defs path),[data-layer-id] svg polygon:not(defs polygon)')).filter(element => !element.closest('defs')).map(element => element.getAttribute('d') ?? element.getAttribute('points'));
      check(JSON.stringify(oldGeometry) === JSON.stringify(newGeometry), 'Fabric changed garment source geometry');
      for (const part of parts) {
        const element = Array.from(host.querySelectorAll('[data-layer-id]')).find(element => element.getAttribute('data-layer-id') === part.id);
        if (!element) continue;
        check(element.getAttribute('data-fabric-id') === assignment.assignments[part.id], `Preview assignment missing: ${part.id}`);
      }
      check(host.querySelector('[data-fabric-texture]'), `Preview has no material paint servers: ${item.label}`);
      if (item.verifiedPass) check(host.querySelector('image[data-fabric-scan]'), `Verified denim missing from actual garment: ${item.label}`);
      check(JSON.stringify(layers) === layerSnapshot, 'Rendering mutated source layers');
      const sleeve = parts.find(part => part.group === 'sleeves');
      if (sleeve) {
        const mixed = assignFabric(setFabricGroupLinked(assignment, parts, 'sleeves', false), parts, sleeve.id, 'waffle');
        flushSync(() => root.render(<TshirtSvgPreview {...item.props} fabricAssignments={mixed} />));
        for (const part of parts) {
          const element = Array.from(host.querySelectorAll('[data-layer-id]')).find(element => element.getAttribute('data-layer-id') === part.id);
          if (element) check(element.getAttribute('data-fabric-id') === mixed.assignments[part.id], `Unlinked sleeve changed another assignment: ${part.id}`);
          const expected = part.id === sleeve.id || part.parentId === sleeve.id ? 'waffle' : assignment.assignments[part.id];
          check(mixed.assignments[part.id] === expected, `Unlinked sleeve/child-panel assignment mismatch: ${part.id}`);
        }
        check(Array.from(host.querySelectorAll('[data-layer-id]')).find(element => element.getAttribute('data-layer-id') === sleeve.id)?.getAttribute('data-fabric-id') === 'waffle', 'Unlinked sleeve did not render independently');
      }
      previews.push(`${item.label}${item.verifiedPass ? ' · verified denim' : ''}`);
    }
  } finally { flushSync(() => root.unmount()); host.remove(); }
  return { model, sources, appearance: { status: sources.unresolved.length ? 'incomplete' : sources.reviewRequired.length ? 'review-required' : 'ready', missing: sources.unresolved, reviewRequired: sources.reviewRequired, note: 'Available maps pass raster visibility checks; procedural construction fidelity still requires visual review. An unresolved plain fill is not a successful fabric render.' }, raster, previews, clipping: 'exact solid fill and transparent opening conserved; transformed/split source geometry unchanged', ink: 'inline strokes and separate construction/stitches stay above fabric paint' };
}

const sourceImages = import.meta.glob(['../../src/assets/fabrics/originals/*.jpg', '../../src/assets/fabrics/procedural/*-source.png'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const sourceTypeLabel = (sourceType: string | undefined) => ({
  'scan-cc0': 'CC0 photographic scan', 'scan-ccby': 'CC BY photographic scan',
  'ceriga-owned': 'Ceriga-owned source', procedural: 'Procedural construction map',
}[sourceType ?? ''] ?? 'Source type unavailable');

function FabricSourceReview({ closeup }: { closeup: boolean }) {
  const [colour, setColour] = useState('#c4cbd1');
  const unresolved = FABRIC_LIBRARY.filter(fabric => !fabricScanSurface(fabric));
  const records = FABRIC_LIBRARY.map(fabricSourceRecord);
  const verifiedCount = records.filter(record => record.status === 'verified').length;
  const proceduralCount = records.filter(record => record.sourceType === 'procedural').length;
  const reviewCount = records.filter(record => record.status === 'review-required').length;
  const comparisonFabrics = [...FABRIC_LIBRARY].sort((a, b) => Number(!!fabricScanSurface(b)) - Number(!!fabricScanSurface(a)));
  return <>
    <div id="source-validation" role={unresolved.length ? 'alert' : 'status'} data-status={unresolved.length ? 'incomplete' : reviewCount ? 'review-required' : 'ready'}>
      <h2>{unresolved.length ? 'INCOMPLETE — missing texture sources' : `All ${FABRIC_LIBRARY.length} fabrics render — ${reviewCount ? 'visual review pending' : 'sources verified'}`}</h2>
      <p>{FABRIC_LIBRARY.length - unresolved.length} / {FABRIC_LIBRARY.length} available · {verifiedCount} verified source · {proceduralCount} procedural maps · {reviewCount} review-required · {unresolved.length} unresolved.</p>
      <p>Denim uses a verified real CC0 source. Procedural maps model individual constructions; they are not photographic scans or verified material captures. Passing renderer tests does not approve their visual fidelity.</p>
      {unresolved.length > 0 && <><p>Missing sources are explicitly unresolved, never shown as plain fabric samples.</p><ul>{unresolved.map(fabric => <li key={fabric.id}><a href={`#source-${fabric.id}`}>{fabric.name}</a> · <code>{fabric.id}</code></li>)}</ul></>}
    </div>
    <h2>{closeup ? '4× close-up comparison' : 'Normal builder zoom · 296px comparison'}</h2>
    <label>Review garment colour <select value={colour} onChange={event => setColour(event.target.value)}><option value="#c4cbd1">Neutral grey</option><option value="#e7dfcd">Light cream</option><option value="#171717">Dark charcoal</option><option value="#617c91">Slate blue</option></select></label>
    <div className="fabric-review-grid" id="fabric-comparison">
      <section><h3>No fabric · colour-only baseline</h3><div className={closeup ? 'garment-closeup' : 'garment-normal'}>{closeup ? <div><TshirtSvgPreview {...reviewTee} color={colour} neckTrimColor={colour} /></div> : <TshirtSvgPreview {...reviewTee} color={colour} neckTrimColor={colour} />}</div><p>Reference only — not a fabric preset.</p></section>
      {comparisonFabrics.map(fabric => {
        const surface = fabricScanSurface(fabric), record = fabricSourceRecord(fabric);
        const preview = <TshirtSvgPreview {...reviewTee} color={colour} neckTrimColor={colour} fabricAssignments={{ assignments: { base: fabric.id }, unlinkedGroups: [] }} />;
        return <section key={fabric.id} data-comparison-fabric={fabric.id} data-source-status={record.status} data-source-type={record.sourceType}>
          <h3>{fabric.name}</h3>
          <p className="source-badge">{sourceTypeLabel(record.sourceType)} · {record.status}</p>
          {surface ? <div className={closeup ? 'garment-closeup' : 'garment-normal'}>{closeup ? <div>{preview}</div> : preview}</div> : <div className="unresolved-map"><span><strong>TEXTURE UNAVAILABLE</strong><br />{fabric.id}<br />No valid source; no fabric preview.</span></div>}
          <p><a href={`#source-${fabric.id}`}>Source, normalized map and settings</a></p>
        </section>;
      })}
    </div>
    <h2 id="source-grid-heading">All {FABRIC_LIBRARY.length} fabrics · source-to-garment review grid</h2>
    <nav className="source-index" aria-label="Fabric comparisons">{FABRIC_LIBRARY.map(fabric => <a key={fabric.id} href={`#source-${fabric.id}`}>{fabric.name}</a>)}</nav>
    <div id="fabric-source-grid" aria-labelledby="source-grid-heading">{FABRIC_LIBRARY.map(fabric => {
      const record = fabricSourceRecord(fabric), surface = fabricScanSurface(fabric), material = fabricMaterial(fabric);
      const rawImage = record.source && sourceImages[`../../src/assets/fabrics/${record.source.originalFile}`];
      const procedural = record.sourceType === 'procedural';
      const reverse = fabric.interiorTexture ? fabricScanSurface(fabric, true) : undefined;
      const state = { assignments: { base: fabric.id }, unlinkedGroups: [] };
      const props = { ...reviewTee, color: colour, neckTrimColor: colour, fabricAssignments: state };
      return <section className="source-review" id={`source-${fabric.id}`} key={fabric.id} data-source-status={record.status} data-source-type={record.sourceType}>
        <h2>{fabric.name} <span className="source-badge">{record.status}</span></h2>
        <p><strong>{sourceTypeLabel(record.sourceType)}</strong> · <code>{record.sourceType ?? 'unresolved'}</code> · {record.reason}</p>
        {procedural && <p className="review-warning">Visual review pending — construction-specific procedural approximation, not a verified photograph.</p>}
        <div className="source-comparison">
          <figure><figcaption>1. {procedural ? 'Raw procedural construction map' : 'Original source image'}</figcaption>{rawImage && record.source ? <><img className="source-map" src={rawImage} alt={`${fabric.name}: ${procedural ? 'raw procedural construction map' : 'original source image'}`} loading="lazy" /><p>{record.source.page ? <a href={record.source.page}>{record.source.provider}</a> : record.source.provider} · {record.source.licensePage ? <a href={record.source.licensePage}>{record.source.license}</a> : record.source.license}</p></> : <div className="unresolved-map">UNRESOLVED — raw source image is not bundled.</div>}</figure>
          <figure><figcaption>2. Normalized neutral-alpha map</figcaption>{surface ? <><img className="source-map normalized-map" src={surface.image} alt={`${fabric.name}: normalized ${procedural ? 'procedural' : 'source'} relief map`} loading="lazy" /><p>Map shown at full strength here; garment uses {Math.round(surface.opacity * 100)}%.</p></> : <div className="unresolved-map">UNRESOLVED — no material map for this construction.</div>}</figure>
          <figure><figcaption>3. Garment · 296px normal zoom</figcaption>{surface ? <><div className="garment-normal"><TshirtSvgPreview {...props} /></div><p>Body assignment only; sleeves and neck unchanged.</p></> : <div className="unresolved-map">UNRESOLVED — cannot preview {fabric.name} without a source texture.</div>}</figure>
          <figure><figcaption>4. Same garment · 4× body crop</figcaption>{surface ? <><div className="garment-closeup"><div><TshirtSvgPreview {...props} /></div></div><p>{procedural ? 'Procedural construction relief' : 'Source material relief'} beneath unchanged construction ink.</p></> : <div className="unresolved-map">UNRESOLVED — close-up unavailable for {fabric.id}.</div>}</figure>
        </div>
        <details><summary>Material settings, recipe and provenance</summary>
          <p>{material.family} · {material.structure} · {material.direction}</p>
          <p>Scale: {material.textureScale} garment units per swatch · tiling density: {material.tilingDensity} · opacity: {material.textureOpacity} · contrast: {material.contrast} · brightness correction: {material.brightnessCorrection} · direction rotation: {material.rotation}° · roughness: {material.roughness} · sheen impression: {material.sheen} · thickness: {material.thickness}.</p>
          {surface && <p>Rendered repeat: {surface.repeat} garment units · effective opacity: {surface.opacity} · brightness correction: {surface.brightnessCorrection} · rotation: {surface.rotation}°.</p>}
          <p>{procedural ? 'Procedural relief and provisional material settings require visual approval; roughness and sheen are descriptive metadata, not measured capture properties.' : material.calibrated ? 'Calibrated for the bundled source map. No artificial lighting is added.' : 'Provisional metadata only. Changing opacity cannot repair a missing source.'}</p>
          <p>Recommended parts (not restrictions): {material.recommendedUses.join(', ')}. Composition/weight: {fabric.composition}, {fabric.gsm} GSM — preset specifications, not measured source properties.</p>
          {record.procedural && <><p>Generator: <code>{record.procedural.generator}</code> · version: {record.procedural.version} · seed: <code>{record.procedural.seed}</code></p><p>Recipe: <code>{typeof record.procedural.recipe === 'string' ? record.procedural.recipe : JSON.stringify(record.procedural.recipe)}</code></p></>}
          {record.source && <><p>{record.source.constructionEvidence} {record.source.evidenceUrl && <a href={record.source.evidenceUrl}>{procedural ? 'Construction reference (not source capture)' : 'Identity / source evidence'}</a>}</p><p>Raw source: <code>{record.source.originalFile}</code><br />Normalized map: <code>{record.source.normalizedFile}</code></p><p>Source SHA256: <code>{record.source.sourceSha256}</code><br />Normalized SHA256: <code>{record.source.normalizedSha256}</code></p></>}
          {fabric.interiorTexture && <figure className="reverse-review"><figcaption>Dedicated reverse · {fabric.interiorTexture} · {reverse ? `${reverse.sourceType} · ${reverse.sourceStatus}` : 'unresolved'}</figcaption>{reverse ? <><img className="source-map normalized-map" src={reverse.image} alt={`${fabric.name}: separate ${fabric.interiorTexture} reverse map`} loading="lazy" /><p>{record.reverse?.description} Exterior previews above use the face map, never this reverse.</p><p><code>{record.reverse?.normalizedFile}</code><br />SHA256: <code>{record.reverse?.normalizedSha256}</code></p></> : <div className="unresolved-map">UNRESOLVED — no dedicated reverse map available.</div>}</figure>}
        </details>
      </section>;
    })}</div>
    <details><summary>Source search limitations</summary>{FABRIC_SOURCE_RESEARCH.map(item => <p key={item.provider}><a href={item.url}>{item.provider}</a>: {item.result}</p>)}</details>
    <details><summary>Existing assignment / construction regression examples</summary><div className="fabric-review-grid">{cases().flatMap((item, index) => {
      const parts = fabricPartsFromLayers(resolveGarmentLayers(item.props), item.props.garmentType);
      const assignment = applyFabricPreset(undefined, parts, item.preset);
      const firstSleeve = parts.find(part => part.group === 'sleeves');
      const mixed = firstSleeve ? assignFabric(setFabricGroupLinked(assignment, parts, 'sleeves', false), parts, firstSleeve.id, 'denim-twill') : assignment;
      return [{ name: 'Original colour / no fabric', state: undefined }, { name: 'Saved assignments · procedural review pending', state: assignment }, { name: 'Unlinked sleeve → verified denim', state: mixed }].map(({ name, state }) => <section key={`${index}-${name}`}><h2>{item.label}</h2><p>{name}</p><div style={{ height: 370, position: 'relative' }}><TshirtSvgPreview {...item.props} fabricAssignments={state} /></div></section>);
    })}</div></details>
  </>;
}

export function mountFabricReview(host: HTMLElement, closeup = false) {
  createRoot(host).render(<FabricSourceReview closeup={closeup} />);
}
