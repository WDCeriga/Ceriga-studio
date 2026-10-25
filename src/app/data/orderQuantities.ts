import { ORDER_SIZE_KEYS, type OrderSizeKey } from './builderSteps';

export type OrderQuantityMode = 'techpack' | 'custom_clothing';

export type SizeBreakdown = Record<OrderSizeKey, number>;

export type OrderQuantityLine = {
  id: string;
  kind: 'sample' | 'bulk';
  /** Quote tier total (e.g. 30, 50, 100) — mainly for bulk runs */
  targetTotal?: number;
  bySize: SizeBreakdown;
};

export type OrderQuantityPlan = {
  mode: OrderQuantityMode;
  sample: OrderQuantityLine;
  bulkRuns: OrderQuantityLine[];
};

/** Samples can be ordered from one unit, in any chosen size. */
export const SAMPLE_MIN_UNITS = 1;

const SIZE_WEIGHTS: Record<OrderSizeKey, number> = {
  xs: 0.08,
  s: 0.14,
  m: 0.22,
  l: 0.22,
  xl: 0.18,
  xxl: 0.16,
};

const SIZE_PRIORITY: OrderSizeKey[] = ['m', 'l', 's', 'xl', 'xs', 'xxl'];

export function emptySizeBreakdown(): SizeBreakdown {
  return { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0 };
}

export function sumBreakdown(bySize: SizeBreakdown): number {
  return ORDER_SIZE_KEYS.reduce((sum, k) => sum + (bySize[k] ?? 0), 0);
}

export function distributeQuantity(total: number): SizeBreakdown {
  if (total <= 0) return emptySizeBreakdown();

  if (total <= ORDER_SIZE_KEYS.length) {
    const result = emptySizeBreakdown();
    let left = total;
    for (const key of SIZE_PRIORITY) {
      if (left <= 0) break;
      result[key] = 1;
      left -= 1;
    }
    return result;
  }

  const raw = ORDER_SIZE_KEYS.map((k) => total * SIZE_WEIGHTS[k]);
  const floored = raw.map(Math.floor);
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  const ranked = raw
    .map((value, index) => ({ index, frac: value - floored[index] }))
    .sort((a, b) => b.frac - a.frac);

  const result = emptySizeBreakdown();
  ORDER_SIZE_KEYS.forEach((key, index) => {
    result[key] = floored[index];
  });

  for (let i = 0; i < remainder; i += 1) {
    const key = ORDER_SIZE_KEYS[ranked[i % ranked.length].index];
    result[key] += 1;
  }

  return result;
}

export function defaultSampleLine(_mode: OrderQuantityMode = 'custom_clothing'): OrderQuantityLine {
  return { id: 'sample', kind: 'sample', targetTotal: 1, bySize: { ...emptySizeBreakdown(), m: 1 } };
}

export function normalizeSampleLine(line: OrderQuantityLine, _mode: OrderQuantityMode): OrderQuantityLine {
  const bySize = emptySizeBreakdown();
  ORDER_SIZE_KEYS.forEach(size => {
    const value = Number(line.bySize?.[size] ?? 0);
    bySize[size] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  });
  return { ...line, id: line.id || 'sample', kind: 'sample', targetTotal: sumBreakdown(bySize), bySize };
}

export function isSampleQuantityValid(plan: OrderQuantityPlan): boolean {
  return ORDER_SIZE_KEYS.every(size => Number.isInteger(plan.sample.bySize[size]) && plan.sample.bySize[size] >= 0)
    && sumBreakdown(plan.sample.bySize) >= SAMPLE_MIN_UNITS;
}

export function sampleValidationMessage(_plan: OrderQuantityPlan): string {
  return 'Choose at least one sample in any size to continue';
}

/** Clamp a single-size edit so the breakdown never exceeds maxTotal / maxPerSize */
export function applySizeChange(
  bySize: SizeBreakdown,
  size: OrderSizeKey,
  value: number,
  maxTotal?: number,
  maxPerSize?: number,
): SizeBreakdown {
  let v = Math.max(0, value);
  if (maxPerSize != null) v = Math.min(v, maxPerSize);

  const next = { ...bySize, [size]: v };
  if (maxTotal == null) return next;

  const total = sumBreakdown(next);
  if (total <= maxTotal) return next;

  const others = total - next[size];
  return { ...next, [size]: Math.max(0, maxTotal - others) };
}

