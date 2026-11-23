import { useContext, useMemo, useRef, useState } from 'react';
import { ArtworkSurfaceContext } from '../../printsStudio/ArtworkSurfaceContext';
import { useArtworkScene } from '../state/scene';
import { applyTextRecipe, clearTextRecipe } from '../typography/recipes';
import type { DesignElement } from '../../PrintStudioEditor';
import { alignArtwork, arrangeArtwork, distributeArtwork, type Area } from '../../../../lib/artworkArrange';
import { ContextToolbar, useSelectionAnchor } from './ContextToolbar';
import { contextActionsFor, type ContextHandlers } from './contextActions';
import { inkOf, inkPatch } from '../state/sharedProperties';
import { groupDesignLayers, groupLayersIssue } from '../../../../lib/designGroups';
import { useCombine } from './useCombine';
import { startShapeBuilder } from '../state/shapeBuilder';
import { createRepeat } from '../geometry/repeat';
import { blendIssue, createBlend } from '../geometry/blend';
import { createOverlap, overlapIssue } from '../geometry/overlap';
import { createReflection } from '../geometry/fade';
import { placeTextInside, textAndShape, warpTextToShape } from '../geometry/textFit';
import { outlineTextForCombine } from '../geometry/combine';
import { createBoolean } from '../../../../lib/booleanArtwork';
import { loadFontLibrary } from '../../printsStudio/designLibrary';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';

