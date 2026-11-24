import { useContext, useMemo, useRef, useState } from 'react';
import { ArtworkSurfaceContext } from '../../printsStudio/ArtworkSurfaceContext';
import { useArtworkScene } from '../state/scene';
import { applyTextRecipe, clearTextRecipe } from '../typography/recipes';
import type { DesignElement } from '../../PrintStudioEditor';
import { alignArtwork, arrangeArtwork, distributeArtwork, type Area } from '../../../../lib/artworkArrange';
import { ContextToolbar, useSelectionAnchor } from './ContextToolbar';
import { contextActionsFor, type ContextHandlers } from './contextActions';
import { inkOf, selectionColours, recolourSelection, inkPatch } from '../state/sharedProperties';
import { groupDesignLayers, groupLayersIssue } from '../../../../lib/designGroups';
import { useCombine } from './useCombine';
import { startShapeBuilder } from '../state/shapeBuilder';
import { createRepeat } from '../geometry/repeat';
import { blendIssue, createBlend } from '../geometry/blend';
import { createOverlap, overlapIssue } from '../geometry/overlap';
import { createReflection } from '../geometry/fade';
import { placeTextInside, textAndShape, warpTextToShape, bendTextInShape } from '../geometry/textFit';
import { outlineTextForCombine } from '../geometry/combine';
import { createBoolean } from '../../../../lib/booleanArtwork';
import { loadFontLibrary } from '../../printsStudio/designLibrary';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import { revealImageTool } from '../state/imageTool';
import { clearRestyle, restyleDrawing } from '../../../../lib/drawingRestyle';
import { BRUSH_PRESETS, type BrushPreset } from '../../../../lib/drawingBrush';
import { TEXT_EFFECTS, createShapeEffect, type TextEffectId } from '../../../../lib/textEffects';

const QUICK_DRAWING_EFFECTS = (['distressed', 'halftone', 'riso', 'screen-print', 'sticker', 'glow', 'long-shadow', 'foil', 'chrome', 'glitter', 'embroidery', 'gradient'] as TextEffectId[]).map(id => ({ id, label: TEXT_EFFECTS.find(effect => effect.id === id)?.label ?? id }));
const QUICK_RESTYLES = ['inflate', 'stipple-tube', 'puffy-paint', 'balloon', 'chrome-tube', 'neon-tube', 'halo-line', 'hairline', 'spray', 'chalk', 'marker', 'pen'].map(id => ({ id, label: BRUSH_PRESETS.find(brush => brush.id === id)?.label ?? id }));
import type { ImageFilterId } from '../../../../lib/imageFilters';

const IMAGE_LOOKS: { id: ImageFilterId; label: string }[] = [{ id: 'none', label: 'Original' }, { id: 'bw', label: 'B&W' }, { id: 'vintage', label: 'Vintage' }, { id: 'film', label: 'Film' }, { id: 'washed', label: 'Washed' }, { id: 'duotone', label: 'Duotone' }, { id: 'halftone', label: 'Halftone' }, { id: 'screen-print', label: 'Screen print' }, { id: 'threshold', label: 'Threshold' }];

