import { useId } from 'react';
import { Check, ChevronDown, Eraser, Pencil, Sparkles, Upload, Layers, FlipHorizontal2, PenTool } from 'lucide-react';
import { BRUSH_PRESETS, type BrushPreset } from '../../../lib/drawingBrush';
import { BrushPreview, BrushPresetControls, BrushTextureControls } from './BrushSettingsPanel';
import { cn } from '../../ui/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { StudioColorField } from '../StudioColorField';
import { STUDIO_TEXT_MAIN_COLORS, STUDIO_TEXT_POPULAR_COLORS } from '../../../data/studioColorPresets';
import {
  usePrintsStudio,
  type PrintsStudioPanel,
} from './PrintsStudioContext';
import {
  DISTRESS_ASSETS,
  SHAPE_ASSETS,
  STUDIO_DRAG_MIME,
  encodeStudioDrag,
  type StudioAsset,
  type StudioAssetKind,
} from './studioAssets';
import { StudioGraphic } from './StudioGraphic';
import { AssetLibraryPanel, useAssetWorkspaceContext } from './AssetWorkspace';
import { PatternLibraryPanel, type PatternLayerSource } from './PatternLibraryPanel';
import type { CustomPatternSource, PatternPatch } from '../../../lib/patternEditing';
import { ImageFiltersPanel } from './ImageFiltersPanel';
import { TextListInput } from './TextListInput';
import type { SavedUpload } from './designLibrary';
import type { DesignElement } from '../PrintsDesignStep';
import { createDistressStamp } from '../../../lib/distressScatter';
import { distressPaths } from '../../../lib/distressRendering';

const DISTRESS_DESCRIPTIONS = {
  holes: 'Open punctures · frayed edges',
  abrasion: 'Faded patches · surface wear',
  rips: 'Long tears · exposed threads',
};

function DistressPreview({ kind, scatter = false, settings, radius = 28, opacity = 100 }: {
  kind: 'holes' | 'abrasion' | 'rips';
  scatter?: boolean;
  settings?: ReturnType<typeof usePrintsStudio>['distressScatter'];
  radius?: number;
  opacity?: number;
}) {
  const fabricId = useId();
  const generated = createDistressStamp(
    { x: 80, y: 48 }, radius,
    settings ?? { count: kind === 'rips' ? 2 : 3, size: 18, opacity: 100, spread: 82, roughness: 60, ripLength: 100 },
    kind,
  );
  const marks = scatter ? generated : generated.map((mark, index) => ({
    ...mark,
    x: [48, 104, 91][index],
    y: kind === 'rips' ? [33, 64][index] : [45, 30, 68][index],
    rotation: kind === 'holes' ? mark.rotation : -.18,
    opacity: 1,
  }));
  // Keep oversized scatter settings inside the swatch without cropping long tears.
  const extent = Math.max(80, ...marks.map(mark => {
    const cos = Math.abs(Math.cos(mark.rotation));
    const sin = Math.abs(Math.sin(mark.rotation));
    const halfWidth = mark.width * .6 + 4;
    const halfHeight = mark.height * .7 + 4;
    return Math.max(
      Math.abs(mark.x - 80) + cos * halfWidth + sin * halfHeight,
      (Math.abs(mark.y - 48) + sin * halfWidth + cos * halfHeight) * 5 / 3,
    ) + 4;
  }));
  return <svg viewBox="0 0 160 96" className="h-full w-full" aria-hidden data-distress-preview={kind}>
    <defs>
      <pattern id={fabricId} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="#8c938e" />
        <path d="M0 1h4M1 0v4" stroke="#c5c9bd" strokeWidth=".5" opacity=".35" />
        <path d="M0 4 4 0" stroke="#4d5754" strokeWidth=".6" opacity=".3" />
      </pattern>
    </defs>
    <rect width="160" height="96" rx="8" fill={`url(#${fabricId})`} />
    <path d="M0 86h160" stroke="#555f5a" strokeWidth="2" opacity=".3" />
    <path d="M0 88h160" stroke="#d1d2c0" strokeWidth="1" strokeDasharray="3 3" opacity=".55" />
    <g opacity={Math.max(.04, opacity / 100)} transform={`translate(80 48) scale(${80 / extent}) translate(-80 -48)`}>
      {marks.map((mark, index) => (
        <g key={index} data-distress-mark={index} transform={`translate(${mark.x} ${mark.y}) rotate(${mark.rotation * 180 / Math.PI})`}>
          {distressPaths(mark, kind).map((path, pathIndex) => (
            <path key={pathIndex} d={path.d} fill={path.fill ?? 'none'} stroke={path.stroke}
              strokeWidth={path.strokeWidth} strokeDasharray={path.dash?.join(' ')}
              strokeLinecap="round" strokeLinejoin="round"
              fillOpacity={mark.opacity * (path.opacity ?? 1)} strokeOpacity={mark.opacity * (path.opacity ?? 1)} />
          ))}
        </g>
      ))}
    </g>
  </svg>;
}

