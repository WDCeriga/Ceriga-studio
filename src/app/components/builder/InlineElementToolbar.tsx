import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  CaseSensitive,
  ChevronDown,
  Copy,
  Crop,
  FlipHorizontal2,
  Italic,
  Lock,
  Minus,
  Move3d,
  Plus,
  RotateCw,
  Sparkles,
  Squircle,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react';
import type { DesignElement } from './PrintsDesignStep';
import { cn } from '../ui/utils';
import {
  STUDIO_TEXT_MAIN_COLORS,
  STUDIO_TEXT_POPULAR_COLORS,
} from '../../data/studioColorPresets';

const DEFAULT_FONTS = [
  'Inter',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Impact',
  'Montserrat',
  'Poppins',
];

type TextAlign = NonNullable<DesignElement['textAlign']>;
type TextTransform = NonNullable<DesignElement['textTransform']>;

interface Props {
  element: DesignElement;
  onPatch: (patch: Partial<DesignElement>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  fontOptions?: readonly string[];
  /** Compact layout — shrinks paddings / hides labels for narrow canvases. */
  compact?: boolean;
  /**
   * Notifies the parent preview when the crop popover opens / closes, so it can render the
   * "crop editing" preview (full image with dimmed overlays on the cropped regions, Canva-style).
   */
  onCropModeChange?: (cropping: boolean) => void;
  className?: string;
  /** When the bar is fixed above the mobile keyboard, open menus upward so they stay on-screen. */
  popoverOpenAbove?: boolean;
}

const ALIGNS: { id: TextAlign; icon: typeof AlignLeft }[] = [
  { id: 'left', icon: AlignLeft },
  { id: 'center', icon: AlignCenter },
  { id: 'right', icon: AlignRight },
  { id: 'justify', icon: AlignJustify },
];

const TEXT_TRANSFORMS: TextTransform[] = ['none', 'uppercase', 'lowercase'];

/**
 * Floating inline toolbar rendered above the active element on the design canvas.
 * Lets users tweak the most-used properties (font, size, colour, effects, alignment, etc.)
 * without opening the side configuration panel.
 */
export function InlineElementToolbar({
  element,
  onPatch,
  onDuplicate,
  onDelete,
  fontOptions = DEFAULT_FONTS,
  compact = false,
  onCropModeChange,
  className,
  popoverOpenAbove = false,
}: Props) {
  const isText = element.type === 'text';
  const isImage = element.type === 'image';
  const isLocked = element.locked === true;

  const [openPanel, setOpenPanel] = useState<
    null | 'font' | 'color' | 'align' | 'case' | 'effects' | 'border' | 'size' | 'crop'
  >(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openPanel) return;
    const onDoc = (ev: PointerEvent) => {
      const target = ev.target as Node | null;
      if (!rootRef.current || !target) return;
      if (!rootRef.current.contains(target)) setOpenPanel(null);
    };
    /** Pointerdown closes open popovers when clicking anywhere outside the toolbar surface. */
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [openPanel]);

  useEffect(() => {
    setOpenPanel(null);
  }, [element.id]);

  useEffect(() => {
    if (element.locked) setOpenPanel(null);
  }, [element.locked]);

  // Mirror `openPanel === 'crop'` up to the preview so it can render an editing overlay
  // showing the full image with dimmed crop regions (no crop applied while editing).
  const cropModeChangeRef = useRef(onCropModeChange);
  cropModeChangeRef.current = onCropModeChange;
  useEffect(() => {
    cropModeChangeRef.current?.(openPanel === 'crop');
  }, [openPanel]);
  useEffect(
    () => () => {
      cropModeChangeRef.current?.(false);
    },
    [],
  );

  const togglePanel = (id: Exclude<typeof openPanel, null>) =>
    setOpenPanel((prev) => (prev === id ? null : id));

  const btnBase =
    'builder-focus press-feedback relative inline-flex shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:pointer-events-none';
  const iconBtn = cn(btnBase, compact ? 'h-7 w-7' : 'h-8 w-8');
  const textBtn = cn(btnBase, compact ? 'h-7 gap-1 px-2 text-[10px]' : 'h-8 gap-1 px-2.5 text-[11px]');

