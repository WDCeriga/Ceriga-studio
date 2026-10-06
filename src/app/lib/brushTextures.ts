export const BRUSH_TEXTURES = [
  { id: 'smooth', label: 'Smooth', category: 'Classic' },
  { id: 'paper', label: 'Paper', category: 'Classic' },
  { id: 'canvas', label: 'Canvas Weave', category: 'Classic' },
  { id: 'denim', label: 'Denim Twill', category: 'Classic' },
  { id: 'cotton', label: 'Cotton', category: 'Fabric' },
  { id: 'heavy-cotton', label: 'Heavy Cotton', category: 'Fabric' },
  { id: 'jersey-knit', label: 'Jersey Knit', category: 'Fabric' },
  { id: 'fleece', label: 'Fleece', category: 'Fabric' },
  { id: 'french-terry', label: 'French Terry', category: 'Fabric' },
  { id: 'rib-knit', label: 'Rib Knit', category: 'Fabric' },
  { id: 'denim-fabric', label: 'Denim', category: 'Fabric' },
  { id: 'canvas-fabric', label: 'Canvas', category: 'Fabric' },
  { id: 'mesh', label: 'Mesh', category: 'Fabric' },
  { id: 'corduroy', label: 'Corduroy', category: 'Fabric' },
  { id: 'waffle-knit', label: 'Waffle Knit', category: 'Fabric' },
  { id: 'wool', label: 'Wool', category: 'Fabric' },
  { id: 'felt', label: 'Felt', category: 'Fabric' },
  { id: 'leather', label: 'Leather', category: 'Fabric' },
  { id: 'thread', label: 'Thread', category: 'Fabric' },
  { id: 'rough-paper', label: 'Rough Paper', category: 'Media' },
  { id: 'watercolour-paper', label: 'Watercolour Paper', category: 'Media' },
  { id: 'chalk', label: 'Chalk', category: 'Media' },
  { id: 'charcoal', label: 'Charcoal', category: 'Media' },
  { id: 'dry-paint', label: 'Dry Paint', category: 'Media' },
  { id: 'brush-grain', label: 'Brush Grain', category: 'Media' },
  { id: 'ink-bleed', label: 'Ink Bleed', category: 'Media' },
  { id: 'crayon', label: 'Crayon', category: 'Media' },
  { id: 'grain', label: 'Grain', category: 'Print' },
  { id: 'fine-noise', label: 'Fine Noise', category: 'Print' },
  { id: 'coarse-noise', label: 'Coarse Noise', category: 'Print' },
  { id: 'halftone', label: 'Halftone', category: 'Print' },
  { id: 'newsprint', label: 'Newsprint', category: 'Print' },
  { id: 'photocopy', label: 'Photocopy', category: 'Print' },
  { id: 'screen-print', label: 'Screen Print', category: 'Print' },
  { id: 'dither', label: 'Dither', category: 'Print' },
  { id: 'speckle', label: 'Speckle', category: 'Print' },
  { id: 'stipple', label: 'Stipple', category: 'Print' },
  { id: 'worn', label: 'Worn', category: 'Distress' },
  { id: 'cracked', label: 'Cracked', category: 'Distress' },
  { id: 'scratched', label: 'Scratched', category: 'Distress' },
  { id: 'peeling', label: 'Peeling', category: 'Distress' },
  { id: 'faded', label: 'Faded', category: 'Distress' },
  { id: 'dust', label: 'Dust', category: 'Distress' },
  { id: 'concrete', label: 'Concrete', category: 'Distress' },
  { id: 'grunge', label: 'Grunge', category: 'Distress' },
  { id: 'vintage', label: 'Vintage', category: 'Distress' },
  { id: 'custom', label: 'Custom Texture', category: 'Custom' },
] as const;

export type BrushTexture = typeof BRUSH_TEXTURES[number]['id'];

export interface BrushTextureSettings {
  /** Percent of the native logical tile size, 10..400. */
  textureScale?: number;
  /** Erasure amount, 0..100; independent of the existing grain control. */
  textureStrength?: number;
  /** Coverage, 0..100: lower values keep only the deepest texture marks. */
  textureDensity?: number;
  /** Clockwise degrees, 0..360. */
  textureRotation?: number;
  /** Luminance contrast, 0..100; 50 is unchanged. */
  textureContrast?: number;
  textureInvert?: boolean;
  customTextureSource?: string;
}

export const DEFAULT_TEXTURE_SETTINGS = {
  textureScale: 100,
  textureStrength: 100,
  textureDensity: 100,
  textureRotation: 0,
  textureContrast: 50,
  textureInvert: false,
} satisfies Required<Omit<BrushTextureSettings, 'customTextureSource'>>;

