import { useEffect, useMemo, useState } from 'react';
import { Camera, ImageIcon } from 'lucide-react';
import {
  PRODUCTION_STAGE_LABEL,
  PRODUCTION_STAGES,
  listPublishedPhotosForOrder,
  type ProductionPhoto,
  type ProductionStage,
} from '../../data/productionFloor';
import { cn } from '../ui/utils';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

const STAGE_TONE: Record<ProductionStage, string> = {
  cut: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  sew: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  finish: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  pack: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  ship: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  done: 'border-white/15 bg-white/[0.06] text-white/70',
};

function groupPhotosByStage(photos: ProductionPhoto[]) {
  const map = new Map<ProductionStage, ProductionPhoto[]>();
  for (const stage of PRODUCTION_STAGES) map.set(stage, []);
  for (const photo of photos) {
    const list = map.get(photo.stage) ?? [];
    list.push(photo);
    map.set(photo.stage, list);
  }
  return PRODUCTION_STAGES.map((stage) => ({
    stage,
    photos: (map.get(stage) ?? []).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
  })).filter((g) => g.photos.length > 0);
}

export function ProductionQcGallery({
  orderId,
  title = 'Production & QC photos',
  emptyHint = 'No production photos published yet.',
  className,
}: {
  orderId: string;
  title?: string;
  emptyHint?: string;
  className?: string;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onUpdate = () => setTick((n) => n + 1);
    window.addEventListener('ceriga-production-floor', onUpdate);
    return () => window.removeEventListener('ceriga-production-floor', onUpdate);
  }, []);
  void tick;
  const photos = listPublishedPhotosForOrder(orderId);
  return (
    <ProductionQcGalleryView
      photos={photos}
      title={title}
      emptyHint={emptyHint}
      className={className}
    />
  );
}

export function ProductionQcGalleryView({
  photos,
  title = 'Production & QC photos',
  emptyHint = 'No production photos published yet.',
  className,
}: {
  photos: ProductionPhoto[];
  title?: string;
  emptyHint?: string;
  className?: string;
}) {
  const groups = useMemo(() => groupPhotosByStage(photos), [photos]);

  if (photos.length === 0) {
    return (
      <section
        className={cn(
          'rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-5 text-center',
          className,
        )}
      >
        <ImageIcon className="mx-auto h-5 w-5 text-white/20" />
        <p className="mt-1.5 text-[12px] text-white/45">{emptyHint}</p>
      </section>
    );
  }

  return (
    <section className={cn('rounded-xl border border-white/[0.08] bg-[#111113] p-3.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5 text-[#CC2D24]" />
          <h2 className="text-[13px] font-semibold text-white">{title}</h2>
        </div>
        <p className="text-[10px] tabular-nums text-white/35">
          {photos.length} · {groups.length} stage{groups.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mt-3 space-y-3">
        {groups.map(({ stage, photos: stagePhotos }) => (
          <div key={stage}>
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className={cn(
                  'rounded border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider',
                  STAGE_TONE[stage],
                )}
              >
                {PRODUCTION_STAGE_LABEL[stage]}
              </span>
              <span className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-[9px] tabular-nums text-white/35">{stagePhotos.length}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {stagePhotos.map((p) => (
                <figure
                  key={p.id}
                  className="w-[132px] overflow-hidden rounded-lg border border-white/[0.08] bg-black/30"
                >
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={p.url}
                      alt={p.caption}
                      className="aspect-square w-full object-cover transition hover:opacity-95"
                    />
                  </a>
                  <figcaption className="space-y-0.5 px-2 py-1.5">
                    <p className="truncate text-[11px] font-medium leading-tight text-white">
                      {p.caption}
                    </p>
                    <p className="truncate text-[9px] text-white/40">
                      {formatWhen(p.uploadedAt)}
                      {p.uploadedBy ? ` · ${p.uploadedBy.split(' ')[0]}` : ''}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
