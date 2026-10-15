import { useState, useMemo } from 'react';
import {
  Ship,
  Truck,
  Globe2,
  Package,
  Layers,
  Check,
  Search,
  Plus,
  Trash2,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { cn } from '../../../components/ui/utils';
import {
  ALL_ADDITIONAL_SERVICES,
  ALL_SHIPPING_METHODS,
  type AdditionalService,
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

  const toggleMethod = (method: ShippingMethod) => {
    const existing = profile.shippingMethods || [];
    const next = existing.includes(method)
      ? existing.filter((m) => m !== method)
      : [...existing, method];
    onChange({ shippingMethods: next });
  };

  const toggleService = (service: AdditionalService) => {
    const existing = profile.additionalServices || [];
    const next = existing.includes(service)
      ? existing.filter((s) => s !== service)
      : [...existing, service];
    onChange({ additionalServices: next });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">5. Shipping & Additional Services</h2>
        <p className="mt-1 text-sm text-white/50">
          Define global delivery destinations, logistics methods, customs compliance, and value-added manufacturing services.
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
          <h3 className="text-sm font-semibold">Shipping Modes & Handling</h3>
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
                onClick={() => toggleMethod(method)}
                className={cn(
                  'p-3 rounded-xl border text-left transition',
                  on
                    ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white ring-1 ring-[#CC2D24]/40'
                    : 'border-[#252528] bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white',
                )}
              >
                <span className="text-xs font-semibold">{method}</span>
              </button>
            );
          })}
        </div>

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

      {/* Additional Manufacturing & Studio Services */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Package className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">Additional Studio & Value-Add Services</h3>
          </div>
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/40">
            Optional
          </span>
        </div>

        <p className="text-xs text-white/40">
          Services beyond basic cut & sew that brands can commission through Ceriga.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {ALL_ADDITIONAL_SERVICES.map((srv) => {
            const on = profile.additionalServices.includes(srv);
            return (
              <button
                key={srv}
                type="button"
                onClick={() => toggleService(srv)}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl border text-left transition',
                  on
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-white font-medium'
                    : 'border-[#252528] bg-white/[0.02] text-white/60 hover:text-white',
                )}
              >
                <div
                  className={cn(
                    'h-3.5 w-3.5 rounded flex items-center justify-center border text-[9px]',
                    on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-white/20',
                  )}
                >
                  {on && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
                <span className="text-xs">{srv}</span>
              </button>
            );
          })}
        </div>
      </div>

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
          Review & Complete Onboarding
        </Button>
      </div>
    </div>
  );
}
