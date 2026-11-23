import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../../i18n/i18n';
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
  useCerigaTranslation();

  const [expandedCategory, setExpandedCategory] = useState<GarmentCategory | null>(
    profile.garments[0] || null,
  );
  const [confirmationMessage,setConfirmationMessage]=useState('');
  const [confirmationIssues,setConfirmationIssues]=useState<string[]>([]);
  const clearConfirmation=()=>{setConfirmationMessage('');setConfirmationIssues([]);};
  const confirmSelected=()=>{const details={...profile.garmentDetails},issues:string[]=[];let confirmed=0,firstInvalid:GarmentCategory|null=null;for(const cat of profile.garments){const detail=details[cat]??createGarmentDetail(cat),issue=garmentReviewError(detail);if(issue){issues.push(cat+': '+issue);firstInvalid??=cat;}else{details[cat]={...detail,confirmed:true};confirmed++;}}if(confirmed)onChange({garmentDetails:details});setConfirmationMessage(confirmed?`${confirmed} selected garment${confirmed===1?'':'s'} confirmed.`:'');setConfirmationIssues(issues);if(firstInvalid)setExpandedCategory(firstInvalid);};
  const toggleGarment = (cat: GarmentCategory) => {
    clearConfirmation();
    const selected = profile.garments.includes(cat);
    const garments = selected ? profile.garments.filter(value => value !== cat) : [...profile.garments, cat];
    const garmentDetails = initializeGarmentDetails(garments, profile.garmentDetails);
    if (!selected) setExpandedCategory(cat);
    else if (expandedCategory === cat) setExpandedCategory(garments[0] ?? null);
    // Retain details when deselected so reselecting never resets a manufacturer's work.
    onChange({ garments, garmentDetails });
  };

  const updateGarmentDetail = (cat: GarmentCategory, patch: Partial<GarmentDetail>) => {
    clearConfirmation();
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
        <h2 className="text-xl font-semibold text-white">{cerigaTranslate("interface.text_1ad4b940521bb22c")}</h2>
        <p className="mt-1 text-sm text-white/50">{cerigaTranslate("interface.text_8be70a1e8ce280a1")}</p>
      </div>

      {/* Main Garment Selection Cards */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-white">
            <Shirt className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">{cerigaTranslate("interface.text_a1a93cf9f1b2e517")}</h3>
            <span className="text-xs text-[#CC2D24] font-medium">{cerigaTranslate("interface.text_1ed1d9e980f90509")}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={cerigaTranslate("interface.text_7b0980de705b78f8")}
            disabled={ALL_GARMENT_CATEGORIES.every(cat => profile.garments.includes(cat))}
            onClick={() => {
              clearConfirmation();
              const garments = [...new Set([...profile.garments, ...ALL_GARMENT_CATEGORIES])];
              onChange({ garments, garmentDetails: initializeGarmentDetails(garments, profile.garmentDetails) });
              if (!expandedCategory) setExpandedCategory(garments[0] ?? null);
            }}
            className="h-8 border-white/15 text-xs text-white hover:bg-white/10"
          >{cerigaTranslate("interface.text_1fc9a387654d410f")}</Button>
          <span className="text-xs text-white/50">
            {profile.garments.length}{" "}{cerigaTranslate("interface.text_d7cbbb688b2e506c")}</span>
          </div>
        </div>

        {errors.garments && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            {cerigaTranslateLabel(errors.garments)}
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
                    {isGarmentConfirmed(profile.garmentDetails?.[cat]) ? cerigaTranslate("interface.text_80c41ec1a0265513") : cerigaTranslate("interface.text_2b58dd60e483ec44")} &rarr;
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="garment-confirmation-bar"><p>{cerigaTranslate("interface.text_b639d996f39b4525")}</p><Button type="button" className="garment-confirm-selected" disabled={!profile.garments.length||profile.garments.every(cat=>isGarmentConfirmed(profile.garmentDetails?.[cat]))} onClick={confirmSelected}><Check className="h-3.5 w-3.5"/>{profile.garments.length>0&&profile.garments.every(cat=>isGarmentConfirmed(profile.garmentDetails?.[cat]))?cerigaTranslate("interface.text_f64d516fa3b67126"):cerigaTranslate("interface.text_b8832d6c862df8ab")}</Button></div>
        {confirmationMessage&&<p role="status" className="garment-confirmation-message">{confirmationMessage}</p>}
        {confirmationIssues.length>0&&<div role="alert" className="garment-confirmation-issues"><p>{cerigaTranslate("interface.text_d490452024cc3f27")}</p><ul>{confirmationIssues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>}
      </div>

      {/* Garment-Specific Capabilities (Conditional Sections) */}
      {profile.garments.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_bf3624f0fb5b32d4")}</h3>
              <p className="text-xs text-white/40">{cerigaTranslate("interface.text_82972d6b756469dc")}</p>
            </div>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/40">{cerigaTranslate("interface.text_f0742e3a82fe8b57")}</span>
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
                          <span>{detail.styles?.length || 0}{" "}{cerigaTranslate("interface.text_90a7578caf8760be")}</span>
                          <span>&bull;</span>
                          <span>
                            {detail.minGsm && detail.maxGsm
                              ? cerigaTranslate("interface.text_a4b764c35f579e00",{value0:(detail.minGsm),value1:(detail.maxGsm)})
                              : cerigaTranslate("interface.text_63f879ecbe54ddda")}
                          </span>
                          <span>&bull;</span>
                          <span>{detail.materials?.length || 0}{" "}{cerigaTranslate("interface.text_e8a76a07860e076e")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/50">
                      <span className="text-xs">{isExpanded ? cerigaTranslate("nav.collapse") : cerigaTranslate("interface.text_6defafa2caa65304")}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {errors[cat] && <p className="px-5 pb-3 text-xs text-red-400">{cerigaTranslateLabel(errors[cat])}</p>}

                  {/* Expanded Customisation Form */}
                  {isExpanded && (
                    <div className="border-t border-[#252528] p-5 sm:p-6 space-y-6 bg-black/20">
                      <GarmentOptionField
                        label={cerigaTranslate("interface.text_09eccd7db0863aba",{value0:(cat)})}
                        placeholder={cerigaTranslate("interface.text_5e632027ed1f8660")}
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
                          <Label className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_9a3d449f01bec48f")}</Label>
                          <p className="text-[11px] text-white/40 mb-1.5">{cerigaTranslate("interface.text_3e82c78ccd9a7e27")}</p>
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
                          <Label className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_dd02d972a4f1e9b3")}</Label>
                          <p className="text-[11px] text-white/40 mb-1.5">{cerigaTranslate("interface.text_0c0132e96df6cfbb")}</p>
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

                      <p className="text-[11px] text-white/40">{cerigaTranslate("interface.text_0ab0fd9fa2469b11")}</p>

                      <GarmentOptionField
                        label={cerigaTranslate("interface.text_e9933446f8037fe1")}
                        placeholder={cerigaTranslate("interface.text_525c9ab29e444ae6")}
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
                        label={cerigaTranslate("interface.text_bcc8b944e6c34005")}
                        placeholder={cerigaTranslate("interface.text_7a686332a73e79a3")}
                        options={defaults.constructionDetails ?? []}
                        selected={detail.constructionDetails ?? []}
                        customOptions={detail.customConstructionDetails ?? []}
                        onToggle={value => toggleChoice(cat, 'constructionDetails', value)}
                        onSelectAll={values => updateGarmentDetail(cat, { constructionDetails: values })}
                        onAdd={value => addChoice(cat, 'constructionDetails', value)}
                        onRemove={value => removeChoice(cat, 'constructionDetails', value)}
                      />

                      <div className="border-t border-[#252528] pt-4 space-y-2">
                        {reviewError && <p className="text-xs text-amber-300">{cerigaTranslateLabel(reviewError)}</p>}
                        <label className="flex items-start gap-2 text-xs text-white/80">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            disabled={Boolean(reviewError)}
                            onChange={event => updateGarmentDetail(cat, { confirmed: event.target.checked })}
                            className="mt-0.5 accent-[#CC2D24]"
                          />{cerigaTranslate("interface.text_53b6e3d4b11d928f")}{" "}{cat.toLowerCase()}{" "}{cerigaTranslate("interface.text_77ed5cce058c4d0d")}</label>
                        <p className="text-[11px] text-white/40">
                          {confirmed ? cerigaTranslate("interface.text_b48556051ce070f4") : cerigaTranslate("interface.text_9caa5c695c747230")}
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
      <div className="onboarding-actions flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-white/15 text-white hover:bg-white/5"
        >{cerigaTranslate("common.back")}</Button>
        <Button
          type="button"
          onClick={onNext}
          className="onboarding-primary bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-6 font-semibold"
        >{cerigaTranslate("interface.text_be28a9a86697214e")}</Button>
      </div>
    </div>
  );
}
