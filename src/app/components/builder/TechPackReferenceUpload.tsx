import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';

/**
 * First step for “tech pack spec” flow: attach reference artwork / files without using the on-garment editor.
 */
export function TechPackReferenceUpload({
  fileNamesText,
  notes,
  onFileNamesChange,
  onNotesChange,
}: {
  fileNamesText: string;
  notes: string;
  onFileNamesChange: (names: string) => void;
  onNotesChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      <div>
        <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
          Upload design files
        </Label>
        <p className="mb-3 text-[11px] leading-relaxed text-white/45">
          Add logos, flat sketches, PDFs, or references for your factory. This step replaces on-shirt placement
          editing — you’ll still complete measurements and construction in the following steps.
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          multiple
          accept="image/*,.pdf,.ai,.eps,.svg,application/pdf"
          onChange={(e) => {
            const files = e.target.files;
            if (!files?.length) {
              onFileNamesChange('');
              return;
            }
            onFileNamesChange(
              Array.from(files)
                .map((f) => f.name)
                .join(', '),
            );
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/18 bg-white/[0.04] px-4 py-8 text-[11px] font-medium text-white/70 transition hover:border-white/28 hover:bg-white/[0.07]',
          )}
        >
          <Upload className="h-5 w-5 shrink-0 text-[#CC2D24]" strokeWidth={2} />
          <span>Choose files (images, PDF, AI/EPS)</span>
        </button>
        {fileNamesText ? (
          <p className="mt-2 text-[10px] leading-relaxed text-white/45">
            <span className="font-semibold text-white/55">Selected: </span>
            {fileNamesText}
          </p>
        ) : (
          <p className="mt-2 text-[10px] text-white/35">No files selected yet.</p>
        )}
      </div>

      <div>
        <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
          Notes for your tech pack
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="min-h-[100px] border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
          placeholder="Placement notes, colour callouts, print method, or anything your manufacturer should know…"
        />
      </div>
    </div>
  );
}
