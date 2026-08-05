import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { ORDER_SIZE_KEYS } from '../../data/builderSteps';
import {
  applySizeChange,
  CUSTOM_SAMPLE_MAX_PER_SIZE,
  distributeQuantity,
  emptySizeBreakdown,
  maxBulkRuns,
  newBulkRun,
  sampleFixedTotal,
  setOrderMode,
  sumBreakdown,
  type OrderQuantityLine,
  type OrderQuantityMode,
  type OrderQuantityPlan,
  type SizeBreakdown,
} from '../../data/orderQuantities';

type Props = {
  plan: OrderQuantityPlan;
  onChange: (plan: OrderQuantityPlan) => void;
};

function SizeGrid({
  bySize,
  onChange,
  compact,
  maxTotal,
  maxPerSize,
}: {
  bySize: SizeBreakdown;
  onChange: (next: SizeBreakdown) => void;
  compact?: boolean;
  maxTotal?: number;
  maxPerSize?: number;
}) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', compact ? 'sm:grid-cols-3' : 'sm:grid-cols-6')}>
      {ORDER_SIZE_KEYS.map((size) => (
        <div key={size}>
          <Label className="mb-1 block text-[9px] uppercase tracking-wider text-white/45">
            {size.toUpperCase()}
          </Label>
          <Input
            type="number"
            min={0}
            max={maxPerSize ?? maxTotal}
            inputMode="numeric"
            placeholder="0"
            value={(bySize[size] ?? 0) === 0 ? '' : String(bySize[size] ?? 0)}
            onChange={(e) => {
              const t = e.target.value.trim();
              if (t === '') {
                onChange(applySizeChange(bySize, size, 0, maxTotal, maxPerSize));
                return;
              }
              const raw = parseInt(t, 10);
              const v = Number.isFinite(raw) ? Math.max(0, raw) : 0;
              onChange(applySizeChange(bySize, size, v, maxTotal, maxPerSize));
            }}
            className="h-8 border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
          />
        </div>
      ))}
    </div>
  );
}

