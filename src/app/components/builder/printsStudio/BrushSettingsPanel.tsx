import { useEffect, useId, useRef, useState } from 'react';
import { brushPresetControls, renderBrushStroke, type BrushSettings } from '../../../lib/drawingBrush';
import { BRUSH_TEXTURES, DEFAULT_TEXTURE_SETTINGS, loadBrushTexture, type BrushTexture } from '../../../lib/brushTextures';
import { usePrintsStudio } from './PrintsStudioContext';
import { Switch } from '../../ui/switch';

const selectClass = 'h-9 w-full rounded-md border border-white/15 bg-[#171717] px-2 text-[11px] text-white';

function BrushSlider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="space-y-1">
    <label htmlFor={id} className="flex justify-between text-[11px] text-white/65"><span>{label}</span><span>{value}</span></label>
    <input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} className="w-full accent-[#FF3B30]" />
  </div>;
}

export function BrushPreview() {
  const studio = usePrintsStudio();
  const ref = useRef<HTMLCanvasElement>(null);
  const [textureReady, setTextureReady] = useState(0);
  useEffect(() => {
    if (studio.texture !== 'custom' || !studio.customTextureSource) return;
    let active = true;
    void loadBrushTexture(studio.customTextureSource).then(() => { if (active) setTextureReady(value => value + 1); }).catch(() => {});
    return () => { active = false; };
  }, [studio.texture, studio.customTextureSource]);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const ink = document.createElement('canvas');
    ink.width = canvas.width; ink.height = canvas.height;
    const inkContext = ink.getContext('2d');
    if (!inkContext) return;
    const points = Array.from({ length: 65 }, (_, i) => ({
      x: 56 + i * 7.6, y: 104 + Math.sin(i / 64 * Math.PI * 2) * 25,
      p: .65 + Math.sin(i / 64 * Math.PI) * .35, tilt: 0,
    }));
    renderBrushStroke(inkContext, points, studio, 2, 73);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const removing = studio.brushPreset === 'distress-brush' && studio.distressMode !== 'paint';
    if (removing) {
      context.fillStyle = '#d5c1aa';
      context.fillRect(24, 24, canvas.width - 48, canvas.height - 48);
    }
    context.save();
    context.globalAlpha = studio.opacity / 100;
    context.globalCompositeOperation = removing ? 'destination-out' : 'source-over';
    context.drawImage(ink, 0, 0);
    context.restore();
  }, [studio, textureReady]);
  return <figure className="space-y-1 rounded-lg border border-white/10 p-2">
    <figcaption className="text-[10px] uppercase text-white/55">Live brush preview</figcaption>
    <canvas ref={ref} width={600} height={208} aria-label="Live brush preview" className="w-full rounded bg-[#303030]" />
  </figure>;
}

export function BrushPresetControls() {
  const studio = usePrintsStudio();
  const controls = brushPresetControls(studio.brushPreset);
  return <div className="space-y-3">
    {studio.brushPreset === 'distress-brush' && <label className="block space-y-1 text-[11px] text-white/65">
      <span>Distress mode</span>
      <select aria-label="Distress mode" className={selectClass} value={studio.distressMode ?? 'erase'} onChange={event => studio.patchBrush({ distressMode: event.target.value as 'paint' | 'erase' })}>
        <option value="erase">Remove from drawing layers</option><option value="paint">Paint worn marks</option>
      </select>
    </label>}
    {controls.map(control => <BrushSlider key={control.key} label={control.label} value={Number(studio[control.key] ?? control.default)} min={control.min} max={control.max} step={control.step} onChange={value => studio.patchBrush({ [control.key]: value } as Partial<BrushSettings>)} />)}
    {['distress-brush', 'drip-paint', 'graffiti-mop'].includes(studio.brushPreset) && <button type="button" className="w-full rounded border border-white/15 px-3 py-2 text-[11px] text-white/80" onClick={() => studio.patchBrush({ brushSeed: ((studio.brushSeed ?? 0) + 1) >>> 0 })}>Randomise brush</button>}
  </div>;
}

export function BrushTextureControls() {
  const studio = usePrintsStudio();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const uploadId = useId();
  const uploadVersion = useRef(0);
  useEffect(() => () => { uploadVersion.current++; }, []);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const version = ++uploadVersion.current;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setLoading(false);
      setError('Choose a PNG, JPEG or WebP image up to 8 MB.');
      return;
    }
    setLoading(true);
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result)); reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await loadBrushTexture(source);
      if (version === uploadVersion.current) studio.patchBrush({ customTextureSource: source, texture: 'custom' });
    } catch {
      if (version === uploadVersion.current) setError('The texture could not be read. Try another image.');
    } finally {
      if (version === uploadVersion.current) setLoading(false);
    }
  };
  const controls = [
    ['textureScale', 'Texture scale', 10, 400], ['textureStrength', 'Texture strength', 0, 100],
    ['textureDensity', 'Texture density', 0, 100], ['textureRotation', 'Texture rotation', 0, 360],
    ['textureContrast', 'Texture contrast / depth', 0, 100],
  ] as const;
  return <div className="space-y-3 rounded-lg border border-white/10 p-3">
    <label className="block space-y-1.5 text-[10px] font-medium uppercase text-white/60">
      <span>Texture</span>
      <select aria-label="Texture" value={studio.texture} onChange={event => studio.patchBrush({ texture: event.target.value as BrushTexture })} className={selectClass}>
        {BRUSH_TEXTURES.map(texture => <option key={texture.id} value={texture.id}>{texture.label}</option>)}
      </select>
    </label>
    {studio.texture === 'custom' && <div className="space-y-2 text-[11px] text-white/60">
      <label htmlFor={uploadId}>Upload texture image</label>
      <input id={uploadId} type="file" accept="image/png,image/jpeg,image/webp" className="w-full text-[10px]" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
      <p>{loading ? 'Preparing texture…' : studio.customTextureSource ? 'Custom mask ready. Dark areas remove more ink.' : 'Upload an image to use its light and dark areas as a grain mask.'}</p>
      {error && <p role="alert" className="text-red-300">{error}</p>}
    </div>}
    {studio.texture !== 'smooth' && <>
      {controls.map(([key, label, min, max]) => <BrushSlider key={key} label={label} value={studio[key] ?? DEFAULT_TEXTURE_SETTINGS[key]} min={min} max={max} onChange={value => studio.patchBrush({ [key]: value })} />)}
      {studio.texture === 'custom' && <div className="flex items-center justify-between text-[11px] text-white/70"><span>Invert texture</span><Switch aria-label="Invert texture" checked={studio.textureInvert ?? false} onCheckedChange={textureInvert => studio.patchBrush({ textureInvert })} /></div>}
    </>}
  </div>;
}