export function maxBulkRuns(mode: OrderQuantityMode): number {
  return mode === 'techpack' ? 1 : 3;
}

export function newBulkRun(): OrderQuantityLine {
  return {
    id: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: 'bulk',
    targetTotal: undefined,
    bySize: emptySizeBreakdown(),
  };
}

export function defaultOrderQuantityPlan(
  mode: OrderQuantityMode = 'custom_clothing',
): OrderQuantityPlan {
  return {
    mode,
    sample: defaultSampleLine(mode),
    bulkRuns: mode === 'techpack' ? [newBulkRun()] : [],
  };
}

/** Migrate legacy single-grid quantity state */
export function migrateFromLegacyQuantityBySize(
  legacy: Partial<Record<OrderSizeKey, number>>,
): OrderQuantityPlan {
  const bySize = emptySizeBreakdown();
  ORDER_SIZE_KEYS.forEach((k) => {
    bySize[k] = legacy[k] ?? 0;
  });
  const total = sumBreakdown(bySize);
  return {
    mode: 'custom_clothing',
    sample: { id: 'sample', kind: 'sample', bySize: emptySizeBreakdown() },
    bulkRuns:
      total > 0
        ? [{ id: 'bulk-legacy', kind: 'bulk', targetTotal: total, bySize }]
        : [],
  };
}

export function normalizeOrderQuantityPlan(
  input: Partial<OrderQuantityPlan> | undefined,
  legacy?: Partial<Record<OrderSizeKey, number>>,
): OrderQuantityPlan {
  if (!input?.sample) {
    if (legacy) return migrateFromLegacyQuantityBySize(legacy);
    return defaultOrderQuantityPlan();
  }

  const mode = input.mode ?? 'custom_clothing';
  const cap = maxBulkRuns(mode);
  const bulkRuns = (input.bulkRuns ?? []).slice(0, cap).map((run) => ({
    ...run,
    kind: 'bulk' as const,
    bySize: { ...emptySizeBreakdown(), ...run.bySize },
  }));

  return {
    mode,
    sample: normalizeSampleLine(
      {
        ...input.sample,
        bySize: { ...emptySizeBreakdown(), ...input.sample.bySize },
      },
      mode,
    ),
    bulkRuns:
      mode === 'techpack' && bulkRuns.length === 0 ? [newBulkRun()] : bulkRuns,
  };
}

export function setOrderMode(plan: OrderQuantityPlan, mode: OrderQuantityMode): OrderQuantityPlan {
  const cap = maxBulkRuns(mode);
  let bulkRuns = plan.bulkRuns.slice(0, cap);
  if (mode === 'techpack' && bulkRuns.length === 0) {
    bulkRuns = [newBulkRun()];
  }
  return { ...plan, mode, bulkRuns, sample: normalizeSampleLine(plan.sample, mode) };
}

export function planHasAnyQuantity(plan: OrderQuantityPlan): boolean {
  if (sumBreakdown(plan.sample.bySize) > 0) return true;
  return plan.bulkRuns.some((run) => sumBreakdown(run.bySize) > 0);
}

export function formatOrderQuantitiesSummary(plan: OrderQuantityPlan): string[] {
  const lines: string[] = [];
  const sampleTotal = sumBreakdown(plan.sample.bySize);
  if (sampleTotal > 0) {
    lines.push(`Sample · ${sampleTotal} unit${sampleTotal === 1 ? '' : 's'}`);
  }
  plan.bulkRuns.forEach((run, index) => {
    const total = sumBreakdown(run.bySize);
    if (total <= 0) return;
    const label =
      run.targetTotal && run.targetTotal !== total
        ? `Bulk ${index + 1} · ${total} units (quote tier ${run.targetTotal})`
        : `Bulk ${index + 1} · ${total} units`;
    lines.push(label);
  });
  if (lines.length === 0) return ['Not set'];
  return lines;
}
