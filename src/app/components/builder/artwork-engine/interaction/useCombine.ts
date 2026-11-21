import { useEffect, useMemo, useState } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { createBoolean, type BooleanOperation } from '../../../../lib/booleanArtwork';
import { loadFontLibrary } from '../../printsStudio/designLibrary';
import { combineIssue, combinePreviews, outlineTextForCombine, type CombinePreview } from '../geometry/combine';

/**
 * Combine state for a selection: why it can't combine, real result thumbnails, and `run(op)`.
 * Text in the selection is outlined in the background so its previews are real too.
 */
export function useCombine(elements: DesignElement[], ids: string[], commit: (next: DesignElement[], id: string) => void) {
  const key = ids.join('|');
  const imports = useMemo(() => loadFontLibrary(), []);
  const issue = ids.length > 1 ? combineIssue(elements, ids, imports) : 'Select two or more shapes or words.';
  const [prepared, setPrepared] = useState<{ key: string; source: DesignElement[]; elements: DesignElement[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (issue) return;
    let live = true;
    outlineTextForCombine(elements, ids, imports)
      .then(next => { if (live) setPrepared({ key, source: elements, elements: next }); })
      .catch(() => { if (live) setPrepared(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, elements, issue]);

  const ready = prepared && prepared.key === key && prepared.source === elements ? prepared.elements : null;
  const previews: CombinePreview[] = useMemo(() => ready && !issue ? combinePreviews(ready, ids) : [], [ready, key, issue]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (op: BooleanOperation) => {
    setError('');
    try {
      const base = ready ?? await outlineTextForCombine(elements, ids, imports);
      const id = crypto.randomUUID();
      commit(createBoolean(base, ids, op, id), id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not combine these.'); }
  };
  /** The prepared (outlined) elements, for an on-canvas hover preview. */
  const previewElements = (op: BooleanOperation) => {
    if (!ready) return [];
    try { return createBoolean(ready, ids, op, 'boolean-preview').filter(element => element.id === 'boolean-preview'); } catch { return []; }
  };
  return { issue, previews, ready: Boolean(ready), run, previewElements, error };
}
