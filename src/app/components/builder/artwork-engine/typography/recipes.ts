import type { DesignElement } from '../../PrintStudioEditor';
import { createTextEffect, type TextEffectId } from '../../../../lib/textEffects';
import { textGradientAllowed, type TextAppearanceItem } from '../../../../lib/textAppearance';
import { fontIdentity } from '../../../../lib/workspaceFonts';
import { INK_DARK, INK_LIGHT, contrastRatio, readableInk } from '../geometry/colour';

/**
 * Text recipes (plan §9.6). A recipe is font + spacing + case + appearance stack + optional warp and finish.
 * The words always stay live (R5): applying one only changes style fields, and the pre-recipe style is kept
 * so switching recipes never compounds and "Original" restores it exactly.
 * Sizes are in em, so a recipe looks the same at any text size; colours are roles, so it reads on any garment.
 */
export type RecipeFamily = 'Sport' | 'Street' | 'Retro' | 'Statement';
export const RECIPE_FAMILIES: RecipeFamily[] = ['Sport', 'Street', 'Retro', 'Statement'];

type Colour = 'ink' | 'accent' | 'garment' | `#${string}` | { gradient: string[]; angle: number };
type Layer =
  | { type: 'fill'; colour: Colour; off?: boolean }
  | { type: 'stroke'; colour: Colour; width: number; join?: 'round' | 'miter' }
  | { type: 'shadow'; colour: Colour; x: number; y: number }
  | { type: 'extrude'; colour: Colour; depth: number; angle: number };
type WarpType = NonNullable<DesignElement['vectorTextEffects']>[number]['type'];

export type TextRecipe = {
  id: string; label: string; family: RecipeFamily;
  font: string; weight: 'normal' | 'bold'; italic?: boolean;
  upper?: boolean; tracking: number; leading?: number;
  /** Used when the design needs a second ink; flips if it would not read on the garment. */
  accent: string;
  /** Topmost first, as in the Appearance stack. */
  layers: Layer[];
  warp?: { type: WarpType; bend: number };
  finish?: { type: TextEffectId; intensity: number; seed: number };
  stack?: boolean;
};

const CHROME = { gradient: ['#f7f8fa', '#aeb4bd', '#ffffff', '#5c636d', '#d7dbe0'], angle: 90 };
const Y2K = { gradient: ['#ff7ad9', '#b48cff', '#6fd8ff'], angle: 0 };
const SUNSET = { gradient: ['#ffd166', '#f4845f', '#d6336c'], angle: 90 };

