import { garmentAssetLabel } from '../../components/builder/TshirtAssetChoiceGrid';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ArrowLeft, Move, Plus, Trash2, Minus, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../components/ui/utils';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MeasurementPreview } from '../../components/builder/MeasurementsStep';
import {
  MEASUREMENT_GUIDE_GARMENTS,
  MEASUREMENT_GUIDE_VIEWBOX,
  MeasurementGuideOverlay,
  addMeasurementGuide,
  clearMeasurementGuideScope,
  getMeasurementGuideAngleDegrees,
  getMeasurementGuideCenter,
  getMeasurementGuideDefaultAssetId,
  getMeasurementGuideLength,
  getMeasurementGuideAssignableAssets,
  hydrateMeasurementGuidesFromRemote,
  measurementGuideLetterAt,
  measurementGuideScopeLabel,
  removeMeasurementGuide,
  rotateMeasurementGuideAroundCenter,
  seedAssetMeasurementGuides,
  seedSuggestedGuidesForAsset,
  selectionForGuideScope,
  setMeasurementGuideLengthFromStart,
  updateMeasurementGuide,
  useMeasurementGuideSyncStatus,
  useMeasurementGuides,
  type MeasurementGuideDef,
  type MeasurementGuideGarmentId,
  type MeasurementGuideId,
  type MeasurementGuideScopeId,
} from '../../components/builder/measurementGuides';
import { GARMENT_BASES, type GarmentBaseId } from '../../data/crmCatalogMock';

const ZOOM_MIN = 75;
const ZOOM_MAX = 250;
const ZOOM_DEFAULT = 140;
const CANVAS_BASE_PX = 560;

function isGuideGarmentId(value: string | undefined): value is MeasurementGuideGarmentId {
  return value === 'tshirt' || value === 'hoodie' || value === 'trousers';
}

