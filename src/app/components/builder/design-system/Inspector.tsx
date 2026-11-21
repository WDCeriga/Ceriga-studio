import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, X } from 'lucide-react';

export type InspectorTransition = 'push' | 'pop' | 'swap' | 'none';

/**
 * Right-panel frame. `viewKey` identifies what the panel is showing (e.g. section, or a selected
 * object id). Changing it replays the entry animation given by `transition`: push for drilling
 * into an object, pop for going back, swap for switching sections.
 */
export function BuilderInspector({ header, subTabs, viewKey, transition = 'swap', density = 'standard', children, label }: {
  header?: ReactNode; subTabs?: ReactNode; viewKey: string; transition?: InspectorTransition;
  density?: 'compact' | 'standard'; children: ReactNode; label: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollMemory = useRef(new Map<string, number>());
  // Each view keeps its own scroll position, so going back restores where the user was.
  useEffect(() => {
    const body = bodyRef.current; if (!body) return;
    body.scrollTop = scrollMemory.current.get(viewKey) ?? 0;
    setScrolled(body.scrollTop > 0);
    const onScroll = () => { scrollMemory.current.set(viewKey, body.scrollTop); setScrolled(body.scrollTop > 0); };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, [viewKey]);
  return (
    <section className="cx cx-inspector" aria-label={label} data-density={density}>
      <div ref={bodyRef} className="cx-inspector-body">
        {header && <div data-scrolled={scrolled} className="cx-inspector-header-wrap">{header}</div>}
        {subTabs}
        <div key={viewKey} className="cx-inspector-pane" data-enter={transition === 'none' ? undefined : transition}>{children}</div>
      </div>
    </section>
  );
}

/** One-line header replacing the eyebrow/title/description stack. */
export function InspectorHeader({ title, meta, onBack, backLabel = 'Back', onClose, actions }: {
  title: ReactNode; meta?: ReactNode; onBack?: () => void; backLabel?: string; onClose?: () => void; actions?: ReactNode;
}) {
  return (
    <header className="cx-inspector-header">
      {onBack && <button type="button" className="cx-back" onClick={onBack} aria-label={backLabel}><ChevronLeft size={18} /></button>}
      <h2>{title}</h2>
      {meta && <span className="cx-meta">{meta}</span>}
      <div className="cx-actions">
        {actions}
        {onClose && <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>}
      </div>
    </header>
  );
}

/** Group of controls. Collapsible when `collapsible`; the header shows a summary of the current value. */
export function InspectorSection({ title, summary, collapsible = false, defaultOpen = true, open: openProp, onOpenChange, density, children }: {
  title: ReactNode; summary?: ReactNode; collapsible?: boolean; defaultOpen?: boolean; open?: boolean;
  onOpenChange?: (open: boolean) => void; density?: 'compact' | 'standard' | 'visual-grid'; children: ReactNode;
}) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const id = useId();
  const toggle = () => { const next = !open; setOpenState(next); onOpenChange?.(next); };
  return (
    <section className="cx-section" data-density={density}>
      {collapsible ? (
        <button type="button" className="cx-section-head" aria-expanded={open} aria-controls={id} onClick={toggle}>
          <span>{title}</span>{summary != null && <span className="cx-summary">{summary}</span>}
          <ChevronDown className="cx-chevron" size={14} />
        </button>
      ) : (
        <h3 className="cx-section-head"><span>{title}</span>{summary != null && <span className="cx-summary">{summary}</span>}</h3>
      )}
      {open && <div id={id} className="cx-section-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cx-row-gap)' }}>{children}</div>}
    </section>
  );
}

/** A section's sub-areas, pinned under the header. Arrow keys move between tabs. */
export function StickySubTabs<T extends string>({ items, value, onChange, label }: {
  items: readonly { id: T; label: string }[]; value: T; onChange: (id: NoInfer<T>) => void; label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + items.length) % items.length;
    refs.current[next]?.focus(); onChange(items[next].id);
  };
  return (
    <div className="cx-subtabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button key={item.id} ref={el => { refs.current[index] = el; }} type="button" role="tab" aria-selected={item.id === value}
          tabIndex={item.id === value ? 0 : -1} onClick={() => onChange(item.id)} onKeyDown={event => onKey(event, index)}>{item.label}</button>
      ))}
    </div>
  );
}

/** One line naming what's selected, replacing in-panel garment diagrams and chip lists. */
export function SelectionSummary({ name, detail, actions, empty }: { name: ReactNode; detail?: ReactNode; actions?: ReactNode; /** Nothing selected: quieter outline style, no dot. */ empty?: boolean }) {
  return (
    <div className="cx-selection" role="status" aria-live="polite" data-empty={empty || undefined}>
      {!empty && <i className="cx-dot" aria-hidden="true" />}
      <strong>{name}</strong>{detail && <span>· {detail}</span>}
      {actions && <div className="cx-selection-actions">{actions}</div>}
    </div>
  );
}