/** A quiet round colour well (native picker) for the context toolbar. */
function ColourWell({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  return <label className="cx-colour-well" title={label} style={{ background: value }}>
    <input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#171717'} onChange={event => onChange(event.target.value)} />
  </label>;
}

/**
 * Hosts the engine's context toolbar inside an Artwork canvas. The editor supplies its existing
 * operations; this component decides the actions (plan §7) and where the bar sits.
 */
export function ArtworkContextBar({ elements, selectedId, selectionIds, hidden, printArea, onChange, onDuplicate, onRemove, onUpdate, onEditText, onCrop }: {
  elements: DesignElement[];
  selectedId: string | null;
  selectionIds: string[];
  hidden: boolean;
  printArea?: Area;
  onChange: (elements: DesignElement[], selectedId?: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<DesignElement>) => void;
  onEditText: (id: string) => void;
  onCrop: (id: string) => void;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const studio = usePrintsStudio();
  const scene = useArtworkScene();
  const onSurface = useContext(ArtworkSurfaceContext);
  const multi = selectionIds.length > 1;
  const ids = multi ? selectionIds : selectedId ? [selectedId] : [];
  const anchor = useSelectionAnchor(host, hidden ? [] : ids);
  const selected = !multi && selectedId ? elements.find(element => element.id === selectedId) : undefined;
  const area = printArea && printArea.width > 0 ? printArea : undefined;
  const pair = multi && !hidden ? textAndShape(elements, ids) : null;
  const fonts = useMemo(() => loadFontLibrary(), []);
  const knockoutId = useRef<string | null>(null);
  const fitRun = async (work: () => Promise<DesignElement[]>, selectId: string | undefined) => {
    try { const next = await work(); onChange(next, selectId ?? knockoutId.current ?? undefined); studio.setSelectionIds([]); studio.setSelectionAdditive(false); }
    catch (error) { console.warn('Text + shape', error); }
  };
  const combine = useCombine(elements, multi && !hidden ? ids : [], (next, id) => { onChange(next, id); studio.setSelectionIds([]); studio.setSelectionAdditive(false); studio.setBooleanPreview([]); });


  const handlers: ContextHandlers = {
    duplicate: () => {
      if (!multi && selectedId) { onDuplicate(selectedId); return; }
      const copies = elements.filter(element => ids.includes(element.id)).map((element, index) => ({ ...element, id: `${Date.now()}-${index}`, x: element.x + 12, y: element.y + 12, locked: false }));
      onChange([...elements, ...copies], copies[0]?.id);
    },
    remove: () => {
      if (!multi && selectedId) { onRemove(selectedId); return; }
      onChange(elements.filter(element => !ids.includes(element.id) || element.locked), undefined);
    },
    flip: axis => { if (selected) onUpdate(selected.id, axis === 'x' ? { flipHorizontal: !selected.flipHorizontal } : { flipVertical: !selected.flipVertical }); },
    toggleLock: () => { if (selected) onUpdate(selected.id, { locked: !selected.locked }); },
    arrange: direction => onChange(arrangeArtwork(elements, ids, direction), selectedId ?? undefined),
    editText: selected?.type === 'text' ? () => onEditText(selected.id) : undefined,
    crop: selected?.type === 'image' ? () => onCrop(selected.id) : undefined,
    align: (to, scope) => onChange(alignArtwork(elements, ids, to, scope === 'print-area' ? area : undefined), selectedId ?? undefined),
    distribute: axis => onChange(distributeArtwork(elements, ids, axis), selectedId ?? undefined),
    group: multi && !groupLayersIssue(elements, ids) ? () => { const id = crypto.randomUUID(); onChange(groupDesignLayers(elements, ids, id), id); } : undefined,
    combine: multi && !combine.issue ? { previews: combine.previews, run: op => void combine.run(op), builder: () => { studio.setBooleanPreview([]); startShapeBuilder(ids); }, overlap: !overlapIssue(elements, ids) ? () => { const id = crypto.randomUUID(); void fitRun(() => createOverlap(elements, ids, id, fonts), id); } : undefined } : undefined,
    repeat: selected && !selected.artworkRepeat && selected.type !== 'group' ? mode => { const id = crypto.randomUUID(); onChange(createRepeat(elements, selected.id, mode, id), id); } : undefined,
    textInShape: pair ? {
      inside: () => void fitRun(() => placeTextInside(elements, pair.textId, pair.shapeId, fonts), pair.textId),
      warp: () => void fitRun(() => warpTextToShape(elements, pair.textId, pair.shapeId, fonts), pair.textId),
      knockout: () => void fitRun(async () => {
        // Text must sit above the shape for Cut out; then outline it behind the scenes and subtract.
        const ordered = [...elements.filter(e => e.id !== pair.textId)]; ordered.splice(ordered.findIndex(e => e.id === pair.shapeId) + 1, 0, elements.find(e => e.id === pair.textId)!);
        const prepared = await outlineTextForCombine(ordered, ids, fonts), id = crypto.randomUUID();
        knockoutId.current = id; return createBoolean(prepared, ids, 'subtract', id);
      }, undefined),
    } : undefined,
    reflect: selected && !selected.reflectionOf && !elements.some(element => element.reflectionOf?.of === selected.id) ? () => onChange(createReflection(elements, selected.id, crypto.randomUUID(), studio.unitsPerCm * .2), selected.id) : undefined,
    stretchLetters: selected?.type === 'text' ? { on: studio.adjustLettersId === selected.id, toggle: () => studio.setAdjustLettersId(studio.adjustLettersId === selected.id ? null : selected.id) } : undefined,
    textRecipes: selected?.type === 'text' ? {
      active: selected.textRecipe?.id,
      apply: id => onUpdate(selected.id, applyTextRecipe(selected, id, onSurface ? undefined : scene.surfaceColour, studio.unitsPerCm)),
      clear: selected.textRecipe ? () => onUpdate(selected.id, clearTextRecipe(selected)) : undefined,
    } : undefined,
    blend: multi && !hidden && !blendIssue(elements, ids) ? () => { const id = crypto.randomUUID(); onChange(createBlend(elements, ids, id, studio.unitsPerCm, onSurface ? undefined : scene.surfaceColour), id); studio.setSelectionIds([]); studio.setSelectionAdditive(false); } : undefined,
    centreOnGarment: () => { if (!area) return; onChange(alignArtwork(alignArtwork(elements, ids, 'center', area), ids, 'middle', area), selectedId ?? undefined); },
  };

  const colourable = selected && (selected.type === 'text' || selected.type === 'shape');
  const { actions, overflow } = multi
    ? contextActionsFor({ kind: 'multi', count: ids.length }, handlers)
    : contextActionsFor({ kind: 'single', type: selected?.type ?? '', locked: selected?.locked,
        colourControl: colourable && selected ? <ColourWell label="Colour" value={inkOf(selected)} onChange={colour => onUpdate(selected.id, inkPatch(selected, colour))} /> : undefined }, handlers);

  return <div ref={setHost} data-editor-chrome className="cx-context-host" aria-hidden={!anchor}>
    {(multi || selected) && <ContextToolbar anchor={anchor} hostWidth={host?.offsetWidth ?? 0} actions={actions} overflow={overflow}
      label={multi ? `${ids.length} objects selected` : `${selected?.type ?? 'Artwork'} actions`} hidden={hidden} />}
  </div>;
}
