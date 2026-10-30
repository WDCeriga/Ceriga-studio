export type GradientPaint = { kind: 'linear' | 'radial' | 'conic'; angle: number; x: number; y: number; stops: { color: string; offset: number }[] };

export function parsePaint(value?: string): GradientPaint | null {
  if (!value?.startsWith('paint:')) return null;
  try {
    const paint = JSON.parse(value.slice(6));
    if (!['linear', 'radial', 'conic'].includes(paint.kind) || ![paint.angle, paint.x, paint.y].every(Number.isFinite) || !Array.isArray(paint.stops) || paint.stops.length < 2 || paint.stops.length > 16) return null;
    if (!paint.stops.every((stop: { color: string; offset: number }) => /^#[0-9a-f]{6}$/i.test(stop.color) && Number.isFinite(stop.offset) && stop.offset >= 0 && stop.offset <= 1)) return null;
    return { ...paint, x: Math.max(0, Math.min(1, paint.x)), y: Math.max(0, Math.min(1, paint.y)) };
  } catch { return null; }
}

export const serializePaint = (paint: GradientPaint) => `paint:${JSON.stringify(paint)}`;
export const solidPaint = (value?: string) => parsePaint(value)?.stops[0].color ?? (value?.startsWith('paint:') ? '#FFFFFF' : value || '#FFFFFF');

export function paintCss(value?: string): string {
  const paint = parsePaint(value);
  if (!paint) return solidPaint(value);
  const stops = [...paint.stops].sort((first, second) => first.offset - second.offset).map(stop => `${stop.color} ${stop.offset * 100}%`).join(', ');
  if (paint.kind === 'linear') return `linear-gradient(${paint.angle}deg, ${stops})`;
  if (paint.kind === 'radial') return `radial-gradient(circle farthest-corner at ${paint.x * 100}% ${paint.y * 100}%, ${stops})`;
  return `conic-gradient(from ${paint.angle}deg at ${paint.x * 100}% ${paint.y * 100}%, ${stops})`;
}

export function canvasPaint(context: CanvasRenderingContext2D, value: string, width: number, height: number): string | CanvasGradient {
  const paint = parsePaint(value);
  if (!paint) return solidPaint(value);
  const radians = paint.angle * Math.PI / 180;
  let gradient: CanvasGradient;
  if (paint.kind === 'linear') {
    const extent = (Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))) / 2;
    const deltaX = Math.sin(radians) * extent;
    const deltaY = -Math.cos(radians) * extent;
    gradient = context.createLinearGradient(width / 2 - deltaX, height / 2 - deltaY, width / 2 + deltaX, height / 2 + deltaY);
  } else if (paint.kind === 'radial') {
    const centerX = paint.x * width;
    const centerY = paint.y * height;
    const radius = Math.hypot(Math.max(centerX, width - centerX), Math.max(centerY, height - centerY));
    gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  } else gradient = context.createConicGradient(radians - Math.PI / 2, paint.x * width, paint.y * height);
  for (const stop of [...paint.stops].sort((first, second) => first.offset - second.offset)) gradient.addColorStop(stop.offset, stop.color);
  return gradient;
}

const vectorPaintCache = new Map<string, string>();
export function paintDataUrl(value: string, width = 256, height = 256): string {
  const key = `${width}:${height}:${value}`;
  const existing = vectorPaintCache.get(key);
  if (existing) return existing;
  const paint=svgPaint(value,'paint-source',width,height);
  const result='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${paint.defs}</defs><rect width="${width}" height="${height}" fill="${paint.color}"/></svg>`);
  if (vectorPaintCache.size >= 64) vectorPaintCache.delete(vectorPaintCache.keys().next().value!);
  vectorPaintCache.set(key, result);
  return result;
}

export function svgPaint(value: string, id: string, width: number, height: number): { color: string; defs: string } {
  const paint = parsePaint(value);
  if (!paint) return { color: solidPaint(value), defs: '' };
  const stops = [...paint.stops].sort((first, second) => first.offset - second.offset).map(stop => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`).join('');
  let definition: string;
  if (paint.kind === 'linear') {
    const radians = paint.angle * Math.PI / 180;
    const extent = (Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))) / 2;
    const deltaX = Math.sin(radians) * extent;
    const deltaY = -Math.cos(radians) * extent;
    definition = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${width / 2 - deltaX}" y1="${height / 2 - deltaY}" x2="${width / 2 + deltaX}" y2="${height / 2 + deltaY}">${stops}</linearGradient>`;
  } else if (paint.kind === 'radial') {
    const radius = Math.hypot(Math.max(paint.x, 1 - paint.x) * width, Math.max(paint.y, 1 - paint.y) * height);
    definition = `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${paint.x * width}" cy="${paint.y * height}" r="${radius}">${stops}</radialGradient>`;
  } else {
    definition = `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${width}" height="${height}">${conicPaintMarkup(paint,width,height)}</pattern>`;
  }
  return { color: `url(#${id})`, defs: definition };
}
/** Angular colour wedges stay geometric at every zoom, rather than a fixed 512px bitmap. */
export function conicPaintMarkup(paint:GradientPaint,width:number,height:number){
 const stops=[...paint.stops].sort((a,b)=>a.offset-b.offset),cx=paint.x*width,cy=paint.y*height,r=Math.hypot(width,height)*2;
 const color=(t:number)=>{const b=stops.find(s=>s.offset>=t)??stops.at(-1)!,a=[...stops].reverse().find(s=>s.offset<=t)??stops[0];const f=a.offset===b.offset?0:(t-a.offset)/(b.offset-a.offset);return '#'+[1,3,5].map(i=>Math.round(parseInt(a.color.slice(i,i+2),16)*(1-f)+parseInt(b.color.slice(i,i+2),16)*f).toString(16).padStart(2,'0')).join('')};
 return Array.from({length:720},(_,i)=>{const a=(paint.angle-90+i*.5)*Math.PI/180,b=a+.501*Math.PI/180;return `<path d="M${cx},${cy}L${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}A${r},${r} 0 0 1 ${cx+r*Math.cos(b)},${cy+r*Math.sin(b)}Z" fill="${color((i+.5)/720)}"/>`}).join('');
}
