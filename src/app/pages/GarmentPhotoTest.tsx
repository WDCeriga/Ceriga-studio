import { useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Droplets,
  FileCheck,
  Hash,
  History,
  Image as ImageIcon,
  Layers,
  Link2,
  Minus,
  Package,
  Palette,
  Plus,
  Pocket,
  Redo2,
  Ruler,
  Scissors,
  Tag,
  Undo2,
} from 'lucide-react';
import { Link } from 'react-router';
import { builderSteps } from '../data/builderSteps';
import { tintPotraceSvg } from '../lib/tshirtSvgUtils';
import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';
import jortsReference from '../../assets/studio-jorts/reference.jpg';
import jortsMockup from '../../assets/studio-jorts/mockup.json';

interface GarmentPart {
  id: string;
  name: string;
  svg: string;
  color: string;
  area: number;
}

interface GarmentTraceResult {
  source: string;
  parts: GarmentPart[];
  lineArtSvg: string;
  partCount: number;
}

const DEMO = jortsMockup as unknown as GarmentTraceResult;

const STEP_ICONS: Record<number, LucideIcon> = {
  1: Ruler,
  2: Palette,
  3: CircleDot,
  4: Scissors,
  5: Layers,
  6: Pocket,
  7: Droplets,
  8: Link2,
  9: ImageIcon,
  10: Tag,
  11: Package,
  12: Hash,
  13: FileCheck,
};

const SHORTS_STEPS = builderSteps.filter(
  (step) => !step.skipForGarmentTypes?.includes('shorts'),
);

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

function inlineSvg(raw: string): string {
  return raw
    .replace(/width="2048"/i, 'width="100%"')
    .replace(/height="2048"/i, 'height="100%"');
}

function constructionInk(raw: string, color: string): string {
  return inlineSvg(raw.replace(/#141414/gi, color).replace(/#000000/gi, 'none'));
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.slice(value.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Could not read that image'));
    reader.readAsDataURL(file);
  });
}

async function traceGarment(
  file: File,
  onProgress: (label: string) => void,
): Promise<GarmentTraceResult> {
  const response = await fetch('/api/garment-from-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: await fileToBase64(file), fileName: file.name }),
  });
  if (!response.body) throw new Error(`Garment trace failed (${response.status})`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: GarmentTraceResult | null = null;
  let error = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = done ? '' : (lines.pop() ?? '');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as {
          type?: string;
          label?: string;
          error?: string;
          source?: string;
          parts?: GarmentPart[];
          lineArtSvg?: string;
          partCount?: number;
        };
        if (event.type === 'progress') onProgress(event.label || 'Processing');
        else if (event.type === 'result' && event.parts && event.lineArtSvg) {
          result = {
            source: event.source || 'local-seam-trace',
            parts: event.parts,
            lineArtSvg: event.lineArtSvg,
            partCount: event.partCount || event.parts.length,
          };
        } else if (event.type === 'error') {
          error = event.error || 'Garment trace failed';
        }
      } catch {
        /* ignore non-NDJSON */
      }
    }
    if (done) break;
  }
  if (error) throw new Error(error);
  if (!result) throw new Error('Garment trace returned no colour regions');
  return result;
}

function CircularProgress({ value }: { value: number }) {
  const radius = 15;
  const stroke = 3;
  const vb = 38;
  const c = vb / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={vb} height={vb} viewBox={`0 0 ${vb} ${vb}`} className="shrink-0" aria-hidden>
      <circle cx={c} cy={c} r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
      <circle
        cx={c}
        cy={c}
        r={radius}
        stroke="#CC2D24"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  );
}