export const TEXT_RECIPES: TextRecipe[] = [
  { id: 'varsity', label: 'Varsity', family: 'Sport', font: 'Bevan', weight: 'normal', upper: true, tracking: .03, accent: '#c8102e',
    layers: [{ type: 'fill', colour: 'ink' }, { type: 'stroke', colour: 'garment', width: .05, join: 'miter' }, { type: 'stroke', colour: 'accent', width: .13, join: 'miter' }] },
  { id: 'college', label: 'College', family: 'Sport', font: 'Zilla Slab', weight: 'bold', upper: true, tracking: .06, accent: '#f2b705', warp: { type: 'arch', bend: 26 },
    layers: [{ type: 'fill', colour: 'ink' }, { type: 'shadow', colour: 'accent', x: .05, y: .05 }] },
  { id: 'racing', label: 'Racing', family: 'Sport', font: 'Kanit', weight: 'bold', italic: true, upper: true, tracking: -.01, accent: '#e4002b',
    layers: [{ type: 'fill', colour: 'ink' }, { type: 'extrude', colour: 'accent', depth: .09, angle: 160 }] },
  { id: 'motorsport', label: 'Motorsport', family: 'Sport', font: 'Orbitron', weight: 'bold', upper: true, tracking: .05, accent: '#ff5a00',
    layers: [{ type: 'fill', colour: 'ink' }, { type: 'shadow', colour: 'accent', x: .045, y: .045 }] },
  { id: 'athletic', label: 'Athletic', family: 'Sport', font: 'Squada One', weight: 'normal', upper: true, tracking: .04, accent: '#1565c0',
    layers: [{ type: 'fill', colour: 'ink' }, { type: 'stroke', colour: 'accent', width: .07, join: 'miter' }] },

  { id: 'streetwear', label: 'Streetwear', family: 'Street', font: 'League Gothic', weight: 'normal', upper: true, tracking: .015, accent: '#ff3b1f',
    layers: [{ type: 'fill', colour: 'ink' }] },
  { id: 'techwear', label: 'Techwear', family: 'Street', font: 'JetBrains Mono', weight: 'bold', upper: true, tracking: .2, accent: '#b6ff00',
    layers: [{ type: 'fill', colour: 'ink' }] },
  { id: 'stacked', label: 'Stacked', family: 'Street', font: 'Antonio', weight: 'bold', upper: true, tracking: .01, leading: 92, stack: true, accent: '#ff3b1f',
    layers: [{ type: 'fill', colour: 'ink' }] },
  { id: 'outlined', label: 'Outlined', family: 'Street', font: 'League Spartan', weight: 'bold', upper: true, tracking: .03, accent: '#ffffff',
    layers: [{ type: 'fill', colour: 'ink', off: true }, { type: 'stroke', colour: 'ink', width: .028 }] },
  { id: 'distressed', label: 'Distressed', family: 'Street', font: 'Staatliches', weight: 'normal', upper: true, tracking: .04, accent: '#8c8c8c', finish: { type: 'distressed', intensity: 85, seed: 4127 },
    layers: [{ type: 'fill', colour: 'ink' }] },
  { id: 'photocopy', label: 'Photocopy', family: 'Street', font: 'Special Elite', weight: 'normal', upper: true, tracking: .02, accent: '#8c8c8c', finish: { type: 'photocopy', intensity: 90, seed: 9013 },
    layers: [{ type: 'fill', colour: 'ink' }] },

  { id: 'retro', label: 'Retro', family: 'Retro', font: 'Righteous', weight: 'normal', tracking: .01, accent: '#f4845f', warp: { type: 'rise', bend: 14 },
    layers: [{ type: 'fill', colour: 'ink' }, { type: 'shadow', colour: '#ffd166', x: .035, y: .035 }, { type: 'shadow', colour: '#f4845f', x: .07, y: .07 }, { type: 'shadow', colour: '#d6336c', x: .105, y: .105 }] },
  { id: 'vintage', label: 'Vintage', family: 'Retro', font: 'Ultra', weight: 'normal', upper: true, tracking: .02, accent: '#b5533c', finish: { type: 'vintage-print', intensity: 80, seed: 2281 },
    layers: [{ type: 'fill', colour: 'ink' }, { type: 'shadow', colour: 'accent', x: .04, y: .04 }] },
  { id: 'y2k', label: 'Y2K', family: 'Retro', font: 'Audiowide', weight: 'normal', tracking: .01, accent: '#b48cff', warp: { type: 'bulge', bend: 24 },
    layers: [{ type: 'fill', colour: Y2K }, { type: 'stroke', colour: '#17171c', width: .03 }] },
  { id: 'bubble', label: 'Bubble', family: 'Retro', font: 'Baloo 2', weight: 'bold', tracking: -.01, accent: '#ff7ad9', warp: { type: 'inflate', bend: 26 },
    layers: [{ type: 'fill', colour: 'ink' }, { type: 'stroke', colour: 'accent', width: .11 }, { type: 'shadow', colour: '#17171c', x: .03, y: .07 }] },

  { id: 'luxury', label: 'Luxury serif', family: 'Statement', font: 'Bodoni Moda', weight: 'normal', upper: true, tracking: .24, accent: '#b89b5e',
    layers: [{ type: 'fill', colour: 'ink' }] },
  { id: 'chrome', label: 'Chrome', family: 'Statement', font: 'Russo One', weight: 'normal', upper: true, tracking: .02, accent: '#5c636d',
    layers: [{ type: 'fill', colour: CHROME }, { type: 'stroke', colour: '#2b2f36', width: .025 }, { type: 'extrude', colour: '#5c636d', depth: .05, angle: 90 }] },
  { id: 'inflated', label: 'Inflated', family: 'Statement', font: 'Fredoka', weight: 'bold', tracking: -.015, accent: '#7c5cff', warp: { type: 'inflate', bend: 46 },
    layers: [{ type: 'fill', colour: 'ink' }, { type: 'stroke', colour: 'accent', width: .05 }, { type: 'extrude', colour: 'accent', depth: .07, angle: 90 }] },
  { id: 'sunset', label: 'Sunset', family: 'Statement', font: 'Pacifico', weight: 'normal', tracking: 0, accent: '#d6336c', warp: { type: 'arc', bend: 14 },
    layers: [{ type: 'fill', colour: SUNSET }, { type: 'shadow', colour: '#17171c', x: .035, y: .04 }] },
];

/** Every field a recipe may change. Position, size, words, rotation and print method are never touched. */
const STYLE_KEYS = ['fontFamily', 'fontId', 'fontPostscriptName', 'fontDisplayName', 'fontWeight', 'fontStyle', 'fontAxes', 'fontFeatures', 'letterSpacing', 'lineSpacing',
  'textTransform', 'textAppearance', 'textEffects', 'textShapeMode', 'textShapeSource', 'vectorTextEffects', 'textCurveAmount', 'textCurveShape', 'textCurveDirection',
  'textStackFit', 'textFillMode', 'borderWidth', 'borderColor', 'textShadowEnabled', 'shadowBlur', 'color'] as const;
