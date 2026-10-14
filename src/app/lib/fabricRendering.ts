import type { GarmentFabric } from '../data/garmentFabrics';
import { renderFabricSvg, tintPotraceSvg } from './tshirtSvgUtils';
import { fabricMaterial, fabricScanSurface, hasFabricScanSurface } from './fabricTextureScans';

const NS = 'http://www.w3.org/2000/svg';

function swatchLuminance(color: string): number | undefined {
  const expanded = color.replace(/^#([\da-f])([\da-f])([\da-f])$/i, '#$1$1$2$2$3$3');
  if (!/^#[\da-f]{6}$/i.test(expanded)) return undefined;
  const linear = [1, 3, 5].map(offset => {
    const channel = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}

export function fabricTextureMotif(fabric: GarmentFabric, interior: boolean, intensity = 40, fill = '#000000'): string {
  const surface = fabricScanSurface(fabric, interior);
  if (!surface) return hasFabricScanSurface(fabric, interior)
    ? '<g data-fabric-scan-loading="true"/>'
    : '<text x=".2" y="5" font-size=".7" fill="#805c28" data-fabric-unavailable="true">Texture unavailable</text>';
  const normalizedIntensity = Math.max(0, Math.min(100, intensity));
  const multiplier = normalizedIntensity / 40;
  const brightness = surface.brightnessCorrection * multiplier;
  const correction = brightness ? `<rect width="10" height="10" fill="${brightness < 0 ? '#000' : '#fff'}" opacity="${Math.min(.25, Math.abs(brightness))}" data-fabric-brightness="${brightness}"/>` : '';
  const opacity = Math.min(.82, surface.opacity * multiplier);
  const lightSwatch = (swatchLuminance(fill) ?? 0) >= .55;
  // Embedded neutral-alpha maps survive SVG rasterization/export without network requests.
  const image = `href="${surface.image}" x="0" y="0" width="10" height="10" preserveAspectRatio="none" transform="rotate(${surface.rotation} 5 5)"`;
  if (lightSwatch) {
    const shadowOpacity = Math.min(.82, opacity * 1.2);
    return `<image ${image} opacity="${shadowOpacity}" style="mix-blend-mode:multiply" data-fabric-scan="${surface.source}" data-fabric-source-type="${surface.sourceType}" data-fabric-intensity="${normalizedIntensity}" data-fabric-luminance-response="light-micro-shadow"/>`;
  }
  const reliefOpacity = Math.min(.08, opacity * .25);
  return `${correction}<image ${image} opacity="${opacity}" data-fabric-scan="${surface.source}" data-fabric-source-type="${surface.sourceType}" data-fabric-intensity="${normalizedIntensity}"/><image ${image} opacity="${reliefOpacity}" style="mix-blend-mode:soft-light" data-fabric-luminance-pass="soft-light"/>`;
}

export function fabricPatternScale(fabric: GarmentFabric, viewBoxWidth = 2048, interior = false): number {
  return (fabricScanSurface(fabric, interior)?.repeat ?? fabricMaterial(fabric).textureScale) / 10 * viewBoxWidth / 2048;
}

function localMatrix(value: string): DOMMatrix {
  let matrix = new DOMMatrix();
  for (const match of value.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const n = match[2].trim().split(/[\s,]+/).map(Number);
    if (!n.length || n.some(number => !Number.isFinite(number))) continue;
    switch (match[1]) {
      case 'matrix': if (n.length === 6) matrix = matrix.multiply(new DOMMatrix(n)); break;
      case 'translate': matrix = matrix.translate(n[0], n[1] ?? 0); break;
      case 'scale': matrix = matrix.scale(n[0], n[1] ?? n[0]); break;
      case 'rotate': matrix = matrix.translate(n[1] ?? 0, n[2] ?? 0).rotate(n[0]).translate(-(n[1] ?? 0), -(n[2] ?? 0)); break;
      case 'skewX': matrix = matrix.skewX(n[0]); break;
      case 'skewY': matrix = matrix.skewY(n[0]); break;
    }
  }
  return matrix;
}

function shapeMatrix(shape: Element, root: Element): DOMMatrix {
  const ancestors: Element[] = [];
  for (let element: Element | null = shape; element && element !== root; element = element.parentElement) ancestors.unshift(element);
  return ancestors.reduce((matrix, element) => matrix.multiply(localMatrix(element.getAttribute('transform') ?? '')), new DOMMatrix());
}

function inheritedFill(shape: Element, root: Element): string {
  for (let element: Element | null = shape; element; element = element.parentElement) {
    const fill = (element as SVGElement).style?.fill || element.getAttribute('fill');
    if (fill) return fill;
    if (element === root) break;
  }
  return '#000';
}

/**
 * A paint server fills the existing solid paths themselves: their holes, fill rules,
 * masks and clips are the texture mask. No silhouette clone, displacement or bounding
 * rectangle can leak past the fabric. Strokes and later construction ink stay on top.
 */
export function renderTexturedFabricSvg(
  raw: string, fill: string, fabric: GarmentFabric | undefined, id: string, interior = false, edgeSealWidth = 0, intensity = 40,
): string {
  const markup = edgeSealWidth ? tintPotraceSvg(raw, fill, 'solid', false, edgeSealWidth) : renderFabricSvg(raw, fill);
  if (!fabric || typeof DOMParser === 'undefined' || typeof DOMMatrix === 'undefined') return markup;
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) return markup;
  const root = parsed.documentElement;
  const primary = root.querySelector('g[transform]');
  const shapes = Array.from(root.querySelectorAll('path,polygon,rect,circle,ellipse')).filter(shape => {
    if (shape.closest('defs,clipPath,mask,[data-fabric-texture]')) return false;
    const source = shape.closest('[data-shared-fabric="true"]') ?? primary;
    if (source && (!source.contains(shape) || inheritedFill(shape, root) !== inheritedFill(source, root))) return false;
    return !/^(none|transparent|url\()/i.test(inheritedFill(shape, root));
  });
  if (!shapes.length) return markup;
  const defs = parsed.createElementNS(NS, 'defs');
  const prefix = `fabric-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const patterns = new Map<string, string>();
  for (const shape of shapes) {
    const inverse = shapeMatrix(shape, root).inverse();
    if (![inverse.a, inverse.b, inverse.c, inverse.d, inverse.e, inverse.f].every(Number.isFinite)) continue;
    const transform = inverse.scale(fabricPatternScale(fabric, 2048, interior)).toString();
    const baseColor = inheritedFill(shape, root);
    const key = `${transform}|${baseColor}`;
    let patternId = patterns.get(key);
    if (!patternId) {
      patternId = `${prefix}-${patterns.size}`;
      patterns.set(key, patternId);
      const pattern = parsed.createElementNS(NS, 'pattern');
      pattern.setAttribute('id', patternId);
      pattern.setAttribute('patternUnits', 'userSpaceOnUse');
      pattern.setAttribute('width', '10'); pattern.setAttribute('height', '10');
      pattern.setAttribute('patternTransform', transform);
      pattern.setAttribute('data-fabric-texture', fabric.id);
      pattern.setAttribute('data-fabric-intensity', String(Math.max(0, Math.min(100, intensity))));
      const surface = fabricScanSurface(fabric, interior);
      pattern.setAttribute('data-fabric-status', surface?.sourceStatus ?? 'unresolved');
      if (surface) pattern.setAttribute('data-fabric-source-type', surface.sourceType);
      pattern.setAttribute('data-fabric-surface', interior ? fabric.interiorTexture ?? 'reverse' : 'face');
      const base = parsed.createElementNS(NS, 'rect');
      base.setAttribute('width', '10'); base.setAttribute('height', '10'); base.setAttribute('fill', baseColor);
      pattern.append(base);
      const motif = new DOMParser().parseFromString(`<svg xmlns="${NS}">${fabricTextureMotif(fabric, interior, intensity, baseColor)}</svg>`, 'image/svg+xml');
      for (const child of Array.from(motif.documentElement.children)) pattern.append(parsed.importNode(child, true));
      defs.append(pattern);
    }
    shape.setAttribute('data-fabric-base', baseColor);
    shape.setAttribute('fill', `url(#${patternId})`);
    // An explicit style fill outranks a presentation attribute on imported SVGs.
    if ((shape as SVGElement).style?.fill) (shape as SVGElement).style.fill = `url(#${patternId})`;
  }
  if (!patterns.size) return markup;
  root.prepend(defs);
  return new XMLSerializer().serializeToString(root);
}
