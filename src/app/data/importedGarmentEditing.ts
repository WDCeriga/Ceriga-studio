import { contours } from 'd3-contour';
import type { ConstructionBoundary, ImportedGarment, ImportedPart } from './importedGarment';

const size = 1024;
type Point = [number, number];

async function raster(svg: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const image = new Image();
  image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  await image.decode();
  context.drawImage(image, 0, 0, size, size);
  return { canvas, context };
}

function trace(context: CanvasRenderingContext2D, ink = false) {
  const pixels = context.getImageData(0, 0, size, size).data;
  const values = new Uint8Array(size * size);
  for (let index = 0; index < values.length; index++) values[index] = pixels[index * 4 + 3] > 127 ? 1 : 0;
  const outline = contours().size([size, size]).thresholds([.5])(values)[0];
  const path = outline.coordinates.map(polygon => polygon.map(ring => `M${ring.map(([pointX, pointY]) => `${(pointX * 20).toFixed(1)},${((size - pointY) * 20).toFixed(1)}`).join('L')}Z`).join('')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><g transform="translate(0,2048) scale(0.1,-0.1)" fill="${ink ? '#141414' : '#000000'}" stroke="none" fill-rule="evenodd"><path d="${path}"/></g></svg>`;
}

function polygonMask(points: Point[]) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.beginPath();
  points.forEach(([pointX, pointY], index) => index ? context.lineTo(pointX / 2, pointY / 2) : context.moveTo(pointX / 2, pointY / 2));
  context.closePath();
  context.fill();
  return canvas;
}

function constructionGeometry(context: CanvasRenderingContext2D) {
  const pixels = context.getImageData(0, 0, size, size).data;
  const values = new Uint8Array(size * size);
  for (let index = 0; index < values.length; index++) values[index] = pixels[index * 4 + 3] > 127 ? 1 : 0;
  const polygons = contours().size([size, size]).thresholds([.5])(values)[0].coordinates;
  if (polygons.length !== 1 || polygons[0].length !== 1) throw new Error('A construction piece must remain continuous, without invented holes.');
  const outline = polygons[0][0].map(([horizontal, vertical]): Point => [horizontal / size, vertical / size]);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const edge = canvas.getContext('2d')!;
  const image = edge.createImageData(size, size);
  for (let index = 0; index < values.length; index++) {
    const column = index % size;
    if (values[index] && (column === 0 || column === size - 1 || !values[index - 1] || !values[index + 1] || !values[index - size] || !values[index + size])) image.data[index * 4 + 3] = 255;
  }
  edge.putImageData(image, 0, 0);
  return { outline, constructionSvg: trace(edge, true) };
}

async function maskedPart(part: ImportedPart, mask: HTMLCanvasElement, keep: boolean) {
  const geometry = await raster(part.svg);
  geometry.context.globalCompositeOperation = keep ? 'destination-in' : 'destination-out';
  geometry.context.drawImage(mask, 0, 0);
  const pixels = geometry.context.getImageData(0, 0, size, size).data;
  let minX = size, minY = size, maxX = 0, maxY = 0, area = 0;
  for (let index = 0; index < size * size; index++) if (pixels[index * 4 + 3] > 127) {
    const column = index % size, row = Math.floor(index / size);
    minX = Math.min(minX, column); minY = Math.min(minY, row);
    maxX = Math.max(maxX, column + 1); maxY = Math.max(maxY, row + 1); area++;
  }
  if (area < 6) throw new Error('This boundary would erase a part. Merge it explicitly instead.');
  const clippedInk = async (svg: string) => {
    const ink = await raster(svg);
    ink.context.globalCompositeOperation = 'destination-in';
    ink.context.drawImage(geometry.canvas, 0, 0);
    return trace(ink.context, true);
  };
  return { ...part, svg: trace(geometry.context), constructionSvg: await clippedInk(part.constructionSvg), stitchSvg: await clippedInk(part.stitchSvg),
    area, geometryBounds: [minX / size, minY / size, maxX / size, maxY / size],
    measurement: { unit: 'relative' as const, width: (maxX - minX) / size, height: (maxY - minY) / size } };
}

export function reviseImportedGarment(garment: ImportedGarment, parts: ImportedPart[]): ImportedGarment {
  const geometryChanged = parts.length !== garment.parts.length || parts.some(part => {
    const previous = garment.parts.find(candidate => candidate.id === part.id);
    return !previous || previous.svg !== part.svg || JSON.stringify(previous.outline) !== JSON.stringify(part.outline);
  });
  return { ...garment, parts, partCount: parts.length, manifest: { ...garment.manifest, regions: [...parts.map(({ svg, constructionSvg, stitchSvg, ...part }) => part), ...(garment.proposedBoundaries ?? [])] },
    measurementCalibration: geometryChanged ? undefined : garment.measurementCalibration,
    revision: (garment.revision ?? 0) + 1, reviewed: false, accepted: false };
}

export async function splitImportedPart(garment: ImportedGarment, id: string, points: Point[], boundary?: ConstructionBoundary) {
  if (garment.constructionVersion === 2 && (!boundary || boundary.boundaryType !== 'seam' || !Number.isFinite(boundary.confidence) || boundary.confidence < .8 || !boundary.evidence.trim())) {
    throw new Error('A split requires source-confirmed seam evidence.');
  }
  if (points.length < 3) throw new Error('A boundary needs at least three points.');
  const part = garment.parts.find(item => item.id === id);
  if (!part) throw new Error('Select a part first.');
  const mask = polygonMask(points);
  const outside = await maskedPart(part, mask, false);
  const inside = await maskedPart(part, mask, true);
  if (garment.constructionVersion === 2) {
    if (part.layerKind !== 'structural') throw new Error('Detail layers cannot be split into fabric.');
    for (const piece of [inside, outside]) {
      Object.assign(piece, constructionGeometry((await raster(piece.svg)).context), { boundary, bounds: piece.geometryBounds });
    }
  }
  inside.id = `region-${crypto.randomUUID()}`;
  inside.name = `${part.name} split`;
  inside.attachmentTo = part.id;
  inside.symmetryPartner = null;
  const parts = garment.parts.flatMap(item => item.id === id ? [outside, inside] : [item]).map((item, order) => ({ ...item, layerOrder: order }));
  return reviseImportedGarment(garment, parts);
}

export async function mergeImportedParts(garment: ImportedGarment, id: string, otherId: string) {
  const first = garment.parts.find(part => part.id === id), second = garment.parts.find(part => part.id === otherId);
  if (!first || !second || id === otherId) throw new Error('Select two different parts to merge.');
  if (first.view !== second.view) throw new Error('Front and back geometry must remain separate.');
  if (garment.constructionVersion === 2 && first.layerKind !== second.layerKind) throw new Error('Structural pieces and detail layers cannot be merged.');
  const mergeSvg = async (field: 'svg' | 'constructionSvg' | 'stitchSvg') => {
    const target = await raster(first[field]), source = await raster(second[field]);
    target.context.drawImage(source.canvas, 0, 0);
    return trace(target.context, field !== 'svg');
  };
  const bounds = [Math.min(first.geometryBounds[0], second.geometryBounds[0]), Math.min(first.geometryBounds[1], second.geometryBounds[1]),
    Math.max(first.geometryBounds[2], second.geometryBounds[2]), Math.max(first.geometryBounds[3], second.geometryBounds[3])];
  const merged = { ...first, svg: await mergeSvg('svg'), constructionSvg: await mergeSvg('constructionSvg'), stitchSvg: await mergeSvg('stitchSvg'),
    area: first.area + second.area, geometryBounds: bounds, symmetryPartner: null,
    attachmentTo: first.attachmentTo === otherId ? second.attachmentTo === id ? null : second.attachmentTo : first.attachmentTo,
    measurement: { unit: 'relative' as const, width: bounds[2] - bounds[0], height: bounds[3] - bounds[1] } };
  if (garment.constructionVersion === 2) Object.assign(merged, constructionGeometry((await raster(merged.svg)).context), { bounds });
  return reviseImportedGarment(garment, garment.parts.filter(part => part.id !== otherId).map((part, order) => ({ ...(part.id === id ? merged : part), layerOrder: order,
    attachmentTo: part.id !== id && part.attachmentTo === otherId ? id : part.id === id ? merged.attachmentTo : part.attachmentTo,
    symmetryPartner: part.symmetryPartner === id || part.symmetryPartner === otherId ? null : part.symmetryPartner })));
}

export async function reshapeImportedPart(garment: ImportedGarment, id: string, points: Point[]) {
  if (garment.constructionVersion === 2) throw new Error('Free geometric repartitioning is disabled. Use a source-confirmed seam split or merge.');
  if (points.length < 3) throw new Error('A boundary needs at least three points.');
  const part = garment.parts.find(item => item.id === id);
  if (!part) throw new Error('Select a part first.');
  const whole = await raster(garment.parts[0].svg);
  for (const item of garment.parts.slice(1)) whole.context.drawImage((await raster(item.svg)).canvas, 0, 0);
  const selection = polygonMask(points);
  whole.context.globalCompositeOperation = 'destination-in';
  whole.context.drawImage(selection, 0, 0);
  const combinedInk = async (field: 'constructionSvg' | 'stitchSvg') => {
    const combined = await raster(garment.parts[0][field]);
    for (const item of garment.parts.slice(1)) combined.context.drawImage((await raster(item[field])).canvas, 0, 0);
    return trace(combined.context, true);
  };
  const enlarged = { ...part, svg: trace(whole.context), constructionSvg: await combinedInk('constructionSvg'), stitchSvg: await combinedInk('stitchSvg') };
  const replacement = await maskedPart(enlarged, selection, true);
  const released = await raster(part.svg);
  released.context.globalCompositeOperation = 'destination-out';
  released.context.drawImage(selection, 0, 0);
  if (released.context.getImageData(0, 0, size, size).data.some((value, index) => index % 4 === 3 && value > 127)) {
    throw new Error('Boundary must enclose the existing part. Split then merge to move a boundary inward.');
  }
  const parts = await Promise.all(garment.parts.map(item => item.id === id ? replacement : maskedPart(item, whole.canvas, false)));
  return reviseImportedGarment(garment, parts);
}