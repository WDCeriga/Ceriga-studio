import type { DesignElement } from '../../PrintStudioEditor';
import { textAppearance, type TextAppearanceItem } from '../../../../lib/textAppearance';

/**
 * Text outcomes (plan §9.5): one tap for a finished look, then every value stays editable.
 * An outcome is a set of tagged layers in the normal appearance stack, so the words stay live and it prints
 * through the same pipeline. Distances are in em: the look holds at any text size.
 */
export type TextOutcomeId = 'interlock' | 'echo' | 'trail' | 'long-shadow' | 'flare' | 'offset';
export type TextOutcome = {
  id: TextOutcomeId;
  /** Reach of the effect, em. For Interlock and Offset this is the gap. */
  distance: number;
  angle: number;
  /** Copies drawn (Echo, Trail). */
  copies: number;
  /** Size of the far end, % of the letters (Flare). */
  endSize: number;
  /** Line weight, em (Offset). */
  weight: number;
  colour: string;
  /** Colour the effect fades into. */
  colourTo: string;
  /** Tracking before Interlock tightened it, artwork units. */
  baseTracking?: number;
  /** Tightening applied by Interlock, em. */
  overlap: number;
  /** Font size the layers were built for. */
  size?: number;
};

export const TEXT_OUTCOMES: { id: TextOutcomeId; label: string }[] = [
  { id: 'interlock', label: 'Interlock' }, { id: 'echo', label: 'Echo' }, { id: 'trail', label: 'Trail' },
  { id: 'long-shadow', label: 'Long shadow' }, { id: 'flare', label: 'Flare' }, { id: 'offset', label: 'Offset' },
];

const TAG = 'outcome-';
const isOutcomeLayer = (item: TextAppearanceItem) => item.id.startsWith(TAG);

const mix = (a: string, b: string, t: number) => {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a;
  return '#' + [1, 3, 5].map(i => { const x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16); return Math.round(x + (y - x) * t).toString(16).padStart(2, '0'); }).join('');
};

export function defaultOutcome(id: TextOutcomeId, ink: string, surface: string): TextOutcome {
  // Effects start part-way to the garment colour, so the word itself always stays crisp against them.
  const base = { id, angle: 45, copies: 6, endSize: 100, weight: .03, colour: id === 'interlock' || id === 'offset' ? ink : mix(ink, surface, .42), colourTo: surface, overlap: 0 };
  switch (id) {
    case 'interlock': return { ...base, distance: .035, overlap: .09, colourTo: surface };
    case 'echo': return { ...base, distance: .42, copies: 5 };
    case 'trail': return { ...base, distance: .75, copies: 26, angle: 20 };
    case 'long-shadow': return { ...base, distance: 1.1, copies: 0 };
    case 'flare': return { ...base, distance: 1.25, copies: 0, angle: 270, endSize: 25 };
    default: return { ...base, distance: .06, copies: 2 };
  }
}

function outcomeLayers(outcome: TextOutcome, size: number, units: number, fill: string): TextAppearanceItem[] {
  const mm = (em: number) => em * size * 10 / Math.max(.0001, units), layer = { enabled: true, colour: outcome.colour };
  switch (outcome.id) {
    case 'interlock': return [{ ...layer, id: TAG + 'interlock', type: 'interlock', colour: outcome.colourTo, colourTo: fill, widthMm: mm(outcome.distance), join: 'round' }];
    case 'offset': {
      const rings: TextAppearanceItem[] = [];
      for (let i = 0; i < Math.max(1, Math.round(outcome.copies)); i++) {
        const inner = (outcome.distance + outcome.weight) * i + outcome.distance;
        rings.push({ ...layer, id: `${TAG}gap-${i}`, type: 'stroke', colour: outcome.colourTo, widthMm: mm(inner), position: 'outside', join: 'round' });
        rings.push({ ...layer, id: `${TAG}line-${i}`, type: 'stroke', widthMm: mm(inner + outcome.weight), position: 'outside', join: 'round' });
      }
      return rings;
    }
    default: return [{
      ...layer, id: TAG + outcome.id, type: 'extrude', depthMm: mm(outcome.distance), angle: outcome.angle, colourTo: outcome.colourTo,
      ...(outcome.id === 'echo' || outcome.id === 'trail' ? { copies: Math.max(1, Math.round(outcome.copies)) } : {}),
      ...(outcome.id === 'echo' ? { edgeMm: mm(outcome.weight * .7) } : {}),
      ...(outcome.id === 'flare' ? { scaleTo: outcome.endSize / 100 } : {}),
    }];
  }
}

/** The patch that puts an outcome on the text, replacing any previous outcome. */
export function applyTextOutcome(element: DesignElement, outcome: TextOutcome, unitsPerCm: number): Partial<DesignElement> {
  const size = element.fontSize ?? 30, stack = textAppearance(element).filter(item => !isOutcomeLayer(item));
  const fill = stack.find(item => item.type === 'fill' && item.enabled)?.colour ?? element.color ?? '#171717';
  const layers = outcomeLayers(outcome, size, unitsPerCm, fill);
  // Stack order is topmost first. Interlock redraws the letters, so it leads; the rest sit behind the fill.
  const fillIndex = stack.findIndex(item => item.type === 'fill');
  const nextStack = outcome.id === 'interlock' ? [...layers, ...stack] : [...stack.slice(0, fillIndex + 1), ...layers, ...stack.slice(fillIndex + 1)];
  const baseTracking = element.textOutcome?.baseTracking ?? element.letterSpacing ?? 0;
  return {
    textAppearance: nextStack, textUnitsPerCm: unitsPerCm, textShadowEnabled: false, shadowBlur: 0, borderWidth: 0,
    letterSpacing: outcome.id === 'interlock' ? baseTracking - outcome.overlap * size : baseTracking,
    textOutcome: { ...outcome, baseTracking, size },
  };
}

export function clearTextOutcome(element: DesignElement): Partial<DesignElement> {
  if (!element.textOutcome) return {};
  const stack = textAppearance(element).filter(item => !isOutcomeLayer(item));
  return { textAppearance: stack, letterSpacing: element.textOutcome.baseTracking ?? element.letterSpacing, textOutcome: undefined };
}

/** Keep an outcome's proportions when the text is resized by any control. */
export function refreshTextOutcomeScale(element: DesignElement): DesignElement {
  const outcome = element.textOutcome, size = element.fontSize;
  if (!outcome?.size || !size || Math.abs(outcome.size - size) < 1e-6) return element;
  const k = size / outcome.size, baseTracking = (outcome.baseTracking ?? 0) * k;
  return { ...element, ...applyTextOutcome({ ...element, textOutcome: { ...outcome, baseTracking } }, { ...outcome, baseTracking }, element.textUnitsPerCm ?? 30) };
}
