import { useState } from 'react';
import {
  Shirt,
  Check,
  ChevronDown,
  ChevronUp,
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
import { createGarmentDetail, getGarmentSuggestions, garmentReviewError, initializeGarmentDetails, isGarmentConfirmed } from '../../../data/manufacturerGarmentDefaults';
import { GarmentOptionField } from './GarmentOptionField';

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
  const toggleGarment = (cat: GarmentCategory) => {
    const selected = profile.garments.includes(cat);
    const garments = selected ? profile.garments.filter(value => value !== cat) : [...profile.garments, cat];
    const garmentDetails = initializeGarmentDetails(garments, profile.garmentDetails);
    if (!selected) setExpandedCategory(cat);
    else if (expandedCategory === cat) setExpandedCategory(garments[0] ?? null);
    // Retain details when deselected so reselecting never resets a manufacturer's work.
    onChange({ garments, garmentDetails });
  };

  const updateGarmentDetail = (cat: GarmentCategory, patch: Partial<GarmentDetail>) => {
    const current = profile.garmentDetails?.[cat] ?? createGarmentDetail(cat);
    onChange({
      garmentDetails: {
        ...profile.garmentDetails,
        [cat]: { ...current, confirmed: false, ...patch },
      },
    });
  };

  type ChoiceField = 'styles' | 'materials' | 'constructionDetails';
  const customFieldFor = {
    styles: 'customStyles', materials: 'customMaterials', constructionDetails: 'customConstructionDetails',
  } as const;

  const toggleChoice = (cat: GarmentCategory, field: ChoiceField, value: string) => {
    const selected = profile.garmentDetails?.[cat]?.[field] ?? [];
    updateGarmentDetail(cat, { [field]: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value] });
  };

  const addChoice = (cat: GarmentCategory, field: ChoiceField, value: string) => {
    const detail = profile.garmentDetails?.[cat] ?? createGarmentDetail(cat);
    const customField = customFieldFor[field];
    updateGarmentDetail(cat, {
      [field]: [...new Set([...(detail[field] ?? []), value])],
      [customField]: [...new Set([...(detail[customField] ?? []), value])],
    });
  };

  const removeChoice = (cat: GarmentCategory, field: ChoiceField, value: string) => {
    const detail = profile.garmentDetails?.[cat];
    if (!detail) return;
    const customField = customFieldFor[field];
    updateGarmentDetail(cat, {
      [field]: (detail[field] ?? []).filter(item => item !== value),
      [customField]: (detail[customField] ?? []).filter(item => item !== value),
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">2. Products & Garments</h2>
        <p className="mt-1 text-sm text-white/50">
          Select the garments you manufacture. Each category starts with editable suggestions. Review the styles, materials, construction, and fabric weights, then confirm what your facility supports.
        </p>
      </div>

      {/* Main Garment Selection Cards */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-white">
            <Shirt className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">Select Garment Categories</h3>
            <span className="text-xs text-[#CC2D24] font-medium">* Select at least 1</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Select all garment categories"
            disabled={ALL_GARMENT_CATEGORIES.every(cat => profile.garments.includes(cat))}
            onClick={() => {
              const garments = [...new Set([...profile.garments, ...ALL_GARMENT_CATEGORIES])];
              onChange({ garments, garmentDetails: initializeGarmentDetails(garments, profile.garmentDetails) });
              if (!expandedCategory) setExpandedCategory(garments[0] ?? null);
            }}
            className="h-8 border-white/15 text-xs text-white hover:bg-white/10"
          >Select all</Button>
          <span className="text-xs text-white/50">
            {profile.garments.length} selected
          </span>
          </div>
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
                    {isGarmentConfirmed(profile.garmentDetails?.[cat]) ? 'Confirmed specs' : 'Review suggestions'} &rarr;
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
                Suggestions are not verified capabilities. Confirm each category before it can be used for order matching. Editing a category requires confirmation again.
              </p>
            </div>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/40">
              Review required
            </span>
          </div>

          <div className="space-y-3">
            {profile.garments.map((cat) => {
              const isExpanded = expandedCategory === cat;
              const detail = profile.garmentDetails?.[cat] ?? createGarmentDetail(cat);
              const defaults = getGarmentSuggestions(cat);
              const stylePresets = [...new Set([...defaults.styles, ...(GARMENT_STYLE_PRESETS[cat] ?? [])])];
              const reviewError = garmentReviewError(detail);
              const confirmed = isGarmentConfirmed(detail);

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

                  {errors[cat] && <p className="px-5 pb-3 text-xs text-red-400">{errors[cat]}</p>}

                  {/* Expanded Customisation Form */}
                  {isExpanded && (
                    <div className="border-t border-[#252528] p-5 sm:p-6 space-y-6 bg-black/20">
                      <GarmentOptionField
                        label={`Supported styles & fits for ${cat}`}
                        placeholder="Add custom style or fit..."
                        options={stylePresets}
                        selected={detail.styles ?? []}
                        customOptions={detail.customStyles ?? []}
                        onToggle={value => toggleChoice(cat, 'styles', value)}
                        onSelectAll={values => updateGarmentDetail(cat, { styles: values })}
                        onAdd={value => addChoice(cat, 'styles', value)}
                        onRemove={value => removeChoice(cat, 'styles', value)}
                      />

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
                            min="1"
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
                            min="1"
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

                      <p className="text-[11px] text-white/40">
                        GSM suggestions describe the main fabric, not the finished garment, lining, or insulation.
                        Adjust to your actual range; leave blank where GSM is not applicable, such as yarn-based knitwear.
                      </p>

                      <GarmentOptionField
                        label="Supported materials & fabrications"
                        placeholder="Add custom material (e.g. Bamboo fleece)..."
                        options={[...new Set([...defaults.materials, ...DEFAULT_MATERIALS])]}
                        selected={detail.materials ?? []}
                        customOptions={detail.customMaterials ?? []}
                        onToggle={value => toggleChoice(cat, 'materials', value)}
                        onSelectAll={values => updateGarmentDetail(cat, { materials: values })}
                        onAdd={value => addChoice(cat, 'materials', value)}
                        onRemove={value => removeChoice(cat, 'materials', value)}
                        green
                      />

                      <GarmentOptionField
                        label="Construction details"
                        placeholder="Add custom construction detail..."
                        options={defaults.constructionDetails ?? []}
                        selected={detail.constructionDetails ?? []}
                        customOptions={detail.customConstructionDetails ?? []}
                        onToggle={value => toggleChoice(cat, 'constructionDetails', value)}
                        onSelectAll={values => updateGarmentDetail(cat, { constructionDetails: values })}
                        onAdd={value => addChoice(cat, 'constructionDetails', value)}
                        onRemove={value => removeChoice(cat, 'constructionDetails', value)}
                      />

                      <div className="border-t border-[#252528] pt-4 space-y-2">
                        {reviewError && <p className="text-xs text-amber-300">{reviewError}</p>}
                        <label className="flex items-start gap-2 text-xs text-white/80">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            disabled={Boolean(reviewError)}
                            onChange={event => updateGarmentDetail(cat, { confirmed: event.target.checked })}
                            className="mt-0.5 accent-[#CC2D24]"
                          />
                          I have reviewed these selections and confirm our facility supports the selected {cat.toLowerCase()} styles, materials, construction details, and fabric weights.
                        </label>
                        <p className="text-[11px] text-white/40">
                          {confirmed ? 'Confirmed by you for order matching.' : 'Awaiting your review. These suggestions are excluded from order matching.'}
                        </p>
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
