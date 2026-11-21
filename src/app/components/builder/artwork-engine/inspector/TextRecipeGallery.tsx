import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { ArtworkSurfaceContext } from '../../printsStudio/ArtworkSurfaceContext';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import { TextArtwork } from '../../printsStudio/TextArtwork';
import { useArtworkScene } from '../state/scene';
import { RECIPE_FAMILIES, TEXT_RECIPES, applyTextRecipe, clearTextRecipe, type RecipeFamily } from '../typography/recipes';
import { TextRecipeCustomiser } from './TextRecipeCustomiser';
import './text-recipes.css';

const TILE_SIZE = 36;

/** The real text renderer, fitted into a tile, showing the user's word on the garment colour. */
const RecipePreview = memo(function RecipePreview({ word, ink, recipeId, surface, units, printMethod }: { word: string; ink: string; recipeId: string; surface?: string; units: number; printMethod?: DesignElement['printMethod'] }) {
  const host = useRef<HTMLSpanElement>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [room, setRoom] = useState(110);
  useEffect(() => {
    const node = host.current; if (!node) return;
    const read = () => setRoom(Math.max(40, node.clientWidth - 12));
    read(); const observer = new ResizeObserver(read); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const element = useMemo(() => {
    const base: DesignElement = { id: 'recipe-preview-' + recipeId, type: 'text', content: word, x: 0, y: 0, width: frame?.width ?? 200, height: frame?.height ?? TILE_SIZE, rotation: 0, color: ink, fontSize: TILE_SIZE, textFrameMode: 'point', autoWidth: true, autoHeight: true, printMethod } as DesignElement;
    return { ...base, ...applyTextRecipe(base, recipeId, surface, units) } as DesignElement;
  }, [word, ink, recipeId, surface, units, printMethod, frame]);
  const scale = frame ? Math.min(room / Math.max(1, frame.width), 34 / Math.max(1, frame.height), 1) : 0;
  return <span ref={host} className="cx-recipe-tile__art" aria-hidden="true">
    <span style={{ width: frame?.width ?? 200, height: frame?.height ?? TILE_SIZE, transform: `scale(${scale})`, opacity: frame ? 1 : 0 }}>
      <TextArtwork element={element} fontSize={TILE_SIZE} onFrameChange={next => setFrame(current => current && Math.abs(current.width - next.width) < .5 && Math.abs(current.height - next.height) < .5 ? current : next)} />
    </span>
  </span>;
});

/** One-tap type styles, drawn with the user's own word. Words stay editable; Original undoes the look. */
export function TextRecipeGallery({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const studio = usePrintsStudio(), scene = useArtworkScene(), onSurface = useContext(ArtworkSurfaceContext);
  const surface = onSurface ? undefined : scene.surfaceColour;
  const activeFamily = TEXT_RECIPES.find(recipe => recipe.id === element.textRecipe?.id)?.family;
  const [customising, setCustomising] = useState(false);
  const [family, setFamily] = useState<RecipeFamily>(activeFamily ?? 'Sport');
  // A style picked from the floating bar opens its family here.
  useEffect(() => { if (activeFamily) setFamily(activeFamily); }, [activeFamily]);
  const word = (element.content || 'Text').split(/\r?\n/)[0].trim().slice(0, 10) || 'Text';
  const ink = element.textRecipe?.base.color ?? element.color ?? '#171717';
  return <div className="cx-recipes">
    <div className="cx-recipes__families" role="tablist" aria-label="Style families">
      {RECIPE_FAMILIES.map(name => <button key={name} type="button" role="tab" aria-selected={family === name} onClick={() => setFamily(name)}>{name}</button>)}
    </div>
    <div className="cx-recipes__grid">
      {TEXT_RECIPES.filter(recipe => recipe.family === family).map(recipe => <button key={recipe.id} type="button" className="cx-recipe-tile" aria-pressed={element.textRecipe?.id === recipe.id}
        onClick={() => update(applyTextRecipe(element, recipe.id, surface, studio.unitsPerCm))}>
        <span className="cx-recipe-tile__stage" style={{ background: surface ?? '#f5f5f4' }}>
          <RecipePreview word={word} ink={ink} recipeId={recipe.id} surface={surface} units={studio.unitsPerCm} printMethod={element.printMethod} />
        </span>
        <span className="cx-recipe-tile__name">{recipe.label}</span>
      </button>)}
    </div>
    {element.textRecipe && <>
      <button type="button" className="cx-recipes__customise" aria-expanded={customising} onClick={() => setCustomising(!customising)}><span>Customise</span></button>
      {customising && <TextRecipeCustomiser element={element} update={update} surface={surface} unitsPerCm={studio.unitsPerCm} />}
      <button type="button" className="cx-recipes__reset" onClick={() => update(clearTextRecipe(element))}>Back to original</button>
    </>}
  </div>;
}
