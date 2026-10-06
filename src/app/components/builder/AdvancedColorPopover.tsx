import { useEffect, useRef, useState, type ReactNode, type PointerEventHandler } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { normalizeHex6 } from '../../lib/colorUtils';
import { Pipette, Plus, Trash2, ArrowLeftRight } from 'lucide-react';
import { parsePaint, paintCss, serializePaint, solidPaint, type GradientPaint } from '../../lib/studioPaint';
import { sampleCanvasColor } from '../../lib/canvasEyedropper';
import { toast } from 'sonner';

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function PaintInput({ value, onChange, className, onPointerDown, allowGradients = false }: {
  value: string; onChange: (event: { target: { value: string } }) => void; className?: string; onPointerDown?: PointerEventHandler<HTMLButtonElement>; allowGradients?: boolean;
}) {
  return <AdvancedColorPopover value={value} allowGradients={allowGradients} onChange={color => onChange({ target: { value: color } })}>
    <button type="button" aria-label="Open colour picker" title="Colour" className={className} onPointerDown={onPointerDown} style={{ background: allowGradients ? paintCss(value) : solidPaint(value) }} />
  </AdvancedColorPopover>;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex6(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => clamp255(x).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const v = max;
  const s = max <= 1e-9 ? 0 : d / max;
  let h = 0;
  if (d > 1e-9) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h: ((h % 360) + 360) % 360, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh < 60) {
    r1 = c;
    g1 = x;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
  } else if (hh < 180) {
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  return {
    r: clamp255((r1 + m) * 255),
    g: clamp255((g1 + m) * 255),
    b: clamp255((b1 + m) * 255),
  };
}

/**
 * Full HSV colour popover. Pass a custom trigger (e.g. large swatch + palette icon) as `children`.
 */
export function AdvancedColorPopover({
  value,
  onChange,
  children,
  contentClassName,
  allowGradients = false,
}: {
  value: string;
  onChange: (hex: string) => void;
  children: ReactNode;
  allowGradients?: boolean;
  /** Optional class for the popover panel (e.g. width). */
  contentClassName?: string;
}) {
  const [stopIndex, setStopIndex] = useState(0);
  const paint = allowGradients ? parsePaint(value) : null;
  const activeIndex = Math.min(stopIndex, (paint?.stops.length ?? 1) - 1);
  const hex = normalizeHex6(paint?.stops[activeIndex].color ?? solidPaint(value));
  const picker = useRef<AbortController | null>(null);
  useEffect(() => () => picker.current?.abort(), []);
  const commitColor = (color: string) => {
    onChange(paint ? serializePaint({ ...paint, stops: paint.stops.map((stop, index) => index === activeIndex ? { ...stop, color } : stop) }) : color);
  };
  const patchPaint = (patch: Partial<GradientPaint>) => { if (paint) onChange(serializePaint({ ...paint, ...patch })); };
  const pickColor = async () => {
    picker.current?.abort();
    const controller = new AbortController(); picker.current = controller;
    const result = sampleCanvasColor(controller.signal);
    setOpen(false);
    try {
      const color = await result;
      commitColor(color);
      window.dispatchEvent(new CustomEvent('studio-color-sampled', { detail: color }));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error(error instanceof Error ? error.message : 'Could not sample this canvas.');
    }
  };
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsv(r, g, b);
  });
  const svRef = useRef<HTMLDivElement>(null);
  const dragSv = useRef(false);

  useEffect(() => {
    if (!open) return;
    const { r, g, b } = hexToRgb(hex);
    setHsv(rgbToHsv(r, g, b));
  }, [open, hex]);

  const commitHsv = (next: { h?: number; s?: number; v?: number }) => {
    const n = { ...hsv, ...next };
    setHsv(n);
    const rgb = hsvToRgb(n.h, n.s, n.v);
    commitColor(rgbToHex(rgb.r, rgb.g, rgb.b));
  };

  const pickSv = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const sx = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const sy = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    commitHsv({ s: sx, v: 1 - sy });
  };

  const hue = hsv.h;
  const rgb = hexToRgb(hex);

  const commitRgb = (r: number, g: number, b: number) => {
    commitColor(rgbToHex(r, g, b));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={
          contentClassName ??
          'w-[min(calc(100vw-2rem),260px)] border border-white/12 bg-[#121212] p-3 text-white shadow-xl'
        }
      >
        <div className="mb-3 flex items-center gap-2">
          {allowGradients && <select aria-label="Paint type" value={paint?.kind ?? 'solid'} className="h-8 min-w-0 flex-1 rounded border border-white/20 bg-zinc-900 px-2 text-xs" onChange={event => {
            const kind = event.target.value;
            if (kind === 'solid') onChange(hex);
            else onChange(serializePaint(paint ? { ...paint, kind: kind as GradientPaint['kind'] } : { kind: kind as GradientPaint['kind'], angle: 90, x: .5, y: .5, stops: [{ color: hex, offset: 0 }, { color: hex === '#FFFFFF' ? '#CC2D24' : '#FFFFFF', offset: 1 }] }));
            setStopIndex(0);
          }}><option value="solid">Solid</option><option value="linear">Linear</option><option value="radial">Radial</option><option value="conic">Conic</option></select>}
          <button type="button" title="Sample canvas colour" aria-label="Sample canvas colour" onClick={pickColor} className="flex h-8 w-8 items-center justify-center rounded border border-white/20"><Pipette size={16} /></button>
        </div>
        {paint && <div className="mb-3 space-y-3">
          <div className="relative h-8 touch-none border border-white/30" style={{ background: paintCss(value) }}>
            {paint.stops.map((stop, index) => <button key={index} type="button" aria-label={`Gradient stop ${index + 1}`} aria-pressed={index === activeIndex} title={`Gradient stop ${index + 1}`} className={`absolute top-6 h-4 w-3 -translate-x-1/2 touch-none border-2 ${index === activeIndex ? 'border-red-500' : 'border-white'}`} style={{ left: `${stop.offset * 100}%`, background: stop.color }}
              onClick={() => setStopIndex(index)} onPointerDown={event => { setStopIndex(index); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                const rect = event.currentTarget.parentElement!.getBoundingClientRect();
                patchPaint({ stops: paint.stops.map((entry, entryIndex) => entryIndex === index ? { ...entry, offset: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) } : entry) });
              }} onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)} />)}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input aria-label="Stop position" type="number" min={0} max={100} value={Math.round(paint.stops[activeIndex].offset * 100)} className="h-7 w-16 rounded border border-white/20 bg-black px-2 text-xs" onChange={event => patchPaint({ stops: paint.stops.map((stop, index) => index === activeIndex ? { ...stop, offset: Math.max(0, Math.min(100, Number(event.target.value))) / 100 } : stop) })} />
            <button type="button" title="Add gradient stop" aria-label="Add gradient stop" disabled={paint.stops.length >= 16} onClick={() => { patchPaint({ stops: [...paint.stops, { color: hex, offset: .5 }] }); setStopIndex(paint.stops.length); }}><Plus size={16} /></button>
            <button type="button" title="Remove gradient stop" aria-label="Remove gradient stop" disabled={paint.stops.length <= 2} onClick={() => { patchPaint({ stops: paint.stops.filter((_, index) => index !== activeIndex) }); setStopIndex(0); }}><Trash2 size={16} /></button>
            <button type="button" title="Reverse gradient" aria-label="Reverse gradient" onClick={() => patchPaint({ stops: paint.stops.map(stop => ({ ...stop, offset: 1 - stop.offset })) })}><ArrowLeftRight size={16} /></button>
          </div>
          {paint.kind !== 'radial' && <label className="flex items-center gap-2 text-xs">Angle<input aria-label="Gradient angle" type="range" min={0} max={360} value={paint.angle} className="min-w-0 flex-1" onChange={event => patchPaint({ angle: Number(event.target.value) })} /></label>}
          {paint.kind !== 'linear' && <>{(['x', 'y'] as const).map(axis => <label key={axis} className="flex items-center gap-2 text-xs">{axis.toUpperCase()}<input aria-label={`Gradient centre ${axis}`} type="range" min={0} max={100} value={paint[axis] * 100} className="min-w-0 flex-1" onChange={event => patchPaint({ [axis]: Number(event.target.value) / 100 })} /></label>)}</>}
        </div>}
        <div className="relative touch-none">
          <div
            ref={svRef}
            role="presentation"
            className="relative h-36 w-full cursor-crosshair overflow-hidden rounded-lg border border-[#252528]"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, rgba(255,255,255,0)), hsl(${Math.round(hue)}, 100%, 50%)`,
            }}
            onPointerDown={(e) => {
              dragSv.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              pickSv(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!dragSv.current) return;
              pickSv(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              dragSv.current = false;
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* released */
              }
            }}
            onPointerCancel={() => {
              dragSv.current = false;
            }}
          />
          <div
            className="pointer-events-none absolute h-3 w-3 rounded-full border-2 border-white shadow-md"
            style={{
              left: `${hsv.s * 100}%`,
              top: `${(1 - hsv.v) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={Math.round(hue)}
            onChange={(e) => commitHsv({ h: Number(e.target.value) })}
            className="h-2.5 w-full cursor-pointer appearance-none rounded-full accent-[#CC2D24]"
            style={{
              background:
                'linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)',
            }}
            aria-label="Hue"
          />
        </div>
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/45">RGB</span>
            <span className="font-mono text-[10px] text-white/55">{hex}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['R', 'r', rgb.r] as const,
                ['G', 'g', rgb.g] as const,
                ['B', 'b', rgb.b] as const,
              ]
            ).map(([label, key, channel]) => (
              <div key={key}>
                <label className="mb-1 block text-center text-[9px] font-medium text-white/40">{label}</label>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={channel}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(255, Math.round(Number(e.target.value) || 0)));
                    const next = { ...rgb, [key]: n };
                    commitRgb(next.r, next.g, next.b);
                  }}
                  className="h-8 w-full rounded-lg border border-white/12 bg-black/50 px-1 text-center font-mono text-[11px] tabular-nums text-white outline-none focus:border-[#CC2D24]/80 focus:ring-1 focus:ring-[#CC2D24]/35"
                />
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