type StyleKey = typeof STYLE_KEYS[number];
export type TextRecipeState = { id: string; /** Font size the appearance was last scaled for. */ size?: number; base: Partial<Pick<DesignElement, StyleKey>> };

const styleOf = (element: DesignElement) => Object.fromEntries(STYLE_KEYS.map(key => [key, element[key]])) as TextRecipeState['base'];
const isHex = (value?: string) => /^#[0-9a-f]{6}$/i.test(value ?? '');

/** Colour roles for a garment: the user's ink, a readable accent, and the garment itself (or the ink's opposite off-garment). */
export function recipeColours(ink: string | undefined, accent: string, surface?: string) {
  const main = isHex(ink) ? readableInk(ink!, surface) : readableInk(INK_DARK, surface);
  const opposite = contrastRatio(main, INK_DARK) >= contrastRatio(main, INK_LIGHT) ? INK_DARK : INK_LIGHT;
  return { ink: main, accent: readableInk(accent, surface, 1.6), garment: isHex(surface) ? surface! : opposite };
}

function paint(colour: Colour, roles: ReturnType<typeof recipeColours>, gradients: boolean): string {
  if (typeof colour === 'object') {
    if (!gradients) return colour.gradient[Math.floor(colour.gradient.length / 2)];
    const stops = colour.gradient.map((color, index) => ({ color, offset: index / (colour.gradient.length - 1) }));
    return 'paint:' + JSON.stringify({ kind: 'linear', angle: colour.angle, x: .5, y: .5, stops });
  }
  return colour === 'ink' || colour === 'accent' || colour === 'garment' ? roles[colour] : colour;
}

/** The patch that puts a recipe on a text object. */
export function applyTextRecipe(element: DesignElement, recipeId: string, surface: string | undefined, unitsPerCm: number): Partial<DesignElement> {
  const recipe = TEXT_RECIPES.find(item => item.id === recipeId);
  if (!recipe) return {};
  const base = element.textRecipe?.base ?? styleOf(element);
  const size = element.fontSize ?? 30, units = Math.max(.0001, unitsPerCm), mm = (em: number) => em * size * 10 / units;
  const roles = recipeColours(base.color, recipe.accent, surface), gradients = textGradientAllowed(element.printMethod);
  const textAppearance: TextAppearanceItem[] = recipe.layers.map((layer, index): TextAppearanceItem => {
    const common = { id: `recipe-${recipe.id}-${index}`, enabled: true, colour: paint(layer.colour, roles, gradients) };
    if (layer.type === 'fill') return { ...common, type: 'fill', enabled: !layer.off };
    if (layer.type === 'stroke') return { ...common, type: 'stroke', widthMm: mm(layer.width), position: 'outside', join: layer.join ?? 'round' };
    if (layer.type === 'shadow') return { ...common, type: 'shadow', xMm: mm(layer.x), yMm: mm(layer.y) };
    return { ...common, type: 'extrude', depthMm: mm(layer.depth), angle: layer.angle };
  });
  const finish = recipe.finish ? { ...createTextEffect(recipe.finish.type), id: `recipe-${recipe.id}-finish`, intensity: recipe.finish.intensity, seed: recipe.finish.seed } : undefined;
  return {
    ...base,
    fontId: undefined, fontPostscriptName: undefined, fontDisplayName: undefined,
    ...fontIdentity(recipe.font),
    fontFamily: recipe.font, fontWeight: recipe.weight, fontStyle: recipe.italic ? 'italic' : 'normal', fontAxes: undefined, fontFeatures: undefined,
    letterSpacing: recipe.tracking * size, lineSpacing: recipe.leading ?? base.lineSpacing,
    textTransform: recipe.upper ? 'uppercase' : 'none', color: roles.ink, textFillMode: undefined, borderWidth: 0, textShadowEnabled: false, shadowBlur: 0,
    textAppearance, textEffects: finish ? [finish] : undefined, textUnitsPerCm: units,
    ...(recipe.warp ? { textShapeMode: 'warp' as const, textCurveAmount: 0, textStackFit: false, vectorTextEffects: [{ id: 'text-shape', type: recipe.warp.type, enabled: true, bend: recipe.warp.bend, horizontal: 0, vertical: 0 }] } : {}),
    ...(recipe.stack ? { textShapeMode: 'stack' as const, textStackFit: true, textCurveAmount: 0, vectorTextEffects: undefined } : {}),
    textRecipe: { id: recipe.id, size, base },
  };
}

/** Back to exactly how the text looked before any recipe. */
export function clearTextRecipe(element: DesignElement): Partial<DesignElement> {
  return element.textRecipe ? { ...element.textRecipe.base, textRecipe: undefined } : {};
}
