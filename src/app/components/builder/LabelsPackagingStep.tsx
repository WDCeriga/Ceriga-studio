import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Upload,
  Trash2,
  RotateCw,
  Move,
  Minus,
  Plus,
  Copy,
  FlipHorizontal2,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Italic,
  GripVertical,
  Check,
} from 'lucide-react';
import type { DesignElement } from './PrintsDesignStep';
import { PrintPanel, PrintTransformOverlay, type PrintManip, type ResizeHandle } from './PrintsDesignStep';
import { ColorPairGrid } from './ColorPairGrid';
import { cn } from '../ui/utils';
import {
  snapDragInZone,
  measureHalfExtentsInZone,
  GUIDE_COLOR,
  type SnapBox,
} from '../../lib/designSnapGuides';
import { reorderDesignElements } from '../../lib/designLayerOrder';

type SubStep = 'label' | 'packaging';

interface LabelsPackagingStepProps {
  subStep?: SubStep;
  elements: DesignElement[];
  onElementsChange: (elements: DesignElement[]) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  planValue: string;
  onPlanChange: (value: string) => void;
  /** When set with `onSelectedLayerIdChange`, selection is controlled (e.g. sync with preview panel). */
  selectedLayerId?: string | null;
  onSelectedLayerIdChange?: (id: string | null) => void;
  /** When set with `onPreviewBaseColorChange`, preview surface colour is controlled by the parent (e.g. builder live preview). */
  previewBaseColor?: string;
  onPreviewBaseColorChange?: (hex: string) => void;
}

const FONT_OPTIONS = ['Inter', 'Arial', 'Helvetica', 'Montserrat', 'Poppins', 'Georgia'];

/** Limited palette for label / packaging surface preview. */
const PREVIEW_SURFACE_COLORS = [
  '#FFFFFF',
  '#F5F5F5',
  '#9CA3AF',
  '#4B5563',
  '#111111',
  '#CC2D24',
  '#3B82F6',
] as const;

const TEXT_FILL_COLORS = [
  '#111111',
  '#4B5563',
  '#6B7280',
  '#9CA3AF',
  '#FFFFFF',
  '#CC2D24',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
] as const;

const sectionLabelClass =
  'mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-[#9CA3AF]';

