import { useState } from 'react';
import {
  Shirt,
  Check,
  ChevronDown,
  ChevronUp,
  Sliders,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { cn } from '../../../components/ui/utils';
import {
  ALL_GARMENT_CATEGORIES,
  DEFAULT_MATERIALS,
  GARMENT_STYLE_PRESETS,
  type CompleteManufacturerProfile,
  type GarmentCategory,
  type GarmentDetail,
} from '../../../data/manufacturerOnboardingTypes';

type Props = {
  profile: CompleteManufacturerProfile;
  onChange: (patch: Partial<CompleteManufacturerProfile>) => void;
  onNext: () => void;
  onBack: () => void;
  errors: Record<string, string>;
};

export function StepProductsGarments({ profile, onChange, onNext, onBack, errors }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<GarmentCategory | null>(
    profile.garments[0] || null,
  );
  const [customMaterialInputs, setCustomMaterialInputs] = useState<Record<string, string>>({});

  const toggleGarment = (cat: GarmentCategory) => {
    const isSelected = profile.garments.includes(cat);
    let nextGarments: GarmentCategory[];
    const nextDetails = { ...(profile.garmentDetails || {}) };

    if (isSelected) {
      nextGarments = profile.garments.filter((g) => g !== cat);
      // Remove detail or keep it in case re-selected; prompt says "Manufacturer removes a garment category after entering advanced details"
      delete nextDetails[cat];
      if (expandedCategory === cat) {
        setExpandedCategory(nextGarments[0] || null);
      }
    } else {
      nextGarments = [...profile.garments, cat];
      if (!nextDetails[cat]) {
        nextDetails[cat] = {
          category: cat,
          styles: (GARMENT_STYLE_PRESETS[cat] || []).slice(0, 3),
          materials: ['Cotton (100%)'],
          minGsm: 180,
          maxGsm: 450,
        };
      }
      setExpandedCategory(cat);
    }

    onChange({
      garments: nextGarments,
      garmentDetails: nextDetails,
    });
  };

  const updateGarmentDetail = (
    cat: GarmentCategory,
    patch: Partial<GarmentDetail>,
  ) => {
    const current = profile.garmentDetails?.[cat] || {
      category: cat,
      styles: [],
      materials: [],
    };
    const updated: GarmentDetail = { ...current, ...patch };
    onChange({
      garmentDetails: {
        ...(profile.garmentDetails || {}),
        [cat]: updated,
      },
    });
  };

  const toggleStyle = (cat: GarmentCategory, style: string) => {
    const detail = profile.garmentDetails?.[cat] || {
      category: cat,
      styles: [],
      materials: [],
    };
    const styles = detail.styles || [];
    const nextStyles = styles.includes(style)
      ? styles.filter((s) => s !== style)
      : [...styles, style];
    updateGarmentDetail(cat, { styles: nextStyles });
  };

  const toggleMaterial = (cat: GarmentCategory, mat: string) => {
    const detail = profile.garmentDetails?.[cat] || {
      category: cat,
      styles: [],
      materials: [],
    };
    const materials = detail.materials || [];
    const nextMaterials = materials.includes(mat)
      ? materials.filter((m) => m !== mat)
      : [...materials, mat];
    updateGarmentDetail(cat, { materials: nextMaterials });
  };

  const addCustomMaterial = (cat: GarmentCategory) => {
    const text = customMaterialInputs[cat]?.trim();
    if (!text) return;
    const detail = profile.garmentDetails?.[cat] || {
      category: cat,
      styles: [],
      materials: [],
      customMaterials: [],
    };
    const custom = detail.customMaterials || [];
    if (!custom.includes(text)) {
      updateGarmentDetail(cat, {
        customMaterials: [...custom, text],
        materials: [...detail.materials, text],
      });
    }
    setCustomMaterialInputs((prev) => ({ ...prev, [cat]: '' }));
  };

  const removeCustomMaterial = (cat: GarmentCategory, text: string) => {
    const detail = profile.garmentDetails?.[cat];
    if (!detail) return;
    updateGarmentDetail(cat, {
      customMaterials: (detail.customMaterials || []).filter((m) => m !== text),
      materials: (detail.materials || []).filter((m) => m !== text),
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">2. Products & Garments</h2>
        <p className="mt-1 text-sm text-white/50">
          Select all garment silhouettes your facility manufactures. Expand each category to specify supported cuts, fabric weights, and materials.
        </p>
      </div>

      {/* Main Garment Selection Cards */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Shirt className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">Select Garment Categories</h3>
            <span className="text-xs text-[#CC2D24] font-medium">* Select at least 1</span>
          </div>
          <span className="text-xs text-white/50">
            {profile.garments.length} selected
          </span>
        </div>

        {errors.garments && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            {errors.garments}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {ALL_GARMENT_CATEGORIES.map((cat) => {
            const selected = profile.garments.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleGarment(cat)}
                className={cn(
                  'flex flex-col items-start p-3 rounded-xl border text-left transition',
                  selected
                    ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white ring-1 ring-[#CC2D24]/50 shadow-md'
                    : 'border-[#252528] bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white',
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold">{cat}</span>
                  <div
                    className={cn(
                      'h-4 w-4 rounded flex items-center justify-center text-[10px] border transition',
                      selected
                        ? 'border-[#CC2D24] bg-[#CC2D24] text-white'
                        : 'border-white/20 bg-transparent',
                    )}
                  >
                    {selected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </div>
                {selected && (
                  <span className="mt-2 text-[10px] text-red-200/80 font-medium">
                    Configured specs &rarr;
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Garment-Specific Capabilities (Conditional Sections) */}
      {profile.garments.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Garment-Specific Specifications</h3>
              <p className="text-xs text-white/40">
                Click any selected category below to refine supported cuts, fabric weight limits, and material compositions.
              </p>
            </div>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/40">
              Optional deep-dive
            </span>
          </div>

          <div className="space-y-3">
            {profile.garments.map((cat) => {
              const isExpanded = expandedCategory === cat;
              const detail = profile.garmentDetails?.[cat] || {
                category: cat,
                styles: [],
                materials: [],
              };
              const stylePresets = GARMENT_STYLE_PRESETS[cat] || [
                'Standard fit',
                'Oversized',
                'Custom cut-and-sew',
              ];

              return (
                <div
                  key={cat}
                  className={cn(
                    'rounded-2xl border transition overflow-hidden',
                    isExpanded
                      ? 'border-[#CC2D24]/50 bg-[#141416]'
                      : 'border-[#252528] bg-[#111113] hover:border-white/20',
                  )}
                >
                  {/* Category Accordion Header */}
                  <button
                    type="button"
                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#CC2D24]/20 text-[#CC2D24]">
                        <Shirt className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-white">{cat}</span>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/40">
                          <span>{detail.styles?.length || 0} styles</span>
                          <span>&bull;</span>
                          <span>
                            {detail.minGsm && detail.maxGsm
                              ? `${detail.minGsm} - ${detail.maxGsm} GSM`
                              : 'Standard GSM'}
                          </span>
                          <span>&bull;</span>
                          <span>{detail.materials?.length || 0} fabrics</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/50">
                      <span className="text-xs">{isExpanded ? 'Collapse' : 'Configure'}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Customisation Form */}
                  {isExpanded && (
                    <div className="border-t border-[#252528] p-5 sm:p-6 space-y-6 bg-black/20">
                      {/* Supported Styles */}
                      <div>
                        <Label className="text-xs text-white/80 font-medium">
                          Supported Styles & Fits for {cat}
                        </Label>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {stylePresets.map((st) => {
                            const on = detail.styles?.includes(st);
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => toggleStyle(cat, st)}
                                className={cn(
                                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                                  on
                                    ? 'border-[#CC2D24] bg-[#CC2D24]/20 text-white'
                                    : 'border-[#252528] bg-white/[0.02] text-white/60 hover:text-white',
                                )}
                              >
                                {st}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Fabric Weight GSM Ranges */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs text-white/80 font-medium">
                            Minimum Fabric Weight (GSM)
                          </Label>
                          <p className="text-[11px] text-white/40 mb-1.5">
                            Lightest fabric weight your machines handle cleanly.
                          </p>
                          <Input
                            type="number"
                            min="50"
                            max="1200"
                            value={detail.minGsm || ''}
                            onChange={(e) =>
                              updateGarmentDetail(cat, {
                                minGsm: Number(e.target.value) || undefined,
                              })
                            }
                            placeholder="e.g. 180"
                            className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-white/80 font-medium">
                            Maximum Fabric Weight (GSM)
                          </Label>
                          <p className="text-[11px] text-white/40 mb-1.5">
                            Heaviest fabric weight your needles & stitchers accommodate.
                          </p>
                          <Input
                            type="number"
                            min="50"
                            max="1200"
                            value={detail.maxGsm || ''}
                            onChange={(e) =>
                              updateGarmentDetail(cat, {
                                maxGsm: Number(e.target.value) || undefined,
                              })
                            }
                            placeholder="e.g. 500"
                            className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                          />
                        </div>
                      </div>

                      {/* Supported Materials */}
                      <div>
                        <Label className="text-xs text-white/80 font-medium">
                          Supported Materials & Fabrications
                        </Label>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {DEFAULT_MATERIALS.map((mat) => {
                            const on = detail.materials?.includes(mat);
                            return (
                              <button
                                key={mat}
                                type="button"
                                onClick={() => toggleMaterial(cat, mat)}
                                className={cn(
                                  'rounded-lg border px-2.5 py-1 text-xs transition',
                                  on
                                    ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-100 font-medium'
                                    : 'border-[#252528] bg-white/[0.02] text-white/50 hover:text-white',
                                )}
                              >
                                {mat}
                              </button>
                            );
                          })}
                          {detail.customMaterials?.map((cMat) => (
                            <span
                              key={cMat}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#CC2D24]/60 bg-[#CC2D24]/15 px-2.5 py-1 text-xs text-white font-medium"
                            >
                              {cMat}
                              <button
                                type="button"
                                onClick={() => removeCustomMaterial(cat, cMat)}
                                className="text-white/60 hover:text-white"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>

                        {/* Custom Material Input */}
                        <div className="mt-3 flex max-w-sm gap-2">
                          <Input
                            value={customMaterialInputs[cat] || ''}
                            onChange={(e) =>
                              setCustomMaterialInputs({
                                ...customMaterialInputs,
                                [cat]: e.target.value,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addCustomMaterial(cat);
                              }
                            }}
                            placeholder="Add custom material (e.g. Bamboo fleece)..."
                            className="h-8 text-xs border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => addCustomMaterial(cat)}
                            className="h-8 text-xs border-white/15 text-white hover:bg-white/10"
                          >
                            <Plus className="mr-1 h-3 w-3" /> Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-white/15 text-white hover:bg-white/5"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-6 font-semibold"
        >
          Continue to Production Capabilities
        </Button>
      </div>
    </div>
  );
}
