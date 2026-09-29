import { useAiCursor } from '../contexts/AiCursorContext';
import { cn } from './ui/utils';

/**
 * Global visual AI cursor — sits above the UI, never captures pointer events.
 * Position is driven by AiCursorProvider (rAF eased moves toward DOM targets).
 */
export function AiCursorOverlay() {
  const { state } = useAiCursor();
  const { visible, point, busy } = state;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden"
      aria-hidden
    >
      <div
        className={cn(
          'absolute will-change-transform transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          left: 0,
          top: 0,
          transform: `translate3d(${point.x}px, ${point.y}px, 0)`,
        }}
      >
        <div className="-translate-x-[3px] -translate-y-[2px]">
          {/* Soft aim glow */}
          <span
            className={cn(
              'absolute left-1 top-1 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#CC2D24]/25 blur-md',
              busy && 'animate-pulse',
            )}
          />
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className="relative drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
          >
            <path
              d="M5.5 3.2 19.2 11.1c.55.32.48 1.12-.12 1.33l-5.35 1.88-1.88 5.35c-.21.6-1.01.67-1.33.12L3.2 5.5c-.3-.52.2-1.12.8-.95l.7.25Z"
              fill="#CC2D24"
              stroke="#F0EEEE"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
          </svg>
          <span className="absolute left-5 top-5 whitespace-nowrap rounded-full border border-[#CC2D24]/40 bg-[#1C0F0F]/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E5534A] shadow-lg">
            AI
          </span>
        </div>
      </div>
    </div>
  );
}
