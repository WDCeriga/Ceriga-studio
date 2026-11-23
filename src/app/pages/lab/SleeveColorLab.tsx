import { garmentAssetLabel } from '../../components/builder/TshirtAssetChoiceGrid';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { StudioColorField } from '../../components/builder/StudioColorField';
import {
  STUDIO_MAIN_COLORS,
  STUDIO_POPULAR_COLORS,
} from '../../data/studioColorPresets';
import {
  getGarmentAssets,
  type GarmentAsset,
} from '../../data/garmentSvgCatalog';
import {
  extractCodedOutlineFromSvg,
  renderCodedOutlineSvg,
  type CodedOutline,
} from '../../lib/outlineToPolylines';
import {
  rasterFillOutlineSvgInteriors,
  tintPotraceSvg,
} from '../../lib/tshirtSvgUtils';
import { normalizeHex6 } from '../../lib/colorUtils';
import { cn } from '../../components/ui/utils';

const SLEEVE_CATEGORY = 'T-shirt sleeves';
const CUFF_CATEGORY = 'T-shirt sleeve hem';

type ColorMethodId =
  | 'coded-lines'
  | 'close-and-flood'
  | 'span-fill'
  | 'flood-fill'
  | 'potrace-solid'
  | 'two-tone-stack';

interface ColorMethod {
  id: ColorMethodId;
  title: string;
  blurb: string;
  verdict: string;
  fillsInterior: boolean;
}

const METHODS: ColorMethod[] = [
  {
    id: 'coded-lines',
    title: '1. Coded lines (extract → close → fill)',
    blurb:
      'Skeletonize the SVG into real polylines (e.g. two straight lines), close the open ends in code, then fill the polygon.',
    verdict: 'This is the path off static potrace fills — geometry becomes data you draw.',
    fillsInterior: true,
  },
  {
    id: 'close-and-flood',
    title: '2. Close loose edges → flood-fill',
    blurb: 'Raster bridges + flood fill (still pixel-based, not coded lines).',
    verdict: 'Works on bitmaps; does not give you editable line data.',
    fillsInterior: true,
  },
  {
    id: 'span-fill',
    title: '3. Span-fill',
    blurb: 'Per scanline, paint between left and right ink of each sleeve half.',
    verdict: 'Fast fallback; can overfill concave shapes.',
    fillsInterior: true,
  },
  {
    id: 'flood-fill',
    title: '4. Flood-fill only',
    blurb: 'No bridging — only fills regions that are already watertight.',
    verdict: 'Fails when the shoulder (or other edge) is open.',
    fillsInterior: true,
  },
  {
    id: 'potrace-solid',
    title: '5. Potrace solid tint (production today)',
    blurb: 'Replace #000 fills with hex via tintPotraceSvg.',
    verdict: 'Still the static SVG path — outline ribbons only.',
    fillsInterior: false,
  },
  {
    id: 'two-tone-stack',
    title: '6. Two-tone sleeve + cuff (tint)',
    blurb: 'Sleeve tint + cuff tint stacked — production trim model.',
    verdict: 'Useful once geometry is solid; with line art, still outlines.',
    fillsInterior: false,
  },
];