export function LabelsPackagingStep({
  subStep = 'label',
  elements,
  onElementsChange,
  notes,
  onNotesChange,
  planValue,
  onPlanChange,
  selectedLayerId: selectedLayerIdProp,
  onSelectedLayerIdChange,
  previewBaseColor,
  onPreviewBaseColorChange,
}: LabelsPackagingStepProps) {
  const [fallbackSelectedId, setFallbackSelectedId] = useState<string | null>(elements[0]?.id ?? null);
  const selectionControlled = onSelectedLayerIdChange !== undefined;
  const surfaceColorControlled =
    previewBaseColor !== undefined && onPreviewBaseColorChange !== undefined;
  const selectedId = selectionControlled ? (selectedLayerIdProp ?? null) : fallbackSelectedId;
  const setSelectedId = useCallback(
    (id: string | null) => {
      onSelectedLayerIdChange?.(id);
      if (!selectionControlled) setFallbackSelectedId(id);
    },
    [onSelectedLayerIdChange, selectionControlled],
  );
  const [textInput, setTextInput] = useState('');
  const [labelColor, setLabelColor] = useState('#FFFFFF');
  const [packagingColor, setPackagingColor] = useState('#F5F5F5');
  const [importedFontFamilies, setImportedFontFamilies] = useState<string[]>([]);
  const [listDraggingId, setListDraggingId] = useState<string | null>(null);
  const [listDragOverId, setListDragOverId] = useState<string | null>(null);
  const selected = useMemo(() => elements.find((item) => item.id === selectedId) ?? null, [elements, selectedId]);

  const LIST_DND_MIME = 'text/x-ceriga-label-element';

  const onListDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData(LIST_DND_MIME, id);
    e.dataTransfer.effectAllowed = 'move';
    setListDraggingId(id);
    setListDragOverId(null);
  };

  const onListDragEnd = () => {
    setListDraggingId(null);
    setListDragOverId(null);
  };

  const onListDragOverRow = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (listDraggingId && listDraggingId !== overId) setListDragOverId(overId);
  };

  const onListDropOnRow = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData(LIST_DND_MIME);
    onListDragEnd();
    if (!dragId || dragId === dropId) return;
    const from = elements.findIndex((x) => x.id === dragId);
    const to = elements.findIndex((x) => x.id === dropId);
    if (from < 0 || to < 0) return;
    onElementsChange(reorderDesignElements(elements, from, to));
  };

  const removeElementFromList = (id: string) => {
    const remaining = elements.filter((el) => el.id !== id);
    onElementsChange(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  };

  const allFontOptions = useMemo(
    () => [...FONT_OPTIONS, ...importedFontFamilies],
    [importedFontFamilies],
  );

  const addText = () => {
    if (!textInput.trim()) return;
    const surface = document.querySelector(
      '[data-label-packaging-surface]',
    ) as HTMLElement | null;
    let cx = subStep === 'label' ? 105 : 112;
    let cy = subStep === 'label' ? 110 : 145;
    if (surface && surface.clientWidth > 0 && surface.clientHeight > 0) {
      cx = surface.clientWidth / 2;
      cy = surface.clientHeight / 2;
    }
    const next: DesignElement = {
      id: `${Date.now()}`,
      type: 'text',
      content: textInput,
      x: cx,
      y: cy,
      width: 130,
      height: 40,
      rotation: 0,
      fontFamily: 'Inter',
      fontSize: subStep === 'label' ? 18 : 24,
      color: subStep === 'label' ? '#000000' : '#111111',
      opacity: 100,
      flipHorizontal: false,
      textAlign: 'center',
      fontStyle: 'normal',
      textTransform: 'none',
      letterSpacing: 0,
    };
    onElementsChange([...elements, next]);
    setSelectedId(next.id);
    setTextInput('');
  };

  const uploadImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const surface = document.querySelector(
          '[data-label-packaging-surface]',
        ) as HTMLElement | null;
        let ix = subStep === 'label' ? 108 : 112;
        let iy = subStep === 'label' ? 112 : 145;
        if (surface && surface.clientWidth > 0 && surface.clientHeight > 0) {
          ix = surface.clientWidth / 2;
          iy = surface.clientHeight / 2;
        }
        const next: DesignElement = {
          id: `${Date.now()}`,
          type: 'image',
          content: event.target?.result as string,
          x: ix,
          y: iy,
          width: subStep === 'label' ? 90 : 120,
          height: subStep === 'label' ? 90 : 120,
          rotation: 0,
          opacity: 100,
          flipHorizontal: false,
        };
        onElementsChange([...elements, next]);
        setSelectedId(next.id);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const updateSelected = (patch: Partial<DesignElement>) => {
    if (!selectedId) return;
    onElementsChange(elements.map((item) => (item.id === selectedId ? { ...item, ...patch } : item)));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const remaining = elements.filter((item) => item.id !== selectedId);
    onElementsChange(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  };

  useEffect(() => {
    if (elements.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && !elements.some((e) => e.id === selectedId)) {
      setSelectedId(elements[0]!.id);
    }
  }, [elements, selectedId, setSelectedId]);

  const updateFontSize = (delta: number) => {
    if (!selected || selected.type !== 'text') return;
    const next = Math.max(12, Math.min(64, (selected.fontSize ?? 20) + delta));
    updateSelected({ fontSize: next, height: next + 18, width: Math.max(90, (selected.width || 120) + delta * 2) });
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy: DesignElement = {
      ...selected,
      id: `${Date.now()}`,
      x: selected.x + 14,
      y: selected.y + 14,
    };
    onElementsChange([...elements, copy]);
    setSelectedId(copy.id);
  };

  const importFontFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.woff,.woff2,.ttf,.otf,font/woff,font/woff2';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\s-]+/g, '') || 'Font';
      const family = `Custom ${base}`.slice(0, 40);
      const unique = `${family}-${Date.now().toString(36)}`;
      try {
        const buf = await file.arrayBuffer();
        const face = new FontFace(unique, buf);
        await face.load();
        document.fonts.add(face);
        setImportedFontFamilies((prev) => (prev.includes(unique) ? prev : [...prev, unique]));
        if (selectedId && elements.find((x) => x.id === selectedId)?.type === 'text') {
          updateSelected({ fontFamily: unique });
        }
      } catch {
        /* invalid font */
      }
    };
    input.click();
  };

  const isNone = planValue === 'none';

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <Label className={sectionLabelClass}>
          {subStep === 'label' ? 'Label option' : 'Packaging option'}
        </Label>
        <Select value={planValue} onValueChange={onPlanChange}>
          <SelectTrigger className="h-9 border-white/10 bg-white/5 text-[11px] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
            {subStep === 'label' ? (
              <>
                <SelectItem value="none">No label</SelectItem>
                <SelectItem value="woven">Woven label</SelectItem>
                <SelectItem value="printed">Printed transfer</SelectItem>
                <SelectItem value="heat">Heat transfer</SelectItem>
                <SelectItem value="satin">Satin label</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="none">No packaging</SelectItem>
                <SelectItem value="polybag">Polybag</SelectItem>
                <SelectItem value="box">Box</SelectItem>
                <SelectItem value="mailer">Mailer</SelectItem>
                <SelectItem value="tissue">Tissue wrap</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {isNone ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-5 text-center text-[12px] leading-relaxed text-white/50">
          {subStep === 'label'
            ? 'No custom neck label will be included. You can still add notes for the factory below.'
            : 'No custom packaging artwork. Add any shipping or outer-pack notes below.'}
        </div>
      ) : (
        <>
          <div>
            <Label
              className={sectionLabelClass}
            >
              {surfaceColorControlled
                ? subStep === 'label'
                  ? 'Label material / print colour'
                  : 'Packaging colour'
                : 'Preview base colour'}
            </Label>
            <ColorPairGrid
              colors={[...PREVIEW_SURFACE_COLORS]}
              selected={
                surfaceColorControlled
                  ? previewBaseColor
                  : subStep === 'label'
                    ? labelColor
                    : packagingColor
              }
              onSelect={(color) => {
                if (surfaceColorControlled) {
                  onPreviewBaseColorChange(color);
                } else if (subStep === 'label') {
                  setLabelColor(color);
                } else {
                  setPackagingColor(color);
                }
              }}
              sizeClass="h-9 w-9 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={uploadImage}
              variant="outline"
              className="h-8 border-white/20 bg-white/5 px-2 text-[10px] !text-white hover:bg-white/10"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload
            </Button>
            <Button onClick={addText} className="h-8 bg-[#FF3B30] px-2 text-[10px] hover:bg-[#FF3B30]/90">
              <Check className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.5} />
              Add text
            </Button>
          </div>

          <div>
            <Label className={sectionLabelClass}>Text</Label>
            <div className="flex gap-2">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="h-9 border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
                placeholder={subStep === 'label' ? 'Brand name' : 'Packaging message'}
                onKeyDown={(e) => e.key === 'Enter' && addText()}
              />
              <Button onClick={addText} className="h-9 min-w-9 bg-[#FF3B30] px-2 hover:bg-[#FF3B30]/90" aria-label="Add text">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Button>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={importFontFile}
            className="mt-2 h-8 w-full border-white/20 bg-white/5 px-2 text-[10px] !text-white hover:bg-white/10"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import font
          </Button>

          {selected ? (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Selected layer</div>
                <Button
                  onClick={deleteSelected}
                  variant="outline"
                  className="h-7 shrink-0 border-white/20 px-2 text-[10px] !text-white hover:bg-white/10"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Delete
                </Button>
              </div>

              {selected.type === 'text' && (
                <>
                  <div>
                    <Label className={sectionLabelClass}>Font</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {allFontOptions.map((font) => (
                        <button
                          key={font}
                          type="button"
                          onClick={() => updateSelected({ fontFamily: font })}
                          className={`h-8 rounded-lg border px-2 text-[10px] ${
                            selected.fontFamily === font
                              ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-white'
                              : 'border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white'
                          }`}
                          style={{ fontFamily: font }}
                        >
                          {font.startsWith('Custom ') ? font.split('-')[0]?.trim() ?? font : font}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className={sectionLabelClass}>Alignment</Label>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          ['left', AlignLeft],
                          ['center', AlignCenter],
                          ['right', AlignRight],
                          ['justify', AlignJustify],
                        ] as const
                      ).map(([align, Icon]) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => updateSelected({ textAlign: align })}
                          className={cn(
                            'flex h-8 flex-1 min-w-[2.5rem] items-center justify-center rounded-lg border text-white/70 transition-colors',
                            (selected.textAlign ?? 'center') === align
                              ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white'
                              : 'border-white/10 bg-black/20 hover:border-white/20 hover:text-white',
                          )}
                          aria-label={`Align ${align}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateSelected({
                          fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic',
                        })
                      }
                      className={cn(
                        'h-8 flex-1 border-white/20 bg-white/5 px-2 text-[10px] !text-white hover:bg-white/10',
                        selected.fontStyle === 'italic' && 'border-[#FF3B30] bg-[#FF3B30]/12',
                      )}
                    >
                      <Italic className="mr-1 h-3.5 w-3.5" />
                      Italic
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const cur = selected.textTransform ?? 'none';
                        const next =
                          cur === 'none' ? 'uppercase' : cur === 'uppercase' ? 'lowercase' : 'none';
                        updateSelected({ textTransform: next });
                      }}
                      className="h-8 flex-1 border-white/20 bg-white/5 px-2 text-[10px] !text-white hover:bg-white/10"
                    >
                      {(selected.textTransform ?? 'none') === 'uppercase'
                        ? 'AA'
                        : (selected.textTransform ?? 'none') === 'lowercase'
                          ? 'aa'
                          : 'Aa'}
                    </Button>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Label className={cn(sectionLabelClass, 'mb-0')}>Letter spacing</Label>
                      <span className="text-[10px] tabular-nums text-white/45">
                        {selected.letterSpacing ?? 0}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-2}
                      max={16}
                      step={0.5}
                      value={selected.letterSpacing ?? 0}
                      onChange={(e) => updateSelected({ letterSpacing: Number(e.target.value) })}
                      className="h-2 w-full cursor-pointer accent-[#FF3B30]"
                    />
                  </div>

                  <div>
                    <Label className={sectionLabelClass}>Size</Label>
                    <NumberStepper
                      value={selected.fontSize ?? 20}
                      onDecrease={() => updateFontSize(-1)}
                      onIncrease={() => updateFontSize(1)}
                    />
                  </div>
                  <div>
                    <Label className={sectionLabelClass}>Text colour</Label>
                    <ColorPairGrid
                      colors={[...TEXT_FILL_COLORS]}
                      selected={selected.color ?? '#111111'}
                      onSelect={(c) => updateSelected({ color: c })}
                      sizeClass="h-9 w-9 rounded-lg"
                    />
                  </div>
                </>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-[#9CA3AF]">Opacity</Label>
                  <span className="text-[10px] tabular-nums text-white/50">{selected.opacity ?? 100}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={100}
                  value={selected.opacity ?? 100}
                  onChange={(e) => updateSelected({ opacity: Number(e.target.value) })}
                  className="h-2 w-full cursor-pointer accent-[#FF3B30]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => updateSelected({ rotation: ((selected.rotation ?? 0) + 15) % 360 })}
                  className="h-8 border-white/20 px-2 text-[10px] !text-white hover:bg-white/10"
                >
                  <RotateCw className="mr-1 h-3 w-3" />
                  Rotate 15°
                </Button>
                <Button
                  variant="outline"
                  onClick={duplicateSelected}
                  className="h-8 border-white/20 px-2 text-[10px] !text-white hover:bg-white/10"
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Duplicate
                </Button>
                {selected.type === 'image' ? (
                  <Button
                    variant="outline"
                    onClick={() => updateSelected({ flipHorizontal: !selected.flipHorizontal })}
                    className="col-span-2 h-8 border-white/20 px-2 text-[10px] !text-white hover:bg-white/10"
                  >
                    <FlipHorizontal2 className="mr-1 h-3 w-3" />
                    Flip horizontal
                  </Button>
                ) : null}
                <div className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-center text-[10px] leading-snug text-white/60">
                  <Move className="h-3 w-3 shrink-0" />
                  Drag to move · corners scale · sides stretch · double-click text to edit
                </div>
              </div>
            </div>
          ) : null}

          <PrintPanel title={`Elements (${elements.length})`}>
            <div className="space-y-2">
              {elements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/12 px-3 py-6 text-center text-[11px] leading-relaxed text-white/38">
                  Upload artwork or add text, then drag on the preview.
                </div>
              ) : (
                elements.map((element) => (
                  <div
                    key={element.id}
                    className={cn(
                      'flex w-full items-stretch gap-1 rounded-xl border',
                      listDragOverId === element.id && listDraggingId && listDraggingId !== element.id
                        ? 'border-white/35 bg-white/[0.06]'
                        : selectedId === element.id
                          ? 'border-[#FF3B30] bg-[#FF3B30]/10'
                          : 'border-white/10 bg-black/25 hover:border-white/18',
                    )}
                    onDragOver={(e) => onListDragOverRow(e, element.id)}
                    onDrop={(e) => onListDropOnRow(e, element.id)}
                  >
                    <div
                      draggable
                      onDragStart={(e) => onListDragStart(e, element.id)}
                      onDragEnd={onListDragEnd}
                      className="flex shrink-0 cursor-grab touch-none items-center rounded-l-[10px] px-1.5 text-white/35 hover:bg-white/[0.06] hover:text-white/60 active:cursor-grabbing"
                      aria-label="Drag to reorder layer"
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(element.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-1 pr-2 text-left"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/55">
                        {element.type === 'image' ? (
                          <ImageIcon className="h-4 w-4" />
                        ) : (
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-medium text-white">
                          {element.type === 'image' ? 'Uploaded artwork' : element.content}
                        </div>
                        <div className="text-[10px] text-white/40">
                          {Math.round(element.x)}, {Math.round(element.y)} · {Math.round(element.rotation)}°
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="flex shrink-0 items-center justify-center rounded-r-[10px] border-l border-white/10 px-2 text-white/35 transition hover:bg-white/[0.08] hover:text-[#FF3B30]"
                      aria-label="Delete layer"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeElementFromList(element.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </PrintPanel>
        </>
      )}

      <div>
        <Label htmlFor={`${subStep}-notes`} className={sectionLabelClass}>
          Extra Details
        </Label>
        <Textarea
          id={`${subStep}-notes`}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={`Add any ${subStep} requirements...`}
          className="min-h-[82px] border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
        />
      </div>
    </div>
  );
}

export function LabelPreview({
  color = '#FFFFFF',
  elements = [],
  onElementsChange,
  selectedId,
  onSelectedIdChange,
}: {
  color?: string;
  elements?: DesignElement[];
  onElementsChange?: (elements: DesignElement[]) => void;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
}) {
  return (
    <DesignSurface
      mode="label"
      color={color}
      elements={elements}
      onElementsChange={onElementsChange}
      selectedId={selectedId}
      onSelectedIdChange={onSelectedIdChange}
    />
  );
}

export function PackagingPreview({
  color = '#F5F5F5',
  elements = [],
  onElementsChange,
  selectedId,
  onSelectedIdChange,
}: {
  color?: string;
  elements?: DesignElement[];
  onElementsChange?: (elements: DesignElement[]) => void;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
}) {
  return (
    <DesignSurface
      mode="packaging"
      color={color}
      elements={elements}
      onElementsChange={onElementsChange}
      selectedId={selectedId}
      onSelectedIdChange={onSelectedIdChange}
    />
  );
}

function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  const s = input.trim();
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(s);
  if (!m?.[1]) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** WCAG relative luminance for sRGB 0–255 channels. */
function relativeLuminance256(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function surfaceIsDark(hex: string): boolean {
  const rgb = parseHexColor(hex);
  if (!rgb) return false;
  return relativeLuminance256(rgb.r, rgb.g, rgb.b) < 0.5;
}

/** Map pointer position to design coordinates inside the surface (matches Prints preview). */
function clientToZonePoint(zone: HTMLElement, clientX: number, clientY: number) {
  const zr = zone.getBoundingClientRect();
  const zw = zone.offsetWidth;
  const zh = zone.offsetHeight;
  if (zr.width < 1 || zr.height < 1 || zw < 1 || zh < 1) {
    return { x: clientX - zr.left, y: clientY - zr.top };
  }
  return {
    x: ((clientX - zr.left) / zr.width) * zw,
    y: ((clientY - zr.top) / zr.height) * zh,
  };
}

/** Default body text on the preview surface (new layers). */
function contrastingTextOnSurface(hex: string): string {
  return surfaceIsDark(hex) ? '#FFFFFF' : '#111111';
}

/** Muted empty-state hint that stays readable on light or dark surfaces. */
function placeholderHintOnSurface(hex: string): string {
  return surfaceIsDark(hex) ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.35)';
}

function DesignSurface({
  mode,
  color,
  elements,
  onElementsChange,
  selectedId,
  onSelectedIdChange,
}: {
  mode: SubStep;
  color: string;
  elements: DesignElement[];
  onElementsChange?: (elements: DesignElement[]) => void;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
}) {
  const editable = Boolean(onElementsChange);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);
  const [manip, setManip] = useState<PrintManip | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const editAreaRef = useRef<HTMLTextAreaElement>(null);
  const editDraftRef = useRef('');
  const [narrowViewport, setNarrowViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );
  const deleteRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef(elements);
  const deleteHoverRef = useRef(false);
  const onElementsChangeRef = useRef(onElementsChange);
  const onSelectedIdChangeRef = useRef(onSelectedIdChange);
  const dragStartClientRef = useRef({ x: 0, y: 0 });
  const dragDidMoveRef = useRef(false);
  const dragPointerCaptureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null);
  const textTapRef = useRef<{ id: string; alreadySelected: boolean } | null>(null);

  const [alignmentGuides, setAlignmentGuides] = useState<{
    vertical: number[];
    horizontal: number[];
  } | null>(null);

  useLayoutEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useLayoutEffect(() => {
    onElementsChangeRef.current = onElementsChange;
  }, [onElementsChange]);

  useLayoutEffect(() => {
    onSelectedIdChangeRef.current = onSelectedIdChange;
  }, [onSelectedIdChange]);

  useLayoutEffect(() => {
    if (!editingTextId) return;
    editAreaRef.current?.focus();
    editAreaRef.current?.select();
  }, [editingTextId]);

  useEffect(() => {
    if (!editingTextId || selectedId === editingTextId) return;
    const fn = onElementsChangeRef.current;
    const el = elementsRef.current.find((item) => item.id === editingTextId);
    const draft = editDraftRef.current.trim();
    const next = draft.length > 0 ? draft : (el?.content ?? '');
    if (fn && el) {
      fn(
        elementsRef.current.map((item) =>
          item.id === editingTextId ? { ...item, content: next } : item,
        ),
      );
    }
    setEditingTextId(null);
  }, [selectedId, editingTextId]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setNarrowViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const defaultOnSurfaceText = contrastingTextOnSurface(color);
  const emptyHintColor = placeholderHintOnSurface(color);
  const canvasClass =
    mode === 'label'
      ? 'h-40 w-40 rounded-[22px] sm:h-56 sm:w-56 sm:rounded-[28px]'
      : 'h-52 w-44 rounded-[26px] sm:h-72 sm:w-56 sm:rounded-[32px]';

  const clampN = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

  const updateElement = (id: string, patch: Partial<DesignElement>) => {
    const fn = onElementsChangeRef.current;
    if (!fn) return;
    fn(elementsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeElement = (id: string) => {
    const fn = onElementsChangeRef.current;
    if (!fn) return;
    const remaining = elementsRef.current.filter((item) => item.id !== id);
    fn(remaining);
    onSelectedIdChangeRef.current(remaining[0]?.id ?? null);
  };

  useEffect(() => {
    if (!manip || !editable) return;

    const onMove = (e: PointerEvent) => {
      if (manip.kind === 'rotate') {
        const cur = Math.atan2(e.clientY - manip.cy, e.clientX - manip.cx);
        const deltaDeg = ((cur - manip.startAngle) * 180) / Math.PI;
        let next = manip.startRot + deltaDeg;
        next = ((next % 360) + 360) % 360;
        updateElement(manip.id, { rotation: next });
        return;
      }
      const dx = e.clientX - manip.startX;
      const dy = e.clientY - manip.startY;
      const h = manip.handle;
      const corners: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];
      if (corners.includes(h)) {
        let dw = 0;
        let dh = 0;
        switch (h) {
          case 'se':
            dw = dx;
            dh = dy;
            break;
          case 'nw':
            dw = -dx;
            dh = -dy;
            break;
          case 'ne':
            dw = dx;
            dh = -dy;
            break;
          case 'sw':
            dw = -dx;
            dh = dy;
            break;
          default:
            break;
        }
        const sw = (manip.startW + dw) / manip.startW;
        const sh = (manip.startH + dh) / manip.startH;
        const s = Math.sqrt(Math.max(0.15, Math.min(6, sw * sh)));
        const nw = clampN(manip.startW * s, manip.isImage ? 32 : 48, manip.isImage ? 520 : 440);
        const nh = clampN(manip.startH * s, manip.isImage ? 32 : 28, manip.isImage ? 520 : 320);
        if (manip.isImage) {
          updateElement(manip.id, { width: nw, height: nh });
        } else {
          const nfs = clampN(Math.round(manip.startFontSize * s), 12, 120);
          updateElement(manip.id, { width: nw, height: nh, fontSize: nfs });
        }
        return;
      }
      if (manip.isImage) {
        if (h === 'e') updateElement(manip.id, { width: clampN(manip.startW + dx, 32, 520) });
        else if (h === 'w') updateElement(manip.id, { width: clampN(manip.startW - dx, 32, 520) });
        else if (h === 's') updateElement(manip.id, { height: clampN(manip.startH + dy, 32, 520) });
        else if (h === 'n') updateElement(manip.id, { height: clampN(manip.startH - dy, 32, 520) });
        return;
      }
      if (h === 'e') updateElement(manip.id, { width: clampN(manip.startW + dx, 48, 440) });
      else if (h === 'w') updateElement(manip.id, { width: clampN(manip.startW - dx, 48, 440) });
      else if (h === 's') updateElement(manip.id, { height: clampN(manip.startH + dy, 28, 360) });
      else if (h === 'n') updateElement(manip.id, { height: clampN(manip.startH - dy, 28, 360) });
    };

    const onUp = () => setManip(null);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [manip, editable]);

  useEffect(() => {
    if (!draggingId || !editable) return;
    if (!onElementsChangeRef.current) return;
    if (manip) return;

    const handleMove = (e: PointerEvent) => {
      const zone = surfaceRef.current;
      if (!zone) return;
      const current = elementsRef.current.find((item) => item.id === draggingId);
      if (!current) return;

      if (
        Math.hypot(e.clientX - dragStartClientRef.current.x, e.clientY - dragStartClientRef.current.y) > 5
      ) {
        dragDidMoveRef.current = true;
      }

      const p = clientToZonePoint(zone, e.clientX, e.clientY);
      const nx = p.x - dragOffset.x;
      const ny = p.y - dragOffset.y;
      const boxH =
        current.type === 'image'
          ? current.height
          : Math.max(current.height ?? 0, (current.fontSize ?? 20) + 18);
      let halfW = current.width / 2;
      let halfH = boxH / 2;
      if (current.type === 'text') {
        const node = zone.querySelector(`[data-surface-id="${draggingId}"]`) as HTMLElement | null;
        if (node) {
          const m = measureHalfExtentsInZone(zone, node);
          halfW = m.halfW;
          halfH = m.halfH;
        }
      }

      const snapBoxes: SnapBox[] = elementsRef.current.map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height:
          el.type === 'image'
            ? el.height
            : Math.max(el.height ?? 0, (el.fontSize ?? 20) + 18),
      }));
      const snapped = snapDragInZone(
        nx,
        ny,
        halfW,
        halfH,
        zone.offsetWidth,
        zone.offsetHeight,
        draggingId,
        snapBoxes,
      );
      setAlignmentGuides({
        vertical: snapped.verticalLines,
        horizontal: snapped.horizontalLines,
      });

      updateElement(draggingId, {
        x: snapped.x,
        y: snapped.y,
      });

      if (deleteRef.current) {
        const dr = deleteRef.current.getBoundingClientRect();
        const over =
          e.clientX >= dr.left &&
          e.clientX <= dr.right &&
          e.clientY >= dr.top &&
          e.clientY <= dr.bottom;
        deleteHoverRef.current = over;
        setIsOverDeleteZone(over);
      }
    };

    const handleUp = () => {
      const cap = dragPointerCaptureRef.current;
      dragPointerCaptureRef.current = null;
      if (cap) {
        try {
          if (cap.el.hasPointerCapture(cap.pointerId)) {
            cap.el.releasePointerCapture(cap.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
      if (draggingId && deleteHoverRef.current) {
        removeElement(draggingId);
      } else if (
        draggingId &&
        !dragDidMoveRef.current &&
        textTapRef.current?.id === draggingId &&
        textTapRef.current.alreadySelected
      ) {
        const el = elementsRef.current.find((item) => item.id === draggingId);
        if (el?.type === 'text') {
          setEditingTextId(el.id);
          setEditDraft(el.content);
          editDraftRef.current = el.content;
        }
      }
      textTapRef.current = null;
      deleteHoverRef.current = false;
      dragDidMoveRef.current = false;
      setDraggingId(null);
      setIsOverDeleteZone(false);
      setAlignmentGuides(null);
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [draggingId, dragOffset, editable, manip]);

  const innerClipClass = editable ? 'overflow-visible' : 'overflow-hidden';

  return (
    <div
      data-label-packaging-root
      className="flex w-full max-w-full min-w-0 flex-col items-center"
      onPointerDown={(e) => {
        if (!editable) return;
        if (e.target === e.currentTarget) {
          onSelectedIdChange(null);
        }
      }}
    >
      <div
        className={cn(
          'relative mx-auto border-2 border-black shadow-[0_12px_32px_rgba(0,0,0,0.16)]',
          editable ? 'overflow-visible' : 'overflow-hidden',
          canvasClass,
        )}
        style={{ backgroundColor: color }}
        onPointerDown={(e) => {
          if (!editable) return;
          const t = e.target as HTMLElement;
          if (t.closest('[data-surface-id]') || t.closest('[data-handles]')) return;
          onSelectedIdChange(null);
        }}
      >
      <div className={cn('absolute inset-[18px] rounded-[18px] border border-black/20', innerClipClass)}>
        {elements.length === 0 && (
          <div
            className="flex h-full min-h-0 items-center justify-center px-2 text-center text-[10px] uppercase tracking-[0.14em] sm:text-[11px] sm:tracking-[0.18em]"
            style={{ color: emptyHintColor }}
          >
            Drag text or artwork here
          </div>
        )}

        <div
          ref={surfaceRef}
          data-label-packaging-surface
          className={cn('absolute inset-0', editable && 'touch-none')}
        >
          {editable && alignmentGuides ? (
            <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
              {alignmentGuides.vertical.map((lx, i) => (
                <div
                  key={`v-${i}-${lx}`}
                  className="absolute top-0 h-full w-px -translate-x-1/2 border-l border-dashed"
                  style={{ left: lx, borderColor: GUIDE_COLOR }}
                />
              ))}
              {alignmentGuides.horizontal.map((ly, i) => (
                <div
                  key={`h-${i}-${ly}`}
                  className="absolute left-0 h-px w-full -translate-y-1/2 border-t border-dashed"
                  style={{ top: ly, borderColor: GUIDE_COLOR }}
                />
              ))}
            </div>
          ) : null}
          {elements.map((element) => {
            const selected = selectedId === element.id;
            const bw = element.borderWidth ?? 0;
            const bc = element.borderColor ?? '#111111';
            const op = (element.opacity ?? 100) / 100;
            const isEditingText = editingTextId === element.id;
            const displayFont = (() => {
              const base = element.fontSize ?? 20;
              if (!narrowViewport) return base;
              return Math.max(11, Math.round(base * 0.82));
            })();

            return (
              <div
                key={element.id}
                data-surface-id={element.id}
                className={cn(
                  'absolute',
                  draggingId === element.id && 'z-[15]',
                  editable && !isEditingText && 'cursor-move select-none',
                )}
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.type === 'text' ? 'max-content' : element.width,
                  maxWidth: element.type === 'text' ? element.width : undefined,
                  minHeight: element.type === 'text' ? element.height : undefined,
                  minWidth: element.type === 'text' ? 0 : undefined,
                  height: element.type === 'image' ? element.height : undefined,
                  opacity: op,
                  transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                }}
                onPointerDown={(e) => {
                  if (!editable) return;
                  if ((e.target as HTMLElement).closest('[data-handles]')) return;
                  e.stopPropagation();
                  const wasSel = selectedId === element.id;
                  onSelectedIdChange(element.id);
                  textTapRef.current = { id: element.id, alreadySelected: wasSel };
                  dragStartClientRef.current = { x: e.clientX, y: e.clientY };
                  dragDidMoveRef.current = false;
                  e.preventDefault();
                  const zone = surfaceRef.current;
                  if (!zone) return;
                  const ptr = clientToZonePoint(zone, e.clientX, e.clientY);
                  setManip(null);
                  setDraggingId(element.id);
                  setDragOffset({ x: ptr.x - element.x, y: ptr.y - element.y });
                  try {
                    const el = e.currentTarget as HTMLElement;
                    el.setPointerCapture(e.pointerId);
                    dragPointerCaptureRef.current = { el, pointerId: e.pointerId };
                  } catch {
                    dragPointerCaptureRef.current = null;
                  }
                }}
              >
                {element.type === 'image' ? (
                  <img
                    src={element.content}
                    alt="Artwork"
                    className="h-full w-full object-contain"
                    style={{
                      transform: element.flipHorizontal ? 'scaleX(-1)' : undefined,
                    }}
                  />
                ) : isEditingText ? (
                  <textarea
                    ref={editAreaRef}
                    value={editDraft}
                    onChange={(ev) => {
                      setEditDraft(ev.target.value);
                      editDraftRef.current = ev.target.value;
                    }}
                    onBlur={() => {
                      const next = editDraftRef.current.trim() || element.content;
                      updateElement(element.id, { content: next });
                      setEditingTextId(null);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Escape') {
                        setEditDraft(element.content);
                        editDraftRef.current = element.content;
                        setEditingTextId(null);
                      }
                      ev.stopPropagation();
                    }}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    className="z-40 min-h-[1.5em] w-full resize-none rounded-md border border-[#CC2D24]/60 bg-black/80 px-1.5 py-1 font-semibold text-white outline-none ring-2 ring-[#CC2D24]/35 [overflow-wrap:anywhere]"
                    style={{
                      color: element.color ?? defaultOnSurfaceText,
                      fontFamily: element.fontFamily ?? 'Inter',
                      fontSize: displayFont,
                      lineHeight: 1.15,
                      maxWidth: element.width,
                      minHeight: element.height,
                      textAlign: element.textAlign ?? 'center',
                      fontStyle: element.fontStyle ?? 'normal',
                      letterSpacing:
                        element.letterSpacing != null ? `${element.letterSpacing}px` : undefined,
                      textTransform: 'none',
                    }}
                    rows={3}
                  />
                ) : (
                  <div className="relative inline-block min-w-0 max-w-full">
                    <div
                      data-text-body
                      onDoubleClick={(ev) => {
                        if (!editable) return;
                        ev.stopPropagation();
                        ev.preventDefault();
                        onSelectedIdChange(element.id);
                        setEditingTextId(element.id);
                        setEditDraft(element.content);
                        editDraftRef.current = element.content;
                        setDraggingId(null);
                        textTapRef.current = null;
                      }}
                      className="whitespace-normal break-words font-semibold [overflow-wrap:anywhere]"
                      style={{
                        color: element.color ?? defaultOnSurfaceText,
                        fontFamily: element.fontFamily ?? 'Inter',
                        fontSize: displayFont,
                        lineHeight: 1.15,
                        maxWidth: element.width,
                        minHeight: element.height,
                        textAlign: element.textAlign ?? 'center',
                        fontStyle: element.fontStyle ?? 'normal',
                        textTransform: element.textTransform ?? 'none',
                        letterSpacing:
                          element.letterSpacing != null ? `${element.letterSpacing}px` : undefined,
                        WebkitTextStroke: bw > 0 ? `${bw}px ${bc}` : undefined,
                        paintOrder: bw > 0 ? ('stroke fill' as const) : undefined,
                      }}
                    >
                      {element.content}
                    </div>
                  </div>
                )}
                {selected && editable && !isEditingText ? (
                  <PrintTransformOverlay
                    onRotatePointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const z = surfaceRef.current;
                      if (!z) return;
                      const zr = z.getBoundingClientRect();
                      const cx = zr.left + element.x;
                      const cy = zr.top + element.y;
                      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
                      setDraggingId(null);
                      setManip({
                        kind: 'rotate',
                        id: element.id,
                        startRot: element.rotation,
                        cx,
                        cy,
                        startAngle,
                      });
                    }}
                    onResizePointerDown={(e, handle) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDraggingId(null);
                      setManip({
                        kind: 'resize',
                        id: element.id,
                        handle,
                        startX: e.clientX,
                        startY: e.clientY,
                        startW: element.width,
                        startH: element.height,
                        startFontSize: element.fontSize ?? 20,
                        isImage: element.type === 'image',
                      });
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {editable && draggingId ? (
        <div className="pointer-events-none mt-2 flex w-full justify-center md:mt-3">
          <div
            ref={deleteRef}
            className={`flex min-w-[160px] max-md:min-w-[128px] items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.28)] transition-all duration-200 max-md:gap-1.5 max-md:rounded-xl max-md:px-2.5 max-md:py-1.5 max-md:shadow-[0_8px_24px_rgba(0,0,0,0.25)] ${
              isOverDeleteZone
                ? 'scale-105 border-[#FF3B30] bg-[#FF3B30]/15 text-white max-md:scale-100'
                : 'border-white/20 bg-black/50 text-white/70'
            }`}
          >
            <Trash2
              className={`h-4 w-4 max-md:h-3 max-md:w-3 ${isOverDeleteZone ? 'animate-pulse' : ''}`}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] max-md:text-[8px] max-md:tracking-[0.14em]">
              {isOverDeleteZone ? 'Release to delete' : 'Drag here'}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NumberStepper({
  value,
  onDecrease,
  onIncrease,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-white/15 bg-white/5">
      <button onClick={onDecrease} className="flex h-9 w-9 items-center justify-center text-white/70 transition hover:bg-white/10 hover:text-white">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-[52px] text-center text-sm font-semibold text-white">{value}</div>
      <button onClick={onIncrease} className="flex h-9 w-9 items-center justify-center text-white/70 transition hover:bg-white/10 hover:text-white">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

