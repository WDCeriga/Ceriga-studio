import { useEffect, useState } from 'react';

/**
 * Which kind of screen the Builder is on.
 * phone: a touch screen whose short side is under 600 CSS px. The Builder is not offered there.
 * narrow: a mouse screen narrower than 768 px, such as a small desktop window.
 * tablet: any other touch screen, such as an iPad. It gets its own touch layout at full size.
 * desktop: everything else, including touchscreen laptops. It scales with the window, relative to a laptop.
 */
export type BuilderDevice = 'phone' | 'narrow' | 'tablet' | 'desktop';

function touchScreen() {
  if (typeof window === 'undefined') return false;
  const iPadDesktopMode = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  // The main pointer decides: a Windows laptop with a touchscreen still has a mouse or trackpad as its main pointer.
  return iPadDesktopMode || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
}

export function detectBuilderDevice(): BuilderDevice {
  if (typeof window === 'undefined') return 'desktop';
  const touch = touchScreen(), shortSide = Math.min(screen.width || innerWidth, screen.height || innerHeight, Math.max(innerWidth, innerHeight));
  if (touch && shortSide < 600) return 'phone';
  if (touch) return 'tablet';
  return innerWidth < 768 ? 'narrow' : 'desktop';
}

/**
 * Desktop scale. The user's laptop look (90%) is the reference: laptop-sized screens keep it exactly.
 * Big monitors grow gently with screen height (a power curve, so a 4K screen doesn't get huge),
 * keeping the UI compact while staying readable. Small or short windows shrink a little before the layout changes.
 *   1920 x 1080 = 95%, 2560 x 1440 = 114%, 3440 x 1440 = 114%, 3840 x 2160 = 148%
 */
const BASE = .9, COMFORT_MIN = 1280, BIG_WIDTH = 1700, BIG_HEIGHT = 1000, GROWTH = .65, MAX_GROWTH = 1.65, SHORT_HEIGHT = 760;
export function desktopScale(width: number, height: number) {
  let scale = BASE;
  if (width >= BIG_WIDTH && height > BIG_HEIGHT) scale = BASE * Math.min(MAX_GROWTH, Math.pow(height / BIG_HEIGHT, GROWTH));
  else if (width < COMFORT_MIN) scale = BASE * Math.max(.9, width / COMFORT_MIN);
  if (height < SHORT_HEIGHT) scale *= Math.max(.88, height / SHORT_HEIGHT);
  return Math.round(Math.max(.74, scale) * 1000) / 1000;
}

/** A personal nudge on top of the automatic size, kept in this browser. */
export type InterfaceSize = 'smaller' | 'default' | 'larger';
export const INTERFACE_SIZES: { id: InterfaceSize; label: string; hint: string; factor: number }[] = [
  { id: 'smaller', label: 'Smaller', hint: 'More room for the canvas', factor: .9 },
  { id: 'default', label: 'Default', hint: 'Sized for this screen', factor: 1 },
  { id: 'larger', label: 'Larger', hint: 'Bigger text and controls', factor: 1.1 },
];
const SIZE_KEY = 'ceriga.builder.interfaceSize';
export function readInterfaceSize(): InterfaceSize {
  try { const saved = localStorage.getItem(SIZE_KEY); return INTERFACE_SIZES.some(size => size.id === saved) ? saved as InterfaceSize : 'default'; } catch { return 'default'; }
}
export function writeInterfaceSize(size: InterfaceSize) {
  try { localStorage.setItem(SIZE_KEY, size); } catch { /* storage can be blocked; the choice still applies until reload */ }
  applyBuilderScale(detectBuilderDevice(), size);
  dispatchEvent(new Event('ceriga-interface-size'));
}

let viewportMeta: string | null = null;
/** iPad mini portrait is 744 px wide. Lay it out at 780 px so it gets the tablet layout, not the phone one. */
function fitSmallTablet(device: BuilderDevice) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;
  viewportMeta ??= meta.content;
  const portraitWidth = Math.min(screen.width || innerWidth, screen.height || innerHeight);
  const wanted = device === 'tablet' && portraitWidth < 768 && (screen.width || innerWidth) < 768 ? 'width=780, viewport-fit=cover' : viewportMeta;
  if (meta.content !== wanted) meta.content = wanted;
}

export function applyBuilderScale(device: BuilderDevice, size: InterfaceSize = readInterfaceSize()) {
  const root = document.documentElement, factor = INTERFACE_SIZES.find(option => option.id === size)?.factor ?? 1;
  root.style.setProperty('--builder-fluid-scale', String(Math.round((device === 'desktop' ? desktopScale(innerWidth, innerHeight) : 1) * factor * 1000) / 1000));
  root.dataset.builderDevice = device;
}

export function useBuilderDevice() {
  const [state, setState] = useState(() => ({ device: detectBuilderDevice(), landscape: typeof window === 'undefined' || innerWidth >= innerHeight }));
  useEffect(() => {
    let frame = 0;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const device = detectBuilderDevice();
      fitSmallTablet(device); applyBuilderScale(device);
      setState(old => old.device === device && old.landscape === (innerWidth >= innerHeight) ? old : { device, landscape: innerWidth >= innerHeight });
    }); };
    update();
    addEventListener('resize', update); addEventListener('orientationchange', update);
    return () => { cancelAnimationFrame(frame); removeEventListener('resize', update); removeEventListener('orientationchange', update); };
  }, []);
  return state;
}