type Settings = BrushTextureSettings & { texture: BrushTexture };
export interface BrushTextureMask {
  width: number;
  height: number;
  /** Destination-out alpha, row-major. No image RGB is ever painted. */
  data: Uint8ClampedArray;
}

type CustomPixels = { id: number; width: number; height: number; luminance: Uint8ClampedArray; alpha: Uint8ClampedArray };
let nextImageId = 0;
const CUSTOM_LIMIT = 4;
const TILE_LIMIT = 12;
const SOURCE_LIMIT = 12 * 1024 * 1024;
const customPixels = new Map<string, CustomPixels>();
const tiles = new Map<string, HTMLCanvasElement>();
const pending = new Map<string, Promise<void>>();

function bounded(value: number | undefined, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback;
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mod = (value: number, period: number) => ((value % period) + period) % period;
const wave = (value: number, period: number) => 0.5 + 0.5 * Math.cos(value * Math.PI * 2 / period);
const ridge = (value: number, period: number, width: number) => Math.max(0, 1 - Math.min(mod(value, period), period - mod(value, period)) / width);

function touch<T>(cache: Map<string, T>, key: string): T | undefined {
  const value = cache.get(key);
  if (value !== undefined) { cache.delete(key); cache.set(key, value); }
  return value;
}
function remember<T>(cache: Map<string, T>, key: string, value: T, limit: number) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value!);
}

// Read raster dimensions before decoding so neither oversized sources nor aspect ratios
// can create unbounded working canvases. The browser still validates the actual image data.
function imageDimensions(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a && text(12, 4) === 'IHDR') {
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (bytes.length >= 30 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    const uint24 = (offset: number) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
    if (text(12, 4) === 'VP8X') return [1 + uint24(24), 1 + uint24(27)];
    if (text(12, 4) === 'VP8 ' && view.getUint8(23) === 0x9d && view.getUint8(24) === 0x01 && view.getUint8(25) === 0x2a) {
      return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
    }
    if (text(12, 4) === 'VP8L' && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
  }
  if (bytes.length >= 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (length >= 7 && [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
      }
      offset += length;
    }
  }
  throw new Error('Invalid or unsupported raster texture.');
}

/** Only embedded raster images are accepted: no URLs, SVG, fetches, or external subresources.
 * Await before storing the source in brush settings. Four processed images (<=512px per side)
 * and twelve rendered tiles are retained; an evicted or missing image safely leaves ink alone.
 */
export function loadBrushTexture(source: string): Promise<void> {
  if (typeof source !== 'string' || source.length > SOURCE_LIMIT ||
      !/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=\r\n]+$/i.test(source)) {
    return Promise.reject(new Error('Use an embedded PNG, JPEG or WebP texture (maximum 12 MiB data URL).'));
  }
  if (touch(customPixels, source)) return Promise.resolve();
  const loading = pending.get(source);
  if (loading) return loading;
  if (pending.size >= CUSTOM_LIMIT) return Promise.reject(new Error('Too many textures loading at once.'));
  const promise = (async () => {
    // Decode with resize hints rather than retaining a full-resolution image or ImageData.
    const encoded = source.slice(source.indexOf(',') + 1).replace(/[\r\n]/g, '');
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const [width, height] = imageDimensions(bytes);
    if (!width || !height || width * height > 64 * 1024 * 1024 || Math.max(width, height) > 32768) {
      throw new Error('Texture exceeds the 64 megapixel / 32768 pixel decode limit.');
    }
    const ratio = Math.min(1, 512 / Math.max(width, height));
    const blob = new Blob([bytes], { type: source.slice(5, source.indexOf(';')) });
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(blob, {
        resizeWidth: Math.max(1, Math.round(width * ratio)),
        resizeHeight: Math.max(1, Math.round(height * ratio)),
        resizeQuality: 'high', imageOrientation: 'none',
      });
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Texture canvas is unavailable.');
      context.drawImage(bitmap, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const luminance = new Uint8ClampedArray(canvas.width * canvas.height);
      const alpha = new Uint8ClampedArray(luminance.length);
      for (let i = 0; i < luminance.length; i++) {
        luminance[i] = Math.round(0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]);
        alpha[i] = rgba[i * 4 + 3];
      }
      remember(customPixels, source, { id: ++nextImageId, width: canvas.width, height: canvas.height, luminance, alpha }, CUSTOM_LIMIT);
      tiles.clear();
    } finally {
      bitmap?.close();
    }
  })();
  pending.set(source, promise);
  void promise.then(() => pending.delete(source), () => pending.delete(source));
  return promise;
}