export function SuperAdminMeasurementGuides() {
  useCerigaTranslation();

  const { baseId: baseIdParam } = useParams<{ baseId: string }>();
  const garmentType: MeasurementGuideGarmentId = isGuideGarmentId(baseIdParam)
    ? baseIdParam
    : 'tshirt';
  const isValidBase = isGuideGarmentId(baseIdParam);
  const meta = GARMENT_BASES.find((b) => b.id === (garmentType as GarmentBaseId));
  const garmentLabel =
    MEASUREMENT_GUIDE_GARMENTS.find((g) => g.id === garmentType)?.label ?? meta?.name ?? garmentType;

  const assignableAssets = useMemo(
    () => getMeasurementGuideAssignableAssets(garmentType),
    [garmentType],
  );

  const defaultAssetId = useMemo(
    () => getMeasurementGuideDefaultAssetId(garmentType) ?? assignableAssets[0]?.id ?? '',
    [assignableAssets, garmentType],
  );

  const [scope, setScope] = useState<MeasurementGuideScopeId>(defaultAssetId);
  const guides = useMeasurementGuides(garmentType, scope);
  const { status: syncStatus, error: syncError, usingCloud } = useMeasurementGuideSyncStatus();
  const previewSelection = useMemo(
    () => selectionForGuideScope(garmentType, scope),
    [garmentType, scope],
  );

  const scopeLabel = measurementGuideScopeLabel(garmentType, scope);
  const canSeedSuggested = Boolean(scope && seedSuggestedGuidesForAsset(garmentType, scope));

  useEffect(() => {
    void hydrateMeasurementGuidesFromRemote().catch(() => {
      /* status surfaced via sync hook */
    });
  }, []);

  useEffect(() => {
    if (syncStatus === 'error' && syncError) {
      toast.error(cerigaTranslateLabel(syncError));
    }
  }, [syncError, syncStatus]);

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
  const garmentTypeRef = useRef(garmentType);
  const scopeRef = useRef(scope);

  const [selectedGuideId, setSelectedGuideId] = useState<MeasurementGuideId | null>(
    guides[0]?.id ?? null,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<MeasurementGuideId | null>(null);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);

  useEffect(() => {
    setScope(defaultAssetId);
  }, [defaultAssetId, garmentType]);

  useEffect(() => {
    guidesRef.current = guides;
  }, [guides]);
  useEffect(() => {
    garmentTypeRef.current = garmentType;
  }, [garmentType]);
  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  useEffect(() => {
    if (!selectedGuideId || !guides.some((guide) => guide.id === selectedGuideId)) {
      setSelectedGuideId(guides[0]?.id ?? null);
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
    () => guides.find((guide) => guide.id === selectedGuideId) ?? null,
    [guides, selectedGuideId],
  );

  const selectedIndex = useMemo(
    () => (selectedGuide ? guides.findIndex((guide) => guide.id === selectedGuide.id) : -1),
    [guides, selectedGuide],
  );

  if (!isValidBase) {
    return <Navigate to="/superadmin/crm" replace />;
  }

  if (!scope) {
    return (
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-6 text-sm text-white/55">{cerigaTranslate("interface.text_cb6ae849bbbe0e9f")}</div>
    );
  }

  const commitGuidePatch = (
    guideId: MeasurementGuideId,
    patch: Partial<Omit<MeasurementGuideDef, 'id'>>,
  ) => {
    updateMeasurementGuide(garmentTypeRef.current, guideId, patch, scopeRef.current);
  };

  const updateDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const canvas = document.querySelector('#measurement-guide-admin-canvas') as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = ((event.clientX - drag.startClientX) / rect.width) * MEASUREMENT_GUIDE_VIEWBOX;
    const dy = ((event.clientY - drag.startClientY) / rect.height) * MEASUREMENT_GUIDE_VIEWBOX;
    updateMeasurementGuide(
      garmentTypeRef.current,
      drag.guideId,
      {
        x1: drag.baseGuide.x1 + dx,
        y1: drag.baseGuide.y1 + dy,
        x2: drag.baseGuide.x2 + dx,
        y2: drag.baseGuide.y2 + dy,
        labelX: drag.baseGuide.labelX + dx,
        labelY: drag.baseGuide.labelY + dy,
      },
      scopeRef.current,
    );
  };

  const beginDrag = (guideId: MeasurementGuideId, event: ReactPointerEvent<SVGGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const guide = guidesRef.current.find((item) => item.id === guideId);
    if (!guide) return;
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

  const handleAddLine = () => {
    const guide = addMeasurementGuide(garmentType, scope);
    setSelectedGuideId(guide.id);
    toast.success(cerigaTranslate("interface.text_3cb0b8c462026010"));
  };

  const handleSeedSuggested = () => {
    if (seedAssetMeasurementGuides(garmentType, scope)) {
      toast.success(cerigaTranslate("interface.text_5b21488b50cdde0c"));
    } else if (guides.length > 0) {
      toast.message(cerigaTranslate("interface.text_899119a4a9b8a6c7"));
    } else {
      toast.message(cerigaTranslate("interface.text_c9666c50bb49ab30"));
    }
  };

  const handleClearAssetPack = () => {
    clearMeasurementGuideScope(garmentType, scope);
    setSelectedGuideId(null);
    toast.success(cerigaTranslate("interface.text_f573ffb74aa1f373"));
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return;
    const nextGuides = guides.filter((guide) => guide.id !== pendingDeleteId);
    removeMeasurementGuide(garmentType, pendingDeleteId, scope);
    setSelectedGuideId(nextGuides[0]?.id ?? null);
    setPendingDeleteId(null);
    toast.success(cerigaTranslate("interface.text_1fb8cd3c4fe6b049"));
  };

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-5 lg:min-h-[calc(100dvh-6rem)]">
      <div className="shrink-0">
        <Link
          to={`/superadmin/crm/bases/${garmentType}`}
          className="inline-flex items-center gap-2 text-xs font-medium text-white/45 hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {cerigaTranslateLabel(garmentLabel)}{" "}{cerigaTranslate("interface.text_cae662172fd450bb")}</Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{cerigaTranslate("interface.text_2f794813748d278e")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{cerigaTranslate("interface.text_8beac5b67e2f4bfe")}</p>
      </div>

      <div className="shrink-0 rounded-2xl border border-[#252528] bg-[#111113] p-4 sm:p-5">
        <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/55">{cerigaTranslate("interface.text_80d298c9f240900f")}</Label>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="max-w-xl border-white/15 bg-white/5 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80 border-white/12 bg-[#161618] text-white">
            {assignableAssets.map((asset) => (
              <SelectItem key={asset.id} value={asset.id}>
                {cerigaTranslateLabel(asset.categoryLabel)} · {garmentAssetLabel(asset.displayName)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-h-0 flex-col rounded-2xl border border-[#252528] bg-[#111113] p-4 sm:p-5">
          <div className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {cerigaTranslateLabel(garmentLabel)} · {cerigaTranslateLabel(scopeLabel)}
              </div>
              <div className="mt-1 text-sm text-white/60">
                {selectedGuide
                  ? cerigaTranslate("interface.text_9a07028262ca1f41",{value0:(measurementGuideLetterAt(selectedIndex)),value1:(selectedGuide.label)})
                  : cerigaTranslate("interface.text_7733925e77a2ff0b")}
              </div>
            </div>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px]',
                    syncStatus === 'error'
                      ? 'border-red-500/30 bg-red-500/10 text-red-200'
                      : syncStatus === 'local'
                        ? 'border-amber-500/25 bg-amber-500/10 text-amber-100/80'
                        : 'border-white/10 bg-white/[0.04] text-white/55',
                  )}
                >
                  {syncStatus === 'loading'
                    ? cerigaTranslate("interface.text_141ce492c7dbf4d7")
                    : syncStatus === 'saving'
                      ? cerigaTranslate("common.saving")
                      : syncStatus === 'saved'
                        ? cerigaTranslate("interface.text_b2f4291bc3a812e6")
                        : syncStatus === 'error'
                          ? cerigaTranslate("interface.text_45bcbf6793983336")
                          : syncStatus === 'local'
                            ? cerigaTranslate("interface.text_f45f4cf44e532273")
                            : usingCloud
                              ? cerigaTranslate("interface.text_f3d25eb8d474cd9c")
                              : cerigaTranslate("interface.text_b924c7a22eb4174f")}
                </div>
                {usingCloud ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-white/65 hover:bg-white/10 hover:text-white"
                    disabled={syncStatus === 'loading' || syncStatus === 'saving'}
                    onClick={() => {
                      void hydrateMeasurementGuidesFromRemote(true)
                        .then(() => toast.success(cerigaTranslate("interface.text_0819c4541c9a5772")))
                        .catch(() => {
                          /* toast via sync error effect */
                        });
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />{cerigaTranslate("interface.text_bdc090ec61e3fcfc")}</Button>
                ) : null}
              <div className="flex items-center gap-1 rounded-xl border border-[#252528] bg-black/40 px-1.5 py-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={cerigaTranslate("interface.text_bc7b631a689b45ca")}
                  className="h-7 w-7 p-0 text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 10))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <input
                  aria-label={cerigaTranslate("interface.text_c1fc5951380872dc")}
                  className="h-1 w-20 cursor-pointer accent-[#CC2D24] sm:w-24"
                  type="range"
                  min={ZOOM_MIN}
                  max={ZOOM_MAX}
                  step={5}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={cerigaTranslate("interface.text_0e47f09a748fa132")}
                  className="h-7 w-7 p-0 text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 10))}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <button
                  type="button"
                  className="min-w-[2.75rem] px-1 text-center text-[11px] tabular-nums text-white/55 hover:text-white"
                  title={cerigaTranslate("interface.text_91a661b24f1bc2bf")}
                  onClick={() => setZoom(ZOOM_DEFAULT)}
                >
                  {zoom}%
                </button>
              </div>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-auto rounded-xl border border-white/5 bg-black/25">
            <div className="flex min-h-full items-center justify-center p-6">
              <div
                id="measurement-guide-admin-canvas"
                className="relative shrink-0"
                style={{
                  width: Math.round(CANVAS_BASE_PX * (zoom / 100)),
                  height: Math.round(CANVAS_BASE_PX * (zoom / 100)),
                }}
              >
                <MeasurementPreview
                  garmentType={garmentType}
                  selection={previewSelection}
                  color="#5C7FB6"
                  highlightedMeasurementId={selectedGuideId}
                  overlay={
                    <MeasurementGuideOverlay
                      garmentType={garmentType}
                      selection={previewSelection}
                      guides={guides}
                      editable
                      highlightedId={selectedGuideId}
                      onGuidePointerDown={beginDrag}
                    />
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4 overflow-y-auto rounded-2xl border border-[#252528] bg-[#111113] p-4 sm:p-5 xl:max-h-full">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{cerigaTranslate("interface.text_760aa27e4442c582")}</div>
              <p className="mt-1 text-xs text-white/45">
                {guides.length}{" "}{cerigaTranslate("interface.plural_noun_38a9c1e721584da2",{count:Number(guides.length)})} · {cerigaTranslateLabel(scopeLabel)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/15 text-white"
              onClick={handleAddLine}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />{cerigaTranslate("interface.text_9fd728c66c9a256b")}</Button>
          </div>

          <div className="flex flex-col gap-2">
            {canSeedSuggested && guides.length === 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-white/15 text-white"
                onClick={handleSeedSuggested}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />{cerigaTranslate("interface.text_b46654b661f05131")}</Button>
            ) : null}
            {guides.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-white/15 text-white"
                onClick={handleClearAssetPack}
              >{cerigaTranslate("interface.text_356551701da1189b")}</Button>
            ) : null}
          </div>

          {guides.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/45">{cerigaTranslate("interface.text_56cacf7d96a020d8")}</div>
          ) : (
            <div className="space-y-2">
              {guides.map((guide, index) => (
                <button
                  key={guide.id}
                  type="button"
                  onClick={() => setSelectedGuideId(guide.id)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-left transition',
                    selectedGuideId === guide.id
                      ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-white'
                      : 'border-[#252528] bg-white/5 text-white/65 hover:border-white/20 hover:text-white',
                  )}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#FF3B30]">
                    {measurementGuideLetterAt(index)}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-white">
                    {guide.label.trim() || cerigaTranslate("interface.text_f59ab8d1331b7b16")}
                  </div>
                  <div className="mt-1.5 text-[10px] leading-snug text-white/40">{cerigaTranslateLabel(scopeLabel)}</div>
                </button>
              ))}
            </div>
          )}

          {selectedGuide ? (
            <>
              <div className="border-t border-white/10 pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{cerigaTranslate("interface.text_f704b06caccefafc")}</div>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  {measurementGuideLetterAt(selectedIndex)}. {cerigaTranslateLabel(selectedGuide.label)}
                </h2>
                <p className="mt-1 text-[11px] text-white/40">{cerigaTranslateLabel(scopeLabel)}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-5 text-white/55">
                <div className="flex items-start gap-2">
                  <Move className="mt-0.5 h-4 w-4 shrink-0 text-[#FF3B30]" />
                  <p>{cerigaTranslate("interface.text_ad593b966d8e11da")}</p>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/55">{cerigaTranslate("interface.text_dcd1d5223f73b3a9")}</Label>
                <Input
                  value={selectedGuide.label}
                  placeholder={cerigaTranslate("interface.text_f59ab8d1331b7b16")}
                  onChange={(event) =>
                    commitGuidePatch(selectedGuide.id, { label: event.target.value })
                  }
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_4c2500aa1ecd7114")}</p>
                <PositionField
                  label={cerigaTranslate("interface.text_00270ecd77beeec4")}
                  value={getMeasurementGuideCenter(selectedGuide).x}
                  onChange={(value) => {
                    const center = getMeasurementGuideCenter(selectedGuide);
                    const delta = value - center.x;
                    commitGuidePatch(selectedGuide.id, {
                      x1: selectedGuide.x1 + delta,
                      x2: selectedGuide.x2 + delta,
                      labelX: selectedGuide.labelX + delta,
                    });
                  }}
                />
                <PositionField
                  label={cerigaTranslate("interface.text_0d895cf26c019847")}
                  value={getMeasurementGuideCenter(selectedGuide).y}
                  onChange={(value) => {
                    const center = getMeasurementGuideCenter(selectedGuide);
                    const delta = value - center.y;
                    commitGuidePatch(selectedGuide.id, {
                      y1: selectedGuide.y1 + delta,
                      y2: selectedGuide.y2 + delta,
                      labelY: selectedGuide.labelY + delta,
                    });
                  }}
                />
                <PositionField
                  label={cerigaTranslate("interface.text_adc95605a1b30c73")}
                  value={getMeasurementGuideLength(selectedGuide)}
                  onChange={(value) => {
                    commitGuidePatch(
                      selectedGuide.id,
                      setMeasurementGuideLengthFromStart(selectedGuide, value),
                    );
                  }}
                />
                <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_57b5e2fc1bba18bb")}</p>
                <PositionField
                  label={cerigaTranslate("interface.text_9eff3a618ed49148")}
                  value={getMeasurementGuideAngleDegrees(selectedGuide)}
                  step={1}
                  onChange={(value) => {
                    commitGuidePatch(
                      selectedGuide.id,
                      rotateMeasurementGuideAroundCenter(selectedGuide, value),
                    );
                  }}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                onClick={() => setPendingDeleteId(selectedGuide.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_690991fae7260bc3")}</Button>
            </>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title={cerigaTranslate("interface.text_0f508633dec8ac5e")}
        description={cerigaTranslate("interface.text_afdfb4a473824820")}
        confirmLabel={cerigaTranslate("interface.text_c3812fc4acb861d5")}
        tone="danger"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

function PositionField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  useCerigaTranslation();

  return (
    <div>
      <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/55">{cerigaTranslateLabel(label)}</Label>
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? String(Math.round(value * 10) / 10) : ''}
        onChange={(event) => onChange(Number(event.target.value))}
        className="border-white/15 bg-white/5 text-white"
      />
    </div>
  );
}