  const currentFont = element.fontFamily ?? 'Inter';
  const currentSize = element.fontSize ?? 30;
  const currentAlign = (element.textAlign ?? 'center') as TextAlign;
  const currentCase = (element.textTransform ?? 'none') as TextTransform;
  const currentColor = element.color ?? '#FFFFFF';
  const opacity = element.opacity ?? 100;
  const outline = element.borderWidth ?? 0;
  const outlineColor = element.borderColor ?? '#FFFFFF';
  const cornerRadius = element.cornerRadius ?? 0;
  const cropT = element.cropTop ?? 0;
  const cropR = element.cropRight ?? 0;
  const cropB = element.cropBottom ?? 0;
  const cropL = element.cropLeft ?? 0;
  const hasCrop = cropT > 0 || cropR > 0 || cropB > 0 || cropL > 0;
  const aspectRatio = element.width && element.height ? element.width / element.height : 1;

  const bumpSize = (delta: number) =>
    onPatch({ fontSize: Math.max(10, Math.min(160, currentSize + delta)) });

  const cycleAlign = () => {
    const idx = ALIGNS.findIndex((a) => a.id === currentAlign);
    const next = ALIGNS[(idx + 1) % ALIGNS.length]!;
    onPatch({ textAlign: next.id });
  };

  const cycleCase = () => {
    const idx = TEXT_TRANSFORMS.indexOf(currentCase);
    const next = TEXT_TRANSFORMS[(idx + 1) % TEXT_TRANSFORMS.length]!;
    onPatch({ textTransform: next });
  };

  const AlignIcon = ALIGNS.find((a) => a.id === currentAlign)?.icon ?? AlignCenter;
  const popSide = popoverOpenAbove ? 'above' : 'below';