function randomSource() {
  let value = 7319;
  return () => {
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value ^= value >>> 16;
    return (value >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, seed = 0) {
  let value = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed + 1, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number, cell: number, seed = 0) {
  const ix = Math.floor(x / cell), iy = Math.floor(y / cell), period = 128 / cell;
  const dx = mod(x, cell) / cell, dy = mod(y, cell) / cell;
  const sx = dx * dx * (3 - 2 * dx), sy = dy * dy * (3 - 2 * dy);
  const n = (a: number, b: number) => hash(mod(a, period), mod(b, period), seed);
  return (n(ix, iy) * (1 - sx) + n(ix + 1, iy) * sx) * (1 - sy) +
    (n(ix, iy + 1) * (1 - sx) + n(ix + 1, iy + 1) * sx) * sy;
}

// Periodic cellular distances give pores, chips and fracture networks actual connected structure.
function cells(x: number, y: number, size: number, seed = 0) {
  const ix = Math.floor(x / size), iy = Math.floor(y / size), period = 128 / size;
  let nearest = Infinity, second = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const a = ix + dx, b = iy + dy;
    const px = (a + 0.2 + 0.6 * hash(mod(a, period), mod(b, period), seed)) * size;
    const py = (b + 0.2 + 0.6 * hash(mod(a, period), mod(b, period), seed + 9)) * size;
    const distance = Math.hypot(x - px, y - py) / size;
    if (distance < nearest) { second = nearest; nearest = distance; }
    else if (distance < second) second = distance;
  }
  return { distance: nearest, edge: second - nearest };
}

function weave(x: number, y: number, size: number) {
  const alternate = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
  return (alternate ? ridge(y, size, 1.2) : ridge(x, size, 1.2)) * 0.55 +
    (alternate ? wave(x, 2) : wave(y, 2)) * 0.12;
}
function knit(x: number, y: number, size: number) {
  const column = Math.floor(x / size);
  const u = mod(x, size) / size - 0.5;
  const v = mod(y + column % 2 * size / 2, size) / size;
  return Math.max(0, 1 - Math.abs(Math.abs(u) - (0.1 + v * 0.38)) * size * 1.5);
}
function loop(x: number, y: number, size: number) {
  const u = (mod(x, size) - size / 2) / (size * 0.32);
  const v = (mod(y, size) - size / 2) / (size * 0.42);
  return Math.max(0, 1 - Math.abs(Math.hypot(u, v) - 1) * 4);
}

function procedural(texture: BrushTexture, x: number, y: number): number {
  const fine = hash(x, y);
  switch (texture) {
    case 'cotton': return weave(x, y, 4) * 0.6 + fine * 0.1;
    case 'heavy-cotton': return weave(x, y, 8) + ridge(x + y, 8, 0.8) * 0.12;
    case 'jersey-knit': return knit(x, y, 8) * 0.55 + fine * 0.06;
    case 'fleece': return clamp((noise(x, y, 4, 1) - 0.3) * 1.3) + loop(x, y, 4) * 0.12;
    case 'french-terry': return loop(x + Math.floor(y / 8) % 2 * 4, y, 8) * 0.6 + weave(x, y, 4) * 0.16;
    case 'rib-knit': return ridge(x, 16, 3) * 0.5 + knit(x, y, 4) * 0.24;
    case 'denim-fabric': return ridge(x + y * 2, 16, 3) * (0.38 + wave(y, 2) * 0.2) + weave(x, y, 4) * 0.2;
    case 'canvas-fabric': return weave(x, y, 16) * 0.8 + ridge(x, 16, 2) * ridge(y, 16, 2) * 0.35 + fine * 0.1;
    case 'mesh': return clamp(1 - Math.hypot(mod(x, 8) - 4, mod(y, 8) - 4) / 3) * 0.9;
    case 'corduroy': return wave(x, 16) ** 6 * 0.62 + wave(y, 2) * wave(x, 16) * 0.18;
    case 'waffle-knit': return Math.min(ridge(x, 16, 6), ridge(y, 16, 6)) * 0.7 + weave(x, y, 4) * 0.18;
    case 'wool': return ridge(x + 3 * Math.sin(y * Math.PI / 16), 8, 1.3) * 0.3 + ridge(y + x + noise(x, y, 8) * 8, 16, 2) * 0.35;
    case 'felt': return Math.max(ridge(x + y * 2, 16, 1), ridge(y - x * 3, 32, 1)) * noise(x, y, 8) * 0.55 + fine * 0.17;
    case 'leather': return clamp(1 - cells(x, y, 16).edge * 9) * 0.55 + fine ** 9 * 0.2;
    case 'thread': return ridge(y + Math.sin(x * Math.PI / 8), 8, 2) * (0.3 + ridge(x + y * 2, 8, 2) * 0.45);
    case 'rough-paper': return cells(x, y, 8, 3).distance * 0.55 + fine * 0.12;
    case 'watercolour-paper': return clamp((noise(x, y, 8, 5) - 0.25) * 0.9) + cells(x, y, 4, 8).distance * 0.3;
    case 'chalk': return (fine > 0.55 ? 0.35 : 0) * noise(x, y, 8) + clamp((noise(x, y, 4) - 0.55) * 2);
    case 'charcoal': return clamp((noise(x / 2, y * 2, 4, 6) - 0.4) * 1.2) + ridge(x + y, 8, 1) * fine * 0.25;
    case 'dry-paint': return ridge(y + noise(x, y, 32) * 4, 8, 2) * clamp((noise(x, y, 16, 7) - 0.2) * 1.5);
    case 'brush-grain': return ridge(y, 4, 1) * (0.2 + noise(x, y, 16, 9) * 0.5) + ridge(y + x / 8, 16, 1) * 0.15;
    case 'ink-bleed': return clamp(0.75 - cells(x + noise(x, y, 8) * 3, y, 32, 5).distance) ** 2 * 1.5;
    case 'crayon': return ridge(x + y, 8, 2) * (fine > 0.32 ? 0.48 : 0.08) + (noise(x, y, 4, 4) > 0.7 ? 0.25 : 0);
    case 'grain': return (fine > 0.62 ? (fine - 0.62) * 1.8 : 0) + hash(Math.floor(x / 2), Math.floor(y / 2), 2) ** 6 * 0.15;
    case 'fine-noise': return fine ** 3 * 0.65;
    case 'coarse-noise': return hash(Math.floor(x / 4), Math.floor(y / 4), 4) ** 2 * 0.7;
    case 'halftone': return clamp(3 - Math.hypot(mod(x, 8) - 4, mod(y, 8) - 4)) * 0.65;
    case 'newsprint': return clamp(2.8 - Math.hypot(mod(x + Math.floor(y / 8) % 2 * 4, 8) - 4, mod(y, 8) - 4)) * (0.35 + fine * 0.35) + fine ** 12 * 0.2;
    case 'photocopy': return (noise(x, y, 4, 12) > 0.62 ? 0.55 : fine ** 12 * 0.35) + ridge(y, 32, 3) * 0.18;
    case 'screen-print': return Math.max(ridge(x, 4, 0.7), ridge(y, 4, 0.7)) * 0.28 + (fine > 0.94 ? 0.42 : 0);
    case 'dither': {
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      return bayer[mod(y, 4) * 4 + mod(x, 4)] < 5 ? 0.7 : 0;
    }
    case 'speckle': return clamp(1 - cells(x, y, 16, 7).distance * 7) * 0.85;
    case 'stipple': return clamp(1 - cells(x, y, 4, 11).distance * 4) * 0.72;
    case 'worn': return clamp((noise(x, y, 16, 18) - 0.4) * 2) * (0.55 + fine * 0.4);
    case 'cracked': return clamp(1 - cells(x + noise(x, y, 8) * 2, y, 32, 13).edge * 20) * 0.85;
    case 'scratched': return ridge(y - x * 2, 32, 0.8) * (noise(x, y, 16) > 0.35 ? 0.85 : 0) + ridge(x + y * 4, 64, 0.65) * 0.4;
    case 'peeling': {
      const cell = cells(x, y, 32, 21);
      return (cell.distance < 0.32 ? 0.72 : 0) + clamp(1 - Math.abs(cell.distance - 0.38) * 35) * 0.28;
    }
    case 'faded': return (noise(x, y, 32, 25) * 0.75 + noise(x, y, 16, 26) * 0.25) * 0.6;
    case 'dust': return (fine > 0.97 ? 0.7 : 0) + clamp(1 - cells(x, y, 8, 32).distance * 9) * 0.35;
    case 'concrete': return noise(x, y, 16, 33) * 0.28 + cells(x, y, 8, 34).distance * 0.4 + (fine > 0.96 ? 0.2 : 0);
    case 'grunge': return clamp((noise(x, y, 32, 36) - 0.25) * 1.4) * (0.35 + noise(x, y, 4, 37)) + ridge(x - y, 32, 1) * 0.15;
    case 'vintage': return (noise(x, y, 32, 39) * 0.25 + fine ** 8 * 0.4) + ridge(x, 32, 1) * noise(x, y, 8) * 0.5 + (noise(x, y, 8, 40) > 0.72 ? 0.3 : 0);
    default: return 0;
  }
}

/** Build a native, unrotated alpha tile. Scale and rotation are applied by the renderer.
 * Custom black removes ink, white retains ink; transparency always retains ink, even inverted.
 * Missing custom data produces no texture, never a blank destructive mask.
 */
export function createBrushTextureMask(settings: Settings, grain = 0): BrushTextureMask {
  const image = settings.texture === 'custom' && settings.customTextureSource ? touch(customPixels, settings.customTextureSource) : undefined;
  const legacy = ['smooth', 'paper', 'canvas', 'denim'].includes(settings.texture);
  const width = image?.width ?? (legacy ? 64 : 128), height = image?.height ?? width;
  const data = new Uint8ClampedArray(width * height);
  const strength = bounded(settings.textureStrength, 100, 0, 100) / 100;
  const density = bounded(settings.textureDensity, 100, 0, 100) / 100;
  const contrast = bounded(settings.textureContrast, 50, 0, 100) / 50;
  const grainAmount = bounded(grain, 0, 0, 100) / 100;
  const random = randomSource();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const grainAlpha = random() ** 3 * grainAmount * 0.8;
    let value = 0;
    if (settings.texture === 'paper') value = random() > 0.72 ? 0.24 : 0;
    else if (settings.texture === 'canvas') value = y % 4 === 0 || x % 4 === 0 ? 0.24 : 0;
    else if (settings.texture === 'denim') value = (x + y * 2) % 8 < 2 ? 0.38 : 0;
    else if (image) value = 1 - image.luminance[i] / 255;
    else value = clamp(procedural(settings.texture, x, y));
    const available = settings.texture !== 'smooth' && (settings.texture !== 'custom' || !!image);
    if (available) {
      if (settings.textureInvert) value = 1 - value;
      value = clamp((value - 0.5) * contrast + 0.5);
      value = density === 0 ? 0 : clamp((value - (1 - density)) / density);
      value *= strength * (image ? image.alpha[i] / 255 : 1);
    } else value = 0;
    data[i] = Math.round(Math.min(image ? 1 : 0.9, value + grainAlpha) * 255);
  }
  return { width, height, data };
}

