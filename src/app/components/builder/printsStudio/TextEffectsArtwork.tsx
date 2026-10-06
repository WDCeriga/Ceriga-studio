import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react';
import { toCanvas } from 'html-to-image';
import { applyTextEffects, type TextEffect } from '../../../lib/textEffects';
import { cancelTextEffects, loadTextEffectImage, renderTextEffects, textEffectPadding, type TextPixels } from '../../../lib/textEffectRendering';

type Capture = TextPixels & { key: string; cssWidth: number; cssHeight: number; padding: number; scale: number };

export function TextEffectsArtwork({ effects, sourceKey, width, height, children, style, onDoubleClick, text, target = 'text', sourcePadding = 0 }: {
  effects: TextEffect[]; sourceKey: string; width: number; height?: number; children: ReactNode; style?: CSSProperties; onDoubleClick?: MouseEventHandler<HTMLDivElement>; text: string; target?: 'text' | 'shape'; sourcePadding?: number;
}) {
  const lane = useId();
  const sourceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width, height: height ?? 1 });
  const [fontRevision, setFontRevision] = useState(0);
  const [retry, setRetry] = useState(0);
  const [source, setSource] = useState<Capture>();
  const [painted, setPainted] = useState<{ key: string; capture: Capture }>();
  const [failure, setFailure] = useState<{ key: string; message: string; capture?: boolean }>();
  const padding = textEffectPadding(effects) + sourcePadding;
  const captureKey = JSON.stringify([sourceKey, size, padding, fontRevision, retry]);
  const renderKey = JSON.stringify([captureKey, effects]);
  const activeError = failure?.key === (failure?.capture ? captureKey : renderKey) ? failure?.message : undefined;

  useLayoutEffect(() => {
    const node = sourceRef.current;
    if (!node) return;
    const measure = () => {
      const next = { width: Math.max(1, node.offsetWidth), height: Math.max(1, node.offsetHeight) };
      setSize(previous => previous.width === next.width && previous.height === next.height ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width, height, sourceKey]);

  useEffect(() => {
    const fingerprint = () => JSON.stringify([...new Set(Array.from(document.fonts).filter(font => font.status === 'loaded').map(font => [font.family, font.style, font.weight, font.stretch, font.unicodeRange].join('|')))].sort());
    let loaded = fingerprint();
    const refresh = () => {
      const next = fingerprint();
      // Font embedding may insert equivalent faces; those must not restart capture.
      if (next !== loaded) { loaded = next; setFontRevision(value => value + 1); }
    };
    document.fonts.addEventListener('loadingdone', refresh);
    return () => document.fonts.removeEventListener('loadingdone', refresh);
  }, []);

  useEffect(() => {
    const node = sourceRef.current;
    if (!node) return;
    let cancelled = false;
    const capture = async () => {
      try {
        await document.fonts.ready;
        if (cancelled) return;
        const cssWidth = size.width + padding * 2;
        const cssHeight = size.height + padding * 2;
        const scale = Math.min(2, 1024 / Math.max(cssWidth, cssHeight));
        const canvas = await toCanvas(node, {
          width: cssWidth, height: cssHeight, pixelRatio: scale,
          style: { width: `${size.width}px`, height: `${size.height}px`, transform: `translate(${padding}px, ${padding}px)`, opacity: '1', visibility: 'visible' },
          filter: child => !(child instanceof Element) || !child.matches('[data-editor-chrome]'),
        });
        if (cancelled) return;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Text effects require canvas support.');
        setSource({ key: captureKey, data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height, cssWidth, cssHeight, padding, scale });
      } catch (error) {
        if (!cancelled) setFailure({ key: captureKey, capture: true, message: error instanceof Error ? error.message : 'Text could not be rendered.' });
      }
    };
    void capture();
    return () => { cancelled = true; };
  }, [captureKey]);

  useEffect(() => {
    if (!source || source.key !== captureKey) return;
    let cancelled = false;
    const paint = async () => {
      try {
        const images: Record<string, TextPixels> = {};
        await Promise.all([...new Set(effects.filter(effect => effect.enabled && effect.intensity > 0).map(effect => effect.source).filter((value): value is string => !!value))].map(async value => { images[value] = await loadTextEffectImage(value); }));
        if (cancelled) return;
        const data = await renderTextEffects(lane, source, effects, images, source.scale);
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = source.width; canvas.height = source.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Text effects require canvas support.');
        context.putImageData(new ImageData(data, source.width, source.height), 0, 0);
        setPainted({ key: renderKey, capture: source });
        setFailure(undefined);
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) setFailure({ key: renderKey, message: error instanceof Error ? error.message : 'Text effects could not be rendered.' });
      }
    };
    void paint();
    return () => { cancelled = true; cancelTextEffects(lane); };
  }, [source, renderKey, lane]);

  const displayed = painted?.capture ?? source;
  return <div data-text-effects data-text-effects-pending={painted?.key !== renderKey ? 'true' : undefined}
    data-text-effects-error={activeError || undefined} onDoubleClick={onDoubleClick} style={{ position: 'relative', width: '100%', ...style }}>
    <div ref={sourceRef} data-text-effects-source aria-hidden={!!painted} style={{ width: '100%', height, opacity: painted ? 0 : 1 }}>{children}</div>
    <canvas ref={canvasRef} data-text-effects-canvas aria-label={text} style={{ position: 'absolute', left: -(displayed?.padding ?? padding), top: -(displayed?.padding ?? padding), width: displayed?.cssWidth, height: displayed?.cssHeight, display: painted ? 'block' : 'none', pointerEvents: 'none' }} />
    {activeError && <div data-editor-chrome role="alert" className="absolute left-0 top-0 z-20 rounded bg-black/90 p-2 text-xs text-white">
      <span>{target === 'shape' ? 'Shape' : 'Text'} effect unavailable. </span><button type="button" onClick={event => { event.stopPropagation(); setRetry(value => value + 1); }} className="underline">Retry effects</button>
    </div>}
  </div>;
}

