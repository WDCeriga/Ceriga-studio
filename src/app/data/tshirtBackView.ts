import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import { getPotraceSvgBBox } from '../lib/tshirtSvgUtils';

const neckBounds: Record<string, { left: number; right: number; top: number; bottom: number }> = {
  slim: { left: 820, right: 1233.3, top: 192, bottom: 437.3 },
  regular: { left: 809.3, right: 1240, top: 296, bottom: 521.3 },
  boxy: { left: 809.3, right: 1241.3, top: 282.7, bottom: 508 },
  oversized: { left: 809.3, right: 1241.3, top: 296, bottom: 521.3 },
};

function svg(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><g transform="translate(0,2048) scale(0.1,-0.1)" fill="#000000">${content}</g></svg>`;
}

function clearNeck(raw: string, path: string, id: string, inside = false): string {
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path fill="white" fill-rule="evenodd" d="${inside ? '' : 'M0,0H2048V2048H0Z '}${path}"/></svg>`;
  const mask = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:alpha"><image href="data:image/svg+xml;base64,${btoa(maskSvg)}" width="2048" height="2048"/></mask></defs>`;
  return raw.replace(/(<svg[^>]*>)/, `$1${mask}<g mask="url(#${id})">`).replace(/<\/svg>\s*$/, '</g></svg>');
}

const rearCollarCache = new Map<string, { upper: number[]; lower: number[];
  side: { inset: number; vertical: number }[]; ribPitch: number; ribWidth: number;
  collarWeight: number; shoulderWeight: number }>();

