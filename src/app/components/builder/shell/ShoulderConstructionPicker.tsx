import { SHOULDER_CONSTRUCTIONS, type ShoulderConstruction } from '../../../data/shoulderConstruction';
import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { VisualOptionGrid } from '../design-system';
import { FIT_SILHOUETTES, FIT_SILHOUETTE_VIEWBOX } from '../design-system/fitSilhouettes';
import type { GarmentAssetSelection } from '../../../data/garmentSvgCatalog';
import './sweatpants-controls.css';

// Shoulder construction drawn on the traced T-shirt silhouette (the same artwork as the Fit cards).
// Seam lines are placed proportionally on the garment; sleeve fabric (outside the seam) is shaded.
const [VX, VY, VW, VH] = FIT_SILHOUETTE_VIEWBOX.split(' ').map(Number);
const CX = VX + VW / 2, TOP = VY + 30, W = VW - 60, H = VH - 60;
const pt = (dx: number, dy: number): [number, number] => [CX - dx * W, TOP + dy * H];
// Seams for the left side as cubic paths (mirrored for the right). dx/dy are fractions of width/height.
const SEAMS: Record<ShoulderConstruction, { seam: string; start: [number, number]; end: [number, number] }> = (() => {
  const make = (s: [number, number], c1: [number, number], c2: [number, number], e: [number, number]) =>
    ({ start: pt(...s), end: pt(...e), seam: `M${pt(...s).join(',')}C${pt(...c1).join(',')} ${pt(...c2).join(',')} ${pt(...e).join(',')}` });
  return {
    'set-in': make([0.285, 0.045], [0.265, 0.12], [0.27, 0.2], [0.295, 0.285]),
    raglan: make([0.155, 0.0], [0.2, 0.09], [0.25, 0.18], [0.295, 0.285]),
    saddle: make([0.165, 0.075], [0.21, 0.1], [0.25, 0.1], [0.268, 0.135]),
    drop: make([0.36, 0.11], [0.34, 0.17], [0.33, 0.24], [0.33, 0.31]),
  };
})();
function sleeveRegion(kind: ShoulderConstruction) {
  const { seam, start, end } = SEAMS[kind];
  const outerX = VX - 100, topY = VY - 100;
  // Saddle: the strip continues down the sleeve edge to the underarm.
  const tail = kind === 'saddle' ? `C${pt(0.29, 0.16).join(',')} ${pt(0.29, 0.22).join(',')} ${pt(0.295, 0.285).join(',')}` : '';
  const lastY = kind === 'saddle' ? pt(0.295, 0.285)[1] : end[1];
  // Below the underarm the sleeve hangs outside the body side seam, so the region continues straight down.
  const lastX = kind === 'saddle' ? pt(0.295, 0.285)[0] : end[0], low = lastY + 0.45 * H;
  return `${seam}${tail}L${lastX},${low}L${outerX},${low}L${outerX},${topY}L${start[0]},${topY}Z`;
}

function ShoulderPreview({ id }: { id: ShoulderConstruction }) {
  const clipId = useId();
  const body = FIT_SILHOUETTES.regular.outer;
  const region = sleeveRegion(id);
  const tail = id === 'saddle' ? `C${pt(0.29, 0.16).join(',')} ${pt(0.29, 0.22).join(',')} ${pt(0.295, 0.285).join(',')}` : '';
  return (
    <svg className="cx-fit" viewBox={FIT_SILHOUETTE_VIEWBOX} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs><clipPath id={clipId}><path d={body} /></clipPath></defs>
      <path className="cx-fit-body" d={body} />
      <g clipPath={`url(#${clipId})`}>
        <path className="cx-shoulder-panel" d={region} />
        <path className="cx-shoulder-panel" d={region} transform={`translate(${2 * CX} 0) scale(-1 1)`} />
      </g>
      <g clipPath={`url(#${clipId})`} className="cx-shoulder-seam">
        <path d={SEAMS[id].seam + tail} />
        <path d={SEAMS[id].seam + tail} transform={`translate(${2 * CX} 0) scale(-1 1)`} />
      </g>
      <path className="cx-fit-outline" d={body} />
    </svg>
  );
}
/** One description per construction, shared by the T-shirt and Hoodie pickers so both read the same. */
export const SHOULDER_HINTS: Record<string, string> = {
  'Set-in': 'Sleeve joins at the shoulder.',
  Raglan: 'Seam runs from neckline to underarm.',
  Saddle: 'Shoulder strip runs into the sleeve.',
  'Drop shoulder': 'Sleeve joins farther down the arm.',
};
export function ShoulderConstructionPicker({
  value = 'set-in',
  onChange,
  onPreview,
  selection,
  fit,
}: {
  value?: ShoulderConstruction;
  /** Current garment selection + fit: previews render the user's real T-shirt with each construction. */
  selection?: GarmentAssetSelection;
  fit?: string;
  onChange: (value: ShoulderConstruction) => void;
  onPreview?: (value: ShoulderConstruction | null) => void;
}) {
  return (
    <details className="sweatpants-choice shoulder-construction-picker cx" open>
      <summary><span>Shoulder construction<small>{SHOULDER_CONSTRUCTIONS.find(option => option.id === value)?.name}</small></span><ChevronDown size={16} /></summary>
      <VisualOptionGrid label="Shoulder construction" columns={4} value={value}
        options={SHOULDER_CONSTRUCTIONS.map(option => ({ id: option.id, label: option.name, detail: SHOULDER_HINTS[option.name] ?? option.hint, preview: <ShoulderPreview id={option.id} /> }))}
        onChange={id => { onPreview?.(null); onChange(id); }} />
    </details>
  );
}
