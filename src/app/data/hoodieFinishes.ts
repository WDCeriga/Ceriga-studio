import type { MultiPolygon, Pair } from 'polygon-clipping';
import { flattenPathContours } from '../features/panelling/panellingGeometry';
import { stablePolygonIntersection, stablePolygonUnion } from '../lib/stablePolygonUnion';
import { stitchPatternPath } from './tshirtStitching';
import { distressedHemEdge } from './distressedHem';
import svgpath from 'svgpath';
import type { GarmentAssetSelection } from './garmentSvgCatalog';
import type { HemConstruction, HemSettings, TshirtHemStyles } from './tshirtHemStyles';

type Finish = { id: HemConstruction; name: string; description: string };

export const hoodieBottomFinishes: Finish[] = [
  { id: 'rib', name: 'Rib waistband', description: 'A separate rib-knit band joins the body at the waist.' },
  { id: 'single-fold', name: 'Turned hem', description: 'The body fabric turns inward and is secured with topstitching.' },
  { id: 'double-fold', name: 'Double fold', description: 'Two turns enclose the cut edge. Two stitch rows mark the folded depths.' },
  { id: 'raw', name: 'Raw hem', description: 'The body fabric continues to the cut edge without a separate band.' },
  { id: 'distressed', name: 'Distressed hem', description: 'A worn cut edge with irregular tears and loose yarns.' },
  { id: 'elasticated', name: 'Elasticated hem', description: 'Enclosed elastic gathers the body into a fitted casing.' },
  { id: 'adjustable', name: 'Adjustable hem', description: 'A drawcord runs through a gathered channel with two exits.' },
];

export const hoodieCuffFinishes: Finish[] = [
  { id: 'rib', name: 'Rib cuff', description: 'A rib-knit band joins the end of the sleeve.' },
  { id: 'extended-rib', name: 'Extended rib cuff', description: 'A deeper rib-knit band extends farther up the sleeve.' },
  { id: 'single-fold', name: 'Turned cuff', description: 'The sleeve fabric turns inward and is secured with topstitching.' },
  { id: 'raw', name: 'Raw edge', description: 'The sleeve fabric continues to the cut edge without a separate band.' },
  { id: 'distressed', name: 'Distressed hem', description: 'A worn sleeve opening with irregular tears and loose yarns.' },
];

export function hoodieFinishChoices(id: string) {
  return id === 'bodyHem' ? hoodieBottomFinishes : hoodieCuffFinishes;
}

export function hoodieFinishDepth(construction: HemConstruction, id: string, shortSleeve = false) {
  if (construction === 'elasticated') return 3;
  if (construction === 'adjustable') return 3.5;
  if (construction === 'extended-rib') return shortSleeve ? 4 : 9;
  if (construction === 'rib') return id !== 'bodyHem' && shortSleeve ? 2.75 : 5.5;
  return 2.5;
}

export function hoodieFinishDefaults(selection: GarmentAssetSelection, id: string): HemSettings {
  const finish = id === 'bodyHem'
    ? (selection.hoodieHem === 'turned' ? 'normal' : 'ribbed')
    : (selection.hoodieCuff ?? (selection.hoodieHem === 'turned' ? 'normal' : 'ribbed'));
  const construction = finish === 'none' ? 'raw' : finish === 'normal' ? 'single-fold' : 'rib';
  return { construction, finish: construction === 'raw' ? 'none' : construction === 'rib' ? 'ribbed' : 'normal',
    depthCm: hoodieFinishDepth(construction, id, selection.hoodieSleeve === 'extended-short'), firstFoldCm: .8 };
}

export function resolveHoodieFinish(selection: GarmentAssetSelection, styles: TshirtHemStyles | undefined, id: string): HemSettings {
  const defaults = hoodieFinishDefaults(selection, id);
  const saved = styles?.editing?.regions?.[id];
  return saved?.construction && hoodieFinishChoices(id).some(choice => choice.id === saved.construction)
    ? { ...defaults, ...saved, depthCm: saved.depthCm ?? hoodieFinishDepth(saved.construction, id, selection.hoodieSleeve === 'extended-short') }
    : { ...defaults, color: saved?.color, stitchColor: saved?.stitchColor, stitchStyle: saved?.stitchStyle, stitchThread: saved?.stitchThread };
}

export function hoodieFinishIsRib(settings: HemSettings) {
  return settings.construction === 'rib' || settings.construction === 'extended-rib';
}

