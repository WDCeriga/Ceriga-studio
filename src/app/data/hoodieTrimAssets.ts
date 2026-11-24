const fill = 'var(--detail-fill, none)';
const ink = 'var(--detail-outline, black)';
const thread = 'var(--detail-stitch, black)';
const hardware = 'var(--detail-hardware, none)';
const svg = (w: number, h: number, content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" stroke-linejoin="round" stroke-linecap="round">${content}</svg>`;
const seam = (d: string, colour = ink, dashed = false) =>
  `<path d="${d}" fill="none" stroke="${colour}" stroke-width="1.1"${dashed ? ' stroke-dasharray="2.4 2"' : ''}/>`;
const fabric = (d: string) => `<path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="1.25"/>`;
const pouch = 'M41 8H159Q170 33 193 66L188 111Q187 115 182 115H18Q13 115 12 111L7 66Q30 33 41 8Z';
const entries = 'M42 13Q30 43 12 66M158 13Q170 43 188 66';
const pouchStitch = seam(entries, thread, true) + seam('M43 13H157M17 70L21 109H179L183 70', thread, true);
const paired = (markup: string) => markup + `<g transform="translate(200 0) scale(-1 1)">${markup}</g>`;
export function splitHoodiePocketSvg(gap = 12) {
  const edge = 100 - Math.max(3, Math.min(80, gap / 2));
  const half = fabric(`M41 8H${edge}V115H18Q13 115 12 111L7 66Q30 33 41 8Z`) +
    seam(`M42 13Q30 43 12 66M44 13H${edge - 4}V109H21L17 70`, thread, true);
  return svg(200, 120, paired(half));
}
const pocketZip = (d: string, pull: string, concealed = false) =>
  `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${concealed ? 3 : 8}"/><path d="${d}" fill="none" stroke="${hardware}" stroke-width="1" stroke-dasharray="1 2"/>` +
  `<path d="${pull}" fill="${hardware}" stroke="${ink}" stroke-width="1"/>`;
const patch = fabric('M12 20H83V96Q83 107 72 107H23Q12 107 12 96Z') +
  seam('M17 30V95Q17 102 24 102H71Q78 102 78 95V30M16 25H79', thread, true);
const pocket = (id: string, label: string, width: number, ratio: number, markup: string, x = .5, y = .73) =>
  ({ id, label, width, ratio, x, y, stitch: true, hardware: id.includes('zip') || id.includes('cargo'), svg: svg(200, 120, markup) });

export const HOODIE_POCKETS = [
  pocket('hoodie-kangaroo', 'Kangaroo pocket', .69, 200/120, fabric(pouch) + pouchStitch),
  { ...pocket('hoodie-split', 'Split kangaroo pocket', .69, 200/120, ''), svg: splitHoodiePocketSvg() },
  pocket('hoodie-hidden-zip', 'Hidden zip kangaroo pocket', .69, 200/120, fabric(pouch) + pouchStitch +
    pocketZip('M49 22H151', 'M51 22v8h4v-8z', true)),
  pocket('hoodie-side-seam', 'Side seam pockets', .96, 2.45, paired(
    seam('M7 20Q3 55 8 105') + seam('M13 21Q9 56 14 104', thread, true) + seam('M4 20h10M5 105h10'))),
  pocket('hoodie-welt', 'Welt pockets', .79, 2.15, paired(
    fabric('M18 29L29 25L42 98L31 101Z') + seam('M23 33L35 95') + seam('M30 32L41 93', thread, true))),
  pocket('hoodie-patch', 'Patch pockets', .75, 1.9, paired(patch)),
  pocket('hoodie-cargo', 'Flap cargo pockets', .75, 1.85, paired(patch +
    fabric('M9 15H86V35L48 49L9 35Z') + seam('M14 20H81V31L48 43L14 31Z', thread, true) +
    seam('M41 49V99M55 49V99', thread, true) + `<circle cx="48" cy="33" r="3.5" fill="${hardware}" stroke="${ink}"/>`)),
  { ...pocket('hoodie-chest-zip', 'Chest zip pocket', .046, .24, '', .72, .35),
    svg: svg(24, 100, fabric('M8 3H16Q21 3 21 8V92Q21 97 16 97H8Q3 97 3 92V8Q3 3 8 3Z') +
      seam('M7 9V91M17 9V91', thread, true) + pocketZip('M12 10V90', 'M10 13h4v16h-4z', true)) },
];

export const CORD_STYLES = [
  ['round', 'Round cord'], ['flat', 'Flat tape'], ['wide', 'Wide flat tape'],
  ['braided', 'Braided cord'], ['elastic', 'Elastic cord'], ['contrast', 'Two-tone cord'],
] as const;
export const EYELET_STYLES = [
  ['none', 'No eyelet'], ['stitched', 'Stitched opening'], ['metal', 'Metal eyelet'],
  ['plastic', 'Plastic eyelet'], ['rubber', 'Rubber eyelet'], ['embroidered', 'Embroidered buttonhole'],
] as const;
export const TIP_STYLES = [
  ['cylinder', 'Metal cylinder'], ['cone', 'Metal cone'], ['bullet', 'Metal bullet'],
  ['plastic', 'Plastic dip'], ['shrink', 'Heat-shrink tip'], ['rubber', 'Rubber molded tip'], ['knot', 'Knotted / no aglet'], ['custom', 'Custom shape'],
] as const;
export const TOGGLE_STYLES = [
  ['round', 'Round toggle'], ['barrel', 'Barrel toggle'], ['flat', 'Flat toggle'],
  ['dual', 'Dual-hole toggle'], ['rubber', 'Rubber toggle'], ['metal', 'Metal toggle'],
] as const;

/** A tip drawn as its right half, top to bottom, so both sides always match and the cord stays centred. */
export const TIP_MATERIALS = { metal: 'Metal', plastic: 'Plastic', rubber: 'Rubber', silicone: 'Silicone', leather: 'Leather', fauxLeather: 'Faux leather', wood: 'Wood', enamel: 'Enamel' } as const;
export const TIP_FINISHES = { polished: 'Polished', brushed: 'Brushed', matte: 'Matte', antique: 'Antique' } as const;
export type TipMaterial = keyof typeof TIP_MATERIALS;
export type CustomTip = {
  half: { x: number; y: number }[];
  round: number;
  /** A closed outline traced from an uploaded image. Used instead of the drawn half when set. */
  outline?: string;
  material?: TipMaterial;
  finish?: keyof typeof TIP_FINISHES;
  /** Colour for non-metal tips. Metal follows the garment's hardware colour. */
  colour?: string;
};
export const DEFAULT_CUSTOM_TIP: CustomTip = { half: [{ x: 3.5, y: 0 }, { x: 3.5, y: 13 }], round: .15 };
export const CUSTOM_TIP_PRESETS: { id: string; label: string; shape: CustomTip }[] = [
  { id: 'barrel', label: 'Barrel', shape: { half: [{ x: 2.5, y: 0 }, { x: 4.5, y: 4 }, { x: 4.5, y: 10 }, { x: 2.5, y: 14 }], round: .5 } },
  { id: 'taper', label: 'Taper', shape: { half: [{ x: 4, y: 0 }, { x: 1.5, y: 14 }], round: .15 } },
  { id: 'bell', label: 'Bell', shape: { half: [{ x: 2, y: 0 }, { x: 2.5, y: 7 }, { x: 5.5, y: 13 }], round: .3 } },
  { id: 'spade', label: 'Spade', shape: { half: [{ x: 2, y: 0 }, { x: 5, y: 6 }, { x: 0, y: 15 }], round: .2 } },
];
/** Closed outline from the right half and its reflection, with adjustable corner rounding. */
export function customTipPath(shape: CustomTip = DEFAULT_CUSTOM_TIP) {
  if (shape.outline) return shape.outline;
  const right = shape.half.length >= 2 ? shape.half : DEFAULT_CUSTOM_TIP.half, left = [...right].reverse().filter(point => point.x > .001).map(point => ({ x: -point.x, y: point.y })), points = [...right, ...left], count = points.length, round = Math.max(0, Math.min(1, shape.round)) * .5, n = (value: number) => Number(value.toFixed(3));
  if (!round) return points.map((point, index) => `${index ? 'L' : 'M'}${n(point.x)} ${n(point.y)}`).join('') + 'Z';
  let path = '';
  points.forEach((point, index) => {
    const before = points[(index - 1 + count) % count], after = points[(index + 1) % count], start = { x: point.x + (before.x - point.x) * round, y: point.y + (before.y - point.y) * round }, end = { x: point.x + (after.x - point.x) * round, y: point.y + (after.y - point.y) * round };
    path += `${index ? 'L' : 'M'}${n(start.x)} ${n(start.y)}Q${n(point.x)} ${n(point.y)} ${n(end.x)} ${n(end.y)}`;
  });
  return path + 'Z';
}

export interface HoodieTrimSettings {
  /** Hanging loop position along the neck seam: -1 left, 0 centre, 1 right. */
  loopOffset?: number;
  eyelet?: typeof EYELET_STYLES[number][0];
  tip?: typeof TIP_STYLES[number][0];
  customTip?: CustomTip;
  thickness?: number;
  spacing?: number;
  visibleLength?: number;
  eyeletSize?: number;
  eyeletBore?: number;
  tipLength?: number;
  tipWidth?: number;
  material?: string;
  finish?: string;
}

function eyelet(style: string, radius: number, bore = .57) {
  if (style === 'none') return '';
  if (style === 'embroidered') return `<ellipse rx="${radius}" ry="${radius * .62}" fill="${ink}" stroke="${thread}" stroke-width="1.5" stroke-dasharray="1 1"/>`;
  const rim = style === 'stitched' ? thread : style === 'metal' ? hardware : fill;
  return `<circle r="${radius}" fill="${rim}" stroke="${ink}" stroke-width=".7"/><circle r="${radius * bore}" fill="${ink}"/>`;
}

const WOOD = '#a8743f', MATERIAL_FILL: Record<TipMaterial, string> = { metal: hardware, plastic: fill, rubber: '#2b2b2a', silicone: fill, leather: '#7a4a2c', fauxLeather: '#5b3a28', wood: WOOD, enamel: fill };
/** Custom tip in its chosen material. Highlights and texture stay inside the outline. */
export function customTipMarkup(custom: CustomTip = DEFAULT_CUSTOM_TIP) {
  const d = customTipPath(custom), material = custom.material ?? 'metal', finish = custom.finish ?? 'polished', paint = material === 'metal' ? hardware : custom.colour ?? MATERIAL_FILL[material];
  const id = `tip-${Math.abs([...d].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) | 0).toString(36)}-${material}-${finish}`;
  const clip = `<clipPath id="${id}"><path d="${d}"/></clipPath>`, inside = (markup: string) => `<g clip-path="url(#${id})">${markup}</g>`;
  const sheen = (x: number, width: number, opacity: number) => `<rect x="${x}" y="-1" width="${width}" height="20" fill="#fff" opacity="${opacity}"/>`;
  const texture = material === 'metal' ? (finish === 'polished' ? sheen(-2.4, 1.1, .55) + sheen(1.6, .5, .3) : finish === 'brushed' ? [-3, -1.8, -.6, .6, 1.8, 3].map(x => sheen(x, .18, .22)).join('') : finish === 'antique' ? `<rect x="-6" y="-1" width="12" height="20" fill="#3b2a14" opacity=".3"/>` + sheen(-2, .7, .18) : '')
    : material === 'enamel' ? sheen(-2.4, 1.2, .6) : material === 'plastic' ? sheen(-2.2, .9, .35) : material === 'silicone' || material === 'rubber' ? sheen(-2.2, 1.4, .12)
      : material === 'wood' ? [1, 3.5, 6, 8.5, 11, 13.5].map((y, i) => `<path d="M-6 ${y}Q0 ${y + (i % 2 ? 1.2 : -1.2)} 6 ${y}" fill="none" stroke="#5b3716" stroke-width=".25" opacity=".55"/>`).join('') : '';
  const stitch = material === 'leather' || material === 'fauxLeather' ? `<path d="${d}" fill="none" stroke="${thread}" stroke-width=".35" stroke-dasharray=".9 .7" transform="translate(0 .8) scale(.8 .9)"/>` : '';
  return `<g data-custom-tip="" data-tip-material="${material}"><defs>${clip}</defs><path d="${d}" fill="${paint}"/>${inside(texture + stitch)}<path d="${d}" fill="none" stroke="${ink}" stroke-width=".9" stroke-linejoin="round"/></g>`;
}

function tip(style: string, custom?: CustomTip) {
  if (style === 'custom') return customTipMarkup(custom);
  if (style === 'knot') return fabric('M-4 2Q-7 5-4 8Q-5 11 0 11Q5 11 4 8Q7 5 4 2Q0-1-4 2Z') + seam('M-4 7L4 4M-2 10L-3 13M2 10L3 13', thread);
  const outline = style === 'cone' ? 'M-2 0H2L4 13H-4Z'
    : style === 'bullet' || style === 'plastic' ? 'M-3.5 0H3.5V10Q3.5 14 0 14T-3.5 10Z'
      : 'M-3.5 0H3.5V12Q3.5 13 2.5 13H-2.5Q-3.5 13-3.5 12Z';
  return `<path d="${outline}" fill="${['plastic','shrink','rubber'].includes(style) ? fill : hardware}" stroke="${ink}" stroke-width=".9"/>` +
    (style === 'rubber' ? seam('M-3 4H3M-3 7H3M-3 10H3') : style === 'shrink' ? '' : seam('M-1 2V10', thread));
}

function toggle(style: string) {
  const rounded = style === 'round' ? 9 : style === 'barrel' ? 6 : 3;
  return `<rect x="1" y="2" width="22" height="16" rx="${rounded}" fill="${style === 'metal' ? hardware : fill}" stroke="${ink}" stroke-width="1.3"/>` +
    seam('M8 2V.8H16V2') + `<circle cx="${style === 'dual' ? 8 : 12}" cy="10" r="2.4" fill="${ink}"/>` +
    (style === 'dual' ? `<circle cx="16" cy="10" r="2.4" fill="${ink}"/>` : '') +
    (style === 'rubber' ? seam('M4 6V14M20 6V14', thread) : '');
}

export const cordWidths: Readonly<Record<string, number>> = { round: 3.5, flat: 6, wide: 8, braided: 5, elastic: 2.4, contrast: 4 };

export function hoodieCordSvg(style: string, settings: HoodieTrimSettings = {}, lock?: { style: string; fill: string; outline: string; hardware: string; paired: boolean }) {
  const thick = Math.max(.65, Math.min(1.6, settings.thickness ?? 1));
  const width = cordWidths[style] ?? cordWidths.round;
  const stroke = width * thick;
  const spacing = Math.max(.55, Math.min(1.45, settings.spacing ?? 1));
  const halfGap = 20 * spacing;
  const hole = Math.min(9, Math.max(2.5, stroke * .56 + .7) * (settings.eyeletSize ?? 1));
  const length = Math.max(.45, Math.min(1, settings.visibleLength ?? 1));
  const y = (value: number) => 10 + (value - 10) * length;
  const end = settings.tip ?? 'cylinder';
  const lockY = y(62);
  const lockX = lock?.paired ? [-halfGap, halfGap] : [0];
  return svg(80, 100, [-1, 1].map(side => {
    const x = 40 + side * halfGap;
    const drift = lock ? 0 : side * 4;
    const feed = lock?.paired ? 0 : side * (lock?.style === 'dual' ? 3.12 : 2) - side * halfGap;
    const tailX = lock ? feed : drift;
    const cord = lock
      ? `M0 10 C0 ${y(31)} ${feed} ${y(43)} ${feed} ${lockY} V${y(82)}`
      : style === 'elastic'
      ? `M0 10Q${drift} ${y(44)} 0 ${y(70)}Q${drift * 3} ${y(91)} 0 ${y(92)}Q${-drift * 2} ${y(92)} 0 ${y(70)}`
      : `M0 10Q${drift} ${y(44)} ${drift} ${y(82)}`;
    return `<g transform="translate(${x} 0)"><g transform="translate(0 10)">${eyelet(settings.eyelet ?? 'stitched', hole, settings.eyeletBore)}</g>
      <path d="${cord}" fill="none" stroke="${ink}" stroke-width="${stroke + 1.25}"/>
      <path d="${cord}" fill="none" stroke="${fill}" stroke-width="${stroke}"/>
      ${style === 'braided' || style === 'contrast' ? `<path d="${cord}" fill="none" stroke="${thread}" stroke-width="${stroke * .52}" stroke-dasharray="${style === 'braided' ? '1 2' : '4 3'}"/>` : ''}
      ${style === 'elastic' && !lock ? `<g transform="translate(-6 ${y(63)}) scale(.5)">${toggle('barrel')}</g>`
        : `<g transform="translate(${tailX} ${y(81)}) scale(${settings.tipWidth ?? 1} ${settings.tipLength ?? 1})">${tip(end, settings.customTip)}</g>`}</g>`;
  }).join('') + (lock ? lockX.map(x => `<g data-integrated-cord-lock="" transform="translate(${40 + x} ${lockY}) scale(.78) translate(-12 -10)" style="--detail-fill:${lock.fill};--detail-outline:${lock.outline};--detail-hardware:${lock.hardware}">${toggle(lock.style)}</g>`).join('') : ''));
}

export const HOODIE_HARDWARE = {
  drawstring: CORD_STYLES.map(([id, label]) => ({ id: `cord-${id}`, label, svg: hoodieCordSvg(id), hardware: true, stitch: id === 'braided' || id === 'contrast' })),
  eyelet: EYELET_STYLES.filter(([id]) => id !== 'none').map(([id, label]) => ({ id: `eyelet-${id}`, label, svg: svg(20, 20, `<g transform="translate(10 10)">${eyelet(id, 8)}</g>`), hardware: true, stitch: true })),
  aglet: TIP_STYLES.map(([id, label]) => ({ id: `tip-${id}`, label, svg: svg(12, 18, `<g transform="translate(6 1)">${tip(id)}</g>`), hardware: true, stitch: true })),
  toggle: TOGGLE_STYLES.map(([id, label]) => ({ id: `toggle-${id}`, label, svg: svg(24, 20, toggle(id)), hardware: true, stitch: false })),
  hoodDetail: [{ id: 'hood-tab', label: 'Hood hanging loop', svg: svg(30, 24, fabric('M3 2H9V10Q9 16 15 16T21 10V2H27V10Q27 22 15 22T3 10Z') + seam('M4 3L8 7M8 3L4 7M22 3L26 7M26 3L22 7')), hardware: false, stitch: false }],
};
