import type { DesignElement } from '../../PrintStudioEditor';

/**
 * A recipe's outlines, shadows and depth belong to the letters: when the text is resized they scale with it,
 * so a Varsity outline keeps its proportion at any size. Runs in the layer pipeline, whichever control resized it.
 */
export function refreshTextRecipeScale(element: DesignElement): DesignElement {
  const recipe = element.textRecipe, size = element.fontSize;
  if (!recipe?.size || !size || Math.abs(size - recipe.size) < 1e-6) return element;
  const k = size / recipe.size, scaled = (value?: number) => value === undefined ? undefined : value * k;
  return {
    ...element,
    textRecipe: { ...recipe, size },
    textAppearance: element.textAppearance?.map(item => ({ ...item, widthMm: scaled(item.widthMm), xMm: scaled(item.xMm), yMm: scaled(item.yMm), depthMm: scaled(item.depthMm) })),
  };
}
