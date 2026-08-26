import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Upload, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { createOrderFromSubmit } from '../data/userOrders';

export function ManufacturerOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('productId') || '';
  const [files, setFiles] = useState<File[]>([]);
  const [quantity, setQuantity] = useState('');
  const [timeline, setTimeline] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const handleSubmitQuote = async () => {
    if (files.length === 0) {
      toast.error('Upload at least one tech pack file');
      return;
    }
    setSubmitting(true);
    try {
      const order = await createOrderFromSubmit({
        productId: productId || undefined,
        productName: files[0]?.name?.replace(/\.[^.]+$/, '') || 'Uploaded tech pack',
        garmentType: 'Uploaded pack',
        kind: 'production',
        quoteRequest: {
          fileNames: files.map((f) => f.name),
          quantity: quantity.trim() || undefined,
          timeline: timeline.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        files,
      });
      toast.success('Quote request submitted');
      navigate(`/orders/${order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit quote request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ceriga-page mx-auto max-w-[720px] px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
      <Link
        to="/create"
        className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-[#8A8A90] transition-colors hover:text-[#F0EEEE]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Create
      </Link>

      <div className="mb-8">
        <div className="ceriga-page-eyebrow">Ceriga quote</div>
        <h1 className="ceriga-page-title">Upload a tech pack for a quote</h1>
        <p className="ceriga-page-sub">
          Send your existing tech pack (PDF, images, or spec sheets). Our team will review and quote
          samples or production — no need to rebuild it in the builder. Add quantity, target dates,
          and notes below.
        </p>
      </div>

      {productId ? (
        <p className="mb-6 rounded-[6px] border border-[#252528] bg-[#161618] px-4 py-3 text-xs text-[#8A8A90]">
          Linked product reference:{' '}
          <span className="ceriga-mono text-[#F0EEEE]">{productId}</span>
        </p>
      ) : null}

      <div className="space-y-6">
        <div>
          <Label className="ceriga-mono mb-2 block text-[10px] uppercase tracking-[0.08em] text-[#8A8A90]">
            Tech pack files
          </Label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#333338] bg-[#111113] px-6 py-10 transition-colors hover:border-[#3A3A40] hover:bg-[#1C1C1E]">
            <Upload className="h-8 w-8 text-[#6B6B72]" />
            <span className="text-center text-sm text-[#8A8A90]">
              Tap or click to upload PDF, PNG, or ZIP
            </span>
            <input type="file" multiple accept=".pdf,image/*,.zip" className="hidden" onChange={onFileChange} />
          </label>
          {files.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-xs text-[#A3A3A8]">
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
            <Label
              htmlFor="mo-qty"
              className="ceriga-mono mb-2 block text-[10px] uppercase tracking-[0.08em] text-[#8A8A90]"
            >
              Quantity (units)
            </Label>
            <Input
              id="mo-qty"
              inputMode="numeric"
              placeholder="e.g. 500"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-10 border-[#252528] bg-[#161618] text-[#F0EEEE] placeholder:text-[#6B6B72]"
            />
          </div>
          <div>
            <Label
              htmlFor="mo-time"
              className="ceriga-mono mb-2 block text-[10px] uppercase tracking-[0.08em] text-[#8A8A90]"
            >
              Target delivery
            </Label>
            <Input
              id="mo-time"
              placeholder="e.g. June 2026"
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              className="h-10 border-[#252528] bg-[#161618] text-[#F0EEEE] placeholder:text-[#6B6B72]"
            />
          </div>
        </div>

        <div>
          <Label
            htmlFor="mo-notes"
            className="ceriga-mono mb-2 block text-[10px] uppercase tracking-[0.08em] text-[#8A8A90]"
          >
            Notes for production
          </Label>
          <Textarea
            id="mo-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Fabric substitutions, label placement, shipping regions…"
            className="min-h-[100px] border-[#252528] bg-[#161618] text-sm text-[#F0EEEE] placeholder:text-[#6B6B72]"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmitQuote()}
            className="ceriga-btn-primary h-10 text-[13px] disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit for quote'}
          </button>
          <Link
            to="/projects"
            className="inline-flex h-10 items-center justify-center rounded-[4px] border border-[#3A3A40] px-4 text-[13px] font-medium text-[#F0EEEE] transition-colors hover:border-[#4A4A52] hover:bg-white/[0.03]"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </div>
  );
}
