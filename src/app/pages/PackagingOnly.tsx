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
    <div className="min-h-dvh overflow-x-hidden bg-[#0F0F0F]">
      <div className="border-b border-white/10 px-4 pb-3 pt-4 sm:px-5 md:px-7">
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
          Labels & packaging
        </h1>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/50 sm:text-sm">
          Design polybag artwork, neck labels, and notes — then continue to delivery. No garment or tech pack required.
        </p>
      </div>

      <div className="p-4 pb-28 sm:p-5 md:px-7 md:py-6 lg:pb-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="flex min-w-0 flex-1 justify-center overflow-visible rounded-[14px] border border-white/10 bg-black/30 p-4 sm:p-6">
            <PackagingPreview
              color={packagingBaseColor}
              elements={packaging}
              onElementsChange={setPackaging}
              selectedId={packagingLayerSelectedId}
              onSelectedIdChange={setPackagingLayerSelectedId}
            />
          </div>
          <div className="w-full min-w-0 shrink-0 lg:max-w-md">
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
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur-md lg:static lg:mx-auto lg:mt-8 lg:max-w-6xl lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-0">
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
    </div>
  );
}
