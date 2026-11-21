import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Check } from 'lucide-react';

/* ---------------------------------------------------------------- VisualOptionGrid */

export type VisualOption<T extends string> = { id: T; label: string; detail?: string; preview: ReactNode; disabled?: boolean; disabledReason?: string; /** Design-review only: render a state statically. */ force?: 'hover' | 'press' | 'focus' };

/**
 * Picture-first single choice (fits, necks, sleeves, hems, stitches, effects…).
 * Radio-group semantics with roving focus; `onPreview` fires on hover/focus for instant
 * previews and with `null` when the pointer leaves (only wire it for cheap previews: AUDIT rule 3).
 */
export function VisualOptionGrid<T extends string>({ label, options, value, onChange, onPreview, columns: _columns, density = 'visual-grid' }: {
  label: string; options: readonly VisualOption<T>[]; value: T | null; onChange: (id: NoInfer<T>) => void;
  /** Layout is fixed-size tiles that wrap; `columns` is kept for API compatibility only. */
  onPreview?: (id: T | null) => void; columns?: 1 | 2 | 3 | 4; density?: 'visual-grid' | 'standard' | 'compact';
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hovered, setHovered] = useState<T | null>(null);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter(i => i >= 0);
  const focusIndex = Math.max(0, options.findIndex(o => o.id === value));
  // Columns as actually laid out (tiles wrap), so Up/Down move to the tile visually above/below.
  const renderedColumns = () => { const tops = refs.current.filter(Boolean).map(el => el!.offsetTop); return Math.max(1, tops.filter(t => t === tops[0]).length); };
  const move = (event: KeyboardEvent, index: number) => {
    const cols = renderedColumns();
    const map: Record<string, number> = { ArrowRight: 1, ArrowDown: cols, ArrowLeft: -1, ArrowUp: -cols };
    if (!(event.key in map)) return;
    event.preventDefault();
    let next = index;
    do { next = (next + map[event.key] + options.length) % options.length; } while (options[next].disabled && next !== index);
    refs.current[next]?.focus(); onChange(options[next].id);
  };
  const captionOption = options.find(o => o.id === (hovered ?? value));
  const hasDetails = options.some(o => o.detail);
  const preview = (id: T | null) => { setHovered(id); onPreview?.(id); };
  return (
    <div className="cx-option-group" data-density={density}>
      <div className="cx-options" role="radiogroup" aria-label={label} onPointerLeave={() => preview(null)}>
        {options.map((option, index) => (
          <button key={option.id} ref={el => { refs.current[index] = el; }} type="button" role="radio" className="cx-option"
            aria-checked={option.id === value} disabled={option.disabled} data-force={option.force} title={option.disabled ? option.disabledReason : undefined}
            tabIndex={index === (enabled.includes(focusIndex) ? focusIndex : enabled[0]) ? 0 : -1}
            onClick={() => onChange(option.id)} onKeyDown={event => move(event, index)}
            onPointerEnter={() => preview(option.id)} onFocus={() => preview(option.id)} onBlur={() => preview(null)}>
            <span className="cx-option-preview" aria-hidden="true">{option.preview}</span>
            <span className="cx-option-label">{option.label}</span>
            {option.detail && <span className="cx-sr-only">{option.detail}</span>}
            <span className="cx-option-check" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="none"><path d="M4.75 8.25 7 10.5l4.25-4.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          </button>
        ))}
      </div>
      {/* One quiet caption for the hovered/focused option (else the selected one) instead of text under every tile. */}
      {hasDetails && <p className="cx-option-caption" aria-hidden="true">{captionOption?.detail ?? ' '}</p>}
    </div>
  );
}
/* ---------------------------------------------------------------- CompactField */

const roundTo = (value: number, step: number) => Math.round(value / step) * step;
const decimalsOf = (step: number) => (String(step).split('.')[1] ?? '').length;

/**
 * Precise numeric fallback for every direct manipulation. Drag the label to scrub
 * (Shift ×10, Alt ×0.1), ArrowUp/Down to step, Enter to commit, Escape to revert.
 */
