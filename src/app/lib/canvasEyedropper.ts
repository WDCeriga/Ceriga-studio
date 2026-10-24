import { toCanvas } from 'html-to-image';

export async function sampleCanvasColor(signal: AbortSignal): Promise<string> {
  const NativePicker = (window as unknown as { EyeDropper?: new () => { open: (options: { signal: AbortSignal }) => Promise<{ sRGBHex: string }> } }).EyeDropper;
  if (NativePicker) return (await new NativePicker().open({ signal })).sRGBHex.toUpperCase();
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const root = document.querySelector<HTMLElement>('[data-design-canvas]');
  if (!root) throw new Error('Open the design canvas to sample a colour.');
  let background = 'transparent';
  for (let node: HTMLElement | null = root; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') { background = color; break; }
  }
  const canvas = await toCanvas(root, { pixelRatio: devicePixelRatio, backgroundColor: background === 'transparent' ? '#FFFFFF' : background,
    filter: node => !(node instanceof Element) || !node.matches('[data-handles], [data-inline-toolbar], [data-editor-chrome]') });
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas sampling is unavailable.');
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-eyedropper', '');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Sample canvas colour');
    overlay.tabIndex = -1;
    Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2147483647', cursor: 'crosshair', touchAction: 'none' });
    const previousFocus = document.activeElement as HTMLElement | null;
    const cleanup = () => { overlay.remove(); signal.removeEventListener('abort', cancel); window.removeEventListener('keydown', key, true); previousFocus?.focus(); };
    const cancel = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancel(); } };
    overlay.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      const rect = root.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) { cancel(); return; }
      try {
        const pixel = context.getImageData(Math.floor((event.clientX - rect.left) / rect.width * canvas.width), Math.floor((event.clientY - rect.top) / rect.height * canvas.height), 1, 1).data;
        const color = `#${Array.from(pixel.slice(0, 3), channel => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
        cleanup(); resolve(color);
      } catch (error) { cleanup(); reject(error); }
    });
    document.body.append(overlay); overlay.focus();
    window.addEventListener('keydown', key, true);
    signal.addEventListener('abort', cancel, { once: true });
  });
}