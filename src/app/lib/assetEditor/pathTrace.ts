import { potraceToCanvas } from './coords';
import { createId } from './document';
import type { DrawnPoint, DrawnStroke } from './types';

export interface TraceSvgOptions {
  /** Minimum sample count per path. */
  minSamples?: number;
  /** Sample one point every N pixels along the path. Lower = more detail. */
  sampleStepPx?: number;
  /** Optional hard cap on samples per path. */
  maxSamples?: number;
  /** @deprecated use sampleStepPx */
  samplesPerPath?: number;
  smoothIterations?: number;
}

function splitPathSubpaths(d: string): string[] {
  const trimmed = d.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/(?=[Mm])/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [trimmed];
}

function samplePathElement(
  pathEl: SVGPathElement,
  options: Pick<TraceSvgOptions, 'minSamples' | 'sampleStepPx' | 'maxSamples' | 'samplesPerPath'>,
): { points: DrawnPoint[]; closed: boolean } {
  const total = pathEl.getTotalLength();
  if (!Number.isFinite(total) || total <= 0) {
    return { points: [], closed: false };
  }

  const minSamples = options.minSamples ?? 16;
  const sampleStepPx = options.sampleStepPx ?? 24;
  const legacyTarget = options.samplesPerPath;
  const stepBased = Math.ceil(total / sampleStepPx);
  let count = Math.max(minSamples, stepBased);
  if (legacyTarget != null) {
    count = Math.max(count, legacyTarget);
  }
  if (options.maxSamples != null) {
    count = Math.min(count, options.maxSamples);
  }

  const points: DrawnPoint[] = [];

  for (let i = 0; i <= count; i += 1) {
    const pt = pathEl.getPointAtLength((i / count) * total);
    points.push(potraceToCanvas(pt.x, pt.y));
  }

  const closed = /z\s*$/i.test(pathEl.getAttribute('d') ?? '');
  if (closed && points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) > 2) {
      points.push({ ...first });
    }
  }

  return { points, closed };
}

/**
 * Sample geometry from a potrace/catalog SVG into editable strokes.
 * Uses browser path sampling so curves are preserved (unlike raw M/L parsing).
 */
export function traceSvgToStrokes(
  svgRaw: string,
  options: TraceSvgOptions = {},
): DrawnStroke[] {
  const {
    minSamples = 16,
    sampleStepPx = 24,
    maxSamples,
    samplesPerPath,
  } = options;

  const sampleOptions = { minSamples, sampleStepPx, maxSamples, samplesPerPath };

  if (typeof document === 'undefined') return [];

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:-32000px;top:0;width:200px;height:200px;visibility:hidden;pointer-events:none;overflow:hidden;';
  host.innerHTML = svgRaw
    .replace(/width="[^"]*"/i, 'width="200"')
    .replace(/height="[^"]*"/i, 'height="200"');
  document.body.appendChild(host);

  const strokes: DrawnStroke[] = [];

  try {
    const paths = Array.from(host.querySelectorAll('svg path')) as SVGPathElement[];
    let strokeIndex = 0;

    paths.forEach((pathEl) => {
      const d = pathEl.getAttribute('d') ?? '';
      const subpaths = splitPathSubpaths(d);

      subpaths.forEach((subpath) => {
        const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        temp.setAttribute('d', subpath);
        pathEl.parentNode?.appendChild(temp);

        try {
          const { points, closed } = samplePathElement(temp, sampleOptions);
          if (points.length < 2) return;

          strokeIndex += 1;
          strokes.push({
            id: createId('traced-stroke'),
            label: `Traced ${strokeIndex}`,
            points,
            closed,
            strokeWidth: 12,
            smooth: true,
          });
        } finally {
          temp.remove();
        }
      });
    });
  } finally {
    host.remove();
  }

  return strokes;
}
