import type { BooleanOperation } from '../../../../lib/booleanArtwork';
import { COMBINE_OPS, type CombinePreview } from '../geometry/combine';

/** The actual result of an operation as a small filled silhouette. */
export function CombineThumb({ preview, size = 34 }: { preview?: CombinePreview; size?: number }) {
  if (!preview || 'empty' in preview) return <svg className="cx-combine-thumb is-empty" width={size} height={size} viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5h6" /></svg>;
  return <svg className="cx-combine-thumb" width={size} height={size} viewBox={preview.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d={preview.d} fillRule="evenodd" /></svg>;
}

/** Combine tiles: real result previews, short names, hover shows the result on the garment. */
export function CombineChoices({ previews, onRun, onPreview, disabled }: {
  previews: CombinePreview[];
  onRun: (op: BooleanOperation) => void;
  onPreview?: (op: BooleanOperation | null) => void;
  disabled?: boolean;
}) {
  return <div className="cx-combine-choices" role="group" aria-label="Combine">
    {COMBINE_OPS.map(({ op, label, hint }) => {
      const preview = previews.find(item => item.op === op);
      const empty = Boolean(preview && 'empty' in preview);
      return <button key={op} type="button" title={empty ? 'Nothing left with this option' : hint} disabled={disabled || empty}
        onMouseEnter={() => onPreview?.(op)} onMouseLeave={() => onPreview?.(null)} onFocus={() => onPreview?.(op)} onBlur={() => onPreview?.(null)}
        onClick={() => onRun(op)}>
        <CombineThumb preview={preview} /><span>{label}</span>
      </button>;
    })}
  </div>;
}