export function GarmentPhotoTest() {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef('');
  const [stepId, setStepId] = useState(2);
  const [visited, setVisited] = useState<number[]>([1, 2]);
  const [fit, setFit] = useState<'slim' | 'boxy'>('slim');
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');
  const [showFront, setShowFront] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [previewBackground, setPreviewBackground] = useState<'black' | 'white' | 'transparent'>('black');
  const [previewZoom, setPreviewZoom] = useState(100);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<GarmentTraceResult>(DEMO);
  const [history, setHistory] = useState<GarmentPart[][]>([DEMO.parts]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [referenceUrl, setReferenceUrl] = useState(jortsReference);

  const stepIndex = SHORTS_STEPS.findIndex((item) => item.id === stepId);
  const step = SHORTS_STEPS[Math.max(0, stepIndex)] ?? SHORTS_STEPS[0];
  const progress = Math.round(((Math.max(0, stepIndex) + 1) / SHORTS_STEPS.length) * 100);

  const renderedParts = useMemo(
    () => result.parts.map((part) => ({
      ...part,
      markup: tintPotraceSvg(part.svg, part.color, 'solid'),
    })),
    [result],
  );

  const previewSurfaceStyle =
    previewBackground === 'transparent'
      ? {
          backgroundColor: 'transparent' as const,
          backgroundImage:
            'linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a), linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px',
        }
      : { backgroundColor: previewBackground === 'white' ? '#FFFFFF' : '#000000' };

  function goTo(id: number) {
    setStepId(id);
    setVisited((current) => (current.includes(id) ? current : [...current, id]));
  }

  function goNext() {
    const next = SHORTS_STEPS[stepIndex + 1];
    if (next) goTo(next.id);
  }

  function goBack() {
    const prev = SHORTS_STEPS[stepIndex - 1];
    if (prev) goTo(prev.id);
  }

  function commitParts(parts: GarmentPart[]) {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(parts);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setResult((current) => ({ ...current, parts }));
  }

  function updateColor(id: string, color: string) {
    commitParts(result.parts.map((part) => (part.id === id ? { ...part, color } : part)));
  }

  function undo() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setResult((current) => ({ ...current, parts: history[nextIndex] }));
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setResult((current) => ({ ...current, parts: history[nextIndex] }));
  }

  async function onFile(file?: File) {
    if (!file || busy) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setReferenceUrl(objectUrlRef.current);
    setBusy(true);
    setError('');
    setStatus('Preparing full garment');
    try {
      const next = await traceGarment(file, setStatus);
      setResult(next);
      setHistory([next.parts]);
      setHistoryIndex(0);
      goTo(2);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Garment trace failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="builder-surface flex h-[100dvh] min-h-0 max-w-[100vw] flex-col overflow-hidden bg-[#09090B]">
      <header className="relative flex flex-wrap items-center gap-2 border-b border-white/[0.09] bg-[#0c0c0c] px-2 py-2 sm:gap-3 sm:px-4 sm:py-2.5 md:px-5">
        <Button
          variant="ghost"
          size="sm"
          asChild
          aria-label="Back to studio"
          className="h-8 w-8 shrink-0 p-0 !text-white/60 hover:bg-white/10 hover:!text-white sm:h-7 sm:w-auto sm:px-2 sm:text-[10px]"
        >
          <Link to="/studio">
            <ChevronLeft className="h-4 w-4 sm:mr-1 sm:h-3 sm:w-3" />
            <span className="hidden sm:inline">BACK</span>
          </Link>
        </Button>

        <div className="order-last flex min-w-0 flex-1 basis-full flex-col items-center justify-center gap-1 sm:order-none sm:basis-auto sm:flex-row sm:gap-3">
          <div className="truncate text-center text-[13px] font-semibold text-white">
            Denim shorts — All Parts
          </div>
          <div className="hidden h-5 w-px bg-white/10 sm:block" />
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider sm:px-2.5',
                showDetails
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'text-white/55 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-[#252528] bg-white/[0.04] p-0.5">
              {(['black', 'white', 'transparent'] as const).map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setPreviewBackground(bg)}
                  title={bg}
                  aria-label={`Background ${bg}`}
                  className={cn(
                    'h-5 w-5 shrink-0 rounded border',
                    previewBackground === bg
                      ? 'border-[#FF3B30] ring-1 ring-[#FF3B30]'
                      : 'border-[#3A3A40] hover:border-white/30',
                  )}
                  style={
                    bg === 'transparent'
                      ? {
                          backgroundImage:
                            'linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%, #666), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%, #666)',
                          backgroundSize: '8px 8px',
                          backgroundPosition: '0 0, 4px 4px',
                        }
                      : { backgroundColor: bg === 'white' ? '#FFFFFF' : '#000000' }
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
            aria-label="Undo"
            className="h-8 w-8 shrink-0 p-0 !text-white/70 hover:!text-white disabled:opacity-30"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            aria-label="Redo"
            className="h-8 w-8 shrink-0 p-0 !text-white/70 hover:!text-white disabled:opacity-30"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Version history"
            className="h-8 w-8 shrink-0 p-0 !text-white/70 hover:!text-white"
          >
            <History className="h-4 w-4" />
          </Button>
          <span className="text-[9px] font-medium uppercase tracking-wider text-white/35">Saved</span>
          <button
            type="button"
            onClick={() => goTo(13)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-black hover:bg-white/90"
          >
            <FileCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
            Review
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className="hidden w-[4.5rem] shrink-0 flex-col bg-[#09090B] py-2 md:flex md:w-[5rem] lg:w-[5.75rem]"
          aria-label="Builder steps"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden pb-3 pl-1.5 pr-0">
            {SHORTS_STEPS.map((item) => {
              const current = stepId === item.id;
              const StepIcon = STEP_ICONS[item.id] ?? Hash;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item.id)}
                  title={item.title}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'group relative flex w-full shrink-0 flex-col items-center gap-1 px-1 py-2.5 text-center',
                    current
                      ? 'rounded-l-lg bg-[#09090B] text-white'
                      : 'mr-1.5 rounded-lg text-white/60 hover:bg-white/[0.04] hover:text-white',
                  )}
                >
                  <StepIcon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 md:h-5 md:w-5',
                      current ? 'text-[#CC2D24]' : 'text-white/55',
                    )}
                    strokeWidth={1.75}
                  />
                  <span className="max-w-[4.75rem] text-[7.5px] font-semibold uppercase leading-tight tracking-[0.06em] md:max-w-none md:text-[9px]">
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex w-[min(100%,22rem)] shrink-0 flex-col border-r border-[#252528] bg-[#09090B] max-sm:absolute max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:z-30 max-sm:h-[46%] max-sm:w-auto max-sm:rounded-t-2xl max-sm:border-t">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
            <div className="mb-4 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24] md:text-[10px]">
              {step.title}
            </div>
            <p className="mb-4 text-[11px] leading-relaxed text-white/45">{step.description}</p>

            {step.id === 1 ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/60">Fit type</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['slim', 'boxy'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFit(option)}
                        className={cn(
                          'h-9 rounded-xl border text-[11px] font-semibold capitalize',
                          fit === option
                            ? 'border-[#CC2D24] bg-[#CC2D24]/10 text-white'
                            : 'border-[#3A3A40] bg-white/[0.04] text-white/70 hover:text-white',
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/60">Measurement unit</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cm', 'in'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setUnit(option)}
                        className={cn(
                          'h-9 rounded-xl border text-[11px] font-semibold uppercase',
                          unit === option
                            ? 'border-[#CC2D24] bg-[#CC2D24]/10 text-white'
                            : 'border-[#3A3A40] bg-white/[0.04] text-white/70 hover:text-white',
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-white/40">
                  This test uses the traced denim shorts mockup. Measurement callouts stay on the canvas when details are shown.
                </p>
              </div>
            ) : null}

            {step.id === 2 ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-white/60">Photo reference</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => inputRef.current?.click()}
                      className="text-[10px] font-semibold uppercase tracking-wider text-[#E5534A]"
                    >
                      Replace
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-[#252528] bg-white">
                    <img src={referenceUrl} alt="Denim shorts reference" className="aspect-[4/3] w-full object-contain" />
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => onFile(event.target.files?.[0])}
                  />
                </div>
                {busy ? <p className="text-[11px] text-white/70">{status}</p> : null}
                {error ? <p className="text-[11px] text-[#FF6B63]">{error}</p> : null}
                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-white/60">
                    Part colours · {result.partCount}
                  </div>
                  <div className="space-y-1.5">
                    {result.parts.map((part) => (
                      <label
                        key={part.id}
                        className="flex items-center gap-3 rounded-xl border border-[#252528] bg-white/[0.04] p-2.5"
                      >
                        <input
                          type="color"
                          value={part.color}
                          onChange={(event) => updateColor(part.id, event.target.value)}
                          className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-medium text-white">{part.name}</span>
                          <span className="text-[9px] uppercase tracking-wider text-white/35">{part.color}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {step.id !== 1 && step.id !== 2 && step.id !== 13 ? (
              <p className="text-[11px] leading-relaxed text-white/40">
                This photo test is focused on the traced denim shorts mockup and part colours. Later builder steps stay in the rail so the page matches the normal process.
              </p>
            ) : null}

            {step.id === 13 ? (
              <div className="space-y-3 text-[11px] text-white/70">
                <div className="flex justify-between border-b border-[#252528] pb-2">
                  <span className="text-white/40">Garment</span>
                  <span>Denim shorts</span>
                </div>
                <div className="flex justify-between border-b border-[#252528] pb-2">
                  <span className="text-white/40">Fit</span>
                  <span className="capitalize">{fit}</span>
                </div>
                <div className="flex justify-between border-b border-[#252528] pb-2">
                  <span className="text-white/40">Colour parts</span>
                  <span>{result.partCount}</span>
                </div>
                <div className="flex justify-between pb-2">
                  <span className="text-white/40">Source</span>
                  <span>Local raster → Potrace</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-[#252528] bg-[#09090B]/50 px-4 pb-4 pt-3.5">
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={goBack}
                disabled={stepIndex <= 0}
                className="h-9 flex-1 rounded-xl border-[#3A3A40] bg-white/[0.04] text-[11px] font-semibold !text-white hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronLeft className="mr-0.5 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={goNext}
                disabled={stepIndex >= SHORTS_STEPS.length - 1}
                className="h-9 flex-1 rounded-xl bg-[#CC2D24] text-[11px] font-semibold hover:bg-[#CC2D24]/90"
              >
                Continue
                <ChevronRight className="ml-0.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col max-sm:pb-[46%]" style={previewSurfaceStyle}>
          <div className="pointer-events-none absolute right-3 top-3 z-[38] flex flex-col gap-1">
            <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-[#252528] bg-black/45 p-1 shadow-[0_6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <button
                type="button"
                onClick={() => setShowFront(true)}
                className={cn(
                  'flex min-h-[2rem] min-w-[2.85rem] flex-col items-center justify-center rounded-lg px-2 py-1 text-[8px] font-bold uppercase tracking-wide',
                  showFront ? 'bg-[#CC2D24] text-white' : 'text-white/60 hover:bg-white/10 hover:text-white',
                )}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setShowFront(false)}
                className={cn(
                  'flex min-h-[2rem] min-w-[2.85rem] flex-col items-center justify-center rounded-lg px-2 py-1 text-[8px] font-bold uppercase tracking-wide',
                  !showFront ? 'bg-[#CC2D24] text-white' : 'text-white/60 hover:bg-white/10 hover:text-white',
                )}
              >
                Back
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-8">
            <div
              className="relative h-full w-full max-w-[720px]"
              style={{
                transform: `scale(${previewZoom / 100})${showFront ? '' : ' scaleX(-1)'}`,
                transformOrigin: 'center center',
              }}
            >
              {renderedParts.map((part) => (
                <div
                  key={part.id}
                  className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: part.markup }}
                />
              ))}
              <div
                className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{
                  __html: constructionInk(
                    result.lineArtSvg,
                    previewBackground === 'white' ? '#141414' : '#8EB4FF',
                  ),
                }}
              />
              {showDetails ? (
                <div className="pointer-events-none absolute left-6 top-[18%] text-[8px] font-bold uppercase tracking-wider text-[#CC2D24]">
                  Waistband
                </div>
              ) : null}
            </div>
            {!showFront ? (
              <div className="pointer-events-none absolute bottom-24 rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[9px] uppercase tracking-wider text-white/70">
                Mirrored front until a back photo is uploaded
              </div>
            ) : null}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[36] flex flex-wrap items-end justify-between gap-1.5 px-3 pb-3">
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-[#252528] bg-black/55 px-2.5 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <button
                type="button"
                aria-label="Zoom out"
                className="flex h-8 w-8 items-center justify-center text-white/80 hover:text-white"
                onClick={() => setPreviewZoom((zoom) => Math.max(ZOOM_MIN, zoom - 10))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                aria-label="Canvas zoom"
                className="h-1 w-[5.5rem] cursor-pointer accent-[#CC2D24]"
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                value={previewZoom}
                onChange={(event) => setPreviewZoom(Number(event.target.value))}
              />
              <button
                type="button"
                aria-label="Zoom in"
                className="flex h-8 w-8 items-center justify-center text-white/80 hover:text-white"
                onClick={() => setPreviewZoom((zoom) => Math.min(ZOOM_MAX, zoom + 10))}
              >
                <Plus className="h-4 w-4" />
              </button>
              <span className="min-w-[2.75rem] text-center text-[11px] font-semibold tabular-nums text-white/75">
                {previewZoom}%
              </span>
            </div>
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-[#252528] bg-black/55 px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <CircularProgress value={progress} />
              <div>
                <div className="text-xs font-bold tabular-nums text-white">{progress}%</div>
                <div className="text-[8px] font-semibold uppercase tracking-wider text-white/35">Complete</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
