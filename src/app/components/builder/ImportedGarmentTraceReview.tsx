import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import type { ImportedInputDetection, ImportedInputType, ImportedTracePreview } from '../../data/importedGarment';

export function readGarmentImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

export function useGarmentInputType(file: File | null) {
  const [type, setType] = useState<ImportedInputType>('auto');
  const [manual, setManual] = useState(false);
  const [revision, setRevision] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const [reason, setReason] = useState('Clean drawings are traced directly; photos use the separate redraw route.');
  useEffect(() => {
    if (!file || manual) { setDetecting(false); return; }
    const controller = new AbortController();
    setType('auto');
    setDetecting(true);
    void (async () => {
      try {
        if (file.size > 12 * 1024 * 1024 || !/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Choose a PNG, JPEG or WebP under 12 MB.');
        const imageBase64 = await readGarmentImage(file);
        if (controller.signal.aborted) return;
        const response = await fetch('/api/garment-input-type', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64 }), signal: controller.signal });
        if (!response.ok) throw new Error('Automatic detection unavailable. Choose an input type explicitly.');
        const detected = await response.json() as ImportedInputDetection;
        if (!['photo', 'trace-only'].includes(detected.mode) || typeof detected.reason !== 'string' || !Number.isFinite(detected.confidence)) throw new Error('Could not determine input type. Choose it explicitly.');
        if (!controller.signal.aborted) {
          setType(detected.mode);
          setReason(`Auto-detected: ${detected.mode === 'trace-only' ? 'Technical drawing' : 'Photo / reference'} (${Math.round(detected.confidence * 100)}% confidence). ${detected.reason} ${detected.confidence < 0.8 ? 'Uncertain: check the input type before processing.' : 'You can override this selection.'}`);
        }
      } catch (error) {
        if (!controller.signal.aborted) setReason(error instanceof Error ? error.message : 'Choose an input type explicitly.');
      } finally { if (!controller.signal.aborted) setDetecting(false); }
    })();
    return () => controller.abort();
  }, [file, manual, revision]);
  return { type, requestType: manual ? type : 'auto' as ImportedInputType, detecting, reason, choose: (next: ImportedInputType) => {
    setType(next); setManual(next !== 'auto'); setRevision(value => value + 1);
    setReason(next === 'trace-only' ? 'Trace only: the uploaded drawing is authoritative. No AI redraw or reconstruction.'
      : next === 'photo' ? 'Photo mode: create a black-and-white construction raster, then key white and trace.' : 'Detecting the selected image locally.');
  } };
}

export function GarmentInputTypeControl({ label = 'Input type', control, disabled = false }: {
  label?: string; control: ReturnType<typeof useGarmentInputType>; disabled?: boolean;
}) {
  return <div className="space-y-1">
    <label className="block">{label}<select aria-label={label} className="mt-1 w-full rounded border border-white/20 bg-[#202024] px-2 py-1.5 text-xs text-white"
      value={control.type} disabled={disabled} onChange={event => control.choose(event.target.value as ImportedInputType)}>
      <option value="auto">Automatic detection</option>
      <option value="photo">Photo / reference (redraw)</option>
      <option value="trace-only">Clean mockup / technical drawing (trace only)</option>
    </select></label>
    <p className="text-white/60" role="status">{control.detecting ? 'Checking whether the upload is already clean line art…' : control.reason}</p>
  </div>;
}

export function ImportedGarmentTraceReview({ preview, open, onOpenChange, traceOnly }: {
  preview: ImportedTracePreview; open: boolean; onOpenChange: (open: boolean) => void; traceOnly: boolean;
}) {
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.tracedSvg)}`;
  const images = [
    ['Source raster', preview.sourceRaster], [traceOnly ? 'Cleaned raster' : 'Clean technical redraw', preview.cleanedRaster],
    ['Keyed line art', preview.keyedRaster], ['Traced SVG', svgUrl], ['Overlay comparison', preview.overlayRaster],
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-6xl overflow-auto border-white/20 bg-[#171719] text-white">
    <DialogTitle>{traceOnly ? 'Trace-only source fidelity review' : 'Photo raster and SVG review'}</DialogTitle>
    <DialogDescription className="text-xs text-white/60">{traceOnly ? 'The original drawing is traced without redrawing or changing garment geometry.' : 'The photograph is analysed and redrawn by Azure as a clean technical flat before the shared tracing stage. Compare its construction with the original photo; the overlay checks the SVG against the technical redraw, not the photo.'} White is keyed with a smooth luminance ramp. The SVG keeps the raster pixel-size viewBox.</DialogDescription>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {images.map(([label, src]) => <figure key={label} className="min-w-0"><figcaption className="mb-2 text-xs font-semibold">{label}</figcaption>
        <div className="overflow-auto rounded border border-white/20 bg-[#eee]" style={label === 'Keyed line art' ? { backgroundImage: 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%)', backgroundSize: '16px 16px' } : undefined}>
          <img alt={label} src={src} className="h-auto max-h-[65vh] w-full object-contain" />
        </div></figure>)}
    </div>
    <button className="text-left text-xs underline" onClick={() => {
      const url = URL.createObjectURL(new Blob([preview.tracedSvg], { type: 'image/svg+xml' }));
      const link = document.createElement('a'); link.href = url; link.download = 'garment-trace.svg';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Download traced SVG</button>
  </DialogContent></Dialog>;
}
