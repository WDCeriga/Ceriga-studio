import { FIT_SILHOUETTES, FIT_SILHOUETTE_VIEWBOX, type FitSilhouetteId } from './fitSilhouettes';

/**
 * Fit preview at true relative scale. Fits sit side by side on one shared scale, so no reference outline is drawn
 * by default (it added noise at thumbnail size); pass eference for a single, isolated comparison.
 * Colour follows the option card state via CSS (.cx-option[aria-checked] .cx-fit-body).
 */
export function FitSilhouette({ fit, reference = null }: { fit: FitSilhouetteId; reference?: FitSilhouetteId | null }) {
  const shape = FIT_SILHOUETTES[fit];
  return (
    <svg className="cx-fit" viewBox={FIT_SILHOUETTE_VIEWBOX} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {reference && reference !== fit && <path className="cx-fit-reference" d={FIT_SILHOUETTES[reference].outer} vectorEffect="non-scaling-stroke" />}
      <path className="cx-fit-body" d={shape.outer} />
    </svg>
  );
}
