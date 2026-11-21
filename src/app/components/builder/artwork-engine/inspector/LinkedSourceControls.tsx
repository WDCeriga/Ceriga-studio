import { useEffect, useRef, useState } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { outlineLettering } from '../../../../lib/editableLettering';
import { loadFontLibrary } from '../../printsStudio/designLibrary';
import { useArtworkDocument } from '../../printsStudio/ArtworkDocumentContext';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import { ClothingFontPicker } from '../../shell/ClothingFontPicker';
import { fontIdentity } from '../../../../lib/workspaceFonts';
import { restoreBuiltShapes } from '../geometry/shapeBuilder';
import { startShapeBuilder } from '../state/shapeBuilder';

/** Words inside a Combine / Cut out: retype or restyle them and the result updates. */
export function CombinedTextSource({ child, update }: { child: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const source = child.letteringSource;
  const [words, setWords] = useState(source?.content ?? '');
  const [error, setError] = useState('');
  const latest = useRef({ child, update }); latest.current = { child, update };
  useEffect(() => { setWords(source?.content ?? ''); }, [child.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!source) return null;
  const rebuild = async (patch: Partial<DesignElement>) => {
    const current = latest.current.child, base = current.letteringSource;
    if (!base) return;
    try {
      const nextSource = { ...base, ...patch };
      const outlined = await outlineLettering(nextSource, loadFontLibrary());
      if (latest.current.child.id !== current.id) return;
      setError('');
      latest.current.update({ ...outlined, type: 'shape', x: current.x, y: current.y, rotation: current.rotation, shapeFilled: true, shapeFillColor: current.shapeFillColor, borderWidth: 0, letteringSource: nextSource, layerName: `Text: ${nextSource.content}` });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the words.'); }
  };
  return <div className="cx-linked-text">
    <label className="studio-field">Words<textarea aria-label="Combined words" rows={2} style={{ resize: 'none' }} value={words}
      onChange={event => { setWords(event.target.value); if (event.target.value.trim()) void rebuild({ content: event.target.value }); }} /></label>
    <label className="studio-field">Font<ClothingFontPicker value={source.fontFamily ?? 'Inter'} sample={words} onChange={fontFamily => void rebuild({ fontFamily, ...fontIdentity(fontFamily) })} /></label>
    {error && <p role="alert">{error}</p>}
  </div>;
}

/** An overlap follows its two objects until it is unlinked into an ordinary shape. */
export function OverlapLinkControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  if (!element.overlapOf) return null;
  return <div className="path-workflow-actions cx-built-shape"><button type="button" onClick={() => update({ overlapOf: undefined, hidden: false, layerName: 'Overlap shape' })}>Unlink overlap</button></div>;
}

/** On a shape made by the shape builder: reopen it, or return to the original shapes. */
export function BuiltShapeControls({ element }: { element: DesignElement }) {
  const artwork = useArtworkDocument(), studio = usePrintsStudio();
  if (!element.builtFrom || !artwork) return null;
  const restore = (reopen: boolean) => {
    const result = restoreBuiltShapes(artwork.elements, element.builtFrom!.id);
    artwork.onChange(result.elements, result.restored[0]);
    if (reopen && result.restored.length > 1) {
      studio.setSelectionIds(result.restored);
      startShapeBuilder(result.restored);
    } else { artwork.onSelect(result.restored[0] ?? null); }
  };
  return <div className="path-workflow-actions cx-built-shape">
    <button type="button" onClick={() => restore(true)}>Edit pieces</button>
    <button type="button" onClick={() => restore(false)}>Restore shapes</button>
  </div>;
}
