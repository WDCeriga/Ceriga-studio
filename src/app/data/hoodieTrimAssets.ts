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
  ['plastic', 'Plastic dip'], ['shrink', 'Heat-shrink tip'], ['rubber', 'Rubber molded tip'], ['knot', 'Knotted / no aglet'],
] as const;
export const TOGGLE_STYLES = [
  ['round', 'Round toggle'], ['barrel', 'Barrel toggle'], ['flat', 'Flat toggle'],
  ['dual', 'Dual-hole toggle'], ['rubber', 'Rubber toggle'], ['metal', 'Metal toggle'],
] as const;

export interface HoodieTrimSettings {
  eyelet?: typeof EYELET_STYLES[number][0];
  tip?: typeof TIP_STYLES[number][0];
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

function tip(style: string) {
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

export function hoodieCordSvg(style: string, settings: HoodieTrimSettings = {}) {
  const thick = Math.max(.65, Math.min(1.6, settings.thickness ?? 1));
  const width = cordWidths[style] ?? cordWidths.round;
  const stroke = width * thick;
  const spacing = Math.max(.55, Math.min(1.45, settings.spacing ?? 1));
  const halfGap = 20 * spacing;
  const hole = Math.min(9, Math.max(2.5, stroke * .56 + .7) * (settings.eyeletSize ?? 1));
  const length = Math.max(.45, Math.min(1, settings.visibleLength ?? 1));
  const y = (value: number) => 10 + (value - 10) * length;
  const end = settings.tip ?? 'cylinder';
  return svg(80, 100, [-1, 1].map(side => {
    const x = 40 + side * halfGap;
    const drift = side * 4;
    const cord = style === 'elastic'
      ? `M0 10Q${drift} ${y(44)} 0 ${y(70)}Q${drift * 3} ${y(91)} 0 ${y(92)}Q${-drift * 2} ${y(92)} 0 ${y(70)}`
      : `M0 10Q${drift} ${y(44)} ${drift} ${y(82)}`;
    return `<g transform="translate(${x} 0)"><g transform="translate(0 10)">${eyelet(settings.eyelet ?? 'stitched', hole, settings.eyeletBore)}</g>
      <path d="${cord}" fill="none" stroke="${ink}" stroke-width="${stroke + 1.25}"/>
      <path d="${cord}" fill="none" stroke="${fill}" stroke-width="${stroke}"/>
      ${style === 'braided' || style === 'contrast' ? `<path d="${cord}" fill="none" stroke="${thread}" stroke-width="${stroke * .52}" stroke-dasharray="${style === 'braided' ? '1 2' : '4 3'}"/>` : ''}
      ${style === 'elastic' ? `<g transform="translate(-6 ${y(63)}) scale(.5)">${toggle('barrel')}</g>`
        : `<g transform="translate(${drift} ${y(81)}) scale(${settings.tipWidth ?? 1} ${settings.tipLength ?? 1})">${tip(end)}</g>`}</g>`;
  }).join(''));
}

export const HOODIE_HARDWARE = {
  drawstring: CORD_STYLES.map(([id, label]) => ({ id: `cord-${id}`, label, svg: hoodieCordSvg(id), hardware: true, stitch: id === 'braided' || id === 'contrast' })),
  eyelet: EYELET_STYLES.filter(([id]) => id !== 'none').map(([id, label]) => ({ id: `eyelet-${id}`, label, svg: svg(20, 20, `<g transform="translate(10 10)">${eyelet(id, 8)}</g>`), hardware: true, stitch: true })),
  aglet: TIP_STYLES.map(([id, label]) => ({ id: `tip-${id}`, label, svg: svg(12, 18, `<g transform="translate(6 1)">${tip(id)}</g>`), hardware: true, stitch: true })),
  toggle: TOGGLE_STYLES.map(([id, label]) => ({ id: `toggle-${id}`, label, svg: svg(24, 20, toggle(id)), hardware: true, stitch: false })),
  hoodDetail: [{ id: 'hood-tab', label: 'Hood hanging loop', svg: svg(30, 24, fabric('M3 22V12Q3 2 15 2T27 12V22H21V12Q21 8 15 8T9 12V22Z')), hardware: false, stitch: false }],
};