function rearCollarProfile(neck: ResolvedGarmentLayer, left: number, right: number, outline: ResolvedGarmentLayer) {
  const cached = rearCollarCache.get(neck.assetId);
  if (cached) return cached;
  const documentSvg = new DOMParser().parseFromString(neck.svgRaw, 'image/svg+xml');
  const mounted = document.importNode(documentSvg.documentElement, true);
  mounted.setAttribute('style', 'position:fixed;left:-10000px;top:0;visibility:hidden');
  document.body.appendChild(mounted);
  const paths = Array.from(mounted.querySelectorAll('path'));
  const bounds = getPotraceSvgBBox(neck.svgRaw)!;
  const upper: number[] = [];
  const lower: number[] = [];
  for (let index = 0; index <= 64; index++) {
    const horizontal = Math.max(bounds.minX + (bounds.maxX - bounds.minX) * .12,
      Math.min(bounds.maxX - (bounds.maxX - bounds.minX) * .12, left + (right - left) * index / 64));
    let start = bounds.minY;
    const contains = (vertical: number) => paths.some(path => path.isPointInFill(new DOMPoint(horizontal * 10, (2048 - vertical) * 10)));
    while (start < bounds.maxY && !contains(start)) start += 1;
    let finish = start + 1;
    while (finish < bounds.maxY && (contains(finish) || contains(finish + 1))) finish += 1;
    upper.push(start);
    lower.push(finish);
  }
  const smooth = (values: number[]) => values.map((_, index) => {
    const neighbors = values.slice(Math.max(0, index - 3), Math.min(values.length, index + 4));
    return neighbors.reduce((total, value) => total + value, 0) / neighbors.length;
  });
  const fitCurve = (values: number[]) => {
    const filtered = smooth(values);
    const center = filtered[32];
    const quadratic = Math.min(0, ((filtered[24] + filtered[40]) / 2 - center) * 16);
    const depth = Math.min(center - (bounds.minY + 2), -quadratic);
    return values.map((_, index) => {
      const position = (index - 32) / 32;
      return center - depth * position * position;
    });
  };
  const rearUpper = fitCurve(upper);
  let thickness = smooth(lower)[32] - smooth(upper)[32];
  if (neck.displayName.toLowerCase().includes('thin')) {
    const horizontal = bounds.centerX;
    let vertical = bounds.maxY - 2;
    const contains = (position: number) => paths.some(path => path.isPointInFill(new DOMPoint(horizontal * 10, (2048 - position) * 10)));
    while (vertical > bounds.minY && !contains(vertical)) vertical--;
    const bottom = vertical;
    while (vertical > bounds.minY && contains(vertical)) vertical--;
    thickness = Math.min(thickness, Math.max(10, bottom - vertical));
  }
  const sourceThickness = smooth(lower)[32] - smooth(upper)[32];
  const side = Array.from({ length: 9 }, (_, index) => {
    const vertical = rearUpper[0] + thickness * index / 8;
    const sampleY = Math.max(bounds.minY + 2, vertical);
    const contains = (horizontal: number) => paths.some(path => path.isPointInFill(new DOMPoint(horizontal * 10, (2048 - sampleY) * 10)));
    let sourceLeft = bounds.minX;
    let sourceRight = bounds.maxX;
    while (sourceLeft < bounds.centerX && !contains(sourceLeft)) sourceLeft += .5;
    while (sourceRight > bounds.centerX && !contains(sourceRight)) sourceRight -= .5;
    return { inset: ((sourceLeft - bounds.minX) + (bounds.maxX - sourceRight)) / 2, vertical };
  });
  mounted.innerHTML = new DOMParser().parseFromString(outline.svgRaw, 'image/svg+xml').documentElement.innerHTML;
  const inkPaths = Array.from(mounted.querySelectorAll('path'));
  const runs: { start: number; width: number }[] = [];
  let start: number | undefined;
  for (let horizontal = left + (right - left) * .25; horizontal <= right - (right - left) * .25; horizontal += .5) {
    const index = Math.round((horizontal - left) / (right - left) * 64);
    const vertical = rearUpper[index] + sourceThickness / 2;
    const ink = inkPaths.some(path => path.isPointInFill(new DOMPoint(horizontal * 10, (2048 - vertical) * 10)));
    if (ink && start === undefined) start = horizontal;
    if (!ink && start !== undefined) {
      runs.push({ start, width: horizontal - start });
      start = undefined;
    }
  }
  const median = (values: number[], fallback: number) => values.length
    ? values.sort((first, second) => first - second)[Math.floor(values.length / 2)] : fallback;
  const ribPitch = Math.max(5, Math.min(12, median(runs.slice(1).map((run, index) => run.start - runs[index].start), 7)));
  const ribWidth = Math.max(1.2, Math.min(2.8, median(runs.map(run => run.width), 1.8)));
  const edgeAt = (horizontal: number) => {
    const contains = (vertical: number) => inkPaths.some(path => path.isPointInFill(new DOMPoint(horizontal * 10, (2048 - vertical) * 10)));
    let vertical = bounds.minY - 30;
    while (vertical < bounds.maxY && !contains(vertical)) vertical += .25;
    const start = vertical;
    while (vertical < bounds.maxY && contains(vertical)) vertical += .25;
    return { start, width: vertical - start };
  };
  const edgeWeight = (horizontal: number) => {
    const edge = edgeAt(horizontal);
    const slope = (edgeAt(horizontal + 2).start - edgeAt(horizontal - 2).start) / 4;
    return edge.width / Math.sqrt(1 + slope * slope);
  };
  const collarWeight = median(Array.from({ length: 41 }, (_, index) =>
    edgeWeight(bounds.centerX - 50 + index * 2.5)), 8);
  const shoulderWeight = median(Array.from({ length: 17 }, (_, index) =>
    [edgeWeight(bounds.minX - 16 - index * 2), edgeWeight(bounds.maxX + 16 + index * 2)]).flat(), collarWeight);
  const profile = { upper: rearUpper, lower: rearUpper.map(vertical => vertical + thickness), side, ribPitch, ribWidth,
    collarWeight, shoulderWeight };
  mounted.remove();
  rearCollarCache.set(neck.assetId, profile);
  return profile;
}

const shoulderCache = new Map<string, { left: number; right: number; leftSlope: number; rightSlope: number }>();

