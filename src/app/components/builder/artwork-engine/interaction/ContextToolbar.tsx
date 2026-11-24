import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import './context-toolbar.css';

export type ContextAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Show the word next to the icon (the first, most frequent actions). */
  showLabel?: boolean;
  onSelect?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  tone?: 'danger';
  /** A small menu of related choices (e.g. Align ▾). */
  menu?: ContextAction[];
  /** A custom control rendered in place of a button (e.g. a colour well). */
  render?: ReactNode;
};

export type AnchorRect = { x: number; y: number; width: number; height: number };

/**
 * Tracks the on-screen box of the selected object(s), relative to `host`.
 * One getBoundingClientRect per frame while mounted; state only changes when the box moves.
 */
export function useSelectionAnchor(host: HTMLElement | null, ids: string[]): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const key = ids.join('|');
  useLayoutEffect(() => {
    if (!host || !ids.length) { setRect(null); return; }
    let frame = 0, last = '';
    const tick = () => {
      const hostBox = host.getBoundingClientRect();
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const id of ids) {
        const node = document.querySelector<HTMLElement>(`[data-print-id="${CSS.escape(id)}"]`);
        if (!node) continue;
        const b = node.getBoundingClientRect();
        x1 = Math.min(x1, b.left); y1 = Math.min(y1, b.top); x2 = Math.max(x2, b.right); y2 = Math.max(y2, b.bottom);
      }
      // The Builder interface is scaled, so screen distances are converted to the toolbar's own units.
      const ui = hostBox.width / Math.max(1, host.offsetWidth) || 1;
      const next = Number.isFinite(x1) ? { x: (x1 - hostBox.left) / ui, y: (y1 - hostBox.top) / ui, width: (x2 - x1) / ui, height: (y2 - y1) / ui } : null;
      const sig = next ? `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.width)},${Math.round(next.height)}` : '';
      if (sig !== last) { last = sig; setRect(next); }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, key]);
  return rect;
}

const GAP = 44; // clears the rotate dot on its stalk
const BAR_HEIGHT = 36, EDGE = 8, HANDLE_CLEARANCE = 18, DOCK_CLEARANCE = 72;

/** Above the selection, then below, then beside it, so the bar never sits on the resize handles. */
export function contextBarPlacement(anchor: AnchorRect, hostWidth: number, hostHeight: number, barWidth: number) {
  const half = barWidth / 2, centre = anchor.x + anchor.width / 2, across = Math.max(EDGE + half, Math.min(hostWidth - EDGE - half, centre));
  const aboveTop = anchor.y - GAP, belowTop = anchor.y + anchor.height + HANDLE_CLEARANCE;
  if (aboveTop >= EDGE) return { left: across, top: aboveTop, side: 'top' as const };
  if (!hostHeight || belowTop + BAR_HEIGHT <= hostHeight - DOCK_CLEARANCE) return { left: across, top: belowTop, side: 'bottom' as const };
  const beside = Math.max(EDGE, Math.min(hostHeight - DOCK_CLEARANCE - BAR_HEIGHT, anchor.y + anchor.height / 2 - BAR_HEIGHT / 2));
  if (anchor.x + anchor.width + HANDLE_CLEARANCE + barWidth <= hostWidth - EDGE) return { left: anchor.x + anchor.width + HANDLE_CLEARANCE + half, top: beside, side: 'bottom' as const };
  if (anchor.x - HANDLE_CLEARANCE - barWidth >= EDGE) return { left: anchor.x - HANDLE_CLEARANCE - half, top: beside, side: 'bottom' as const };
  return { left: across, top: EDGE, side: 'bottom' as const };
}

/**
 * The single context toolbar of the Artwork engine (plan §7): the most frequent actions for the
 * selection, placed above it (flipping below near the top edge, clamped inside the canvas).
 */
export function ContextToolbar({ anchor, hostWidth, hostHeight = 0, actions, overflow, label = 'Selection actions', hidden = false }: {
  anchor: AnchorRect | null; hostWidth: number; hostHeight?: number; actions: ContextAction[]; overflow?: ContextAction[]; label?: string; hidden?: boolean;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const shown = Boolean(anchor) && !hidden;
  // Measure when the bar's size changes, not on every render (each read forces a page layout).
  useLayoutEffect(() => {
    const node = bar.current; if (!node) return;
    setWidth(node.offsetWidth);
    const observer = new ResizeObserver(() => setWidth(node.offsetWidth)); observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);
  if (!anchor || hidden) return null;
  const { left, top, side } = contextBarPlacement(anchor, hostWidth, hostHeight, width);
  return <div ref={bar} className="cx-context-bar" role="toolbar" aria-label={label} data-side={side}
    style={{ left, top }} onPointerDown={event => event.stopPropagation()}>
    {actions.map(action => <ActionItem key={action.id} action={action} />)}
    {overflow?.length ? <><span className="cx-context-bar__sep" aria-hidden="true" /><ActionMenu action={{ id: 'more', label: 'More actions', icon: <MoreHorizontal size={16} />, menu: overflow }} /></> : null}
  </div>;
}

function ActionItem({ action }: { action: ContextAction }) {
  if (action.id.startsWith('sep')) return <span className="cx-context-bar__sep" aria-hidden="true" />;
  if (action.render) return <span className="cx-context-bar__custom" title={action.label}>{action.render}</span>;
  if (action.menu) return <ActionMenu action={action} />;
  return <button type="button" className="cx-context-bar__btn" aria-label={action.label} title={action.label} aria-pressed={action.pressed}
    data-tone={action.tone} data-labelled={action.showLabel || undefined} disabled={action.disabled} onClick={action.onSelect}>
    {action.icon}{action.showLabel && <span>{action.label}</span>}
  </button>;
}

function ActionMenu({ action }: { action: ContextAction }) {
  return <Menu.Root modal={false}>
    <Menu.Trigger asChild>
      <button type="button" className="cx-context-bar__btn" aria-label={action.label} title={action.label} data-labelled={action.showLabel || undefined}>
        {action.icon}{action.showLabel && <span>{action.label}</span>}
      </button>
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Content className="cx-context-menu" sideOffset={8} align="center" collisionPadding={12}>
        {action.menu!.map(item => item.id.startsWith('sep')
          ? <Menu.Separator key={item.id} className="cx-context-menu__sep" />
          : <Menu.Item key={item.id} className="cx-context-menu__item" data-tone={item.tone} disabled={item.disabled} onSelect={() => item.onSelect?.()}>
              {item.icon}<span>{item.label}</span>
            </Menu.Item>)}
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>;
}
