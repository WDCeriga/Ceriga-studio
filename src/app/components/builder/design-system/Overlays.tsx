import type { ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Drawer } from 'vaul';

/** Anchored quick-edit popover (measurement chip, label placement, effects). Scales from its trigger. */
export function FloatingPopover({ trigger, children, open, onOpenChange, side = 'top', align = 'center', density = 'standard', label }: {
  trigger: ReactNode; children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void;
  side?: 'top' | 'right' | 'bottom' | 'left'; align?: 'start' | 'center' | 'end'; density?: 'compact' | 'standard'; label: string;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="cx cx-popover" data-density={density} side={side} align={align} sideOffset={8} collisionPadding={12} aria-label={label}>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export type SheetSnap = 'peek' | 'half' | 'full';
const SNAPS: Record<SheetSnap, number | string> = { peek: '148px', half: 0.5, full: 0.92 };

/** Tablet inspector: a bottom sheet with peek / half / full heights. Non-modal at peek so the canvas stays usable. */
export function BottomSheet({ title, open, onOpenChange, snap, onSnapChange, children }: {
  title: string; open: boolean; onOpenChange: (open: boolean) => void; snap: SheetSnap; onSnapChange: (snap: SheetSnap) => void; children: ReactNode;
}) {
  const points = [SNAPS.peek, SNAPS.half, SNAPS.full];
  const fromPoint = (p: number | string | null) => (Object.keys(SNAPS) as SheetSnap[]).find(k => SNAPS[k] === p) ?? 'half';
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} snapPoints={points} activeSnapPoint={SNAPS[snap]}
      setActiveSnapPoint={p => onSnapChange(fromPoint(p))} modal={snap !== 'peek'}>
      <Drawer.Portal>
        {snap !== 'peek' && <Drawer.Overlay className="cx-sheet-overlay" />}
        <Drawer.Content className="cx cx-sheet" aria-describedby={undefined}>
          <div className="cx-sheet-handle" aria-hidden="true" />
          <Drawer.Title className="cx-sheet-title">{title}</Drawer.Title>
          <div className="cx-sheet-body">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
