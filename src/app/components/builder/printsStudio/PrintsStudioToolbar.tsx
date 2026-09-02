import { ChevronDown, Eraser, Pencil, Sparkles, Upload } from 'lucide-react';
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
  PATTERN_ASSETS,
  SHAPE_ASSETS,
  STUDIO_DRAG_MIME,
  encodeStudioDrag,
  patternDensityOptions,
  type StudioAsset,
  type StudioAssetKind,
} from './studioAssets';
import { StudioGraphic } from './StudioGraphic';
import type { SavedUpload } from './designLibrary';
import type { DesignElement } from '../PrintsDesignStep';

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
      title={`Drag ${asset.label} onto the garment, or tap to place`}
      onClick={() => onPlace(asset.kind, asset.id)}
      onDragStart={(e) => {
        e.dataTransfer.setData(STUDIO_DRAG_MIME, encodeStudioDrag(asset.kind, asset.id));
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
}: {
  compact?: boolean;
  layout?: 'accordion' | 'workspace';
  onPlaceAsset: (kind: StudioAssetKind, id: string) => void;
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
}) {
  const studio = usePrintsStudio();
  const open = studio.panel;

  const shapesBody = (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {SHAPE_ASSETS.map((asset) => (
          <AssetCard key={asset.id} asset={asset} color={studio.color} onPlace={onPlaceAsset} />
        ))}
      </div>
      <StudioColorField
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
          <StudioColorField
            value={studio.color}
            onChange={studio.setColor}
            mainColors={STUDIO_TEXT_MAIN_COLORS}
            popularColors={STUDIO_TEXT_POPULAR_COLORS}
            mainLabel="Colour"
            popularLabel="Quick colours"
            clearVisible={false}
          />
          <ToolSlider label="Brush size" value={studio.brushSize} min={2} max={64} suffix="px" onChange={studio.setBrushSize} />
          <ToolSlider
            label="Stabilization"
            value={studio.stabilization}
            min={0}
            max={100}
            suffix="%"
            onChange={studio.setStabilization}
          />
          <p className="text-[10px] leading-snug text-white/40">
            0% is a natural stroke. 100% heavily smooths shake in real time while still following your direction. Works with mouse, finger, stylus, and Apple Pencil.
          </p>
          <ToolSlider label="Opacity" value={studio.opacity} min={5} max={100} suffix="%" onChange={studio.setOpacity} />
          <ToolSlider label="Grain / texture" value={studio.grain} min={0} max={100} suffix="%" onChange={studio.setGrain} />
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
      <Button
        type="button"
        onClick={onUpload}
        className="h-9 w-full bg-[#FF3B30] px-2 text-[10px] text-white hover:bg-[#FF3B30]/90"
      >
        <Upload className="mr-1.5 h-3.5 w-3.5" />
        Upload image
      </Button>
      <div>
        <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">Previous uploads</div>
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
    </>
  );

  const textBody = (
    <>
      <div className="flex gap-2">
        <Input
          value={textInput}
          onChange={(e) => onTextInput(e.target.value)}
          placeholder="Type, then add"
          className="h-9 flex-1 border-white/12 bg-black/35 text-[11px] text-white placeholder:text-white/28"
          onKeyDown={(e) => e.key === 'Enter' && onAddText()}
        />
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

  const patternsBody = (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {PATTERN_ASSETS.map((asset) => (
          <AssetCard key={asset.id} asset={asset} color={studio.color} onPlace={onPlaceAsset} />
        ))}
      </div>
      {selectedElement?.type === 'pattern'
        ? (() => {
            const options = patternDensityOptions(selectedElement.content);
            if (!options) return null;
            return (
              <div className="space-y-1.5">
                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
                  Pattern amount
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {options.map((opt) => {
                    const on = (selectedElement.patternCount ?? (selectedElement.content === 'checks' || selectedElement.content === 'dots' ? 4 : 5)) === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onUpdateSelected?.({ patternCount: opt.value })}
                        className={cn(
                          'h-9 rounded-lg border text-[10px] font-semibold',
                          on
                            ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white'
                            : 'border-white/10 bg-black/25 text-white/70 hover:text-white',
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()
        : (
          <p className="text-[10px] leading-snug text-white/40">
            Place a pattern on the garment, then choose how dense the repeat is.
          </p>
        )}
    </>
  );

  const distressBody = (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {DISTRESS_ASSETS.map((asset) => (
          <AssetCard key={asset.id} asset={asset} color="#FFFFFF" onPlace={onPlaceAsset} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
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
            className={cn(
              'flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wide',
              studio.tool === id
                ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white'
                : 'border-white/10 bg-black/25 text-white/65 hover:text-white',
            )}
          >
            {id === 'distressEraser' ? <Eraser className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
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
        <div className="space-y-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/38">
            Distressing type
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {DISTRESS_ASSETS.map((asset) => {
              const on = studio.distressType === asset.id;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => studio.setDistressType(asset.id as 'holes' | 'abrasion' | 'rips')}
                  className={cn(
                    'h-9 rounded-lg border px-1 text-[10px] font-semibold',
                    on
                      ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white'
                      : 'border-white/10 bg-black/25 text-white/70 hover:text-white',
                  )}
                >
                  {asset.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] leading-snug text-white/40">
            Pick a type, then brush it onto the garment. Use Eraser to take it back.
          </p>
        </div>
      ) : (
        <p className="text-[10px] leading-snug text-white/40">
          Drag a preset onto the garment, or brush the worn area by hand.
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
      <Accordion id="upload" title="Images" hint="Place artwork, or reuse a previous file" open={open === 'upload'} onOpen={studio.setPanel}>
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
      <Accordion
        id="distress"
        title="Distressing"
        hint="Drop a worn effect, or brush it on"
        open={open === 'distress'}
        onOpen={studio.setPanel}
      >
        {distressBody}
      </Accordion>
    </div>
  );
}

