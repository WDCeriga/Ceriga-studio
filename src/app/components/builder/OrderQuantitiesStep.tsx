import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { ORDER_SIZE_KEYS } from '../../data/builderSteps';
import {
  applySizeChange,
  MIN_RUN_UNITS,
  distributeQuantity,
  emptySizeBreakdown,
  maxBulkRuns,
  newBulkRun,
  normalizeSampleLine,
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
            className="h-8 border-[#252528] bg-white/5 text-[11px] text-white placeholder:text-white/30"
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
  targetLabel = 'Quote tier (units)',
}: {
  title: string;
  subtitle?: string;
  line: OrderQuantityLine;
  onUpdate: (line: OrderQuantityLine) => void;
  onRemove?: () => void;
  showTargetTotal?: boolean;
  minTotal?: number;
  targetLabel?: string;
}) {
  useCerigaTranslation();

  const total = sumBreakdown(line.bySize);
  const belowMin = minTotal != null && Math.max(total, showTargetTotal ? line.targetTotal ?? 0 : 0) < minTotal;

  const applyAutoFill = () => {
    const target = Math.max(minTotal ?? 0, line.targetTotal ?? total);
    if (target <= 0) return;
    onUpdate({ ...line, targetTotal: target, bySize: distributeQuantity(target) });
  };

  return (
    <div className="rounded-xl border border-[#252528] bg-white/[0.03] p-3.5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">{title}</p>
          {subtitle ? <p className="mt-0.5 text-[10px] text-white/40">{cerigaTranslateLabel(subtitle)}</p> : null}
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1 text-white/35 transition hover:bg-white/10 hover:text-white"
            aria-label={cerigaTranslate("interface.text_e224cf245aada55a",{value0:(title)})}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showTargetTotal ? (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[7rem] flex-1">
            <Label className="mb-1 block text-[9px] uppercase tracking-wider text-white/45">
              {cerigaTranslateLabel(targetLabel)}
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
              className="h-8 border-[#252528] bg-white/5 text-[11px] text-white placeholder:text-white/30"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-white/15 bg-transparent text-[10px] text-white hover:bg-white/10"
            onClick={applyAutoFill}
          >
            <Sparkles className="mr-1.5 h-3 w-3" />{cerigaTranslate("interface.text_be8c44e852bd9703")}</Button>
        </div>
      ) : null}

      <SizeGrid
        bySize={line.bySize}
        onChange={(bySize) => onUpdate({ ...line, bySize })}
        compact={!showTargetTotal}
      />

      <div className="mt-2.5 flex items-center justify-between text-[10px] text-white/45">
        <span>{cerigaTranslate("adminOrders.total")}{minTotal != null ? (
            <span className={cn('ml-1.5', belowMin ? 'text-amber-300/90' : 'text-white/30')}>{cerigaTranslate("interface.text_4ca7884033831a31")}{" "}{minTotal}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            belowMin ? 'text-amber-300' : 'text-white',
          )}
        >
          {total}
        </span>
      </div>

    </div>
  );
}

export function OrderQuantitiesStep({ plan, onChange }: Props) {
  useCerigaTranslation();

  const bulkCap = maxBulkRuns(plan.mode);
  const canAddBulk = plan.bulkRuns.length < bulkCap;

  const setMode = (mode: OrderQuantityMode) => {
    onChange(setOrderMode(plan, mode));
  };

  const updateSample = (sample: OrderQuantityLine) => {
    onChange({ ...plan, sample: normalizeSampleLine(sample) });
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
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#252528] bg-black/30 p-1">
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
            {cerigaTranslateLabel(opt.label)}
          </button>
        ))}
      </div>

      <QuantityBlock
        title={cerigaTranslate("manufacturerOrders.sample")}
        subtitle={cerigaTranslate("interface.text_112d85ab1a8754b6")}
        line={plan.sample}
        onUpdate={updateSample}
        minTotal={MIN_RUN_UNITS}
      />

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">{cerigaTranslate("interface.text_e9d0c1de40dbe58b")}</p>
          <span className="text-[10px] text-white/35">
            {plan.bulkRuns.length}/{bulkCap}
          </span>
        </div>

        {plan.bulkRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#252528] px-3 py-4 text-center text-[11px] text-white/40">{cerigaTranslate("interface.text_8744cb23299f76dd")}</div>
        ) : (
          plan.bulkRuns.map((run, index) => (
            <QuantityBlock
              key={run.id}
              title={cerigaTranslate("interface.text_350f0cb4aec117c3",{value0:(index + 1)})}
              line={run}
              onUpdate={(line) => updateBulk(index, line)}
              onRemove={() => removeBulk(index)}
              minTotal={MIN_RUN_UNITS}
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
            <Plus className="mr-1.5 h-3.5 w-3.5" />{cerigaTranslate("interface.text_2f95c34867347adf")}</Button>
        ) : null}
      </div>
    </div>
  );
}

export function OrderQuantitiesSummary({ plan }: { plan: OrderQuantityPlan }) {
  useCerigaTranslation();

  const sampleTotal = sumBreakdown(plan.sample.bySize);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-white/40">
        <span>{cerigaTranslate("adminOrders.type")}</span>
        <span className="normal-case text-white/70">
          {plan.mode === 'techpack' ? cerigaTranslate("adminOrders.techpack") : cerigaTranslate("adminOrders.clothing")}
        </span>
      </div>

      <div className="rounded-lg border border-[#252528] bg-white/[0.03] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{cerigaTranslate("manufacturerOrders.sample")}</p>
        <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 text-xs sm:grid-cols-6">
          {ORDER_SIZE_KEYS.map((k) => (
            <div key={k}>
              <span className="text-white/45">{k.toUpperCase()}</span>{' '}
              <span className="font-medium text-white">{plan.sample.bySize[k] ?? 0}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-white">{sampleTotal}{" "}{cerigaTranslate("interface.text_c981a30c0e7b420b")}</p>
      </div>

      {plan.bulkRuns.map((run, index) => {
        const total = sumBreakdown(run.bySize);
        if (total <= 0 && !run.targetTotal) return null;
        return (
          <div key={run.id} className="rounded-lg border border-[#252528] bg-white/[0.03] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{cerigaTranslate("interface.text_3140100df131cf30")}{" "}{index + 1}
              {run.targetTotal ? (
                <span className="ml-2 font-normal normal-case text-white/35">{cerigaTranslate("interface.text_1a276367226187f2")}{" "}{run.targetTotal}
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
            <p className="mt-2 text-xs font-semibold text-white">{total}{" "}{cerigaTranslate("interface.text_c981a30c0e7b420b")}</p>
          </div>
        );
      })}
    </div>
  );
}