function ToolSlider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</span>
        <span className="text-[10px] font-semibold tabular-nums text-white/70">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-[#FF3B30]"
      />
    </label>
  );
}

function PencilRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-white">{label}</div>
        <div className="mt-0.5 text-[10px] leading-snug text-white/42">{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 data-[state=checked]:bg-[#FF3B30]" />
    </div>
  );
}

function AssetCard({
  asset,
  color,
  onPlace,
}: {
  asset: StudioAsset;
  color: string;
  onPlace: (kind: StudioAssetKind, id: string) => void;
}) {
  const preview: DesignElement = {
    id: asset.id,
    type: asset.kind,
    content: asset.id,
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    rotation: 0,
    color,
    borderWidth: 5,
  };
  return (
    <button
      type="button"
      draggable
      title={`Drag ${asset.label} onto the canvas, or tap to place`}
      onClick={() => onPlace(asset.kind, asset.id)}
      onDragStart={(e) => {
        e.dataTransfer.setData(STUDIO_DRAG_MIME, encodeStudioDrag(asset.kind, asset.id));
        if (asset.kind === 'pattern') e.dataTransfer.setData('application/x-ceriga-pattern', asset.id);
        e.dataTransfer.setData('text/plain', encodeStudioDrag(asset.kind, asset.id));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-1.5 py-2 text-white/70 transition hover:border-white/25 hover:text-white"
    >
      <div className="flex h-12 w-full items-center justify-center">
        <div className="h-10 w-10">
          <StudioGraphic element={preview} />
        </div>
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-wide">{asset.label}</span>
    </button>
  );
}

function Accordion({
  id,
  title,
  hint,
  open,
  onOpen,
  children,
}: {
  id: PrintsStudioPanel;
  title: string;
  hint: string;
  open: boolean;
  onOpen: (id: PrintsStudioPanel) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border', open ? 'border-[#FF3B30]/50 bg-[#FF3B30]/[0.06]' : 'border-white/[0.07] bg-black/30')}>
      <button
        type="button"
        onClick={() => onOpen(id)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-white">{title}</div>
          <div className="truncate text-[10px] text-white/42">{hint}</div>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/45 transition', open && 'rotate-180 text-white')} />
      </button>
      {open ? <div className="space-y-3 border-t border-white/[0.06] px-3 py-3">{children}</div> : null}
    </div>
  );
}

export function PrintsStudioToolbar({
  compact: _compact = false,
  layout = 'accordion',
  onPlaceAsset,
  onUpload,
  previousUploads,
  onReuseUpload,
  textInput,
  onTextInput,
  onAddText,
  onImportFont,
  fontLibrary,
  selectedElement = null,
  onUpdateSelected,
  onStartCustomArea,
  patternLayers = [],
  onCapturePatternLayer,
  patternDocumentKey,
}: {
  compact?: boolean;
  layout?: 'accordion' | 'workspace';
  onPlaceAsset: (kind: StudioAssetKind, id: string, settings?: PatternPatch) => void;
  patternLayers?: PatternLayerSource[];
  onCapturePatternLayer?: (id: string) => Promise<CustomPatternSource>;
  patternDocumentKey?: string;
  onUpload: () => void;
  previousUploads: SavedUpload[];
  onReuseUpload: (item: SavedUpload) => void;
  textInput: string;
  onTextInput: (value: string) => void;
  onAddText: () => void;
  onImportFont: () => void;
  fontLibrary: string[];
  selectedElement?: DesignElement | null;
  onUpdateSelected?: (patch: Partial<DesignElement>) => void;
  onStartCustomArea?: () => void;
}) {
  const studio = usePrintsStudio();
  const assetMode = Boolean(useAssetWorkspaceContext()?.project);
  const open = studio.panel;

  const shapesBody = (
    <>
      <button
        type="button"
        aria-pressed={studio.tool === 'customArea'}
        onClick={() => {
          if (studio.tool === 'customArea') studio.setTool('select');
          else { onStartCustomArea?.(); studio.setTool('customArea'); }
        }}
        className={cn(
          'flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-[10px] font-semibold uppercase tracking-wide',
          studio.tool === 'customArea'
            ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white'
            : 'border-white/10 bg-black/25 text-white/65 hover:text-white',
        )}
      >
        <PenTool className="h-3.5 w-3.5" />
        Custom Area
      </button>
      {studio.tool === 'customArea' ? (
        <p className="text-[10px] leading-relaxed text-white/55">
          Click points on the canvas to create a custom area. Click the first point again to close the shape.
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-1.5">
        {SHAPE_ASSETS.map((asset) => (
          <AssetCard key={asset.id} asset={asset} color={studio.color} onPlace={onPlaceAsset} />
        ))}
      </div>
      <StudioColorField
        allowGradients
        value={selectedElement?.type === 'shape' ? selectedElement.color ?? studio.color : studio.color}
        onChange={(hex) => {
          studio.setColor(hex);
          if (selectedElement?.type === 'shape') onUpdateSelected?.({ color: hex });
        }}
        mainColors={STUDIO_TEXT_MAIN_COLORS}
        popularColors={STUDIO_TEXT_POPULAR_COLORS}
        mainLabel="Shape colour"
        popularLabel="Quick colours"
        clearVisible={false}
      />
    </>
  );

  const eraserPresets = [
    { id: 'xs', label: 'Extra Small', size: 8 },
    { id: 's', label: 'Small', size: 14 },
    { id: 'm', label: 'Medium', size: 24 },
    { id: 'l', label: 'Large', size: 36 },
    { id: 'xl', label: 'Extra Large', size: 50 },
    { id: 'xxl', label: 'Double Extra Large', size: 68 },
  ] as const;

  const brushBody = (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            ['brush', 'Brush'],
            ['eraser', 'Eraser'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => studio.setTool(studio.tool === id ? 'select' : id)}
            className={cn(
              'flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wide',
              studio.tool === id
                ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white'
                : 'border-white/10 bg-black/25 text-white/65 hover:text-white',
            )}
          >
            {id === 'eraser' ? <Eraser className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
      </div>
      {studio.tool === 'eraser' ? (
        <div className="space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">Eraser size</div>
          <div className="grid grid-cols-3 gap-1.5">
            {eraserPresets.map((preset) => {
              const on = studio.eraserSize === preset.size;
              const d = 6 + (preset.size / 68) * 28;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => studio.setEraserSize(preset.size)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2',
                    on
                      ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white'
                      : 'border-white/10 bg-black/25 text-white/65 hover:text-white',
                  )}
                >
                  <span
                    className="rounded-full bg-white/85"
                    style={{ width: d, height: d }}
                    aria-hidden
                  />
                  <span className="text-center text-[8px] font-semibold uppercase leading-tight tracking-wide">
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 space-y-1.5 text-[10px] font-medium uppercase text-white/60">
              <span>Brush preset</span>
              <select aria-label="Brush preset" value={studio.brushPreset} onChange={event => studio.setBrushPreset(event.target.value as BrushPreset)} className="h-9 w-full rounded-md border border-white/15 bg-[#171717] px-2 text-[11px] text-white">
                {BRUSH_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </label>
            <button type="button" title="New drawing layer" aria-label="New drawing layer" onClick={studio.newDrawingLayer} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 text-white/70 hover:text-white"><Layers className="h-4 w-4" /></button>
          </div>
          <BrushPreview />
          <BrushPresetControls />
          <div className="flex items-center justify-between gap-3 text-[11px] text-white/80">
            <span className="flex items-center gap-2"><FlipHorizontal2 className="h-4 w-4" />Dual drawing / Symmetry</span>
            <Switch aria-label="Dual drawing / Symmetry" checked={studio.symmetry} onCheckedChange={symmetry => studio.patchBrush({ symmetry })} className="data-[state=checked]:bg-[#FF3B30]" />
          </div>
          <StudioColorField
            allowGradients
            value={studio.color}
            onChange={studio.setColor}
            mainColors={STUDIO_TEXT_MAIN_COLORS}
            popularColors={STUDIO_TEXT_POPULAR_COLORS}
            mainLabel="Colour"
            popularLabel="Quick colours"
            clearVisible={false}
          />
          <ToolSlider label="Brush size" value={studio.brushSize} min={2} max={64} suffix="px" onChange={studio.setBrushSize} />
          <ToolSlider label="Spacing" value={studio.brushSpacing} min={5} max={500} suffix="%" onChange={brushSpacing => studio.patchBrush({ brushSpacing })} />
          <p className="text-[10px] text-white/45">Distance between marks, as a percentage of brush size. Higher values leave larger gaps.</p>
          <div className="space-y-3 rounded-lg border border-white/10 p-3">
            <div className="flex items-center justify-between text-[11px] text-white/80">
              <span>Scatter</span>
              <Switch aria-label="Scatter" checked={studio.scatterEnabled} onCheckedChange={scatterEnabled => studio.patchBrush({ scatterEnabled })} className="data-[state=checked]:bg-[#FF3B30]" />
            </div>
            {studio.scatterEnabled && <>
              <ToolSlider label="Scatter spread" value={studio.scatterSpread} min={0} max={300} suffix="%" onChange={scatterSpread => studio.patchBrush({ scatterSpread })} />
              <ToolSlider label="Scatter count" value={studio.scatterCount} min={1} max={12} onChange={scatterCount => studio.patchBrush({ scatterCount })} />
              <ToolSlider label="Scatter size" value={studio.scatterSize} min={10} max={200} suffix="%" onChange={scatterSize => studio.patchBrush({ scatterSize })} />
              <ToolSlider label="Scatter opacity" value={studio.scatterOpacity ?? 100} min={0} max={100} suffix="%" onChange={scatterOpacity => studio.patchBrush({ scatterOpacity })} />
              <p className="text-[10px] text-white/45">Spread and size are relative to brush size. Count and opacity apply to each mark; Opacity below controls the whole stroke.</p>
            </>}
          </div>
          <ToolSlider
            label="Stabilisation Strength"
            value={studio.stabilization}
            min={0}
            max={100}
            suffix="%"
            onChange={studio.setStabilization}
          />
          <ToolSlider label="Stroke smoothing" value={studio.smoothing} min={0} max={100} suffix="%" onChange={smoothing => studio.patchBrush({ smoothing })} />
          <ToolSlider label="Opacity" value={studio.opacity} min={5} max={100} suffix="%" onChange={studio.setOpacity} />
          <ToolSlider label="Grain" value={studio.grain} min={0} max={100} suffix="%" onChange={studio.setGrain} />
          <BrushTextureControls />
          <ToolSlider label="Brush angle" value={studio.brushAngle} min={0} max={90} suffix=" deg" onChange={brushAngle => studio.patchBrush({ brushAngle })} />
          <ToolSlider label="Brush rotation" value={studio.brushRotation} min={-180} max={180} suffix=" deg" onChange={brushRotation => studio.patchBrush({ brushRotation })} />
          <ToolSlider label="Start taper" value={studio.taperStart} min={0} max={100} suffix="%" onChange={taperStart => studio.patchBrush({ taperStart })} />
          <ToolSlider label="End taper" value={studio.taperEnd} min={0} max={100} suffix="%" onChange={taperEnd => studio.patchBrush({ taperEnd })} />
          <ToolSlider label="Blur" value={studio.blur} min={0} max={100} suffix="%" onChange={blur => studio.patchBrush({ blur })} />
          <PencilRow
            label="Pressure sensitivity"
            hint="Apple Pencil and other styli taper the stroke with press."
            checked={studio.pressure}
            onCheckedChange={studio.setPressure}
          />
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/38 [&::-webkit-details-marker]:hidden">
              <Pencil className="h-3 w-3" />
              Apple Pencil
            </summary>
            <div className="mt-2 space-y-2">
              <PencilRow
                label="Pencil only"
                hint="Ignore finger and mouse so a resting palm does not mark the shirt."
                checked={studio.pencil.pencilOnly}
                onCheckedChange={(on) => studio.patchPencil({ pencilOnly: on })}
              />
              <PencilRow
                label="Tilt shading"
                hint="Flatten and widen the brush when the pencil is tilted."
                checked={studio.pencil.tiltShading}
                onCheckedChange={(on) => studio.patchPencil({ tiltShading: on })}
              />
              <PencilRow
                label="Double-tap eraser"
                hint="Two quick pencil taps switch between brush and eraser."
                checked={studio.pencil.doubleTapTogglesEraser}
                onCheckedChange={(on) => studio.patchPencil({ doubleTapTogglesEraser: on })}
              />
            </div>
          </details>
        </>
      )}
    </>
  );

  const uploadBody = (
    <>
      <AssetLibraryPanel />
      <Button
        type="button"
        onClick={onUpload}
        className="h-9 w-full bg-[#FF3B30] px-2 text-[10px] text-white hover:bg-[#FF3B30]/90"
      >
        <Upload className="mr-1.5 h-3.5 w-3.5" />
        Upload image
      </Button>
      <div>
        <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">Uploaded Assets</div>
        {previousUploads.length === 0 ? (
          <p className="text-[10px] leading-snug text-white/40">
            Files you upload are saved here so you can drop them onto a new project later.
          </p>
        ) : (
          <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {previousUploads.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.name}
                onClick={() => onReuseUpload(item)}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/12 bg-black/40"
              >
                <img src={item.dataUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      <ImageFiltersPanel element={selectedElement} onChange={patch => onUpdateSelected?.(patch)} />
    </>
  );

  const textBody = (
    <>
      <div className="flex gap-2">
        <TextListInput value={textInput} onChange={onTextInput} onSubmit={onAddText} />
        <Button onClick={onAddText} className="h-9 shrink-0 bg-[#FF3B30] px-3 text-[10px] hover:bg-[#FF3B30]/90">
          Add
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onImportFont}
        className="h-9 w-full border-white/18 bg-white/[0.04] px-2 text-[10px] !text-white hover:bg-white/10"
      >
        <Upload className="mr-1.5 h-3.5 w-3.5" />
        Upload font
      </Button>
      <p className="text-[10px] leading-snug text-white/40">
        {fontLibrary.length > 0
          ? `Font library: ${fontLibrary.length} saved across projects.`
          : 'Uploaded fonts stay in your library so you do not have to import them again.'}
      </p>
    </>
  );

  const patternsBody = <PatternLibraryPanel key={patternDocumentKey} color={studio.color} selected={selectedElement}
    onChange={patch => onUpdateSelected?.(patch)} onPlace={(id, settings) => onPlaceAsset('pattern', id, settings)}
    uploads={previousUploads} layers={patternLayers} onCaptureLayer={onCapturePatternLayer} />;

  const distressBody = (
    <>
      <div className="space-y-3">
        <div>
          <div className="text-xs font-semibold text-white/90">Choose your wear</div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">Three textures. Each with a different finish.</p>
        </div>
        <div className="grid gap-2">
          {DISTRESS_ASSETS.map((asset) => {
            const kind = asset.id as 'holes' | 'abrasion' | 'rips';
            const selected = studio.distressType === kind;
            return <button key={asset.id} type="button" aria-pressed={selected}
              aria-label={asset.label} onClick={() => studio.setDistressType(kind)}
              className={cn(
                'group flex min-w-0 items-center gap-3 rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B30] focus-visible:ring-offset-2 focus-visible:ring-offset-[#171717]',
                selected ? 'border-[#FF3B30]/65 bg-[#FF3B30]/[0.06]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]',
              )}>
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg"><DistressPreview kind={kind} /></div>
              <div className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-white/90">{asset.label}</span>
                <span className="mt-1 block text-[10px] leading-relaxed text-white/45">{DISTRESS_DESCRIPTIONS[kind]}</span>
              </div>
              <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', selected ? 'border-[#FF3B30] bg-[#FF3B30] text-white' : 'border-white/20')}>
                {selected ? <Check className="h-2.5 w-2.5" aria-hidden /> : null}
              </span>
            </button>;
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.05] p-1">
        {(
          [
            ['distress', 'Brush'],
            ['distressEraser', 'Eraser'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => studio.setTool(studio.tool === id ? 'select' : id)}
            aria-pressed={studio.tool === id}
            className={cn(
              'flex h-8 items-center justify-center gap-2 rounded-md text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B30]',
              studio.tool === id
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/45 hover:bg-white/[0.04] hover:text-white/80',
            )}
          >
            {id === 'distressEraser' ? <Eraser className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <button type="button" onClick={studio.newDistressLayer}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/15 text-[11px] font-medium text-white/80 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B30]">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Add new distress layer
        </button>
        <p className="text-[10px] leading-snug text-white/40">Marks share one layer. Add a new layer before painting separately.</p>
      </div>
      {studio.tool === 'distressEraser' ? (
        <div className="space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">Eraser size</div>
          <div className="grid grid-cols-3 gap-1.5">
            {eraserPresets.map((preset) => {
              const on = studio.eraserSize === preset.size;
              const d = 6 + (preset.size / 68) * 28;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => studio.setEraserSize(preset.size)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2',
                    on
                      ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white'
                      : 'border-white/10 bg-black/25 text-white/65 hover:text-white',
                  )}
                >
                  <span className="rounded-full border border-white/70 bg-transparent" style={{ width: d, height: d }} aria-hidden />
                  <span className="text-center text-[8px] font-semibold uppercase leading-tight tracking-wide">
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] leading-snug text-white/40">
            Hold and drag to clear distressing — brushed marks and placed holes, abrasion, and rips.
          </p>
        </div>
      ) : studio.tool === 'distress' ? (
        <div className="space-y-3" data-distress-scatter-controls>
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-[10px] font-medium text-white/65">Brush preview</span>
              <span className="text-[9px] tabular-nums text-white/40">{studio.distressScatter.count} {studio.distressScatter.count === 1 ? 'mark' : 'marks'} / pass</span>
            </div>
            <div className="h-24 border-y border-white/[0.06] bg-[#8c938e]">
              <DistressPreview kind={studio.distressType} scatter settings={studio.distressScatter}
                radius={studio.eraserSize / 2} opacity={studio.opacity} />
            </div>
            <p className="px-3 py-2 text-[10px] leading-relaxed text-white/40">Actual brush stamp · pen pressure varies size</p>
          </div>
          <div className="space-y-3">
            <div className="text-[10px] font-medium text-white/70">Brush settings</div>
            <ToolSlider label="Count" value={studio.distressScatter.count} min={1} max={48} suffix=" marks"
              onChange={(count) => studio.patchDistressScatter({ count })} />
            <ToolSlider label="Size" value={studio.distressScatter.size} min={2} max={28} suffix=" px"
              onChange={(size) => studio.patchDistressScatter({ size })} />
            <ToolSlider label="Opacity" value={studio.distressScatter.opacity} min={5} max={100} suffix="%"
              onChange={(opacity) => studio.patchDistressScatter({ opacity })} />
          </div>
          {studio.distressType === 'holes' ? <ToolSlider label="Edge roughness" value={studio.distressScatter.roughness} min={0} max={100} suffix="%"
            onChange={(roughness) => studio.patchDistressScatter({ roughness })} /> : null}
          {studio.distressType === 'abrasion' ? <ToolSlider label="Wear spread" value={studio.distressScatter.spread} min={20} max={100} suffix="%"
            onChange={(spread) => studio.patchDistressScatter({ spread })} /> : null}
          {studio.distressType === 'rips' ? <ToolSlider label="Rip length" value={studio.distressScatter.ripLength} min={40} max={180} suffix="%"
            onChange={(ripLength) => studio.patchDistressScatter({ ripLength })} /> : null}
          <p className="text-[10px] leading-snug text-white/40">
            Brush to apply this stamp. Passes and texture types build up on the current distress layer.
          </p>
        </div>
      ) : (
        <p className="text-[10px] leading-snug text-white/40">
          Choose a distress type, then select Brush to paint it onto the garment.
        </p>
      )}
    </>
  );

  const body =
    open === 'brush'
      ? brushBody
      : open === 'shapes'
        ? shapesBody
        : open === 'upload'
          ? uploadBody
          : open === 'text'
            ? textBody
            : open === 'patterns'
              ? patternsBody
              : distressBody;

  if (layout === 'workspace') {
    return (
      <div key={open} className="space-y-3 rounded-xl border border-white/[0.07] bg-black/30 p-3">
        {body}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Accordion
        id="brush"
        title="Drawing tools"
        hint="Brush, eraser, and Pencil"
        open={open === 'brush'}
        onOpen={studio.setPanel}
      >
        {brushBody}
      </Accordion>
      <Accordion
        id="shapes"
        title="Shapes and lines"
        hint="Pick a shape, then drag it onto the garment"
        open={open === 'shapes'}
        onOpen={studio.setPanel}
      >
        {shapesBody}
      </Accordion>
      <Accordion id="upload" title="Assets" hint="Create, upload, or reuse artwork" open={open === 'upload'} onOpen={studio.setPanel}>
        {uploadBody}
      </Accordion>
      <Accordion id="text" title="Typography" hint="Add type, then place it on the garment" open={open === 'text'} onOpen={studio.setPanel}>
        {textBody}
      </Accordion>
      <Accordion
        id="patterns"
        title="Patterns"
        hint="Drag a pattern onto the selected area"
        open={open === 'patterns'}
        onOpen={studio.setPanel}
      >
        {patternsBody}
      </Accordion>
      {!assetMode && <Accordion
        id="distress"
        title="Distressing"
        hint="Compare textures, then brush on wear"
        open={open === 'distress'}
        onOpen={studio.setPanel}
      >
        {distressBody}
      </Accordion>}
    </div>
  );
}

