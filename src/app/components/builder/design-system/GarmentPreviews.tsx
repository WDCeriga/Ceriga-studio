import { useId } from 'react';
import { FIT_SILHOUETTES, FIT_SILHOUETTE_VIEWBOX, type FitSilhouetteId } from './fitSilhouettes';
import { harmonisePreviewArt } from './PresetArt';

const [VX, VY, VW, VH] = FIT_SILHOUETTE_VIEWBOX.split(' ').map(Number);

/**
 * Body-length preview: the real garment silhouette cut at the new hem, with the full-length
 * outline dashed behind it so the change in length is visible at thumbnail size.
 * `shortenPercent` is how much shorter the body is (0 = original); negative values lengthen.
 */
export function LengthSilhouette({ shortenPercent, fit = 'regular' }: { shortenPercent: number; fit?: FitSilhouetteId }) {
  const clipId = useId();
  const shape = FIT_SILHOUETTES[fit].outer;
  const bodyTop = VY + VH * 0.22; // roughly the underarm line: shortening comes off the torso below it
  const fullHem = VY + VH - 30;
  const hem = fullHem - (fullHem - bodyTop) * (shortenPercent / 100);
  return (
    <svg className="cx-fit cx-length" viewBox={FIT_SILHOUETTE_VIEWBOX} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={clipId}><rect x={VX} y={VY} width={VW} height={hem - VY} /></clipPath>
        <clipPath id={`${clipId}-below`}><rect x={VX} y={hem} width={VW} height={VY + VH - hem} /></clipPath>
      </defs>
      {/* Full-length reference only below the new hem, so the visible body keeps a clean edge. */}
      {shortenPercent !== 0 && <path className="cx-fit-reference" d={shape} vectorEffect="non-scaling-stroke" clipPath={`url(#${clipId}-below)`} />}
      <path className="cx-fit-body" d={shape} clipPath={`url(#${clipId})`} />
      {shortenPercent !== 0 && <line className="cx-length-hem" x1={VX + 40} x2={VX + VW - 40} y1={hem} y2={hem} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/**
 * Body-length preview from a real garment render (garments without a traced silhouette, e.g. hoodies):
 * the full garment is ghosted behind, the shortened garment drawn on top, with a hem line at the cut.
 */
export function LengthImage({ src: raw, shortenPercent }: { src: string; shortenPercent: number }) {
  const src = harmonisePreviewArt(raw);
  const cut = Math.max(0, Math.min(60, shortenPercent * 0.78)); // % of image height removed from the hem (torso below the underarm)
  return (
    <span className="cx-length-image" aria-hidden="true">
      {shortenPercent !== 0 && <img className="cx-length-ghost" src={src} alt="" draggable={false} />}
      <img src={src} alt="" draggable={false} style={{ clipPath: `inset(0 0 ${cut}% 0)` }} />
      {shortenPercent !== 0 && <i className="cx-length-cut" style={{ bottom: `calc(${cut}% + 6%)` }} />}
    </span>
  );
}

/** A real garment render cropped to the region an option changes (shoulders, waist, hem…). */
export function CroppedImage({ src, region }: { src: string; region: 'upper' | 'waist' | 'lower' | 'full' }) {
  return <span className="cx-crop" data-region={region}><img src={harmonisePreviewArt(src)} alt="" draggable={false} /></span>;
}
