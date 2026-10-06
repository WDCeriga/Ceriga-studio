import { FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import type { DesignElement } from '../PrintsDesignStep';
import { cn } from '../../ui/utils';

export function FlipControls({ element, onChange, compact = false, className }: {
  element: DesignElement;
  onChange: (patch: Partial<DesignElement>) => void;
  compact?: boolean;
  className?: string;
}) {
  return <>
    {(['flipHorizontal', 'flipVertical'] as const).map((axis) => {
      const label = axis === 'flipHorizontal' ? 'Flip horizontally' : 'Flip vertically';
      const Icon = axis === 'flipHorizontal' ? FlipHorizontal2 : FlipVertical2;
      return <button key={axis} type="button" title={label} aria-label={label}
        aria-pressed={Boolean(element[axis])} disabled={element.locked === true}
        onClick={() => onChange({ [axis]: !element[axis] })}
        className={cn('inline-flex items-center justify-center gap-1.5 rounded-md disabled:cursor-not-allowed disabled:opacity-40',
          className ?? 'h-9 border border-white/20 px-2 text-[10px] font-semibold text-white hover:bg-white/10',
          element[axis] && 'bg-white/10 text-white')}>
        <Icon className={compact ? 'h-4 w-4' : 'h-3 w-3'} />
        {!compact && (axis === 'flipHorizontal' ? 'Flip horizontal' : 'Flip vertical')}
      </button>;
    })}
  </>;
}
