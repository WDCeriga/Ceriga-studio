import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, RotateCcw, Move } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../components/ui/utils';
import { MeasurementPreview } from '../../components/builder/MeasurementsStep';
import {
  MeasurementGuideOverlay,
  getMeasurementGuideCenter,
  resetMeasurementGuideDefs,
  type MeasurementGuideDef,
  type MeasurementGuideId,
  updateMeasurementGuide,
  useMeasurementGuides,
} from '../../components/builder/measurementGuides';
import {
  MEASUREMENT_GUIDE_CLASS_PHONE,
  PREVIEW_STAGE_CLASS,
} from '../../components/builder/measurementPreviewSizing';

const CANVAS_VIEWBOX = 1000;

export function SuperAdminMeasurementGuides() {
  const guides = useMeasurementGuides();
  const dragRef = useRef<{
    guideId: MeasurementGuideId;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    baseGuide: MeasurementGuideDef;
  } | null>(null);
  const dragListenersRef = useRef<{
    move: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
  } | null>(null);
  const guidesRef = useRef(guides);
  const [selectedGuideId, setSelectedGuideId] = useState<MeasurementGuideId>(
    guides[0]?.id ?? 'halfLength',
  );

  useEffect(() => {
    guidesRef.current = guides;
  }, [guides]);

  useEffect(() => {
    if (!guides.some((guide) => guide.id === selectedGuideId) && guides[0]) {
      setSelectedGuideId(guides[0].id);
    }
  }, [guides, selectedGuideId]);

  useEffect(
    () => () => {
      const listeners = dragListenersRef.current;
      if (listeners) {
        window.removeEventListener('pointermove', listeners.move);
        window.removeEventListener('pointerup', listeners.up);
        window.removeEventListener('pointercancel', listeners.up);
      }
    },
    [],
  );

  const selectedGuide = useMemo(
    () => guides.find((guide) => guide.id === selectedGuideId) ?? guides[0],
    [guides, selectedGuideId],
  );

  const commitGuidePatch = (
    guideId: MeasurementGuideId,
    patch: Partial<Omit<MeasurementGuideDef, 'id' | 'label'>>,
  ) => {
    updateMeasurementGuide(guideId, patch);
  };

  const updateDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const canvas = document.querySelector('#measurement-guide-admin-canvas') as HTMLElement | null;
    const rect = canvas?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    const deltaX = ((event.clientX - drag.startClientX) / rect.width) * CANVAS_VIEWBOX;
    const deltaY = ((event.clientY - drag.startClientY) / rect.height) * CANVAS_VIEWBOX;
    commitGuidePatch(drag.guideId, {
      x1: drag.baseGuide.x1 + deltaX,
      y1: drag.baseGuide.y1 + deltaY,
      x2: drag.baseGuide.x2 + deltaX,
      y2: drag.baseGuide.y2 + deltaY,
      labelX: drag.baseGuide.labelX + deltaX,
      labelY: drag.baseGuide.labelY + deltaY,
    });
  };

  const beginDrag = (guideId: MeasurementGuideId, event: ReactPointerEvent<SVGGElement>) => {
    const guide = guidesRef.current.find((item) => item.id === guideId);
    if (!guide) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedGuideId(guideId);
    dragRef.current = {
      guideId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      baseGuide: { ...guide },
    };
    const handleMove = (moveEvent: PointerEvent) => updateDrag(moveEvent);
    const handleUp = (upEvent: PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== upEvent.pointerId) return;
      dragRef.current = null;
      const listeners = dragListenersRef.current;
      if (listeners) {
        window.removeEventListener('pointermove', listeners.move);
        window.removeEventListener('pointerup', listeners.up);
        window.removeEventListener('pointercancel', listeners.up);
        dragListenersRef.current = null;
      }
    };
    dragListenersRef.current = { move: handleMove, up: handleUp };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const resetAll = () => {
    const listeners = dragListenersRef.current;
    if (listeners) {
      window.removeEventListener('pointermove', listeners.move);
      window.removeEventListener('pointerup', listeners.up);
      window.removeEventListener('pointercancel', listeners.up);
      dragListenersRef.current = null;
      dragRef.current = null;
    }
    resetMeasurementGuideDefs();
    toast.success('Measurement guides reset');
  };

  if (!selectedGuide) {
    return (
      <div className="rounded-2xl border border-[#252528] bg-[#111113] px-6 py-16 text-center">
        <p className="text-sm text-white/50">No measurement guides found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/superadmin/settings"
            className="inline-flex items-center gap-2 text-xs font-medium text-white/45 hover:text-white/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Settings
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Measurement guides
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Drag the guide line or its handles to align the canvas. Changes persist for the shared builder
            preview immediately.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" className="border-white/15 text-white" onClick={resetAll}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-[#252528] bg-[#111113] p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Shared canvas
              </div>
              <div className="mt-1 text-sm text-white/60">
                {selectedGuide.label} — drag to reposition
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
              Autosaves to shared config
            </div>
          </div>

          <div className="relative mx-auto flex h-full min-h-0 w-full max-w-full flex-1 items-center justify-center px-2">
            <div id="measurement-guide-admin-canvas" className="relative aspect-square w-full max-w-[576px]">
              <MeasurementPreview
                garmentType="tshirt"
                color="#5C7FB6"
                highlightedMeasurementId={selectedGuideId}
                imgClassName={PREVIEW_STAGE_CLASS}
                overlay={
                  <MeasurementGuideOverlay
                    guides={guides}
                    editable
                    highlightedId={selectedGuideId}
                    onGuidePointerDown={beginDrag}
                  />
                }
              />
            </div>
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-[#252528] bg-[#111113] p-4 sm:p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Selected guide
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">{selectedGuide.label}</h2>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-5 text-white/55">
            <div className="flex items-start gap-2">
              <Move className="mt-0.5 h-4 w-4 shrink-0 text-[#FF3B30]" />
              <p>Drag the line or center handle to move the guide. Use the inputs below for exact placement.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {guides.map((guide) => (
              <button
                key={guide.id}
                type="button"
                onClick={() => setSelectedGuideId(guide.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition',
                  selectedGuideId === guide.id
                    ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-white'
                    : 'border-[#252528] bg-white/5 text-white/65 hover:border-white/20 hover:text-white',
                )}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#FF3B30]">
                  {guide.id.toUpperCase()}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug">{guide.label}</div>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <PositionField label="Start X" value={selectedGuide.x1} onChange={(value) => commitGuidePatch(selectedGuide.id, { x1: value })} />
            <PositionField label="Start Y" value={selectedGuide.y1} onChange={(value) => commitGuidePatch(selectedGuide.id, { y1: value })} />
            <PositionField label="End X" value={selectedGuide.x2} onChange={(value) => commitGuidePatch(selectedGuide.id, { x2: value })} />
            <PositionField label="End Y" value={selectedGuide.y2} onChange={(value) => commitGuidePatch(selectedGuide.id, { y2: value })} />
            <PositionField label="Label X" value={selectedGuide.labelX} onChange={(value) => commitGuidePatch(selectedGuide.id, { labelX: value })} />
            <PositionField label="Label Y" value={selectedGuide.labelY} onChange={(value) => commitGuidePatch(selectedGuide.id, { labelY: value })} />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Anchor</div>
            <div className="mt-1 text-sm text-white">
              {Math.round(getMeasurementGuideCenter(selectedGuide).x)}, {Math.round(getMeasurementGuideCenter(selectedGuide).y)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PositionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/55">{label}</Label>
      <Input
        type="number"
        step="1"
        value={Number.isFinite(value) ? String(Math.round(value)) : ''}
        onChange={(event) => onChange(Number(event.target.value))}
        className="border-white/15 bg-white/5 text-white"
      />
    </div>
  );
}