  return (
    <div
      ref={rootRef}
      role="toolbar"
      aria-label="Element quick actions"
      data-inline-toolbar
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'pointer-events-auto relative z-[60] min-w-0 max-w-full animate-builder-pop-in',
        className,
      )}
    >
      <div
        className={cn(
          compact &&
            'no-scrollbar max-w-[min(100%,calc(100vw-1.25rem))] overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] touch-pan-x',
        )}
      >
        <div
          className={cn(
            'flex w-max min-w-0 max-w-full flex-nowrap items-center rounded-2xl border border-white/[0.08] bg-[#141414]/96 text-white shadow-[0_18px_48px_rgba(0,0,0,0.55),0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-xl',
            compact ? 'gap-0.5 px-1 py-1' : 'gap-1 px-1.5 py-1.5',
            !compact && 'max-w-[min(98vw,960px)]',
          )}
        >
        {isText ? (
          <>
            {/* Font family */}
            <button
              type="button"
              onClick={() => togglePanel('font')}
              disabled={isLocked}
              className={cn(textBtn, 'max-w-[128px] justify-between pr-1.5', openPanel === 'font' && 'bg-white/10 text-white')}
              title="Font family"
            >
              <Type className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} strokeWidth={2} />
              <span className="truncate text-[11px] font-semibold" style={{ fontFamily: currentFont }}>
                {currentFont}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            <Divider />

            {/* Font size stepper */}
            <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-white/[0.04] px-0.5">
              <button
                type="button"
                onClick={() => bumpSize(-1)}
                disabled={isLocked}
                className={cn(iconBtn, 'text-white/75')}
                title="Decrease size"
                aria-label="Decrease font size"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                aria-label="Font size"
                value={Math.round(currentSize)}
                min={10}
                max={160}
                disabled={isLocked}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) onPatch({ fontSize: Math.max(10, Math.min(160, v)) });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                  'builder-focus h-6 w-10 rounded-md border border-transparent bg-transparent text-center text-[12px] font-semibold text-white outline-none hover:border-white/10 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-40',
                  compact && 'h-5 w-9 text-[11px]',
                )}
              />
              <button
                type="button"
                onClick={() => bumpSize(1)}
                disabled={isLocked}
                className={cn(iconBtn, 'text-white/75')}
                title="Increase size"
                aria-label="Increase font size"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <Divider />

            {/* Text colour */}
            <button
              type="button"
              onClick={() => togglePanel('color')}
              disabled={isLocked}
              className={cn(iconBtn, openPanel === 'color' && 'bg-white/10')}
              title="Text colour"
              aria-label="Text colour"
            >
              <span
                className="block h-4 w-4 rounded-full border border-white/30 shadow-[0_0_0_1px_rgba(0,0,0,0.35)_inset]"
                style={{ backgroundColor: currentColor }}
              />
            </button>

            {/* Italic */}
            <button
              type="button"
              onClick={() =>
                onPatch({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })
              }
              disabled={isLocked}
              className={cn(iconBtn, element.fontStyle === 'italic' && 'bg-white/10 text-white')}
              title="Italic"
              aria-label="Italic"
              aria-pressed={element.fontStyle === 'italic'}
            >
              <Italic className="h-3.5 w-3.5" />
            </button>

            <Divider />

            {/* Alignment cycle + picker */}
            <button
              type="button"
              onClick={cycleAlign}
              onContextMenu={(e) => {
                e.preventDefault();
                togglePanel('align');
              }}
              disabled={isLocked}
              className={cn(iconBtn, openPanel === 'align' && 'bg-white/10')}
              title={`Alignment (${currentAlign})`}
              aria-label="Alignment"
            >
              <AlignIcon className="h-3.5 w-3.5" />
            </button>

            {/* Case cycle (Aa / AA / aa) */}
            <button
              type="button"
              onClick={cycleCase}
              disabled={isLocked}
              className={cn(iconBtn, currentCase !== 'none' && 'bg-white/10 text-white')}
              title={`Text case: ${currentCase}`}
              aria-label="Text case"
            >
              <CaseSensitive className="h-4 w-4" />
            </button>

            <Divider />

            {/* Effects panel */}
            <button
              type="button"
              onClick={() => togglePanel('effects')}
              disabled={isLocked}
              className={cn(textBtn, openPanel === 'effects' && 'bg-white/10 text-white')}
              title="Effects"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {!compact && <span className="font-semibold">Effects</span>}
            </button>
          </>
        ) : null}

        {isImage ? (
          <>
            <button
              type="button"
              onClick={() => togglePanel('effects')}
              disabled={isLocked}
              className={cn(textBtn, openPanel === 'effects' && 'bg-white/10 text-white')}
              title="Adjustments"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {!compact && <span className="font-semibold">Adjust</span>}
            </button>

            <button
              type="button"
              onClick={() => togglePanel('border')}
              disabled={isLocked}
              className={cn(textBtn, openPanel === 'border' && 'bg-white/10 text-white')}
              title="Outline & corners"
            >
              <span
                className="block h-4 w-4 shrink-0"
                style={{
                  border: outline > 0 ? `2px solid ${outlineColor}` : '1px dashed rgba(255,255,255,0.45)',
                  borderRadius:
                    cornerRadius > 0 ? `${Math.min(8, cornerRadius / 10)}px` : '2px',
                }}
              />
              {!compact && <span className="font-semibold">Outline</span>}
            </button>

            <button
              type="button"
              onClick={() => togglePanel('crop')}
              disabled={isLocked}
              className={cn(textBtn, openPanel === 'crop' && 'bg-white/10 text-white')}
              title="Crop"
              aria-pressed={hasCrop}
            >
              <Crop className="h-3.5 w-3.5" />
              {!compact && <span className="font-semibold">Crop</span>}
            </button>
          </>
        ) : null}

        <Divider />

        {/* Size (width / height / rotate) — available for both text and image */}
        <button
          type="button"
          onClick={() => togglePanel('size')}
          disabled={isLocked}
          className={cn(textBtn, openPanel === 'size' && 'bg-white/10 text-white')}
          title="Size & rotation"
        >
          <Move3d className="h-3.5 w-3.5" />
          {!compact && <span className="font-semibold">Size</span>}
        </button>

        <Divider />

        {/* Flip horizontal (both) */}
        <button
          type="button"
          onClick={() => onPatch({ flipHorizontal: !element.flipHorizontal })}
          disabled={isLocked}
          className={cn(iconBtn, element.flipHorizontal && 'bg-white/10 text-white')}
          title="Flip horizontally"
          aria-label="Flip horizontally"
          aria-pressed={Boolean(element.flipHorizontal)}
        >
          <FlipHorizontal2 className="h-3.5 w-3.5" />
        </button>

        {/* Lock / unlock position — always enabled so a locked element can be unlocked from the bar */}
        <button
          type="button"
          onClick={() => onPatch({ locked: !isLocked })}
          className={cn(iconBtn, isLocked && 'bg-white/10 text-white')}
          title={isLocked ? 'Unlock' : 'Lock'}
          aria-label={isLocked ? 'Unlock element' : 'Lock element'}
          aria-pressed={isLocked}
        >
          {isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        </button>

        {/* Duplicate */}
        <button
          type="button"
          onClick={onDuplicate}
          disabled={isLocked}
          className={iconBtn}
          title="Duplicate"
          aria-label="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className={cn(iconBtn, 'hover:bg-[#FF3B30]/20 hover:text-[#FF8C85]')}
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        </div>
      </div>

      {/* ──────────────── Popovers ──────────────── */}
      {openPanel === 'font' ? (
        <Popover side={popSide}>
          <div className="mb-1 px-2 pt-1 text-[9px] font-semibold uppercase tracking-wider text-white/45">
            Font
          </div>
          <div className="no-scrollbar max-h-[220px] overflow-y-auto px-1 pb-1">
            {fontOptions.map((font) => (
              <button
                key={font}
                type="button"
                onClick={() => {
                  onPatch({ fontFamily: font });
                  setOpenPanel(null);
                }}
                className={cn(
                  'builder-focus press-feedback flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12px] text-white/80 hover:bg-white/10 hover:text-white',
                  currentFont === font && 'bg-white/10 text-white',
                )}
                style={{ fontFamily: font }}
              >
                <span className="truncate">{font}</span>
                {currentFont === font ? <span className="text-[9px] text-white/60">●</span> : null}
              </button>
            ))}
          </div>
        </Popover>
      ) : null}

      {openPanel === 'color' ? (
        <Popover side={popSide}>
          <div className="px-2 pt-2 text-[9px] font-semibold uppercase tracking-wider text-white/45">
            Text colour
          </div>
          <ColorGrid
            colors={STUDIO_TEXT_MAIN_COLORS as readonly string[]}
            selected={currentColor}
            onSelect={(hex) => {
              onPatch({ color: hex });
            }}
          />
          <div className="mx-2 mb-1 mt-1 h-px bg-white/[0.07]" />
          <ColorGrid
            colors={STUDIO_TEXT_POPULAR_COLORS as readonly string[]}
            selected={currentColor}
            onSelect={(hex) => {
              onPatch({ color: hex });
            }}
          />
          <div className="flex items-center gap-2 border-t border-white/[0.07] px-2 py-2">
            <label className="text-[9px] uppercase tracking-wider text-white/45">Custom</label>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onPatch({ color: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              className="h-6 w-8 cursor-pointer rounded border border-white/10 bg-transparent p-0"
            />
            <input
              type="text"
              value={currentColor}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9A-Fa-f]{3,8}$/.test(v)) onPatch({ color: v });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="builder-focus h-6 w-20 rounded-md border border-white/10 bg-black/40 px-1.5 text-[11px] text-white"
              maxLength={9}
            />
          </div>
        </Popover>
      ) : null}

      {openPanel === 'align' ? (
        <Popover side={popSide}>
          <div className="flex items-center gap-1 p-1.5">
            {ALIGNS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onPatch({ textAlign: id });
                  setOpenPanel(null);
                }}
                className={cn(
                  'builder-focus press-feedback flex h-8 w-8 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white',
                  currentAlign === id && 'bg-white/15 text-white',
                )}
                title={`Align ${id}`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </Popover>
      ) : null}

      {openPanel === 'effects' ? (
        <Popover side={popSide} className="w-[240px]">
          <div className="space-y-3 p-2">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-white/55">
                  Opacity
                </span>
                <span className="text-[10px] font-semibold text-white/75">{Math.round(opacity)}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={opacity}
                onChange={(e) => onPatch({ opacity: Number(e.target.value) })}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#CC2D24]"
              />
            </div>
            {isText ? (
              <>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/55">
                      Outline
                    </span>
                    <span className="text-[10px] font-semibold text-white/75">{outline}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={0.5}
                    value={outline}
                    onChange={(e) => onPatch({ borderWidth: Number(e.target.value) })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#CC2D24]"
                  />
                  {outline > 0 ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-wider text-white/45">Colour</span>
                      <input
                        type="color"
                        value={outlineColor}
                        onChange={(e) => onPatch({ borderColor: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="h-5 w-7 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                      />
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/55">
                      Letter spacing
                    </span>
                    <span className="text-[10px] font-semibold text-white/75">
                      {element.letterSpacing ?? 0}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-4}
                    max={20}
                    step={0.5}
                    value={element.letterSpacing ?? 0}
                    onChange={(e) => onPatch({ letterSpacing: Number(e.target.value) })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#CC2D24]"
                  />
                </div>
                <div>
                  <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/55">
                    Shadow
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={1}
                      value={element.shadowBlur ?? 0}
                      onChange={(e) => onPatch({ shadowBlur: Number(e.target.value) })}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-[#CC2D24]"
                    />
                    <input
                      type="color"
                      value={element.shadowColor ?? '#000000'}
                      onChange={(e) => onPatch({ shadowColor: e.target.value })}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="h-5 w-7 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/55">
                  Shadow
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={32}
                    step={1}
                    value={element.shadowBlur ?? 0}
                    onChange={(e) => onPatch({ shadowBlur: Number(e.target.value) })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-[#CC2D24]"
                  />
                  <input
                    type="color"
                    value={element.shadowColor ?? '#000000'}
                    onChange={(e) => onPatch({ shadowColor: e.target.value })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="h-5 w-7 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                  />
                </div>
              </div>
            )}
          </div>
        </Popover>
      ) : null}

      {openPanel === 'border' && isImage ? (
        <Popover side={popSide} className="w-[240px]">
          <div className="space-y-3 p-2">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-white/55">
                  Outline width
                </span>
                <span className="text-[10px] font-semibold text-white/75">{outline}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={0.5}
                value={outline}
                onChange={(e) => onPatch({ borderWidth: Number(e.target.value) })}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#CC2D24]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-wider text-white/45">Colour</span>
              <input
                type="color"
                value={outlineColor}
                onChange={(e) => onPatch({ borderColor: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-5 w-7 cursor-pointer rounded border border-white/10 bg-transparent p-0"
              />
              <input
                type="text"
                value={outlineColor}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (/^#[0-9A-Fa-f]{3,8}$/.test(v)) onPatch({ borderColor: v });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="builder-focus h-6 w-20 rounded-md border border-white/10 bg-black/40 px-1.5 text-[11px] text-white"
                maxLength={9}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/55">
                  <Squircle className="h-3 w-3" /> Corner rounding
                </span>
                <span className="text-[10px] font-semibold text-white/75">
                  {Math.round(cornerRadius)}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={1}
                value={cornerRadius}
                onChange={(e) => onPatch({ cornerRadius: Number(e.target.value) })}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#CC2D24]"
              />
            </div>
          </div>
        </Popover>
      ) : null}

      {openPanel === 'size' ? (
        <Popover side={popSide} className="w-[260px]">
          <div className="space-y-2.5 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/55">
                Attributes
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <AttrField
                label="Width"
                suffix="px"
                value={Math.round(element.width || 0)}
                onChange={(v) => {
                  const next = Math.max(8, Math.min(1200, v));
                  const patch = isImage
                    ? { width: next, height: Math.round(next / aspectRatio) }
                    : { width: next };
                  onPatch(isText ? { ...patch, autoWidth: false } : patch);
                }}
              />
              <AttrField
                label="Height"
                suffix="px"
                value={Math.round(element.height || 0)}
                onChange={(v) => {
                  const next = Math.max(8, Math.min(1200, v));
                  const patch = isImage
                    ? { height: next, width: Math.round(next * aspectRatio) }
                    : { height: next };
                  onPatch(isText ? { ...patch, autoHeight: false } : patch);
                }}
              />
              <AttrField
                label="Rotate"
                suffix="°"
                value={Math.round((element.rotation ?? 0) * 10) / 10}
                step={1}
                onChange={(v) => onPatch({ rotation: ((v % 360) + 360) % 360 })}
              />
              {isText ? (
                <AttrField
                  label="Font size"
                  suffix="px"
                  value={Math.round(element.fontSize ?? 30)}
                  onChange={(v) => onPatch({ fontSize: Math.max(10, Math.min(160, v)) })}
                />
              ) : (
                <AttrField
                  label="Scale"
                  suffix="%"
                  value={100}
                  step={1}
                  onChange={(v) => {
                    const pct = Math.max(10, Math.min(400, v)) / 100;
                    onPatch({
                      width: Math.round((element.width || 0) * pct),
                      height: Math.round((element.height || 0) * pct),
                    });
                  }}
                />
              )}
            </div>
            <div className="flex items-center justify-end gap-1 pt-1">
              <button
                type="button"
                onClick={() => onPatch({ rotation: 0 })}
                className="builder-focus press-feedback inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-white/75 hover:bg-white/10 hover:text-white"
                title="Reset rotation"
              >
                <RotateCw className="h-3 w-3" /> Reset
              </button>
            </div>
          </div>
        </Popover>
      ) : null}

      {openPanel === 'crop' && isImage ? (
        <Popover side={popSide} className="w-[260px]">
          <div className="space-y-2.5 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/55">
                Crop ({Math.round(100 - cropT - cropB)}×{Math.round(100 - cropL - cropR)}%)
              </span>
              {hasCrop ? (
                <button
                  type="button"
                  onClick={() =>
                    onPatch({ cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 })
                  }
                  className="builder-focus press-feedback rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Reset
                </button>
              ) : null}
            </div>
            <CropSlider
              label="Top"
              value={cropT}
              otherOpposite={cropB}
              onChange={(v) => onPatch({ cropTop: v })}
            />
            <CropSlider
              label="Right"
              value={cropR}
              otherOpposite={cropL}
              onChange={(v) => onPatch({ cropRight: v })}
            />
            <CropSlider
              label="Bottom"
              value={cropB}
              otherOpposite={cropT}
              onChange={(v) => onPatch({ cropBottom: v })}
            />
            <CropSlider
              label="Left"
              value={cropL}
              otherOpposite={cropR}
              onChange={(v) => onPatch({ cropLeft: v })}
            />
          </div>
        </Popover>
      ) : null}
    </div>
  );
}

function AttrField({
  label,
  suffix,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-white/55">
        {label}
      </span>
      <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2.5 transition-colors focus-within:border-[#CC2D24]/55 focus-within:bg-black/60">
        <input
          type="number"
          value={draft}
          step={step}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Number(draft);
            if (Number.isFinite(n)) onChange(n);
            else setDraft(String(value));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 bg-transparent text-left text-[12px] font-semibold tabular-nums text-white outline-none focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="shrink-0 text-[10px] font-medium tabular-nums leading-none text-white/45">
          {suffix}
        </span>
      </div>
    </label>
  );
}

function CropSlider({
  label,
  value,
  otherOpposite,
  onChange,
}: {
  label: string;
  value: number;
  /** The crop on the opposite edge — we clamp max so the two never overlap past 95%. */
  otherOpposite: number;
  onChange: (v: number) => void;
}) {
  const max = Math.max(0, 95 - otherOpposite);
  const clamped = Math.min(value, max);
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-wider text-white/50">{label}</span>
        <span className="text-[10px] font-semibold text-white/75">{Math.round(clamped)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={(e) => e.stopPropagation()}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#CC2D24]"
      />
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-white/[0.08]" aria-hidden />;
}

/**
 * Pop-over attached to the inline toolbar. Default is right-anchored so panels
 * slide out toward the right edge instead of dropping over the centre of the
 * canvas (where the element being edited usually sits).
 */
function Popover({
  children,
  className,
  align = 'right',
  side = 'below',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  /** `above` = open upward (e.g. toolbar fixed above keyboard). */
  side?: 'above' | 'below';
}) {
  return (
    <div
      className={cn(
        'absolute z-[61] w-[200px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#141414]/96 text-white shadow-[0_20px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl animate-builder-fade-in',
        side === 'below' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
        align === 'left' && 'left-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        align === 'right' && 'right-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

function ColorGrid({
  colors,
  selected,
  onSelect,
}: {
  colors: readonly string[];
  selected: string;
  onSelect: (hex: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 p-2">
      {colors.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onSelect(hex)}
          className={cn(
            'builder-focus press-feedback h-6 w-6 shrink-0 rounded-full border transition-transform',
            selected.toLowerCase() === hex.toLowerCase()
              ? 'border-white scale-110 ring-2 ring-[#CC2D24]/60'
              : 'border-white/15 hover:border-white/40',
          )}
          style={{ backgroundColor: hex }}
          aria-label={`Set colour ${hex}`}
          title={hex}
        />
      ))}
    </div>
  );
}