function finishPath(geometry: MultiPolygon) {
  return geometry.map(polygon => polygon.map(ring =>
    'M' + ring.map(point => point.join(' ')).join(' L ') + ' Z').join(' ')).join(' ');
}

export function hoodieTerminalFootprint(paths: string[]) {
  return stablePolygonUnion(...paths.filter(Boolean).map(path => flattenPathContours(path, 1).map(ring =>
    [ring.map(({ x, y }) => [x, y] as Pair)]) as MultiPolygon));
}

/** Fit the construction to a band cut from the actual terminal footprint. */
export function hoodieTerminalFinish(paths: string[], edge: [Pair, Pair], settings: HemSettings, scale: number) {
  const footprint = hoodieTerminalFootprint(paths);
  const [left, right] = edge;
  const slope = (right[1] - left[1]) / (right[0] - left[0]);
  const edgeY = (x: number) => left[1] + (x - left[0]) * slope;
  const depth = Math.max(1, Math.min(12, settings.depthCm ?? 2.5)) * scale;
  const depthY = (x: number) => edgeY(x) - depth;
  const band = stablePolygonIntersection(footprint, [[[[0, depthY(0)], [2048, depthY(2048)], [2048, 2200], [0, 2200], [0, depthY(0)]]]]);
  const fill = finishPath(band);
  const stitchRow = (offset: number) => {
    const crossings: number[] = [];
    for (const polygon of footprint) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = ring[i - 1];
      const [bx, by] = ring[i];
      const a = ay - edgeY(ax) + offset;
      const b = by - edgeY(bx) + offset;
      if ((a < 0) !== (b < 0)) crossings.push(ax + (bx - ax) * a / (a - b));
    }
    if (crossings.length < 2) return [];
    return [Math.min(...crossings) + 5, Math.max(...crossings) - 5].map(x => ({ x, y: edgeY(x) - offset }));
  };
  const offsets = settings.construction === 'double-fold'
    ? [depth, Math.max(3, Math.min(depth - 3, (settings.firstFoldCm ?? .8) * scale))]
    : [depth];
  const stitches = settings.construction === 'raw' || settings.stitchStyle === 'none'
    ? [] : offsets.map(stitchRow).filter(row => row.length === 2);
  return { fill, stitches };
}

export function continuousHoodieFinish(paths: string[]) {
  return finishPath(hoodieTerminalFootprint(paths));
}

/** Draft the terminal body below its existing side curve. */
export function hoodieBodyTerminal(kind: HemConstruction, sideEnd: Pair, previous: Pair, bottom: number, depth: number) {
  const elastic = kind === 'elasticated';
  const adjustable = kind === 'adjustable';
  const gathered = elastic || adjustable;
  const [x, y] = sideEnd;
  const dx = x - previous[0];
  const dy = Math.max(1, y - previous[1]);
  const run = bottom - y;
  const endX = x + (elastic ? 53 : adjustable ? 38 : dx / dy * run * .42);
  const first: Pair = [x + dx / dy * run * .29, y + run * .29];
  const second: Pair = [endX - (gathered ? 24 : 2), bottom - run * .23];
  const end: Pair = [endX, bottom];
  const mirror = ([px, py]: Pair) => [2048 - px, py].join(' ');
  const span = 2048 - 2 * endX;
  const wave = (rowY: number, left: number, amount: number) => {
    const count = 18;
    const width = (2048 - 2 * left) / count;
    return Array.from({length: count}, (_, i) => {
      const rise = (i % 2 ? -1 : 1) * amount * (i % 3 === 0 ? .75 : 1);
      return `Q ${left + (i + .5) * width} ${rowY + rise} ${left + (i + 1) * width} ${rowY}`;
    }).join(' ');
  };
  const edge = gathered ? wave(bottom, endX, elastic ? 11 : 7)
    : kind === 'raw' || kind === 'distressed' ? `L ${mirror(end)}`
    : `Q 1024 ${bottom + 9} ${mirror(end)}`;
  const left = `C ${first.join(' ')} ${second.join(' ')} ${end.join(' ')}`;
  const right = `C ${mirror(second)} ${mirror(first)} ${mirror(sideEnd)}`;
  const channelY = bottom - Math.max(23, Math.min(72, depth));
  const channelX = endX - 13;
  const channel = gathered ? `M ${channelX} ${channelY} ${wave(channelY, channelX, elastic ? 7 : 4)}` : '';
  const gathers = gathered ? Array.from({length: elastic ? 15 : 9}, (_, i) => {
    const count = elastic ? 15 : 9;
    const px = endX + span * (i + .65) / count;
    const lean = (i % 3 - 1) * 10;
    const top = channelY - 12 - (i * 13 % 31);
    return `M ${px} ${bottom - 7} Q ${px + lean} ${channelY + 4} ${px + lean * 1.7} ${top}`;
  }).join(' ') : '';
  return { left, right, edge, end, channel, gathers };
}