export function TextEffectPreview({ effect, text = 'CERIGA', shape = false }: { effect: TextEffect; text?: string; shape?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify(effect);
  useEffect(() => {
    let cancelled = false;
    const paint = async () => {
      const canvas = ref.current;
      if (!canvas) return;
      const scratch = document.createElement('canvas');
      scratch.width = 240; scratch.height = 120;
      const context = scratch.getContext('2d', { willReadFrequently: true })!;
      context.font = 'bold 32px Arial'; context.fillStyle = '#ecb6b0'; context.textAlign = 'center'; context.textBaseline = 'middle';
      if (shape) {
        context.beginPath();
        for (let point = 0; point < 10; point++) {
          const angle = -Math.PI / 2 + point * Math.PI / 5;
          const radius = point % 2 ? 23 : 43;
          const x = 120 + Math.cos(angle) * radius, y = 60 + Math.sin(angle) * radius;
          if (point === 0) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.closePath(); context.fill();
      } else context.fillText(text.slice(0, 12) || 'CERIGA', 120, 60, 174);
      const pixels = context.getImageData(0, 0, 240, 120).data;
      let preview = effect;
      const images: Record<string, TextPixels> = {};
      if (effect.type === 'image-fill' || effect.type === 'texture-fill') {
        if (effect.source) images[effect.source] = await loadTextEffectImage(effect.source);
        else {
          const data = new Uint8ClampedArray(64 * 64 * 4);
          for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
            const index = (y * 64 + x) * 4;
            data[index] = 60 + x * 3; data[index + 1] = 60 + y * 3; data[index + 2] = 160 + Math.sin((x + y) / 5) * 80; data[index + 3] = 255;
          }
          images.preview = { data, width: 64, height: 64 };
          preview = { ...effect, source: 'preview' };
        }
      }
      if (cancelled) return;
      const output = applyTextEffects(pixels, 240, 120, [preview], images, .6);
      canvas.width = 240; canvas.height = 120;
      canvas.getContext('2d')!.putImageData(new ImageData(output, 240, 120), 0, 0);
      setFailed(false);
    };
    void paint().catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [key, text, shape]);
  return <span className="block w-full"><canvas ref={ref} aria-hidden className="block w-full" style={{ aspectRatio: '2 / 1' }} />{failed && <span className="text-[9px] text-white/50">Preview unavailable</span>}</span>;
}
