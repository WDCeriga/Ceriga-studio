import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import {
  LabelsPackagingStep,
  PackagingPreview,
} from '../components/builder/LabelsPackagingStep';
import type { DesignElement } from '../components/builder/PrintsDesignStep';
import { Button } from '../components/ui/button';

export function PackagingOnly() {
  const navigate = useNavigate();
  const [packaging, setPackaging] = useState<DesignElement[]>([]);
  const [packagingType, setPackagingType] = useState('polybag');
  const [notes, setNotes] = useState('');
  const [packagingLayerSelectedId, setPackagingLayerSelectedId] = useState<string | null>(null);
  const [packagingBaseColor, setPackagingBaseColor] = useState('#F5F5F5');

  return (
    <div className="flex h-[calc(100dvh-4.35rem-env(safe-area-inset-top,0px))] min-h-0 w-full flex-col overflow-hidden bg-[#0F0F0F] lg:h-[100dvh] lg:max-h-[100dvh]">
      <div className="shrink-0 border-b border-white/10 px-4 pb-3 pt-4 sm:px-5 md:px-7">
        <Link
          to="/studio"
          className="mb-3 inline-flex items-center gap-2 text-[11px] font-medium text-white/45 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Studio
        </Link>
        <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">
          Packaging designer
        </div>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase leading-tight tracking-[-0.03em] text-white sm:text-[1.65rem]">
          Packaging
        </h1>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/50 sm:text-sm">
          Design polybag artwork, neck labels, and notes — then continue to delivery. No garment or tech pack required.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pb-28 sm:p-5 md:px-7 md:py-6 lg:pb-4">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch lg:gap-8">
          {/*
            Phone / narrow: lock preview height so the canvas stays on screen; only the sidebar scrolls.
            lg+: previous split — preview and panel share height, each scrolls internally if needed.
          */}
          <div className="flex max-h-[min(40dvh,280px)] min-h-0 w-full shrink-0 items-center justify-center overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-[14px] border border-white/10 bg-black/30 p-3 sm:max-h-[min(42dvh,300px)] sm:p-4 lg:max-h-none lg:min-h-0 lg:flex-1 lg:p-6">
            <PackagingPreview
              color={packagingBaseColor}
              elements={packaging}
              onElementsChange={setPackaging}
              selectedId={packagingLayerSelectedId}
              onSelectedIdChange={setPackagingLayerSelectedId}
            />
          </div>
          <aside className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-2 lg:max-h-full lg:max-w-md lg:shrink-0 lg:overflow-y-auto lg:pb-0 lg:pr-0.5">
            <LabelsPackagingStep
              subStep="packaging"
              elements={packaging}
              onElementsChange={setPackaging}
              notes={notes}
              onNotesChange={setNotes}
              planValue={packagingType}
              onPlanChange={(v) => {
                setPackagingType(v);
                if (v === 'none') {
                  setPackaging([]);
                  setPackagingLayerSelectedId(null);
                }
              }}
              selectedLayerId={packagingLayerSelectedId}
              onSelectedLayerIdChange={setPackagingLayerSelectedId}
              previewBaseColor={packagingBaseColor}
              onPreviewBaseColorChange={setPackagingBaseColor}
            />
          </aside>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 shrink-0 border-t border-white/10 bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur-md lg:static lg:z-0 lg:border-t lg:border-white/10 lg:bg-[#0F0F0F] lg:px-4 lg:py-3 lg:backdrop-blur-0">
        <div className="mx-auto flex max-w-6xl gap-3 lg:justify-end">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-white/15 text-white/85 hover:bg-white/5 lg:flex-none"
            asChild
          >
            <Link to="/studio">Back</Link>
          </Button>
          <Button
            type="button"
            className="flex-[2] bg-[#CC2D24] font-semibold hover:bg-[#CC2D24]/90 lg:flex-none lg:min-w-[200px]"
            onClick={() =>
              navigate('/delivery', {
                state: { from: 'packaging' },
              })
            }
          >
            Continue to delivery
          </Button>
        </div>
      </div>
    </div>
  );
}