export function adjustableHemHardware(left: number, right: number, bottom: number) {
  const y = bottom - 19;
  const exit = left + 67;
  const exitRight = right - 67;
  const eyelets = [exit, exitRight].map(x =>
    `<ellipse cx="${x}" cy="${y}" rx="7" ry="7" fill="none" stroke="#202020" stroke-width="4"/>`).join('');
  const cord = `M ${exit} ${y} c -15 18 -36 92 -10 88 c 24 -4 14 -66 10 -88 M ${exitRight} ${y} c 15 18 36 92 10 88 c -24 -4 -14 -66 -10 -88`;
  return eyelets + `<path d="${cord}" fill="none" stroke="#202020" stroke-width="5" stroke-linecap="round"/><rect x="${exit - 15}" y="${y + 29}" width="17" height="12" rx="4" fill="#202020"/><rect x="${exitRight - 2}" y="${y + 29}" width="17" height="12" rx="4" fill="#202020"/>`;
}

/** Shared rolled-edge and loose-yarn finish for T-shirt and hoodie openings. */
export function rawEdgeTreatment(edge: number[], seed: number, control?: Pair, distressed = false): string {
  const [left, right] = [[edge[0], edge[1]], [edge[2], edge[3]]].sort((a, b) => a[0] - b[0]);
  const dx = right[0] - left[0];
  const dy = right[1] - left[1];
  const length = Math.hypot(dx, dy);
  if (length < 24) return '';
  const finish = distressedHemEdge(7, length - 7, 0, distressed ? 60 : 19,
    distressed ? 60 : 26, distressed ? 82 : length > 500 ? 74 : 64, seed);
  const project = (d: string) => {
    const path = svgpath(d).abs();
    if (control) {
      path.iterate(segment => {
        const coords = segment as unknown as number[];
        for (let i = 1; i < coords.length; i += 2) {
          const t = coords[i] / length;
          const u = 1 - t;
          coords[i] = u * u * left[0] + 2 * u * t * control[0] + t * t * right[0];
          coords[i + 1] += u * u * left[1] + 2 * u * t * control[1] + t * t * right[1];
        }
      });
    } else {
      path.matrix([dx / length, dy / length, -dy / length, dx / length, left[0], left[1]]);
    }
    return path.round(2).toString();
  };
  const line = (points: { x: number; y: number }[]) =>
    'M' + points.map(p => p.x + ',' + p.y).join('L');
  const threads = project([...finish.bridges, ...finish.fibers].join(' '));
  const wear = distressed ? `<path data-distress-openings="true" d="${project(finish.rims.join(' '))}" fill="none" stroke="none"/>` : '';
  return `<path d="${project(line(finish.roll))}" stroke="#15110c" stroke-width="7" opacity=".23"/>
    <path d="${project(line(finish.roll.map(p => ({ ...p, y: p.y - 2 }))))}" stroke="#fff" stroke-width="2.3" opacity=".28"/>
    <path d="${project(finish.rims.join(' '))}" stroke="#d5c9b5" stroke-width="1.4" opacity=".65"/>
    <path d="${threads}" stroke="#302b23" stroke-width="2.4" opacity=".46"/>
    <path d="${threads}" stroke="#fff" stroke-width="1.1" opacity=".7"/>${wear}`;
}

export function hoodieFinishStitchMarkup(rows: { x: number; y: number }[][], settings: HemSettings) {
  const style = settings.stitchStyle ?? 'standard';
  const width = { fine: 3, regular: 4, heavy: 5 }[settings.stitchThread ?? 'regular'];
  return rows.map(row => {
    const native = style === 'standard' || typeof document === 'undefined';
    const d = native ? 'M' + row.map(({ x, y }) => x + ' ' + y).join(' L ') : stitchPatternPath(row, style);
    return `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${width}"${native ? ' stroke-dasharray="9 7"' : ''} stroke-linecap="round"/>`;
  }).join('');
}
