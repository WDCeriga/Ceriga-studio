import { chaikinSmooth, douglasPeucker } from './strokeSmooth';
import type { TraceSvgOptions } from './pathTrace';
import type { DrawnStroke } from './types';

export type TraceFidelityPreset = 'full' | 'high' | 'balanced' | 'minimal';

export interface TraceFidelityConfig {
  preset: TraceFidelityPreset;
  /** Sample one point every N pixels along each path. Lower = more detail. */
  sampleStepPx: number;
  /** Minimum samples per path regardless of length. */
  minSamples: number;
  /** Optional hard cap on samples per path during trace. */
  maxSamples?: number;
  chaikinIterations: number;
  /** 0 = skip Douglas–Peucker simplification. */
  douglasPeuckerEpsilon: number;
  /** Optional cap after smoothing. Undefined = keep all points. */
  maxPointsPerStroke?: number;
}

export const TRACE_FIDELITY_PRESETS: Record<TraceFidelityPreset, TraceFidelityConfig> = {
  full: {
    preset: 'full',
    sampleStepPx: 6,
    minSamples: 32,
    chaikinIterations: 0,
    douglasPeuckerEpsilon: 0,
  },
  high: {
    preset: 'high',
    sampleStepPx: 10,
    minSamples: 28,
    chaikinIterations: 1,
    douglasPeuckerEpsilon: 4,
  },
  balanced: {
    preset: 'balanced',
    sampleStepPx: 24,
    minSamples: 20,
    maxSamples: 96,
    chaikinIterations: 2,
    douglasPeuckerEpsilon: 10,
    maxPointsPerStroke: 48,
  },
  minimal: {
    preset: 'minimal',
    sampleStepPx: 80,
    minSamples: 12,
    maxSamples: 48,
    chaikinIterations: 3,
    douglasPeuckerEpsilon: 20,
    maxPointsPerStroke: 16,
  },
};

export const TRACE_FIDELITY_LABELS: Record<TraceFidelityPreset, string> = {
  full: 'Full detail (all points)',
  high: 'High detail',
  balanced: 'Balanced',
  minimal: 'Minimal points',
};

export function resolveTraceFidelity(preset: TraceFidelityPreset): TraceFidelityConfig {
  return TRACE_FIDELITY_PRESETS[preset];
}

export function traceOptionsFromFidelity(config: TraceFidelityConfig): TraceSvgOptions {
  return {
    sampleStepPx: config.sampleStepPx,
    minSamples: config.minSamples,
    maxSamples: config.maxSamples,
  };
}

/** Optional post-trace smoothing / simplification controlled by fidelity preset. */
export function processTracedStrokes(
  strokes: DrawnStroke[],
  config: TraceFidelityConfig,
): DrawnStroke[] {
  return strokes.map((stroke) => {
    let points = stroke.points;

    if (config.chaikinIterations > 0) {
      points = chaikinSmooth(points, config.chaikinIterations, stroke.closed);
    }

    if (config.douglasPeuckerEpsilon > 0) {
      points = douglasPeucker(points, config.douglasPeuckerEpsilon);
    }

    if (config.maxPointsPerStroke != null && points.length > config.maxPointsPerStroke) {
      const step = Math.ceil(points.length / config.maxPointsPerStroke);
      points = points.filter((_, index) => index % step === 0 || index === points.length - 1);
    }

    return {
      ...stroke,
      smooth: true,
      points,
    };
  });
}

export function countStrokePoints(strokes: DrawnStroke[]): number {
  return strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
}