function rearShoulders(base: ResolvedGarmentLayer, left: number, right: number, top: number) {
  const key = `${base.assetId}:${left}:${right}`;
  const cached = shoulderCache.get(key);
  if (cached) return cached;
  const mounted = document.importNode(new DOMParser().parseFromString(base.svgRaw, 'image/svg+xml').documentElement, true);
  mounted.setAttribute('style', 'position:fixed;left:-10000px;top:0;visibility:hidden');
  document.body.appendChild(mounted);
  try {
    const paths = Array.from(mounted.querySelectorAll('path'));
    const edge = (horizontal: number) => {
      let vertical = Math.max(0, top - 100);
      while (vertical < top + 250 && !paths.some(path => path.isPointInFill(new DOMPoint(horizontal * 10, (2048 - vertical) * 10)))) vertical += .5;
      return vertical;
    };
    const leftEdge = edge(left);
    const rightEdge = edge(right);
    const result = { left: leftEdge, right: rightEdge,
      leftSlope: (leftEdge - edge(left - 6)) / 6,
      rightSlope: (edge(right + 6) - rightEdge) / 6 };
    shoulderCache.set(key, result);
    return result;
  } finally {
    mounted.remove();
  }
}

export function withTshirtBackView(
  selectedLayers: ResolvedGarmentLayer[], fit: string,
): ResolvedGarmentLayer[] {
  const selectedNeck = selectedLayers.find(layer => layer.id === 'neck');
  if (!selectedNeck) return selectedLayers;
  const frontBounds = getPotraceSvgBBox(selectedNeck.svgRaw)!;
  const halfWidth = (frontBounds.maxX - frontBounds.minX) / 2;
  const left = 1024 - halfWidth;
  const right = 1024 + halfWidth;
  const { bottom } = neckBounds[fit] ?? neckBounds.slim;
  const width = right - left;
  const collar = selectedNeck.displayName.toLowerCase();
  const prefix = `rear-${selectedNeck.assetId.replace(/[^a-z0-9]/gi, '-')}`;
  const point = (horizontal: number, vertical: number, local = false) => local
    ? `${horizontal * 10},${(2048 - vertical) * 10}` : `${horizontal},${vertical}`;
  const selectedOutline = selectedLayers.find(layer => layer.id === 'outline')!;
  const profile = rearCollarProfile(selectedNeck, left, right, selectedOutline);
  const lowerInset = profile.side[8].inset;
  const upperInset = profile.side[0].inset;
  const profileCurve = (values: number[], local = false) => values.map((vertical, index) =>
    `${index === 0 ? 'M' : 'L'}${point(left + lowerInset + (width - 2 * lowerInset) * index / 64, vertical, local)}`).join(' ');
  const polo = collar.includes('polo');
  const bandPoint = (index: number, lower: boolean, local = false) => {
    const inset = lower ? lowerInset : upperInset;
    return point(left + inset + (width - inset * 2) * index / 64,
      (lower ? profile.lower : profile.upper)[index], local);
  };
  const bandShape = (local = false) =>
    `${profile.upper.map((_, index) => `${index === 0 ? 'M' : 'L'}${bandPoint(index, false, local)}`).join(' ')} ${profile.side.slice(1).map(sample => `L${point(right - sample.inset, sample.vertical, local)}`).join(' ')} ${profile.lower.map((_, index) => {
      const reverse = 64 - index;
      return `L${bandPoint(reverse, true, local)}`;
    }).join(' ')} ${profile.side.slice(0, -1).reverse().map(sample => `L${point(left + sample.inset, sample.vertical, local)}`).join(' ')}Z`;
  const regionLeft = Math.min(left, frontBounds.minX) - 8;
  const regionRight = Math.max(right, frontBounds.maxX) + 8;
  const regionBottom = Math.max(bottom, frontBounds.maxY) + 24;
  const shoulders = rearShoulders(selectedLayers.find(layer => layer.id === 'base')!, regionLeft, regionRight, frontBounds.minY);
  const attachment = profile.side.reduce((outermost, sample) => sample.inset < outermost.inset ? sample : outermost);
  const shoulderCurve = (side: 'left' | 'right', local = false) => {
    const isLeft = side === 'left';
    const outer = isLeft ? regionLeft : regionRight;
    const inner = isLeft ? left + attachment.inset : right - attachment.inset;
    const span = (inner - outer) / 3;
    const edge = shoulders[side];
    const lower = attachment.vertical;
    const controlOuter = point(outer + span, edge + shoulders[isLeft ? 'leftSlope' : 'rightSlope'] * span, local);
    const controlInner = point(inner - span, lower - shoulders[isLeft ? 'leftSlope' : 'rightSlope'] * span, local);
    return isLeft ? `M${point(outer, edge, local)} C${controlOuter} ${controlInner} ${point(inner, lower, local)}`
      : `C${controlInner} ${controlOuter} ${point(outer, edge, local)}`;
  };
  const bodyEdge = profile.lower.map((vertical, index) => vertical - 3 * Math.min(index, 64 - index, 1));
  const bodyTop = (local = false) => `${shoulderCurve('left', local)} ${profileCurve(bodyEdge, local).replace(/^M/, 'L')} L${point(right - attachment.inset, attachment.vertical, local)} ${shoulderCurve('right', local)}`;
  const patch = `${bodyTop(true)} L${point(regionRight, regionBottom, true)} L${point(regionLeft, regionBottom, true)}Z`;
  const aboveBody = `${bodyTop()} L${regionRight},0H${regionLeft}Z`;
  const cut = `M${regionLeft},0H${regionRight}V${regionBottom}H${regionLeft}Z`;
  return selectedLayers.filter(layer => layer.id !== 'innerBackNeck').map(layer => {
    if (layer.id === 'base') {
      const filled = layer.svgRaw.replace('</g>', `<path d="${patch}"/></g>`);
      return { ...layer, assetId: `${layer.assetId}:back`, svgRaw: clearNeck(filled, aboveBody, `${prefix}-body`) };
    }
    if (layer.id === 'neck') return { ...layer,
      assetId: `${layer.assetId}:back`, svgRaw: svg(`<path d="${bandShape(true)}"/>`) };
    if (layer.id === 'outline' || layer.id === 'stitching') {
      const stitching = layer.id === 'stitching';
      const ribbed = !polo && !collar.includes('scoop');
      const ribs: string[] = [];
      if (!stitching && ribbed) {
        const ribWidth = width - 2 * Math.min(...profile.side.map(sample => sample.inset));
        const count = Math.max(2, Math.round(ribWidth / profile.ribPitch));
        for (let rib = 0; rib < count; rib++) {
          const horizontal = 1024 - ribWidth / 2 + ribWidth * (rib + .5) / count;
          const sampleCurve = (values: number[], inset: number) => {
            const position = Math.max(0, Math.min(64, (horizontal - left - inset) / (width - 2 * inset) * 64));
            const index = Math.min(63, Math.floor(position));
            const fraction = position - index;
            return values[index] * (1 - fraction) + values[index + 1] * fraction;
          };
          const upper = sampleCurve(profile.upper, upperInset);
          const lower = sampleCurve(profile.lower, lowerInset);
          ribs.push(`M${horizontal},${upper + 2}L${horizontal},${lower - 2}`);
        }
      }
      const ribInk = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><path data-rear-ribs="true" d="${ribs.join(' ')}" fill="none" stroke="#141414" stroke-width="${profile.ribWidth}"/></svg>`;
      const construction = ribs.length ? clearNeck(ribInk, bandShape(), `${prefix}-ribs`, true) : '';
      const shoulder = `${shoulderCurve('left')} M${right - attachment.inset},${attachment.vertical} ${shoulderCurve('right')}`;
      const ink = stitching
        ? `<path d="${profileCurve(profile.lower.map(vertical => vertical - 5))}" fill="none" stroke="#B0B0B0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="9 9"/>`
        : `${construction}<path data-rear-collar-outline="true" d="${bandShape()}" fill="none" stroke="#141414" stroke-width="${profile.collarWeight}" stroke-linecap="round" stroke-linejoin="round"/><path data-rear-shoulder-outline="true" d="${shoulder}" fill="none" stroke="#141414" stroke-width="${profile.shoulderWeight}" stroke-linecap="round" stroke-linejoin="round"/>`;
      return { ...layer, assetId: `${layer.assetId}:back`,
        svgRaw: clearNeck(layer.svgRaw, cut, `${prefix}-${layer.id}`).replace(/<\/svg>\s*$/, `${ink}</svg>`) };
    }
    return layer;
  });
}