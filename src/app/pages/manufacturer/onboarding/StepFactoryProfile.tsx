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
        <h2 className="text-xl font-semibold text-white">1. Factory Profile & Contacts</h2>
        <p className="mt-1 text-sm text-white/50">
          Establish your facility credentials, location, and primary operations point of contact.
        </p>
      </div>

      {/* Required Info Section */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 text-white">
          <Building2 className="h-4 w-4 text-[#CC2D24]" />
          <h3 className="text-sm font-semibold">Primary Facility Details</h3>
          <span className="text-[11px] text-[#CC2D24] font-medium">* Required fields</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Factory Name */}
          <div className="sm:col-span-2">
            <Label className="text-xs text-white/80 font-medium">
              Factory / Facility Name <span className="text-[#CC2D24]">*</span>
            </Label>
            <Input
              value={profile.factoryName}
              onChange={(e) => onChange({ factoryName: e.target.value })}
              placeholder="e.g. Apex Apparel Ltd or Porto Stitch Works"
              className={cn(
                'mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30',
                errors.factoryName && 'border-red-500/80 focus-visible:ring-red-500',
              )}
            />
            {errors.factoryName && (
              <p className="mt-1 text-xs text-red-400">{errors.factoryName}</p>
            )}
          </div>

          {/* Primary Contact Person */}
          <div>
            <Label className="text-xs text-white/80 font-medium">
              Primary Contact Person <span className="text-[#CC2D24]">*</span>
            </Label>
            <div className="relative mt-1.5">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
              <Input
                value={profile.contactName}
                onChange={(e) => onChange({ contactName: e.target.value })}
                placeholder="e.g. Sarah Jenkins or Marco Silva"
                className={cn(
                  'pl-9 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30',
                  errors.contactName && 'border-red-500/80 focus-visible:ring-red-500',
                )}
              />
            </div>
            {errors.contactName && (
              <p className="mt-1 text-xs text-red-400">{errors.contactName}</p>
            )}
          </div>

          {/* Business Email */}
          <div>
            <Label className="text-xs text-white/80 font-medium">
              Business Email <span className="text-[#CC2D24]">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
              <Input
                type="email"
                value={profile.contactEmail}
                onChange={(e) => onChange({ contactEmail: e.target.value })}
                placeholder="e.g. ops@apexapparel.com"
                className={cn(
                  'pl-9 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30',
                  errors.contactEmail && 'border-red-500/80 focus-visible:ring-red-500',
                )}
              />
            </div>
            {errors.contactEmail && (
              <p className="mt-1 text-xs text-red-400">{errors.contactEmail}</p>
            )}
          </div>

          {/* Phone Number with country code */}
          <div>
            <Label className="text-xs text-white/80 font-medium">
              Phone Number (with Country Code) <span className="text-[#CC2D24]">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
              <Input
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
              <p className="mt-1 text-xs text-red-400">{errors.contactPhone}</p>
            )}
          </div>

          {/* Searchable Country Selector */}
          <div className="relative">
            <Label className="text-xs text-white/80 font-medium">
              Country <span className="text-[#CC2D24]">*</span>
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
                placeholder="Search country..."
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
            {errors.country && <p className="mt-1 text-xs text-red-400">{errors.country}</p>}
          </div>

          {/* City */}
          <div>
            <Label className="text-xs text-white/80 font-medium">
              City / Municipality <span className="text-[#CC2D24]">*</span>
            </Label>
            <Input
              value={profile.city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="e.g. Manchester or Porto"
              className={cn(
                'mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30',
                errors.city && 'border-red-500/80 focus-visible:ring-red-500',
              )}
            />
            {errors.city && <p className="mt-1 text-xs text-red-400">{errors.city}</p>}
          </div>

          {/* Street / Facility Address */}
          <div>
            <Label className="text-xs text-white/80 font-medium">Street Address / Industrial Park</Label>
            <Input
              value={profile.addressLine}
              onChange={(e) => onChange({ addressLine: e.target.value })}
              placeholder="e.g. Unit 4, Ancoats Mill, Pollard Street"
              className="mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Manufacturer Types Multi-Select */}
        <div className="pt-2 border-t border-[#252528]">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-white/80 font-medium">
              Manufacturer Type(s) <span className="text-[#CC2D24]">*</span>
            </Label>
            <span className="text-[11px] text-white/40">Select all that apply</span>
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
            <p className="mt-1.5 text-xs text-red-400">{errors.manufacturerTypes}</p>
          )}
        </div>
      </div>

      {/* Optional Information Section */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Layers className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">Operational Scale & Details</h3>
          </div>
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/40">
            Optional
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Company Website */}
          <div>
            <Label className="text-xs text-white/60">Company Website</Label>
            <div className="relative mt-1.5">
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-white/30" />
              <Input
                value={profile.website}
                onChange={(e) => onChange({ website: e.target.value })}
                placeholder="https://yourfactory.com"
                className="pl-9 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Years in Operation */}
          <div>
            <Label className="text-xs text-white/60">Years in Operation</Label>
            <Input
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
            <Label className="text-xs text-white/60">Number of Employees</Label>
            <Input
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
            <Label className="text-xs text-white/60">Facility Size (Sq Ft)</Label>
            <Input
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
            <Label className="text-xs text-white/60">Business Registration / VAT Number</Label>
            <Input
              value={profile.businessRegNumber || ''}
              onChange={(e) => onChange({ businessRegNumber: e.target.value })}
              placeholder="e.g. GB 123 4567 89 or PT 509876543"
              className="mt-1.5 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Supported Languages Multi-select */}
        <div>
          <Label className="text-xs text-white/60">Supported Languages for Communication</Label>
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
          <Label className="text-xs text-white/60">
            Company Description & Specialisations
          </Label>
          <p className="mt-0.5 text-[11px] text-white/40">
            Explain your craftsmanship, primary machinery, aesthetic focus, and brand pedigree.
          </p>
          <Textarea
            rows={3}
            value={profile.companyDescription || ''}
            onChange={(e) => onChange({ companyDescription: e.target.value })}
            placeholder="e.g. Specialised in heavyweight loopback fleece hoodies and oversized vintage-wash tees. Equipped with automated cutting tables and multi-head Tajima embroidery."
            className="mt-2 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={onNext}
          className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-6 font-semibold"
        >
          Continue to Products & Garments
        </Button>
      </div>
    </div>
  );
}