/** Every colour in the selection as its own swatch. Changing one recolours it everywhere it is used. */
function SelectionColours({ elements, ids, onChange }: { elements: DesignElement[]; ids: string[]; onChange: (next: DesignElement[]) => void }) {
  const colours = selectionColours(elements.filter(element => ids.includes(element.id)));
  if (!colours.length) return null;
  const shown = colours.slice(0, 5);
  return <span className="cx-selection-colours" role="group" aria-label="Selection colours">{shown.map(group => <ColourWell key={group.colour + group.uses.map(use => use.key).join()} label={group.labels.join(', ') + (group.uses.length > 1 ? ` · ${group.uses.length} places` : '')} value={group.colour} onChange={colour => onChange(recolourSelection(elements, group.uses, colour))} />)}{colours.length > shown.length && <small>+{colours.length - shown.length}</small>}</span>;
}

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
    makeVector: selected?.type === 'drawing' && selected.drawing?.strokes.length ? () => revealImageTool('vector') : undefined,
    drawingEffects: selected?.type === 'drawing' && selected.drawing?.strokes.length ? {
      options: QUICK_DRAWING_EFFECTS, active: (selected.shapeEffects ?? []).map(effect => effect.type),
      toggle: id => { const current = selected.shapeEffects ?? [], has = current.some(effect => effect.type === id); onUpdate(selected.id, { shapeEffects: has ? current.filter(effect => effect.type !== id) : [...current, { ...createShapeEffect(id as TextEffectId), id: crypto.randomUUID() }] }); },
    } : undefined,
    restyle: selected?.type === 'drawing' && selected.drawing?.strokes.length ? {
      active: selected.drawingRestyle?.preset ?? selected.drawing.strokes[0].settings.brushPreset, options: QUICK_RESTYLES,
      apply: id => onUpdate(selected.id, restyleDrawing(selected, id as BrushPreset)),
      clear: selected.drawingRestyle ? () => onUpdate(selected.id, clearRestyle(selected)) : undefined,
    } : undefined,
    image: selected?.type === 'image' ? {
      looks: IMAGE_LOOKS, look: selected.imageFilter?.id ?? 'none',
      setLook: id => onUpdate(selected.id, { imageFilter: id === 'none' ? undefined : { id: id as ImageFilterId, intensity: selected.imageFilter?.intensity ?? 100 } }),
      cutout: Boolean(selected.imageGrade?.cutout) || selected.imageFilter?.id === 'remove-background',
      toggleCutout: () => {
        const on = Boolean(selected.imageGrade?.cutout) || selected.imageFilter?.id === 'remove-background';
        onUpdate(selected.id, { imageGrade: { ...selected.imageGrade, cutout: on ? undefined : { id: 'remove-background', intensity: 100 } }, ...(selected.imageFilter?.id === 'remove-background' ? { imageFilter: undefined } : {}) });
      },
      recolour: () => revealImageTool('recolour'), trace: () => revealImageTool('trace'),
    } : undefined,
    align: (to, scope) => onChange(alignArtwork(elements, ids, to, scope === 'print-area' ? area : undefined), selectedId ?? undefined),
    distribute: axis => onChange(distributeArtwork(elements, ids, axis), selectedId ?? undefined),
    group: multi && !groupLayersIssue(elements, ids) ? () => { const id = crypto.randomUUID(); onChange(groupDesignLayers(elements, ids, id), id); } : undefined,
    combine: multi && !combine.issue ? { previews: combine.previews, run: op => void combine.run(op), builder: () => { studio.setBooleanPreview([]); startShapeBuilder(ids); }, overlap: !overlapIssue(elements, ids) ? () => { const id = crypto.randomUUID(); void fitRun(() => createOverlap(elements, ids, id, fonts), id); } : undefined } : undefined,
    repeat: selected && !selected.artworkRepeat && selected.type !== 'group' ? mode => { const id = crypto.randomUUID(); onChange(createRepeat(elements, selected.id, mode, id), id); } : undefined,
    textInShape: pair ? {
      inside: () => void fitRun(() => placeTextInside(elements, pair.textId, pair.shapeId, fonts), pair.textId),
      warp: () => void fitRun(() => warpTextToShape(elements, pair.textId, pair.shapeId, fonts), pair.textId),
      bend: () => void fitRun(() => bendTextInShape(elements, pair.textId, pair.shapeId, fonts), pair.textId),
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
    ? contextActionsFor({ kind: 'multi', count: ids.length, colourControl: <SelectionColours elements={elements} ids={ids} onChange={next => onChange(next, selectedId ?? undefined)} /> }, handlers)
    : contextActionsFor({ kind: 'single', type: selected?.type ?? '', locked: selected?.locked,
        colourControl: colourable && selected ? <SelectionColours elements={elements} ids={[selected.id]} onChange={next => onChange(next, selected.id)} /> : undefined }, handlers);

  return <div ref={setHost} data-editor-chrome className="cx-context-host" aria-hidden={!anchor}>
    {(multi || selected) && <ContextToolbar anchor={anchor} hostWidth={host?.offsetWidth ?? 0} hostHeight={host?.offsetHeight ?? 0} actions={actions} overflow={overflow}
      label={multi ? `${ids.length} objects selected` : `${selected?.type ?? 'Artwork'} actions`} hidden={hidden} />}
  </div>;
}
