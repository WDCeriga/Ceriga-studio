import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../../i18n/i18n';
import { useState, useMemo } from 'react';
import {
  Truck,
  Globe2,
  Check,
  Search,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { cn } from '../../../components/ui/utils';
import {
  ALL_SHIPPING_METHODS,
  type CompleteManufacturerProfile,
  type ShippingMethod,
} from '../../../data/manufacturerOnboardingTypes';
import { REGIONS_AND_DESTINATIONS } from '../../../data/countryData';

type Props = {
  profile: CompleteManufacturerProfile;
  onChange: (patch: Partial<CompleteManufacturerProfile>) => void;
  onNext: () => void;
  onBack: () => void;
  errors: Record<string, string>;
};

export function StepShippingServices({
  profile,
  onChange,
  onNext,
  onBack,
  errors,
}: Props) {
  useCerigaTranslation();

  const [destSearch, setDestSearch] = useState('');
  const [openMethod, setOpenMethod] = useState<ShippingMethod>();
  const visibleMethod = openMethod ?? profile.shippingMethods[0];

  const filteredDestinations = useMemo(() => {
    if (!destSearch.trim()) return REGIONS_AND_DESTINATIONS;
    return REGIONS_AND_DESTINATIONS.filter((d) =>
      d.toLowerCase().includes(destSearch.toLowerCase()),
    );
  }, [destSearch]);

  const toggleDestination = (dest: string) => {
    const existing = profile.shippingDestinations || [];
    const next = existing.includes(dest)
      ? existing.filter((d) => d !== dest)
      : [...existing, dest];
    onChange({ shippingDestinations: next });
  };

  const updateShippingDetails = (
    method: ShippingMethod,
    patch: Pick<Partial<CompleteManufacturerProfile>, 'shippingProvidersByMethod' | 'shippingTransitDaysByMethod'>,
  ) => {
    const next = { ...profile, ...patch };
    const provider = next.shippingProvidersByMethod?.[method]
      ?? (profile.shippingMethods.includes(method) ? profile.shippingProvider : '');
    const days = next.shippingTransitDaysByMethod?.[method];
    const hasDetails = !!provider?.trim() || (typeof days === 'number' && Number.isInteger(days) && days >= 0);
    onChange({
      ...patch,
      // Persist the displayed provider so enabling a time-only method cannot
      // cause an old account-wide provider to appear in the empty field.
      shippingProvidersByMethod: { ...next.shippingProvidersByMethod, [method]: provider ?? '' },
      shippingMethods: hasDetails
        ? [...new Set([...profile.shippingMethods, method])]
        : profile.shippingMethods.filter(item => item !== method),
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">{cerigaTranslate("interface.text_a26efb4b64d5de40")}</h2>
        <p className="mt-1 text-sm text-white/50">{cerigaTranslate("interface.text_e3e8607751b315d4")}</p>
      </div>

      {/* Structured Shipping Destinations */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Globe2 className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">{cerigaTranslate("interface.text_c99fb82f22daf112")}</h3>
            <span className="text-xs text-[#CC2D24] font-medium">{cerigaTranslate("interface.text_b62a197611d03b4d")}</span>
          </div>
          <span className="text-xs text-white/50">
            {profile.shippingDestinations.length}{" "}{cerigaTranslate("interface.text_d7cbbb688b2e506c")}</span>
        </div>

        {errors.destinations && (
          <p className="text-xs text-red-400">{cerigaTranslateLabel(errors.destinations)}</p>
        )}

        {/* Search Field */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
          <Input
            value={destSearch}
            onChange={(e) => setDestSearch(e.target.value)}
            placeholder={cerigaTranslate("interface.text_6c97750848e5aaa1")}
            className="pl-9 h-9 text-xs border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
          />
        </div>

        {/* Multi-select Pills */}
        <div className="flex flex-wrap gap-2">
          {filteredDestinations.map((dest) => {
            const selected = profile.shippingDestinations.includes(dest);
            return (
              <button
                key={dest}
                type="button"
                onClick={() => toggleDestination(dest)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                  selected
                    ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white ring-1 ring-[#CC2D24]/40'
                    : 'border-[#252528] bg-white/[0.02] text-white/60 hover:text-white',
                )}
              >
                <div
                  className={cn(
                    'h-3.5 w-3.5 rounded flex items-center justify-center border text-[9px]',
                    selected ? 'border-[#CC2D24] bg-[#CC2D24] text-white' : 'border-white/20',
                  )}
                >
                  {selected && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
                {dest}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shipping Methods & Logistics Details */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 text-white">
          <Truck className="h-4 w-4 text-[#CC2D24]" />
          <h3 className="text-sm font-semibold">{cerigaTranslate("interface.text_8b9e7b142325d859")}</h3>
          <span className="text-xs text-[#CC2D24] font-medium">{cerigaTranslate("interface.text_b62a197611d03b4d")}</span>
        </div>

        {errors.methods && <p className="text-xs text-red-400">{cerigaTranslateLabel(errors.methods)}</p>}

        {/* Shipping Methods Selection */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ALL_SHIPPING_METHODS.map((method) => {
            const on = profile.shippingMethods.includes(method);
            return (
              <button
                key={method}
                type="button"
                onClick={() => setOpenMethod(method)}
                aria-pressed={visibleMethod === method}
                className={cn(
                  'p-3 rounded-xl border text-left transition',
                  visibleMethod === method
                    ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white ring-1 ring-[#CC2D24]/40'
                    : cn('border-[#252528] bg-white/[0.02] hover:border-white/20 hover:text-white',
                      on ? 'text-white' : 'text-white/60'),
                )}
              >
                <span className="text-xs font-semibold">{method}</span>
                {on && <Check className="ml-1 inline h-3 w-3" aria-label={cerigaTranslate("interface.text_92c1cdfdf4cb9cf6")} />}
              </button>
            );
          })}
        </div>

        {visibleMethod && <div className="space-y-3">
          <p className="text-xs text-white/60">{cerigaTranslate("interface.text_88ef6372bbd80db4")}</p>
          <fieldset key={visibleMethod} className="grid gap-3 rounded-lg border border-white/15 p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium">{visibleMethod}</legend>
            <label className="block text-sm font-medium">{cerigaTranslate("interface.text_472590ae974d4c1f")}<Input className="mt-2 min-h-11" maxLength={200} placeholder={cerigaTranslate("interface.text_a7804807dcb8ee5e")}
                value={profile.shippingProvidersByMethod?.[visibleMethod]
                  ?? (profile.shippingMethods.includes(visibleMethod) ? profile.shippingProvider ?? '' : '')}
                onChange={event => updateShippingDetails(visibleMethod, {
                  shippingProvidersByMethod: {
                    ...profile.shippingProvidersByMethod,
                    [visibleMethod]: event.target.value,
                  },
                })}/>
            </label>
            <label className="block text-sm font-medium">{cerigaTranslate("interface.text_c0f69b97b113068e")}<Input className="mt-2 min-h-11" inputMode="numeric" maxLength={3}
                placeholder={cerigaTranslate("interface.text_59be71333c960fd0")}
                value={profile.shippingTransitDaysByMethod?.[visibleMethod] ?? ''}
                onChange={event => {
                  const value = event.target.value;
                  if (!/^\d{0,3}$/.test(value)) return;
                  updateShippingDetails(visibleMethod, {
                    shippingTransitDaysByMethod: {
                      ...profile.shippingTransitDaysByMethod,
                      [visibleMethod]: value === '' ? undefined : Number(value),
                    },
                  });
                }}/>
            </label>
          </fieldset>
        </div>}

        {/* Additional Logistics Flags */}
        <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-[#252528]">
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3">
            <div>
              <span className="text-xs font-medium text-white">{cerigaTranslate("interface.text_bac2d8fd76f07510")}</span>
              <p className="text-[11px] text-white/40">{cerigaTranslate("interface.text_1af648e2a6aeed32")}</p>
            </div>
            <Switch
              checked={profile.customsDocumentationSupport}
              onCheckedChange={(c) => onChange({ customsDocumentationSupport: c })}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3">
            <div>
              <span className="text-xs font-medium text-white">{cerigaTranslate("interface.text_db4cdcf06d618d9a")}</span>
              <p className="text-[11px] text-white/40">{cerigaTranslate("interface.text_897a314a44788576")}</p>
            </div>
            <Switch
              checked={profile.trackingAvailability}
              onCheckedChange={(c) => onChange({ trackingAvailability: c })}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3">
            <div>
              <span className="text-xs font-medium text-white">{cerigaTranslate("interface.text_8d09b7616cffbc31")}</span>
              <p className="text-[11px] text-white/40">{cerigaTranslate("interface.text_03f4757c2016c231")}</p>
            </div>
            <Switch
              checked={profile.directToCustomerShipping}
              onCheckedChange={(c) => onChange({ directToCustomerShipping: c })}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3">
            <div>
              <span className="text-xs font-medium text-white">{cerigaTranslate("interface.text_b665b946c4e8fdad")}</span>
              <p className="text-[11px] text-white/40">{cerigaTranslate("interface.text_3d4c56888981cd18")}</p>
            </div>
            <Switch
              checked={profile.bulkShipmentHandling}
              onCheckedChange={(c) => onChange({ bulkShipmentHandling: c })}
            />
          </div>

          <div>
            <Label className="text-xs text-white/70 font-medium">{cerigaTranslate("interface.text_df0ba69e41f90968")}</Label>
            <Input
              type="number"
              min="1"
              value={profile.typicalDispatchDays || 2}
              onChange={(e) => onChange({ typicalDispatchDays: Number(e.target.value) || 1 })}
              className="mt-1 h-8 text-xs border-white/10 bg-white/[0.03] text-white"
            />
          </div>
        </div>
      </div>

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
        >{cerigaTranslate("interface.text_5a16e3d43a6a82ab")}</Button>
      </div>
    </div>
  );
}
