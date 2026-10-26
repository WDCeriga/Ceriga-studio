import {canvasPaint} from '../../../lib/studioPaint';
import {useContext} from 'react';
import {ArtworkResolutionContext} from './ArtworkResolutionContext';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { ImageFilterSettings } from '../../../lib/imageFilters';
import { filteredImagePixels, paintFilteredImage } from '../../../lib/imageFilterRendering';

type Rendered = Awaited<ReturnType<typeof filteredImagePixels>>;

export function FilteredImage({ source, settings, alt, className, style, tint, thumbnail = false }: {
  source: string; settings?: ImageFilterSettings; alt: string; className?: string; style?: CSSProperties; thumbnail?: boolean; tint?:string;
}) {
  const active = Boolean(tint) || (!!settings && settings.id !== 'none' && (settings.intensity ?? 100) > 0);
  const displayScale=useContext(ArtworkResolutionContext),host=useRef<HTMLSpanElement>(null),[detail,setDetail]=useState(2048);
  useLayoutEffect(()=>{if(thumbnail)return;const update=()=>{const edge=Math.max(host.current?.offsetWidth??0,host.current?.offsetHeight??0)*displayScale*(window.devicePixelRatio||1)*1.25;setDetail(Math.min(8192,Math.max(2048,Math.ceil(edge/512)*512)))};update();const observer=new ResizeObserver(update);if(host.current)observer.observe(host.current);return()=>observer.disconnect()},[displayScale,thumbnail,active]);
  const effect = JSON.stringify({ ...settings, intensity: 100 });
  const key = `${source}:${effect}:${thumbnail}:${detail}`;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<{ key: string; source: string; pixels?: Rendered; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  const ready = result?.key === key && !!result.pixels;
  const error = result?.key === key ? result.error : undefined;
  const displayed = result?.source === source && !!result.pixels && !error;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void filteredImagePixels(source, JSON.parse(effect), thumbnail ? 96 : detail)
      .then(pixels => { if (!cancelled) setResult({ key, source, pixels }); })
      .catch(error => { if (!cancelled) setResult({ key, source, error: error instanceof Error ? error.message : 'Image filter unavailable.' }); });
    return () => { cancelled = true; };
  }, [active, source, effect, key, thumbnail, attempt,detail]);
  useLayoutEffect(() => {
    if (active && displayed && canvas.current) {
      paintFilteredImage(canvas.current, result!.pixels!, settings?.intensity ?? 100);
      if(tint){const ctx=canvas.current.getContext('2d')!;ctx.globalCompositeOperation='source-in';ctx.fillStyle=canvasPaint(ctx,tint,canvas.current.width,canvas.current.height);ctx.fillRect(0,0,canvas.current.width,canvas.current.height);ctx.globalCompositeOperation='source-over'}
    }
  }, [active, displayed, result, settings?.intensity,tint]);
  if (!active) return <img src={source} alt={alt} className={className} style={style} />;
  return <span ref={host} className={className} style={{ display: 'block', position: 'relative', ...style }} data-image-filter={settings!.id} data-image-filter-pending={!ready && !error ? 'true' : 'false'} data-image-filter-error={error || undefined}>
    <img src={source} alt={alt} className="h-full w-full object-fill" style={{ opacity: displayed ? 0 : 1, objectFit: thumbnail ? 'contain' : 'fill' }} />
    <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" style={{ opacity: displayed ? 1 : 0, objectFit: thumbnail ? 'contain' : 'fill' }} />
    {error && <span data-editor-chrome role={thumbnail ? undefined : 'alert'} title={error} className="absolute inset-x-0 bottom-0 bg-[#fafafa] p-1 text-[10px] text-red-200">{thumbnail ? 'Unavailable' : <>Filter unavailable. <button type="button" className="underline" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setResult(undefined); setAttempt(value => value + 1); }}>Retry filter</button> or choose Original.</>}</span>}
  </span>;
}
