import { useMemo, useState } from 'react';
import type { DesignElement } from '../PrintsDesignStep';
import { BRUSH_TEXTURES, createBrushTextureMask, loadBrushTexture, type BrushTexture } from '../../../lib/brushTextures';

const BUILTIN_IDS: BrushTexture[] = ['canvas-fabric', 'denim-fabric', 'cotton', 'leather', 'rough-paper', 'watercolour-paper', 'chalk', 'halftone', 'screen-print', 'speckle', 'cracked', 'grunge'];
const textureSources = new Map<BrushTexture, string>();
const DEFAULT_TRANSFORM = { scale: 100, rotation: 0, x: 0, y: 0, opacity: 100 };
const DEFAULT_OUTLINE = { enabled: false, color: '#09090B', width: 2, opacity: 100, style: 'solid' as const };

function textureSource(texture: BrushTexture) {
  const existing = textureSources.get(texture);
  if (existing) return existing;
  const mask = createBrushTextureMask({ texture });
  const canvas = document.createElement('canvas');
  canvas.width = mask.width;
  canvas.height = mask.height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const pixels = context.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) pixels.data[i * 4 + 3] = mask.data[i];
  context.putImageData(pixels, 0, 0);
  const source = canvas.toDataURL('image/png');
  textureSources.set(texture, source);
  return source;
}