export function CompactField({ label, value, onChange, unit, step = 1, min = -Infinity, max = Infinity, width, disabled, ariaLabel, layout = 'row', force }: {
  label: ReactNode; value: number; onChange: (value: number) => void; unit?: string; step?: number; min?: number; max?: number;
  width?: number; disabled?: boolean; ariaLabel?: string;
  /** row: label left, value right. inline: short prefix inside the box (W, H, X, Y, °), for paired values. */
  layout?: 'row' | 'inline'; force?: 'hover' | 'focus';
}) {
  const decimals = decimalsOf(step);
  const format = (n: number) => Number.isFinite(n) ? n.toFixed(decimals) : '';
  const [draft, setDraft] = useState(format(value));
  const [editing, setEditing] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const scrub = useRef<{ x: number; start: number } | null>(null);
  useEffect(() => { if (!editing) setDraft(format(value)); }, [value, editing, decimals]);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const parsed = Number(draft.replace(',', '.'));
  const invalid = editing && (draft.trim() === '' || !Number.isFinite(parsed));
  const commit = () => { setEditing(false); if (Number.isFinite(parsed) && draft.trim() !== '') onChange(clamp(roundTo(parsed, step / 10 || step))); else setDraft(format(value)); };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.currentTarget.blur(); return; }
    if (event.key === 'Escape') { setDraft(format(value)); setEditing(false); event.currentTarget.blur(); return; }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const factor = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
      const base = Number.isFinite(parsed) ? parsed : value;
      const next = clamp(roundTo(base + (event.key === 'ArrowUp' ? 1 : -1) * step * factor, step * (event.altKey ? 0.1 : 1)));
      setDraft(format(next)); onChange(next);
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub.current = { x: event.clientX, start: value }; setScrubbing(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (!scrub.current) return;
    const factor = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
    const next = clamp(roundTo(scrub.current.start + Math.round((event.clientX - scrub.current.x) / 4) * step * factor, step * (event.altKey ? 0.1 : 1)));
    if (next !== value) onChange(next);
  };
  const end = () => { scrub.current = null; setScrubbing(false); };
  const scrubLabel = <span className="cx-field-label" data-scrubbing={scrubbing} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
    onPointerUp={end} onPointerCancel={end} aria-hidden="true">{label}</span>;
  return (
    <div className="cx-field" data-layout={layout} data-disabled={disabled || undefined}>
      {layout === 'row' && scrubLabel}
      <span className="cx-field-box" data-invalid={invalid || undefined} data-force={force}
        style={width ? { ['--cx-field-w' as string]: `${width}px` } : undefined}>
        {layout === 'inline' && scrubLabel}
        <input inputMode="decimal" value={draft} disabled={disabled} aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
          aria-invalid={invalid || undefined} onFocus={event => { setEditing(true); event.currentTarget.select(); }}
          onChange={event => { setEditing(true); setDraft(event.target.value); }} onBlur={commit} onKeyDown={onKey} />
        {unit && <span className="cx-field-unit">{unit}</span>}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- ToolButton + Tooltip */

export function CxTooltipProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delayDuration={400} skipDelayDuration={300}>{children}</Tooltip.Provider>;
}

/** Tooltip with name, shortcut and (for disabled controls) the reason. */
export function CxTooltip({ label, shortcut, reason, side = 'right', children }: {
  label: string; shortcut?: string; reason?: string; side?: 'top' | 'right' | 'bottom' | 'left'; children: ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="cx cx-tooltip" side={side} sideOffset={8}>
          <span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}{reason && <span className="cx-tip-reason">· {reason}</span>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** Icon-only tool with tooltip (name + shortcut). Disabled tools stay focusable and explain why. */
export function ToolButton({ icon, label, shortcut, active, disabledReason, onClick, side = 'right', force }: {
  icon: ReactNode; label: string; shortcut?: string; active?: boolean; disabledReason?: string; onClick?: () => void; side?: 'top' | 'right' | 'bottom' | 'left'; force?: 'hover' | 'press' | 'focus';
}) {
  const disabled = Boolean(disabledReason);
  return (
    <CxTooltip label={label} shortcut={shortcut} reason={disabledReason} side={side}>
      <button type="button" className="cx-tool" aria-label={shortcut ? `${label} (${shortcut})` : label} aria-pressed={active ?? undefined}
        aria-disabled={disabled || undefined} data-force={force} onClick={disabled ? undefined : onClick}>{icon}</button>
    </CxTooltip>
  );
}
