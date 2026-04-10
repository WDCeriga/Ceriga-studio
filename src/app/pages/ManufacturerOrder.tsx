import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Upload, ArrowLeft } from 'lucide-react';

export function ManufacturerOrder() {
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('productId') || '';
  const [files, setFiles] = useState<File[]>([]);
  const [quantity, setQuantity] = useState('');
  const [timeline, setTimeline] = useState('');
  const [notes, setNotes] = useState('');

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0A0A0B] px-4 py-6 sm:px-6 md:px-8">
      <Link
        to="/studio"
        className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-white/45 transition-colors hover:text-white/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Studio
      </Link>

      <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#CC2D24]">Manufacturing</p>
      <h1 className="mb-2 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold tracking-tight text-[#F2F0EC]">
        Order with your tech pack
      </h1>
      <p className="mb-8 max-w-xl text-sm leading-relaxed text-white/45">
        Upload your existing tech pack (PDF, images, or spec sheets). Our team will review and quote. Add quantity,
        target dates, and any factory preferences below.
      </p>

      {productId ? (
        <p className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/55">
          Linked product reference: <span className="font-mono text-white/80">{productId}</span>
        </p>
      ) : null}

      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <Label className="mb-2 block text-[10px] uppercase tracking-wider text-white/50">Tech pack files</Label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-black/30 px-6 py-10 transition-colors hover:border-[#CC2D24]/40 hover:bg-white/[0.03]">
            <Upload className="h-8 w-8 text-white/35" />
            <span className="text-center text-sm text-white/55">Tap or click to upload PDF, PNG, or ZIP</span>
            <input type="file" multiple accept=".pdf,image/*,.zip" className="hidden" onChange={onFileChange} />
          </label>
          {files.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-xs text-white/60">
              {files.map((f) => (
                <li key={f.name + f.size} className="truncate">
                  {f.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="mo-qty" className="mb-2 block text-[10px] uppercase tracking-wider text-white/50">
              Quantity (units)
            </Label>
            <Input
              id="mo-qty"
              inputMode="numeric"
              placeholder="e.g. 500"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-10 border-white/12 bg-black/40 text-white placeholder:text-white/30"
            />
          </div>
          <div>
            <Label htmlFor="mo-time" className="mb-2 block text-[10px] uppercase tracking-wider text-white/50">
              Target delivery
            </Label>
            <Input
              id="mo-time"
              placeholder="e.g. June 2026"
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              className="h-10 border-white/12 bg-black/40 text-white placeholder:text-white/30"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="mo-notes" className="mb-2 block text-[10px] uppercase tracking-wider text-white/50">
            Notes for production
          </Label>
          <Textarea
            id="mo-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Fabric substitutions, label placement, shipping regions…"
            className="min-h-[100px] border-white/12 bg-black/40 text-sm text-white placeholder:text-white/30"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            className="h-10 bg-[#CC2D24] text-sm font-semibold hover:bg-[#CC2D24]/90"
            asChild
          >
            <Link
              to="/delivery"
              state={{
                from: 'manufacturer',
                ...(productId ? { productId } : {}),
              }}
            >
              Order — continue to delivery
            </Link>
          </Button>
          <Button type="button" variant="outline" className="h-10 border-white/15 text-white/80 hover:bg-white/5" asChild>
            <Link to="/dashboard">Save as draft (demo)</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