function AppearanceSlider({ label, value, min, max, step = 1, suffix = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void;
}) {
  return <label className="block space-y-1.5 text-[10px] text-white/60">
    <span className="flex justify-between gap-2"><span>{label}</span><span>{Math.round(value * 10) / 10}{suffix}</span></span>
    <input type="range" aria-label={label} value={value} min={Math.min(min, value)} max={Math.max(max, value)} step={step}
      onChange={event => onChange(Number(event.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-[#FF3B30]" />
  </label>;
}

export function CustomAreaAppearanceControls({ element, onChange }: {
  element: DesignElement;
  onChange: (patch: Partial<DesignElement>) => void;
}) {
  const textures = useMemo(() => BRUSH_TEXTURES.filter(item => BUILTIN_IDS.includes(item.id))
    .map(item => ({ ...item, source: textureSource(item.id) })), []);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fill = { ...DEFAULT_TRANSFORM, ...element.customAreaFillTransform };
  const outline = { ...DEFAULT_OUTLINE, ...element.customAreaOutline };
  const updateFill = (patch: Partial<typeof fill>) => onChange({ customAreaFillTransform: { ...fill, ...patch } });
  const updateOutline = (patch: Partial<typeof outline>) => onChange({ customAreaOutline: { ...outline, ...patch } });
  const texture = textures.find(item => item.source === element.customAreaTexture);
  const selectClass = 'h-9 w-full rounded-lg border border-white/15 bg-[#171719] px-2 text-xs text-white';

  return <fieldset disabled={element.locked || uploading} className="min-w-0 space-y-3 disabled:opacity-50" data-custom-area-appearance>
    <label className="block space-y-1 text-[10px] text-white/65">Texture fill
      <select aria-label="Custom Area texture" className={selectClass}
        value={element.customAreaTexture ? texture?.id ?? 'custom' : 'none'}
        onChange={event => {
          setError('');
          onChange({ customAreaTexture: textures.find(item => item.id === event.target.value)?.source });
        }}>
        <option value="none">No texture</option>
        {Array.from(new Set(textures.map(item => item.category))).map(category => <optgroup key={category} label={category}>
          {textures.filter(item => item.category === category).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </optgroup>)}
        {element.customAreaTexture && !texture && <option value="custom">Uploaded texture</option>}
      </select>
    </label>
    {element.customAreaTexture && <div className="flex items-center gap-3">
      <img src={element.customAreaTexture} alt="Current Custom Area texture" className="h-12 w-12 rounded border border-white/15 bg-white/50 object-cover" />
      <button type="button" className="text-xs text-white/65 hover:text-white" onClick={() => onChange({ customAreaTexture: undefined })}>Remove texture</button>
    </div>}
    <label className="block space-y-1 text-[10px] text-white/65">Upload texture (PNG, JPEG, WebP; up to 12 MB)
      <input type="file" aria-label="Upload Custom Area texture" accept="image/png,image/jpeg,image/webp"
        className="block w-full text-[10px] file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-2 file:text-white"
        onChange={async event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setError('');
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
            setError('Choose a PNG, JPEG or WebP image no larger than 12 MB.');
            return;
          }
          setUploading(true);
          try {
            const source = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image'));
              reader.onerror = () => reject(new Error('Unable to read image'));
              reader.readAsDataURL(file);
            });
            await loadBrushTexture(source);
            onChange({ customAreaTexture: source });
          } catch {
            setError('Unable to load texture. Choose a valid, smaller raster image.');
          } finally {
            setUploading(false);
          }
        }} />
    </label>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    <p className="text-[10px] text-white/45">Texture tiles over the current fill without changing the vector path.</p>
    {(element.customAreaImage || element.customAreaTexture) && <div className="space-y-3 border-t border-white/10 pt-3" data-custom-area-fill-controls>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Image &amp; texture placement</p>
      <AppearanceSlider label="Fill scale" value={fill.scale} min={10} max={400} suffix="%" onChange={scale => updateFill({ scale })} />
      <AppearanceSlider label="Fill rotation" value={fill.rotation} min={-180} max={180} suffix="°" onChange={rotation => updateFill({ rotation })} />
      <AppearanceSlider label="Fill horizontal position" value={fill.x} min={-Math.ceil(element.customAreaViewWidth ?? element.width)} max={Math.ceil(element.customAreaViewWidth ?? element.width)} suffix=" px" onChange={x => updateFill({ x })} />
      <AppearanceSlider label="Fill vertical position" value={fill.y} min={-Math.ceil(element.customAreaViewHeight ?? element.height)} max={Math.ceil(element.customAreaViewHeight ?? element.height)} suffix=" px" onChange={y => updateFill({ y })} />
      <AppearanceSlider label="Fill opacity" value={fill.opacity} min={0} max={100} suffix="%" onChange={opacity => updateFill({ opacity })} />
      <button type="button" className="text-xs text-white/65 hover:text-white" onClick={() => onChange({ customAreaFillTransform: { ...DEFAULT_TRANSFORM } })}>Reset fill placement</button>
    </div>}
    <div className="space-y-3 border-t border-white/10 pt-3">
      <label className="flex items-center justify-between text-xs text-white/75">Outline
        <input type="checkbox" aria-label="Custom Area outline" checked={outline.enabled}
          onChange={event => updateOutline({ enabled: event.target.checked })} className="accent-[#FF3B30]" />
      </label>
      {outline.enabled && <>
        <label className="flex items-center justify-between text-[10px] text-white/65">Outline colour
          <input type="color" aria-label="Custom Area outline colour" value={outline.color}
            onChange={event => updateOutline({ color: event.target.value })} className="h-8 w-12 cursor-pointer rounded border border-white/15 bg-transparent" />
        </label>
        <AppearanceSlider label="Outline thickness" value={outline.width} min={.5} max={40} step={.5} suffix=" px" onChange={width => updateOutline({ width })} />
        <AppearanceSlider label="Outline opacity" value={outline.opacity} min={0} max={100} suffix="%" onChange={opacity => updateOutline({ opacity })} />
        <label className="block space-y-1 text-[10px] text-white/65">Outline style
          <select aria-label="Custom Area outline style" className={selectClass} value={outline.style}
            onChange={event => updateOutline({ style: event.target.value as typeof outline.style })}>
            <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option>
          </select>
        </label>
        <p className="text-[10px] text-white/45">Outline is inset to stay inside the area.</p>
      </>}
    </div>
  </fieldset>;
}
