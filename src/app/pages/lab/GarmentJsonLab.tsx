import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  GARMENT_JSON_PRESETS,
  formatGarmentDrawing,
  parseGarmentDrawingJson,
  renderGarmentDrawingSvg,
  resolveGarmentDrawing,
  type GarmentDrawing,
  type GarmentPiece,
  type JsonPoint,
} from '../../lib/garmentJsonDrawing';
import { cn } from '../../components/ui/utils';

type DragTarget =
  | { type: 'landmark'; pieceId: string; name: string }
  | { type: 'point'; pieceId: string; index: number };

function cloneDrawing(drawing: GarmentDrawing): GarmentDrawing {
  return structuredClone(drawing);
}

function updatePiece(
  drawing: GarmentDrawing,
  pieceId: string,
  updater: (piece: GarmentPiece) => GarmentPiece,
): GarmentDrawing {
  return {
    ...drawing,
    pieces: drawing.pieces.map((p) => (p.id === pieceId ? updater(p) : p)),
  };
}

function InlineMarkup({ html }: { html: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function clientToViewBox(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  viewBox: number,
): JsonPoint {
  const rect = svg.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  const offsetX = (rect.width - size) / 2;
  const offsetY = (rect.height - size) / 2;
  const x = ((clientX - rect.left - offsetX) / size) * viewBox;
  const y = ((clientY - rect.top - offsetY) / size) * viewBox;
  return {
    x: Math.round(Math.min(viewBox, Math.max(0, x)) * 10) / 10,
    y: Math.round(Math.min(viewBox, Math.max(0, y)) * 10) / 10,
  };
}

export function GarmentJsonLab() {
  useCerigaTranslation();

  const initial = GARMENT_JSON_PRESETS[0]!.drawing;
  const [presetId, setPresetId] = useState(GARMENT_JSON_PRESETS[0]!.id);
  const [drawing, setDrawing] = useState<GarmentDrawing>(() => cloneDrawing(initial));
  const [jsonText, setJsonText] = useState(() => formatGarmentDrawing(initial));
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(
    initial.pieces[0]?.id ?? null,
  );
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [jsonDirtyFromEditor, setJsonDirtyFromEditor] = useState(false);
  const [traceUrl, setTraceUrl] = useState<string | null>(null);
  const [traceName, setTraceName] = useState<string | null>(null);
  const [traceOpacity, setTraceOpacity] = useState(0.45);
  const [traceDragging, setTraceDragging] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [canvasTheme, setCanvasTheme] = useState<'dark' | 'light'>('dark');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragTarget | null>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;
  const selectedPieceIdRef = useRef(selectedPieceId);
  selectedPieceIdRef.current = selectedPieceId;
  const traceUrlRef = useRef<string | null>(null);

  const selectedPiece =
    drawing.pieces.find((p) => p.id === selectedPieceId) ?? drawing.pieces[0] ?? null;

  const hasTrace = Boolean(traceUrl);

  const previewHtml = useMemo(
    () =>
      renderGarmentDrawingSvg(drawing, {
        showLandmarks,
        showGuides,
        highlightPieceId: selectedPiece?.id ?? null,
        skipBackground: hasTrace,
        pieceFillOpacity: hasTrace ? 0.4 : 1,
        theme: canvasTheme,
      }),
    [drawing, showLandmarks, showGuides, selectedPiece?.id, hasTrace, canvasTheme],
  );

  const resolved = useMemo(() => resolveGarmentDrawing(drawing), [drawing]);
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;

  function applyDrawing(next: GarmentDrawing, options?: { keepText?: boolean }) {
    setDrawing(next);
    setParseError(null);
    if (!options?.keepText) {
      setJsonText(formatGarmentDrawing(next));
      setJsonDirtyFromEditor(false);
    }
    if (!next.pieces.some((p) => p.id === selectedPieceIdRef.current)) {
      setSelectedPieceId(next.pieces[0]?.id ?? null);
    }
  }

  const applyDrawingRef = useRef(applyDrawing);
  applyDrawingRef.current = applyDrawing;

  function loadPreset(id: string) {
    const preset = GARMENT_JSON_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    applyDrawing(cloneDrawing(preset.drawing));
  }

  function handleJsonChange(text: string) {
    setJsonText(text);
    setJsonDirtyFromEditor(true);
    const result = parseGarmentDrawingJson(text);
    if (!result.ok) {
      setParseError(result.error);
      return;
    }
    setParseError(null);
    setDrawing(result.drawing);
    if (!result.drawing.pieces.some((p) => p.id === selectedPieceId)) {
      setSelectedPieceId(result.drawing.pieces[0]?.id ?? null);
    }
  }

  function handleFormatJson() {
    const result = parseGarmentDrawingJson(jsonText);
    if (!result.ok) {
      setParseError(result.error);
      return;
    }
    applyDrawing(result.drawing);
  }

  function handleParamChange(key: string, value: number) {
    if (!selectedPiece) return;
    applyDrawing(
      updatePiece(drawing, selectedPiece.id, (piece) => ({
        ...piece,
        params: { ...piece.params, [key]: value },
      })),
    );
  }

  function handleFillChange(fill: string) {
    if (!selectedPiece) return;
    applyDrawing(
      updatePiece(drawing, selectedPiece.id, (piece) => ({
        ...piece,
        fill,
      })),
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopyStatus('Copied');
      window.setTimeout(() => setCopyStatus(null), 1500);
    } catch {
      setCopyStatus('Copy failed');
      window.setTimeout(() => setCopyStatus(null), 1500);
    }
  }

  function handleExport() {
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${drawing.name || 'garment'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function hitTest(point: JsonPoint, viewBox: number): DragTarget | null {
    const threshold = viewBox * 0.025;
    for (const geo of resolvedRef.current) {
      for (const lm of geo.landmarks) {
        if (Math.hypot(lm.point.x - point.x, lm.point.y - point.y) <= threshold) {
          return { type: 'landmark', pieceId: geo.piece.id, name: lm.name };
        }
      }
      if (geo.piece.kind === 'polygon' && geo.piece.points) {
        for (let i = 0; i < geo.piece.points.length; i++) {
          const p = geo.piece.points[i]!;
          if (Math.hypot(p.x - point.x, p.y - point.y) <= threshold) {
            return { type: 'point', pieceId: geo.piece.id, index: i };
          }
        }
      }
    }
    return null;
  }

  function applyDrag(target: DragTarget, point: JsonPoint) {
    const current = drawingRef.current;
    const next =
      target.type === 'landmark'
        ? updatePiece(current, target.pieceId, (piece) => ({
            ...piece,
            landmarks: { ...piece.landmarks, [target.name]: point },
          }))
        : updatePiece(current, target.pieceId, (piece) => {
            const points = [...(piece.points ?? [])];
            points[target.index] = point;
            return { ...piece, points };
          });
    applyDrawingRef.current(next);
    setSelectedPieceId(target.pieceId);
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const target = dragRef.current;
      const host = svgHostRef.current;
      if (!target || !host) return;
      const svg = host.querySelector('svg');
      if (!svg) return;
      const point = clientToViewBox(svg, e.clientX, e.clientY, drawingRef.current.viewBox);
      applyDrag(target, point);
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const host = svgHostRef.current;
    if (!host) return;
    const svg = host.querySelector('svg');
    if (!svg) return;
    const vb = drawingRef.current.viewBox;
    const point = clientToViewBox(svg, e.clientX, e.clientY, vb);
    const target = hitTest(point, vb);
    if (!target) return;
    e.preventDefault();
    dragRef.current = target;
    setSelectedPieceId(target.pieceId);
  }

  function clearTraceImage() {
    if (traceUrlRef.current) {
      URL.revokeObjectURL(traceUrlRef.current);
      traceUrlRef.current = null;
    }
    setTraceUrl(null);
    setTraceName(null);
    setTraceError(null);
  }

  function loadTraceFile(file: File | undefined | null) {
    if (!file) return;
    const okType =
      file.type === 'image/png' ||
      file.type === 'image/jpeg' ||
      file.type === 'image/webp' ||
      /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!okType) {
      setTraceError('Use a PNG, JPG, or WebP image');
      return;
    }
    setTraceError(null);
    const url = URL.createObjectURL(file);
    if (traceUrlRef.current) URL.revokeObjectURL(traceUrlRef.current);
    traceUrlRef.current = url;
    setTraceUrl(url);
    setTraceName(file.name);
  }

  function handleCanvasDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      setTraceDragging(true);
    }
  }

  function handleCanvasDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setTraceDragging(false);
  }

  function handleCanvasDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setTraceDragging(false);
    const file = e.dataTransfer.files?.[0];
    loadTraceFile(file);
  }

  useEffect(() => {
    return () => {
      if (traceUrlRef.current) URL.revokeObjectURL(traceUrlRef.current);
    };
  }, []);

  const paramEntries = Object.entries(selectedPiece?.params ?? {});

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <header className="border-b border-white/10 bg-[#111113]/90 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{cerigaTranslate("interface.text_efdcf466b553a068")}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{cerigaTranslate("interface.text_b9046c6395591d9c")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/55">{cerigaTranslate("interface.text_a9c50575adafe432")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              to="/lab"
              className="text-white/50 underline-offset-4 hover:text-white hover:underline"
            >{cerigaTranslate("interface.text_9e87d9dadae79eb5")}</Link>
            <Link
              to="/lab/sleeve-color"
              className="text-white/50 underline-offset-4 hover:text-white hover:underline"
            >{cerigaTranslate("interface.text_793015055f7bebd9")}</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)_minmax(320px,420px)] sm:px-6">
        <aside className="space-y-4 rounded-2xl border border-[#252528] bg-[#111113] p-4">
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_7252e7ce008587e1")}</label>
            <select
              className="w-full rounded-lg border border-[#252528] bg-black/40 px-3 py-2 text-sm text-white"
              value={presetId}
              onChange={(e) => loadPreset(e.target.value)}
            >
              {GARMENT_JSON_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {cerigaTranslateLabel(p.label)}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[12px] leading-relaxed text-white/45">
              {GARMENT_JSON_PRESETS.find((p) => p.id === presetId)?.blurb}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_8d8a162d576ba33c")}</label>
            <div className="space-y-1">
              {drawing.pieces.map((piece) => (
                <button
                  key={piece.id}
                  type="button"
                  onClick={() => setSelectedPieceId(piece.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px]',
                    selectedPiece?.id === piece.id
                      ? 'border-sky-500/40 bg-sky-500/10 text-white'
                      : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]',
                  )}
                >
                  <span>{piece.label ?? piece.id}</span>
                  <span className="text-white/35">{piece.kind}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedPiece ? (
            <div className="space-y-3 border-t border-white/10 pt-4">
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_033955d469b620d6")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedPiece.fill ?? '#CC2D24'}
                    onChange={(e) => handleFillChange(e.target.value.toUpperCase())}
                    className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
                  />
                  <input
                    type="text"
                    value={selectedPiece.fill ?? ''}
                    onChange={(e) => handleFillChange(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-[#252528] bg-black/40 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {paramEntries.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_7ffdd4b4c44c366a")}</p>
                  {paramEntries.map(([key, value]) => {
                    const isLength = key === 'length';
                    const min = isLength ? 2 : key === 'side' ? -1 : 1;
                    const max = isLength ? 30 : key === 'side' ? 1 : key.includes('Width') || key === 'halfChest' ? 400 : key === 'unitsPerCm' ? 40 : 200;
                    const step = key === 'side' ? 1 : isLength || key === 'unitsPerCm' ? 0.5 : 1;
                    return (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
                          <span>{key}</span>
                          <span className="tabular-nums text-white/85">{value}</span>
                        </div>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={value}
                          onChange={(e) => handleParamChange(key, Number(e.target.value))}
                          className="w-full accent-[#5B8CF5]"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-white/40">{cerigaTranslate("interface.text_26508dafa2c0a925")}</p>
              )}
            </div>
          ) : null}

          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_3824a9f4dafe92c6")}</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setCanvasTheme('dark')}
                className={cn(
                  'rounded-md px-2 py-1.5 text-[11px]',
                  canvasTheme === 'dark'
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white/80',
                )}
              >{cerigaTranslate("interface.text_60acc53f13a5d1bf")}</button>
              <button
                type="button"
                onClick={() => setCanvasTheme('light')}
                className={cn(
                  'rounded-md px-2 py-1.5 text-[11px]',
                  canvasTheme === 'light'
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white/80',
                )}
              >{cerigaTranslate("interface.text_dbcd5e7bb7a0f538")}</button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-white/70">
              <input
                type="checkbox"
                checked={showLandmarks}
                onChange={(e) => setShowLandmarks(e.target.checked)}
                className="accent-[#5B8CF5]"
              />{cerigaTranslate("interface.text_fc0857c7fc9bcf79")}</label>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-white/70">
              <input
                type="checkbox"
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
                className="accent-[#5B8CF5]"
              />{cerigaTranslate("interface.text_662908cdf5b6f5bf")}</label>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_84c6e722c93344c7")}</p>
            <p className="text-[12px] leading-relaxed text-white/45">{cerigaTranslate("interface.text_ce32c0c04f68f83b")}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                loadTraceFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.06]"
              >{cerigaTranslate("interface.text_6b87f8cf96fb099d")}</button>
              {hasTrace ? (
                <button
                  type="button"
                  onClick={clearTraceImage}
                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-red-300/80 hover:bg-red-500/10"
                >{cerigaTranslate("interface.text_83b12c2216efb4fd")}</button>
              ) : null}
            </div>
            {traceName ? (
              <p className="truncate text-[11px] text-white/50" title={traceName}>
                {traceName}
              </p>
            ) : null}
            {traceError ? <p className="text-[11px] text-red-300">{cerigaTranslateLabel(traceError)}</p> : null}
            {hasTrace ? (
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
                  <span>{cerigaTranslate("interface.text_1719e36eb302bc1e")}</span>
                  <span className="tabular-nums text-white/85">
                    {Math.round(traceOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={traceOpacity}
                  onChange={(e) => setTraceOpacity(Number(e.target.value))}
                  className="w-full accent-[#5B8CF5]"
                />
              </div>
            ) : null}
          </div>
        </aside>

        <section className="space-y-3">
          <div
            ref={svgHostRef}
            onPointerDown={handlePointerDown}
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
            className={cn(
              'relative aspect-square w-full cursor-crosshair overflow-hidden rounded-2xl border touch-none',
              canvasTheme === 'light' ? 'bg-[#F2F2F4]' : 'bg-[#0c0c0e]',
              traceDragging
                ? 'border-sky-400/60 ring-2 ring-sky-400/30'
                : canvasTheme === 'light'
                  ? 'border-black/10'
                  : 'border-[#252528]',
            )}
          >
            {hasTrace && traceUrl ? (
              <img
                src={traceUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                style={{ opacity: traceOpacity }}
              />
            ) : null}
            <InlineMarkup html={previewHtml} />
            {traceDragging ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-sky-500/15">
                <span
                  className={cn(
                    'rounded-full border px-4 py-2 text-[12px]',
                    canvasTheme === 'light'
                      ? 'border-sky-600/30 bg-white/90 text-sky-900'
                      : 'border-sky-300/40 bg-[#0c0c0e]/85 text-sky-100',
                  )}
                >{cerigaTranslate("interface.text_d216e0e30d172276")}</span>
              </div>
            ) : null}
            {!hasTrace ? (
              <div
                className={cn(
                  'pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px]',
                  canvasTheme === 'light' ? 'text-black/35' : 'text-white/30',
                )}
              >{cerigaTranslate("interface.text_743aee2058de47dc")}</div>
            ) : null}
          </div>
          <p className="text-[12px] text-white/45">{cerigaTranslate("interface.text_be532ae00dbd32e4")}</p>
        </section>

        <aside className="flex min-h-[420px] flex-col rounded-2xl border border-[#252528] bg-[#111113] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="mr-auto text-[10px] uppercase tracking-wider text-white/50">{cerigaTranslate("interface.text_db1a21a0bc2ef8fb")}</p>
            <button
              type="button"
              onClick={handleFormatJson}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/[0.06]"
            >{cerigaTranslate("interface.text_2f343666aaa88c44")}</button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/[0.06]"
            >
              {copyStatus ?? cerigaTranslate("interface.text_e21f935f11d7e966")}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg border border-sky-500/30 bg-sky-500/15 px-2.5 py-1 text-[11px] text-sky-100 hover:bg-sky-500/25"
            >{cerigaTranslate("interface.text_8da1ae4f24f99743")}</button>
          </div>

          <textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-emerald-200/90 outline-none focus:border-sky-500/40"
          />

          <div className="mt-3 min-h-[1.25rem] text-[11px]">
            {parseError ? (
              <span className="text-red-300">{cerigaTranslateLabel(parseError)}</span>
            ) : jsonDirtyFromEditor ? (
              <span className="text-emerald-300/80">{cerigaTranslate("interface.text_360fd35027aa2542")}</span>
            ) : (
              <span className="text-white/40">{cerigaTranslate("interface.text_f5d3dcfd59c954af")}</span>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
