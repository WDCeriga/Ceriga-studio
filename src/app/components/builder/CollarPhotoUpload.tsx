import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';

export interface CustomCollarResult {
  neckSvg: string;
  bodySvg: string;
  fileName: string;
  source?: string;
  kind?: 'vneck' | 'crew' | 'mock';
  displayName?: string;
}

const STEPS = [
  { id: 'lineart', label: 'Drawing the full collar (several slow passes)' },
  { id: 'key', label: 'Keying white (luminance ramp)' },
  { id: 'place', label: 'Seating on the crew socket' },
  { id: 'potrace', label: 'Closing the ring and tracing SVG' },
];

async function traceCollarFromPhoto(
  file: File,
  onProgress: (step: string, label: string) => void,
): Promise<CustomCollarResult> {
  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read that photo'));
    reader.readAsDataURL(file);
  });

  const response = await fetch('/api/collar-from-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, fileName: file.name }),
  });

  if (!response.ok && !response.body) {
    throw new Error(`Collar trace failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const fallback = (await response.json()) as { error?: string };
    throw new Error(fallback.error || 'Collar trace failed');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let result: CustomCollarResult | null = null;
  let error: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = done ? '' : (lines.pop() ?? '');
    const pending = done ? lines.concat(buffer ? [buffer] : []) : lines;
    for (const line of pending) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: {
        type?: string;
        step?: string;
        label?: string;
        error?: string;
        neckSvg?: string;
        bodySvg?: string;
        source?: string;
        kind?: 'vneck' | 'crew' | 'mock';
        displayName?: string;
      };
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (event.type === 'progress' && event.step) {
        onProgress(event.step, event.label || event.step);
      } else if (event.type === 'result' && event.neckSvg && event.bodySvg) {
        result = {
          neckSvg: event.neckSvg,
          bodySvg: event.bodySvg,
          fileName: file.name,
          source: event.source,
          kind: event.kind,
          displayName: event.displayName,
        };
      } else if (event.type === 'error') {
        error = event.error || 'Collar trace failed';
      }
    }
    if (done) break;
  }

  if (error) throw new Error(error);
  if (!result) throw new Error('Collar trace returned no SVG');
  return result;
}

export function CollarPhotoUpload({
  disabled,
  disabledReason,
  busy,
  onBusyChange,
  onTraced,
}: {
  disabled?: boolean;
  disabledReason?: string;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onTraced: (collar: CustomCollarResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  async function onFile(file: File | undefined) {
    if (!file || disabled || busy) return;
    setError(null);
    setStep('lineart');
    setLabel(STEPS[0].label);
    onBusyChange?.(true);
    try {
      const traced = await traceCollarFromPhoto(file, (nextStep, nextLabel) => {
        setStep(nextStep);
        setLabel(nextLabel);
      });
      onTraced(traced);
      setStep(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Collar trace failed');
      setStep(null);
    } finally {
      onBusyChange?.(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
        From a photo
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-md border px-2.5 py-2.5 text-center transition sm:rounded-lg',
          disabled
            ? 'cursor-not-allowed border-[#252528] bg-white/5 text-white/35'
            : busy
              ? 'border-[#FF3B30]/40 bg-[#FF3B30]/10 text-white'
              : 'border-[#252528] bg-white/5 text-white/80 hover:border-white/20 hover:text-white',
        )}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        <span className="text-[10px] font-medium leading-snug sm:text-[11px]">
          {busy ? label || 'Tracing collar…' : 'Upload collar photo'}
        </span>
      </button>
      {busy ? (
        <div className="mt-2 space-y-1">
          {STEPS.map((entry, index) => (
            <div
              key={entry.id}
              className={cn(
                'text-[10px]',
                index < stepIndex
                  ? 'text-white/50'
                  : index === stepIndex
                    ? 'text-[#FF3B30]'
                    : 'text-white/25',
              )}
            >
              {index < stepIndex ? 'Done — ' : index === stepIndex ? 'Now — ' : ''}
              {entry.label}
            </div>
          ))}
        </div>
      ) : null}
      {disabled && disabledReason ? (
        <p className="mt-1.5 text-[10px] leading-snug text-white/40">{disabledReason}</p>
      ) : (
        <p className="mt-1.5 text-[10px] leading-snug text-white/40">
          Takes a little longer on purpose: several drawing passes, then the neckline is closed and traced. Polo and button-down collars are included — you do not need a perfect crop.
        </p>
      )}
      {error ? <p className="mt-1.5 text-[10px] leading-snug text-[#FF3B30]">{error}</p> : null}
    </div>
  );
}
