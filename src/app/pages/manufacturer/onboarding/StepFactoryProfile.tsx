import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../../i18n/i18n';
import { useState, useMemo } from 'react';
import {
  Building2,
  Globe,
  Mail,
  MapPin,
  Phone,
  User,
  Users,
  Calendar,
  Layers,
  FileText,
  Search,
  Check,
  X,
  HelpCircle,
} from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../components/ui/utils';
import {
  ALL_MANUFACTURER_TYPES,
  type CompleteManufacturerProfile,
  type ManufacturerType,
} from '../../../data/manufacturerOnboardingTypes';
import { WORLD_COUNTRIES, LANGUAGES } from '../../../data/countryData';

type Props = {
  profile: CompleteManufacturerProfile;
  onChange: (patch: Partial<CompleteManufacturerProfile>) => void;
  onNext: () => void;
  errors: Record<string, string>;
};

export function StepFactoryProfile({ profile, onChange, onNext, errors }: Props) {
  useCerigaTranslation();

  const [countrySearch, setCountrySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return WORLD_COUNTRIES;
    return WORLD_COUNTRIES.filter((c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()),
    );
  }, [countrySearch]);

  const toggleType = (t: ManufacturerType) => {
    const existing = profile.manufacturerTypes || [];
    const next = existing.includes(t)
      ? existing.filter((x) => x !== t)
      : [...existing, t];
    onChange({ manufacturerTypes: next });
  };

  const toggleLanguage = (lang: string) => {
    const existing = profile.supportedLanguages || [];
    const next = existing.includes(lang)
      ? existing.filter((l) => l !== lang)
      : [...existing, lang];
    onChange({ supportedLanguages: next });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">{cerigaTranslate("interface.text_4e4040f58b6db3eb")}</h2>
        <p className="mt-1 text-sm text-white/50">{cerigaTranslate("interface.text_acf809d46db336de")}</p>
      </div>

      {/* Required Info Section */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 text-white">
          <Building2 className="h-4 w-4 text-[#CC2D24]" />
          <h3 className="text-sm font-semibold">{cerigaTranslate("interface.text_8865f5ab783a4508")}</h3>
          <span className="text-[11px] text-[#CC2D24] font-medium">{cerigaTranslate("interface.text_21e920a6c80509cf")}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Factory Name */}
          <div className="sm:col-span-2">
            <Label htmlFor="onboarding-factoryName" className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_a30418a5a10ddad6")}{" "}<span className="text-[#CC2D24]">*</span>
            </Label>
            <Input id="onboarding-factoryName" aria-invalid={Boolean(errors.factoryName)}
              value={profile.factoryName}
              onChange={(e) => onChange({ factoryName: e.target.value })}
              placeholder={cerigaTranslate("interface.text_7139b741048dddd4")}
              className={cn(
                'mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30',
                errors.factoryName && 'border-red-500/80 focus-visible:ring-red-500',
              )}
            />
            {errors.factoryName && (
              <p className="mt-1 text-xs text-red-400">{cerigaTranslateLabel(errors.factoryName)}</p>
            )}
          </div>

          {/* Primary Contact Person */}
          <div>
            <Label htmlFor="onboarding-contactName" className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_0ef91531c115abbe")}{" "}<span className="text-[#CC2D24]">*</span>
            </Label>
            <div className="relative mt-1.5">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
              <Input id="onboarding-contactName" aria-invalid={Boolean(errors.contactName)}
                value={profile.contactName}
                onChange={(e) => onChange({ contactName: e.target.value })}
                placeholder={cerigaTranslate("interface.text_1342c27390716370")}
                className={cn(
                  'pl-9 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30',
                  errors.contactName && 'border-red-500/80 focus-visible:ring-red-500',
                )}
              />
            </div>
            {errors.contactName && (
              <p className="mt-1 text-xs text-red-400">{cerigaTranslateLabel(errors.contactName)}</p>
            )}
          </div>

          {/* Business Email */}
          <div>
            <Label htmlFor="onboarding-contactEmail" className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_baf51475a8926369")}{" "}<span className="text-[#CC2D24]">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
              <Input id="onboarding-contactEmail" aria-invalid={Boolean(errors.contactEmail)}
                type="email"
                value={profile.contactEmail}
                onChange={(e) => onChange({ contactEmail: e.target.value })}
                placeholder={cerigaTranslate("interface.text_7cc42c658f4b5b7a")}
                className={cn(
                  'pl-9 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30',
                  errors.contactEmail && 'border-red-500/80 focus-visible:ring-red-500',
                )}
              />
            </div>
            {errors.contactEmail && (
              <p className="mt-1 text-xs text-red-400">{cerigaTranslateLabel(errors.contactEmail)}</p>
            )}
          </div>

          {/* Phone Number with country code */}
          <div>
            <Label htmlFor="onboarding-contactPhone" className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_5a43f96007407bec")}{" "}<span className="text-[#CC2D24]">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
              <Input id="onboarding-contactPhone" aria-invalid={Boolean(errors.contactPhone)}
                value={profile.contactPhone}
                onChange={(e) => onChange({ contactPhone: e.target.value })}
                placeholder="+44 7700 900123"
                className={cn(
                  'pl-9 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30',
                  errors.contactPhone && 'border-red-500/80 focus-visible:ring-red-500',
                )}
              />
            </div>
            {errors.contactPhone && (
              <p className="mt-1 text-xs text-red-400">{cerigaTranslateLabel(errors.contactPhone)}</p>
            )}
          </div>

          {/* Searchable Country Selector */}
          <div className="relative">
            <Label className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_701d021d08c54579")}{" "}<span className="text-[#CC2D24]">*</span>
            </Label>
            <div className="relative mt-1.5">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
              <Input
                value={countryDropdownOpen ? countrySearch : profile.country}
                onFocus={() => {
                  setCountryDropdownOpen(true);
                  setCountrySearch('');
                }}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder={cerigaTranslate("interface.text_32c8650fe8b73e1d")}
                className={cn(
                  'pl-9 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30',
                  errors.country && 'border-red-500/80 focus-visible:ring-red-500',
                )}
              />
            </div>
            {countryDropdownOpen && (
              <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-[#252528] bg-[#161618] p-1.5 shadow-2xl">
                {filteredCountries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onChange({ country: c.name });
                      setCountryDropdownOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-white hover:bg-[#CC2D24]/15 hover:text-red-200"
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] text-white/40">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
            {errors.country && <p className="mt-1 text-xs text-red-400">{cerigaTranslateLabel(errors.country)}</p>}
          </div>

          {/* City */}
          <div>
            <Label htmlFor="onboarding-city" className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_1f15f6d9f6b5169f")}{" "}<span className="text-[#CC2D24]">*</span>
            </Label>
            <Input id="onboarding-city" aria-invalid={Boolean(errors.city)}
              value={profile.city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder={cerigaTranslate("interface.text_9beb005c22a5f59d")}
              className={cn(
                'mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30',
                errors.city && 'border-red-500/80 focus-visible:ring-red-500',
              )}
            />
            {errors.city && <p className="mt-1 text-xs text-red-400">{cerigaTranslateLabel(errors.city)}</p>}
          </div>

          {/* Street / Facility Address */}
          <div>
            <Label htmlFor="onboarding-addressLine" className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_68de2df120174021")}</Label>
            <Input id="onboarding-addressLine" aria-invalid={Boolean(errors.addressLine)}
              value={profile.addressLine}
              onChange={(e) => onChange({ addressLine: e.target.value })}
              placeholder={cerigaTranslate("interface.text_628649aec0d8359f")}
              className="mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Manufacturer Types Multi-Select */}
        <div className="pt-2 border-t border-[#252528]">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_ed2282bcadd99422")}{" "}<span className="text-[#CC2D24]">*</span>
            </Label>
            <span className="text-[11px] text-white/40">{cerigaTranslate("interface.text_10d20e340181a52f")}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ALL_MANUFACTURER_TYPES.map((t) => {
              const selected = profile.manufacturerTypes?.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition',
                    selected
                      ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white ring-1 ring-[#CC2D24]/40 shadow-sm'
                      : 'border-[#252528] bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white',
                  )}
                >
                  <div
                    className={cn(
                      'h-3.5 w-3.5 rounded flex items-center justify-center border text-[9px]',
                      selected
                        ? 'border-[#CC2D24] bg-[#CC2D24] text-white'
                        : 'border-white/20 bg-transparent',
                    )}
                  >
                    {selected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  {t}
                </button>
              );
            })}
          </div>
          {errors.manufacturerTypes && (
            <p className="mt-1.5 text-xs text-red-400">{cerigaTranslateLabel(errors.manufacturerTypes)}</p>
          )}
        </div>
      </div>

      {/* Optional Information Section */}
      <details className="onboarding-optional rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6"><summary><span>{cerigaTranslate("interface.text_aa5f05c57cb36fdc")}<small>{cerigaTranslate("interface.text_8cf7fb348f491703")}</small></span><span>{cerigaTranslate("interface.text_59be71333c960fd0")}</span></summary>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Layers className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">{cerigaTranslate("interface.text_fe4f031863567015")}</h3>
          </div>
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/40">{cerigaTranslate("interface.text_59be71333c960fd0")}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Company Website */}
          <div>
            <Label htmlFor="onboarding-website" className="text-xs text-white/60">{cerigaTranslate("interface.text_199c06817c017acd")}</Label>
            <div className="relative mt-1.5">
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-white/30" />
              <Input id="onboarding-website" aria-invalid={Boolean(errors.website)}
                value={profile.website}
                onChange={(e) => onChange({ website: e.target.value })}
                placeholder="https://yourfactory.com"
                className="pl-9 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Years in Operation */}
          <div>
            <Label htmlFor="onboarding-yearsInOperation" className="text-xs text-white/60">{cerigaTranslate("interface.text_c4ea700af64e6c5a")}</Label>
            <Input id="onboarding-yearsInOperation" aria-invalid={Boolean(errors.yearsInOperation)}
              type="number"
              min="0"
              value={profile.yearsInOperation || ''}
              onChange={(e) => onChange({ yearsInOperation: Number(e.target.value) || undefined })}
              placeholder="e.g. 8"
              className="mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
            />
          </div>

          {/* Employee Count */}
          <div>
            <Label htmlFor="onboarding-employeeCount" className="text-xs text-white/60">{cerigaTranslate("interface.text_ec8a0a8eaf081262")}</Label>
            <Input id="onboarding-employeeCount" aria-invalid={Boolean(errors.employeeCount)}
              type="number"
              min="1"
              value={profile.employeeCount || ''}
              onChange={(e) => onChange({ employeeCount: Number(e.target.value) || undefined })}
              placeholder="e.g. 50"
              className="mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
            />
          </div>

          {/* Factory Floor Size */}
          <div>
            <Label htmlFor="onboarding-factorySizeSqFt" className="text-xs text-white/60">{cerigaTranslate("interface.text_410884b3293461a3")}</Label>
            <Input id="onboarding-factorySizeSqFt" aria-invalid={Boolean(errors.factorySizeSqFt)}
              type="number"
              min="100"
              value={profile.factorySizeSqFt || ''}
              onChange={(e) => onChange({ factorySizeSqFt: Number(e.target.value) || undefined })}
              placeholder="e.g. 15000"
              className="mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
            />
          </div>

          {/* Business Registration Number */}
          <div className="sm:col-span-2 lg:col-span-2">
            <Label htmlFor="onboarding-businessRegNumber" className="text-xs text-white/60">{cerigaTranslate("interface.text_1112b29686d7bf86")}</Label>
            <Input id="onboarding-businessRegNumber" aria-invalid={Boolean(errors.businessRegNumber)}
              value={profile.businessRegNumber || ''}
              onChange={(e) => onChange({ businessRegNumber: e.target.value })}
              placeholder={cerigaTranslate("interface.text_314c87401f5adea5")}
              className="mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Supported Languages Multi-select */}
        <div>
          <Label className="text-xs text-white/60">{cerigaTranslate("interface.text_25ca39dafb9c7128")}</Label>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {LANGUAGES.map((lang) => {
              const active = profile.supportedLanguages?.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-xs transition',
                    active
                      ? 'border-[#CC2D24]/50 bg-[#CC2D24]/20 text-red-100 font-medium'
                      : 'border-[#252528] bg-white/[0.02] text-white/50 hover:text-white',
                  )}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </div>

        {/* Short Company Description */}
        <div>
          <Label htmlFor="onboarding-companyDescription" className="text-xs text-white/60">{cerigaTranslate("interface.text_43804e10d74c93ab")}</Label>
          <p className="mt-0.5 text-[11px] text-white/40">{cerigaTranslate("interface.text_b4a3a4bae75db296")}</p>
          <Textarea id="onboarding-companyDescription" aria-invalid={Boolean(errors.companyDescription)}
            rows={3}
            value={profile.companyDescription || ''}
            onChange={(e) => onChange({ companyDescription: e.target.value })}
            placeholder={cerigaTranslate("interface.text_3713e1a7813b6ac9")}
            className="mt-2 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
          />
        </div>
      </details>

      {/* Navigation */}
      <div className="onboarding-actions flex justify-end pt-2">
        <Button
          type="button"
          onClick={onNext}
          className="onboarding-primary bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-6 font-semibold"
        >{cerigaTranslate("interface.text_7d2076d0563a1019")}</Button>
      </div>
    </div>
  );
}
