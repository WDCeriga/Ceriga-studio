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
        <h2 className="text-xl font-semibold text-white">6. Shipping</h2>
        <p className="mt-1 text-sm text-white/50">
          Choose your shipping destinations, delivery methods and customs services.
        </p>
      </div>

      {/* Structured Shipping Destinations */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Globe2 className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">Shipping Destinations & Regions</h3>
            <span className="text-xs text-[#CC2D24] font-medium">* Required</span>
          </div>
          <span className="text-xs text-white/50">
            {profile.shippingDestinations.length} selected
          </span>
        </div>

        {errors.destinations && (
          <p className="text-xs text-red-400">{errors.destinations}</p>
        )}

        {/* Search Field */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
          <Input
            value={destSearch}
            onChange={(e) => setDestSearch(e.target.value)}
            placeholder="Search country or region (e.g. EU, Worldwide)..."
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
          <h3 className="text-sm font-semibold">Shipping methods & provider</h3>
          <span className="text-xs text-[#CC2D24] font-medium">* Required</span>
        </div>

        {errors.methods && <p className="text-xs text-red-400">{errors.methods}</p>}

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
                {on && <Check className="ml-1 inline h-3 w-3" aria-label="Enabled" />}
              </button>
            );
          })}
        </div>

        {visibleMethod && <div className="space-y-3">
          <p className="text-xs text-white/60">Add a provider or shipping time to offer this method on quotes. Use 0 days for same-day delivery.</p>
          <fieldset key={visibleMethod} className="grid gap-3 rounded-lg border border-white/15 p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium">{visibleMethod}</legend>
            <label className="block text-sm font-medium">
              Provider
              <Input className="mt-2 min-h-11" maxLength={200} placeholder="e.g. DHL"
                value={profile.shippingProvidersByMethod?.[visibleMethod]
                  ?? (profile.shippingMethods.includes(visibleMethod) ? profile.shippingProvider ?? '' : '')}
                onChange={event => updateShippingDetails(visibleMethod, {
                  shippingProvidersByMethod: {
                    ...profile.shippingProvidersByMethod,
                    [visibleMethod]: event.target.value,
                  },
                })}/>
            </label>
            <label className="block text-sm font-medium">
              Estimated shipping time (calendar days)
              <Input className="mt-2 min-h-11" inputMode="numeric" maxLength={3}
                placeholder="Optional"
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
              <span className="text-xs font-medium text-white">Customs Documentation Support</span>
              <p className="text-[11px] text-white/40">Invoices, packing lists, and export forms</p>
            </div>
            <Switch
              checked={profile.customsDocumentationSupport}
              onCheckedChange={(c) => onChange({ customsDocumentationSupport: c })}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3">
            <div>
              <span className="text-xs font-medium text-white">Shipment Tracking Availability</span>
              <p className="text-[11px] text-white/40">Live carrier tracking numbers for parcels</p>
            </div>
            <Switch
              checked={profile.trackingAvailability}
              onCheckedChange={(c) => onChange({ trackingAvailability: c })}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3">
            <div>
              <span className="text-xs font-medium text-white">Direct-to-Customer (D2C) Dropship</span>
              <p className="text-[11px] text-white/40">Ship directly to retail end customers</p>
            </div>
            <Switch
              checked={profile.directToCustomerShipping}
              onCheckedChange={(c) => onChange({ directToCustomerShipping: c })}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3">
            <div>
              <span className="text-xs font-medium text-white">Bulk Palletised Freight Handling</span>
              <p className="text-[11px] text-white/40">Pallets, container load, freight loading bays</p>
            </div>
            <Switch
              checked={profile.bulkShipmentHandling}
              onCheckedChange={(c) => onChange({ bulkShipmentHandling: c })}
            />
          </div>

          <div>
            <Label className="text-xs text-white/70 font-medium">
              Typical Dispatch Time After Packing (Days)
            </Label>
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
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="onboarding-primary bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-6 font-semibold"
        >
          Review setup
        </Button>
      </div>
    </div>
  );
}
