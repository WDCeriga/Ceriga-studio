import { canAcceptImportedConstruction, importedGarmentLayers, type ImportedGarment, type ImportedGarmentView } from './importedGarment';

/** Construction review gates editing, not the availability of individual builder pages. */
export function canShowImportedBuilderOptions(garment: ImportedGarment): boolean {
  return Boolean(garment.accepted && canAcceptImportedConstruction(garment));
}

export function importedBuilderControlNotice(garment: ImportedGarment, step: number, view: ImportedGarmentView): string | undefined {
  if ([3, 4, 5].includes(step)) return 'Construction choices and trim colours below are saved as specifications only; they do not replace or reshape imported ink. Use the semantic region controls above for visible fabric and colour changes.';
  if (step === 6) return 'Existing pockets and closures stay in the semantic controls above. Added openings, closures and details are preview overlays; they do not remove or replace inseparable source ink. Pocket / zip trim colour and notes are specifications only; recolour existing parts with their semantic controls.';
  if (step === 7) return importedGarmentLayers(garment, view).some(layer => layer.kind === 'solid' && layer.washable !== false)
    ? 'Wash and fading preview on editable fabric fills only. Source construction ink, hardware and decorations remain unchanged.'
    : 'This view has no editable fabric fills. Wash settings are saved as specifications only and cannot visibly fade inseparable source ink. Review construction regions to identify fabric fills.';
  if (step === 8) return [...garment.parts, ...(garment.detailLayers ?? [])].some(part => part.view === view && part.stitchSvg?.includes('<path'))
    ? 'Thread controls above affect separately extracted stitches only. Stitching style and thread colour below are saved as specifications; they do not redraw source seams.'
    : 'Stitches are inseparable from source ink in this view. Thread visibility, colour, weight and stitching style are saved as specifications only; they cannot change the source preview.';
  return undefined;
}