/** Apply once to an isolated stroke canvas. `scale` is logical-to-backing-pixel ratio
 * (the drawing engine's pixelRatio), NOT another context transform. Caller state and clips
 * survive; destination-out can only reduce existing alpha, never add image colour or ink.
 */
export function applyBrushTexture(context: CanvasRenderingContext2D, settings: Settings, grain: number, scale: number): void {
  if (!Number.isFinite(scale) || scale <= 0) return;
  const grainAmount = bounded(grain, 0, 0, 100);
  const strength = bounded(settings.textureStrength, 100, 0, 100);
  const density = bounded(settings.textureDensity, 100, 0, 100);
  const image = settings.texture === 'custom' && settings.customTextureSource ? touch(customPixels, settings.customTextureSource) : undefined;
  if (!grainAmount && (settings.texture === 'smooth' || !strength || !density || (settings.texture === 'custom' && !image))) return;
  const key = JSON.stringify([settings.texture, strength, density, bounded(settings.textureContrast, 50, 0, 100), !!settings.textureInvert,
    image?.id ?? 0, grainAmount]);
  let tile = touch(tiles, key);
  if (!tile) {
    const mask = createBrushTextureMask(settings, grainAmount);
    tile = document.createElement('canvas');
    tile.width = mask.width;
    tile.height = mask.height;
    const tileContext = tile.getContext('2d');
    if (!tileContext) return;
    const pixels = tileContext.createImageData(mask.width, mask.height);
    for (let i = 0; i < mask.data.length; i++) pixels.data[i * 4 + 3] = mask.data[i];
    tileContext.putImageData(pixels, 0, 0);
    remember(tiles, key, tile, TILE_LIMIT);
  }
  const pattern = context.createPattern(tile, 'repeat');
  if (!pattern) return;
  const size = bounded(settings.textureScale, 100, 10, 400) / 100 * scale;
  const angle = bounded(settings.textureRotation, 0, 0, 360) % 360;
  pattern.setTransform(new DOMMatrix().rotate(angle).scale(size));
  context.save();
  try {
    context.resetTransform();
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'destination-out';
    context.filter = 'none';
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetX = context.shadowOffsetY = 0;
    context.fillStyle = pattern;
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  } finally {
    context.restore();
  }
}