function QuantityBlock({
  title,
  subtitle,
  line,
  onUpdate,
  onRemove,
  showTargetTotal,
  minTotal,
  fixedTotal,
  maxPerSize,
  targetLabel = 'Quote tier (units)',
}: {
  title: string;
  subtitle?: string;
  line: OrderQuantityLine;
  onUpdate: (line: OrderQuantityLine) => void;
  onRemove?: () => void;
  showTargetTotal?: boolean;
  minTotal?: number;
  fixedTotal?: number;
  maxPerSize?: number;
  targetLabel?: string;
}) {
  const total = sumBreakdown(line.bySize);
  const belowMin = minTotal != null && total < minTotal;
  const fixedMismatch = fixedTotal != null && total !== fixedTotal;
  const sizeCap = maxPerSize != null ? undefined : fixedTotal ?? undefined;

  const applyAutoFill = () => {
    if (maxPerSize != null) {
      const bySize = emptySizeBreakdown();
      ORDER_SIZE_KEYS.forEach((k) => {
        bySize[k] = maxPerSize;
      });
      onUpdate({
        ...line,
        targetTotal: fixedTotal,
        bySize,
      });
      return;
    }

    const target = fixedTotal ?? Math.max(minTotal ?? 0, line.targetTotal ?? total);
    if (target <= 0) return;
    onUpdate({
      ...line,
      targetTotal: target,
      bySize: distributeQuantity(target),
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">{title}</p>
          {subtitle ? <p className="mt-0.5 text-[10px] text-white/40">{subtitle}</p> : null}
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1 text-white/35 transition hover:bg-white/10 hover:text-white"
            aria-label={`Remove ${title}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {fixedTotal != null ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-white/45">Total units</span>
          <span className="text-sm font-semibold tabular-nums text-white">{fixedTotal}</span>
        </div>
      ) : showTargetTotal ? (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[7rem] flex-1">
            <Label className="mb-1 block text-[9px] uppercase tracking-wider text-white/45">
              {targetLabel}
            </Label>
            <Input
              type="number"
              min={minTotal ?? 0}
              inputMode="numeric"
              placeholder={minTotal ? String(minTotal) : 'e.g. 50'}
              value={line.targetTotal ? String(line.targetTotal) : ''}
              onChange={(e) => {
                const t = e.target.value.trim();
                const parsed = t === '' ? undefined : Math.max(minTotal ?? 0, parseInt(t, 10) || 0);
                onUpdate({ ...line, targetTotal: parsed });
              }}
              className="h-8 border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-white/15 bg-transparent text-[10px] text-white hover:bg-white/10"
            onClick={applyAutoFill}
          >
            <Sparkles className="mr-1.5 h-3 w-3" />
            Auto-fill sizes
          </Button>
        </div>
      ) : null}

      <SizeGrid
        bySize={line.bySize}
        onChange={(bySize) => onUpdate({ ...line, bySize })}
        compact={!showTargetTotal && fixedTotal == null}
        maxTotal={sizeCap}
        maxPerSize={maxPerSize}
      />

      <div className="mt-2.5 flex items-center justify-between text-[10px] text-white/45">
        <span>
          Total
          {fixedTotal != null ? (
            <span className="ml-1.5 text-white/30">· fixed {fixedTotal}</span>
          ) : minTotal != null ? (
            <span className={cn('ml-1.5', belowMin ? 'text-amber-300/90' : 'text-white/30')}>
              · min {minTotal}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            belowMin || fixedMismatch ? 'text-amber-300' : 'text-white',
          )}
        >
          {total}
        </span>
      </div>

      {fixedTotal != null ? (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-white/15 bg-transparent text-[10px] text-white hover:bg-white/10"
            onClick={applyAutoFill}
          >
            <Sparkles className="mr-1.5 h-3 w-3" />
            {maxPerSize != null ? 'One per size' : 'Reset size split'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function OrderQuantitiesStep({ plan, onChange }: Props) {
  const bulkCap = maxBulkRuns(plan.mode);
  const canAddBulk = plan.bulkRuns.length < bulkCap;

  const setMode = (mode: OrderQuantityMode) => {
    onChange(setOrderMode(plan, mode));
  };

  const updateSample = (sample: OrderQuantityLine) => {
    onChange({ ...plan, sample });
  };

  const updateBulk = (index: number, line: OrderQuantityLine) => {
    const bulkRuns = [...plan.bulkRuns];
    bulkRuns[index] = line;
    onChange({ ...plan, bulkRuns });
  };

  const removeBulk = (index: number) => {
    onChange({ ...plan, bulkRuns: plan.bulkRuns.filter((_, i) => i !== index) });
  };

  const addBulk = () => {
    if (!canAddBulk) return;
    onChange({ ...plan, bulkRuns: [...plan.bulkRuns, newBulkRun()] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
        {(
          [
            { id: 'techpack' as const, label: 'Tech pack' },
            { id: 'custom_clothing' as const, label: 'Custom clothing' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setMode(opt.id)}
            className={cn(
              'rounded-md px-2 py-2 text-[10px] font-semibold uppercase tracking-wider transition',
              plan.mode === opt.id
                ? 'bg-[#FF3B30] text-white'
                : 'text-white/45 hover:text-white/70',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <QuantityBlock
        title="Sample"
        subtitle={
          plan.mode === 'custom_clothing'
            ? 'Fixed 6 units — one sample per size (max 1 each)'
            : undefined
        }
        line={plan.sample}
        onUpdate={updateSample}
        fixedTotal={sampleFixedTotal(plan.mode)}
        maxPerSize={plan.mode === 'custom_clothing' ? CUSTOM_SAMPLE_MAX_PER_SIZE : undefined}
      />

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
            Bulk quotes
          </p>
          <span className="text-[10px] text-white/35">
            {plan.bulkRuns.length}/{bulkCap}
          </span>
        </div>

        {plan.bulkRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-white/40">
            Add a bulk tier to get pricing for production runs.
          </div>
        ) : (
          plan.bulkRuns.map((run, index) => (
            <QuantityBlock
              key={run.id}
              title={`Bulk ${index + 1}`}
              line={run}
              onUpdate={(line) => updateBulk(index, line)}
              onRemove={
                plan.mode === 'custom_clothing' && plan.bulkRuns.length > 1
                  ? () => removeBulk(index)
                  : undefined
              }
              showTargetTotal
            />
          ))
        )}

        {canAddBulk ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full border-white/15 bg-transparent text-[11px] text-white hover:bg-white/10"
            onClick={addBulk}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add bulk quote
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function OrderQuantitiesSummary({ plan }: { plan: OrderQuantityPlan }) {
  const sampleTotal = sumBreakdown(plan.sample.bySize);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-white/40">
        <span>Order type</span>
        <span className="normal-case text-white/70">
          {plan.mode === 'techpack' ? 'Tech pack' : 'Custom clothing'}
        </span>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Sample</p>
        <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 text-xs sm:grid-cols-6">
          {ORDER_SIZE_KEYS.map((k) => (
            <div key={k}>
              <span className="text-white/45">{k.toUpperCase()}</span>{' '}
              <span className="font-medium text-white">{plan.sample.bySize[k] ?? 0}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-white">{sampleTotal} units</p>
      </div>

      {plan.bulkRuns.map((run, index) => {
        const total = sumBreakdown(run.bySize);
        if (total <= 0 && !run.targetTotal) return null;
        return (
          <div key={run.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Bulk {index + 1}
              {run.targetTotal ? (
                <span className="ml-2 font-normal normal-case text-white/35">
                  · tier {run.targetTotal}
                </span>
              ) : null}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 text-xs sm:grid-cols-6">
              {ORDER_SIZE_KEYS.map((k) => (
                <div key={k}>
                  <span className="text-white/45">{k.toUpperCase()}</span>{' '}
                  <span className="font-medium text-white">{run.bySize[k] ?? 0}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-white">{total} units</p>
          </div>
        );
      })}
    </div>
  );
}