function InlineMarkup({ html }: { html: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function CodedLinesCanvas({
  raw,
  color,
  asStraightLines,
  maxStrokes,
  onOutline,
}: {
  raw: string;
  color: string;
  asStraightLines: boolean;
  maxStrokes: number;
  onOutline?: (outline: CodedOutline | null) => void;
}) {
  useCerigaTranslation();

  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const onOutlineRef = useRef(onOutline);
  onOutlineRef.current = onOutline;

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    onOutlineRef.current?.(null);
    void extractCodedOutlineFromSvg(raw, {
      size: 512,
      viewBox: 1000,
      maxStrokes,
      asStraightLines,
      simplifyEpsilon: asStraightLines ? 8 : 3,
      dilate: 2,
    })
      .then((outline) => {
        if (cancelled) return;
        onOutlineRef.current?.(outline);
        setHtml(
          renderCodedOutlineSvg(outline, {
            stroke: shadeToward(color, -0.25),
            fill: color,
            showFill: true,
            showLines: true,
            strokeWidth: 7,
          }),
        );
        setBusy(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onOutlineRef.current?.(null);
        setError(err instanceof Error ? err.message : cerigaTranslate("interface.text_d79e37163a7a7325"));
        setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [raw, color, asStraightLines, maxStrokes]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#0c0c0e]">
      {html ? <InlineMarkup html={html} /> : null}
      {busy ? (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/45">{cerigaTranslate("interface.text_b6e0cb7092e295b0")}</div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-[11px] text-red-300">
          {cerigaTranslateLabel(error)}
        </div>
      ) : null}
    </div>
  );
}

function shadeToward(hex: string, amount: number): string {
  const n = normalizeHex6(hex).replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const mix = (c: number) => {
    const next = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.round(Math.min(255, Math.max(0, next)));
  };
  const to = (c: number) => mix(c).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function FloodFillCanvas({
  raw,
  color,
  mode,
  showClosingLines,
}: {
  raw: string;
  color: string;
  mode: 'flood' | 'span' | 'close-and-flood';
  showClosingLines: boolean;
}) {
  useCerigaTranslation();

  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    void rasterFillOutlineSvgInteriors(raw, color, {
      size: 640,
      dilate: mode === 'close-and-flood' ? 1 : mode === 'flood' ? 3 : 1,
      keepOutline: true,
      mode,
      showClosingLines,
      bridgeThickness: 4,
      bridgeHex: '#5B8CF5',
    })
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
          setBusy(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : cerigaTranslate("interface.text_582ac180957715d4"));
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [raw, color, mode, showClosingLines]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#0c0c0e]">
      {src ? (
        <img alt="" src={src} className="absolute inset-0 h-full w-full object-contain" />
      ) : null}
      {busy ? (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/45">{cerigaTranslate("interface.text_e291a9aef2bc4200")}</div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-[11px] text-red-300">
          {cerigaTranslateLabel(error)}
        </div>
      ) : null}
    </div>
  );
}

function MethodCanvas({
  method,
  sleeve,
  cuff,
  color,
  cuffColor,
  showClosingLines,
  asStraightLines,
  maxStrokes,
  onCodedOutline,
}: {
  method: ColorMethodId;
  sleeve: GarmentAsset;
  cuff: GarmentAsset | null;
  color: string;
  cuffColor: string;
  showClosingLines: boolean;
  asStraightLines: boolean;
  maxStrokes: number;
  onCodedOutline?: (outline: CodedOutline | null) => void;
}) {
  const solid = useMemo(
    () => tintPotraceSvg(sleeve.svgRaw, color, 'solid'),
    [sleeve.svgRaw, color],
  );
  const cuffSolid = useMemo(
    () => (cuff ? tintPotraceSvg(cuff.svgRaw, cuffColor, 'solid') : ''),
    [cuff, cuffColor],
  );

  if (method === 'coded-lines') {
    return (
      <CodedLinesCanvas
        raw={sleeve.svgRaw}
        color={color}
        asStraightLines={asStraightLines}
        maxStrokes={maxStrokes}
        onOutline={onCodedOutline}
      />
    );
  }
  if (method === 'close-and-flood') {
    return (
      <FloodFillCanvas
        raw={sleeve.svgRaw}
        color={color}
        mode="close-and-flood"
        showClosingLines={showClosingLines}
      />
    );
  }
  if (method === 'span-fill') {
    return (
      <FloodFillCanvas
        raw={sleeve.svgRaw}
        color={color}
        mode="span"
        showClosingLines={false}
      />
    );
  }
  if (method === 'flood-fill') {
    return (
      <FloodFillCanvas
        raw={sleeve.svgRaw}
        color={color}
        mode="flood"
        showClosingLines={false}
      />
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#0c0c0e]">
      {method === 'potrace-solid' ? <InlineMarkup html={solid} /> : null}
      {method === 'two-tone-stack' ? (
        <>
          <InlineMarkup html={solid} />
          {cuffSolid ? <InlineMarkup html={cuffSolid} /> : null}
        </>
      ) : null}
    </div>
  );
}

export function SleeveColorLab() {
  useCerigaTranslation();

  const sleeves = useMemo(() => getGarmentAssets('tshirt', SLEEVE_CATEGORY), []);
  const cuffs = useMemo(() => getGarmentAssets('tshirt', CUFF_CATEGORY), []);
  const [sleeveId, setSleeveId] = useState(sleeves[0]?.id ?? '');
  const [cuffId, setCuffId] = useState(cuffs[0]?.id ?? '');
  const [color, setColor] = useState('#CC2D24');
  const [cuffColor, setCuffColor] = useState('#FFFFFF');
  const [focusMethod, setFocusMethod] = useState<ColorMethodId | 'all'>('coded-lines');
  const [showClosingLines, setShowClosingLines] = useState(true);
  const [asStraightLines, setAsStraightLines] = useState(true);
  const [maxStrokes, setMaxStrokes] = useState(2);
  const [codedOutline, setCodedOutline] = useState<CodedOutline | null>(null);

  const sleeve = sleeves.find((a) => a.id === sleeveId) ?? sleeves[0];
  const cuff = cuffs.find((a) => a.id === cuffId) ?? cuffs[0] ?? null;

  const visibleMethods =
    focusMethod === 'all' ? METHODS : METHODS.filter((m) => m.id === focusMethod);

  if (!sleeve) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] text-white">{cerigaTranslate("interface.text_d04cae8a164e7f43")}{SLEEVE_CATEGORY}”.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <header className="border-b border-white/10 bg-[#111113]/90 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{cerigaTranslate("interface.text_efdcf466b553a068")}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{cerigaTranslate("interface.text_7b85b262c610ca5c")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/55">{cerigaTranslate("interface.text_2b7b0cc5494520f5")}{' '}
              <span className="text-white/80">{cerigaTranslate("interface.text_c89e2a503d816934")}</span>{" "}{cerigaTranslate("interface.text_0977e4230a18a105")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              to="/lab"
              className="text-white/50 underline-offset-4 hover:text-white hover:underline"
            >{cerigaTranslate("interface.text_9e87d9dadae79eb5")}</Link>
            <Link
              to="/lab/garment-json"
              className="text-white/50 underline-offset-4 hover:text-white hover:underline"
            >{cerigaTranslate("interface.text_47205cf6512f87ab")}</Link>
            <Link
              to="/catalog"
              className="text-white/50 underline-offset-4 hover:text-white hover:underline"
            >{cerigaTranslate("marketing.catalog")}</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[320px_minmax(0,1fr)] sm:px-6">
        <aside className="space-y-5 rounded-2xl border border-[#252528] bg-[#111113] p-4">
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-3 text-[12px] leading-relaxed text-sky-100/85">{cerigaTranslate("interface.text_be0e28f687db5cb9")}</div>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/70">
            <input
              type="checkbox"
              checked={asStraightLines}
              onChange={(e) => setAsStraightLines(e.target.checked)}
              className="accent-[#5B8CF5]"
            />{cerigaTranslate("interface.text_a2064383f818961b")}</label>

          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_4864b3b0ebfa2a28")}</label>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={maxStrokes}
              onChange={(e) => setMaxStrokes(Number(e.target.value))}
              className="w-full accent-[#5B8CF5]"
            />
            <div className="mt-1 text-[11px] text-white/45">{maxStrokes}{" "}{cerigaTranslate("interface.text_ccc19d228f297cd5")}</div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/70">
            <input
              type="checkbox"
              checked={showClosingLines}
              onChange={(e) => setShowClosingLines(e.target.checked)}
              className="accent-[#5B8CF5]"
            />{cerigaTranslate("interface.text_ca3234dfdfe6f45e")}</label>

          {codedOutline ? (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_c9d91c9fb4c203fb")}</p>
              <pre className="max-h-56 overflow-auto rounded-xl border border-white/10 bg-black/50 p-3 text-[10px] leading-relaxed text-emerald-200/90">
                {codedOutline.codeSnippet}
              </pre>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_c0b14a62dca75f18")}</label>
            <select
              className="w-full rounded-lg border border-[#252528] bg-black/40 px-3 py-2 text-sm text-white"
              value={sleeve.id}
              onChange={(e) => setSleeveId(e.target.value)}
            >
              {sleeves.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {garmentAssetLabel(asset.displayName)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_eea9423e3bc1b566")}</label>
            <select
              className="w-full rounded-lg border border-[#252528] bg-black/40 px-3 py-2 text-sm text-white"
              value={cuff?.id ?? ''}
              onChange={(e) => setCuffId(e.target.value)}
            >
              {cuffs.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {garmentAssetLabel(asset.displayName)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_793015055f7bebd9")}</p>
            <StudioColorField
              value={color}
              onChange={setColor}
              mainColors={STUDIO_MAIN_COLORS}
              popularColors={STUDIO_POPULAR_COLORS}
              clearVisible={false}
            />
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_2e6ec5d75d09bc29")}</p>
            <StudioColorField
              value={cuffColor}
              onChange={setCuffColor}
              mainColors={STUDIO_MAIN_COLORS}
              popularColors={STUDIO_POPULAR_COLORS}
              clearVisible={false}
            />
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_8ee9d7338e8ba3e6")}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFocusMethod('all')}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px]',
                  focusMethod === 'all'
                    ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white'
                    : 'border-white/10 text-white/55 hover:border-white/25 hover:text-white',
                )}
              >{cerigaTranslate("interface.text_a52ace420f2175d0")}</button>
              {METHODS.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFocusMethod(m.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px]',
                    focusMethod === m.id
                      ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white'
                      : 'border-white/10 text-white/55 hover:border-white/25 hover:text-white',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section
          className={cn(
            'grid gap-4',
            focusMethod === 'all'
              ? 'sm:grid-cols-2 xl:grid-cols-3'
              : 'mx-auto max-w-xl grid-cols-1',
          )}
        >
          {visibleMethods.map((method) => (
            <article
              key={method.id}
              className={cn(
                'flex flex-col overflow-hidden rounded-2xl border bg-[#111113]',
                method.fillsInterior
                  ? 'border-emerald-500/35 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]'
                  : 'border-[#252528]',
              )}
            >
              <MethodCanvas
                method={method.id}
                sleeve={sleeve}
                cuff={cuff}
                color={normalizeHex6(color)}
                cuffColor={normalizeHex6(cuffColor)}
                showClosingLines={showClosingLines}
                asStraightLines={asStraightLines}
                maxStrokes={maxStrokes}
                onCodedOutline={method.id === 'coded-lines' ? setCodedOutline : undefined}
              />
              <div className="space-y-1.5 border-t border-white/5 p-3.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-white">{cerigaTranslateLabel(method.title)}</h2>
                  {method.fillsInterior ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">{cerigaTranslate("interface.text_876e88f1f4e8866e")}</span>
                  ) : (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">{cerigaTranslate("interface.text_14aaa81814d8773d")}</span>
                  )}
                </div>
                <p className="text-[12px] leading-snug text-white/50">{method.blurb}</p>
                <p
                  className={cn(
                    'text-[11px] leading-snug',
                    method.fillsInterior ? 'text-emerald-200/80' : 'text-white/40',
                  )}
                >
                  {method.verdict}
                </p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
