import { GARMENT_DETAIL_ASSETS, GARMENT_DETAIL_OPTIONS, createGarmentDetail, detailAsset, detailPlacement, detailSvg, resizeGarmentDetail,
  type GarmentDetail, type GarmentDetailType } from '../../src/app/data/garmentDetails';

export async function verifyGarmentDetails() {
  const details: GarmentDetail[] = [];
  const bounds = { minX: 400, minY: 100, maxX: 1600, maxY: 1900 };
  let placements = 0;
  const cases = (Object.keys(GARMENT_DETAIL_ASSETS) as GarmentDetailType[]).flatMap(type => {
    if (GARMENT_DETAIL_OPTIONS[type].length !== 5) throw new Error(`${type}: expected five options`);
    return [undefined, ...GARMENT_DETAIL_OPTIONS[type].map(option => option.id)].map(variant => ({ type, variant }));
  });
  const uniqueSvgs = new Set<string>();
  for (const { type, variant } of cases) {
    const detail = createGarmentDetail(type, details, '#CC2D24', variant);
    details.push(detail);
    const asset = detailAsset(detail);
    if (variant) {
      if (asset.svg === GARMENT_DETAIL_ASSETS[type].svg || uniqueSvgs.has(asset.svg)) throw new Error(`${variant}: missing or duplicated asset`);
      uniqueSvgs.add(asset.svg);
    }
    const duplicate = createGarmentDetail(type, details, detail.fill);
    if (duplicate.id === detail.id || duplicate.name === detail.name) throw new Error(`${type}: duplicate identity`);
    const svg = detailSvg(detail);
    const recolored = detailSvg({ ...detail, fill: '#112233', outline: '#445566', stitch: '#778899', hardware: '#AABBCC' });
    for (const expected of ['#112233', '#445566', ...(asset.stitch ? ['#778899'] : []), ...(asset.hardware ? ['#AABBCC'] : [])]) {
      if (!recolored.includes(expected)) throw new Error(`${variant ?? type}: missing colour channel ${expected}`);
    }
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (document.querySelector('parsererror') || svg.includes('var(')) throw new Error(`${type}: invalid SVG`);
    if (document.querySelector('image, text, script, filter, linearGradient, radialGradient')) throw new Error(`${type}: non-outline content`);
    const viewBox = document.documentElement.getAttribute('viewBox')!.split(' ').map(Number);
    if (Math.abs(viewBox[2] / viewBox[3] - asset.ratio) > .00001) throw new Error(`${type}: viewBox ratio mismatch`);
    if (!svg.includes('#CC2D24')) throw new Error(`${type}: fill missing`);
    const image = new Image();
    image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 240;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0, 200, 240);
    const pixels = context.getImageData(0, 0, 200, 240).data;
    if (!pixels.some((value, index) => index % 4 === 3 && value > 0)) throw new Error(`${type}: blank render`);
    if (pixels[3] !== 0) throw new Error(`${type}: background is not transparent`);
    for (const x of [-10, .5, 10]) {
      for (const y of [-10, .5, 10]) {
        const placed = detailPlacement({ ...detail, x, y }, bounds);
        const centerX = placed.left + placed.width / 2;
        const centerY = placed.top + placed.height / 2;
        if (centerX < 0 || centerY < 0 || centerX > 2048 || centerY > 2048) {
          throw new Error(`${type}: center escaped canvas`);
        }
        placements++;
      }
    }
    for (const position of [{ x: .5, y: .04 }, { x: -.2, y: .2 }, { x: .7, y: .9 }]) {
      const placed = detailPlacement({ ...detail, ...position }, bounds);
      if (Math.abs(placed.x - position.x) > .00001 || Math.abs(placed.y - position.y) > .00001) throw new Error(`${type}: position snapped`);
    }
    const original = detailPlacement(detail, bounds);
    for (const factor of [.5, 1.7]) {
      const resized = resizeGarmentDetail(detail, bounds, 1, 1, original.width * (factor - 1), original.height * (factor - 1));
      const placed = detailPlacement(resized, bounds);
      if (Math.abs(resized.scale - factor) > .00001 || Math.abs(placed.width / placed.height - asset.ratio) > .00001) throw new Error(`${type}: distorted scale`);
      if (Math.abs(placed.left - original.left) > .00001 || Math.abs(placed.top - original.top) > .00001) throw new Error(`${type}: resize anchor moved`);
    }
    const legacy = { ...detail, scale: undefined } as unknown as GarmentDetail;
    if (detailPlacement(legacy, bounds).width !== original.width) throw new Error(`${type}: legacy scale changed`);
    if (!variant && asset.svg !== GARMENT_DETAIL_ASSETS[type].svg) throw new Error(`${type}: legacy asset changed`);
    if (detailSvg({ ...detail, fill: '"><script>' }).includes('<script>')) throw new Error(`${type}: unsafe colour`);
  }
  const restored = JSON.parse(JSON.stringify(details));
  if (JSON.stringify(restored) !== JSON.stringify(details)) throw new Error('State serialization changed details');
  for (const detail of restored as GarmentDetail[]) {
    if (detailSvg(detail) !== detailSvg(details.find(original => original.id === detail.id)!)) throw new Error('Restored variant changed');
  }
  return { assets: details.length, variants: uniqueSvgs.size, decodedAndPainted: true, colorChannels: true, placements, freePositions: true, proportionalResizing: true, uniqueInstances: true, serialized: true };
}