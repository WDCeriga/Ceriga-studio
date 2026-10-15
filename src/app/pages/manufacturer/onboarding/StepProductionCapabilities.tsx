import { useState, useMemo } from 'react';
import {
  Wrench,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  HelpCircle,
  ShieldCheck,
  Building,
  Handshake,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { cn } from '../../../components/ui/utils';
import {
  CAPABILITY_GROUPS,
  type CapabilitySource,
  type CompleteManufacturerProfile,
} from '../../../data/manufacturerOnboardingTypes';

type Props = {
  profile: CompleteManufacturerProfile;
  onChange: (patch: Partial<CompleteManufacturerProfile>) => void;
  onNext: () => void;
  onBack: () => void;
  errors: Record<string, string>;
};

export function StepProductionCapabilities({
  profile,
  onChange,
  onNext,
  onBack,
  errors,
}: Props) {
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [customCapInput, setCustomCapInput] = useState('');

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const capabilitiesMap = profile.capabilitiesMap || {};
  const selectedCount = Object.keys(capabilitiesMap).length;

  const setCapability = (name: string, source: CapabilitySource | null) => {
    const nextMap = { ...capabilitiesMap };
    if (!source) {
      delete nextMap[name];
    } else {
      nextMap[name] = source;
    }
    onChange({ capabilitiesMap: nextMap });
  };

  const addCustomCapability = () => {
    const text = customCapInput.trim();
    if (!text) return;
    const existing = profile.customCapabilities || [];
    if (!existing.includes(text)) {
      onChange({
        customCapabilities: [...existing, text],
        capabilitiesMap: {
          ...capabilitiesMap,
          [text]: 'in_house',
        },
      });
    }
    setCustomCapInput('');
  };

  const removeCustomCapability = (name: string) => {
    const nextCustom = (profile.customCapabilities || []).filter((c) => c !== name);
    const nextMap = { ...capabilitiesMap };
    delete nextMap[name];
    onChange({
      customCapabilities: nextCustom,
      capabilitiesMap: nextMap,
    });
  };

  // Filter groups according to search query
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CAPABILITY_GROUPS;

    return CAPABILITY_GROUPS.map((group) => {
      const matchingItems = group.items.filter((item) =>
        item.toLowerCase().includes(q),
      );
      return {
        ...group,
        items: matchingItems,
      };
    }).filter((g) => g.items.length > 0 || g.title.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">3. Production Capabilities</h2>
        <p className="mt-1 text-sm text-white/50">
          Organise your factory techniques into clear production methods. Specify whether each technique is performed in-house or outsourced to an accredited partner.
        </p>
      </div>

      {/* Global Capability Search & Counter Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#252528] bg-[#111113] p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search printing, embroidery, washing, cut & sew..."
            className="pl-9 h-9 border-white/10 bg-white/[0.03] text-xs text-white placeholder:text-white/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70">
            <span className="font-semibold text-[#CC2D24]">{selectedCount}</span> techniques active
          </div>
        </div>
      </div>

      {errors.capabilities && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
          {errors.capabilities}
        </div>
      )}

      {/* Capability Groups Accordions */}
      <div className="space-y-4">
        {filteredGroups.map((group) => {
          const isCollapsed = Boolean(collapsedCategories[group.category]);
          const inGroupSelected = group.items.filter((it) => Boolean(capabilitiesMap[it])).length;

          return (
            <div
              key={group.category}
              className="rounded-2xl border border-[#252528] bg-[#111113] overflow-hidden transition"
            >
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => toggleCategoryCollapse(group.category)}
                className="flex w-full items-center justify-between p-5 text-left hover:bg-white/[0.01]"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-semibold text-white">{group.title}</h3>
                    {inGroupSelected > 0 && (
                      <span className="rounded-full bg-[#CC2D24]/20 border border-[#CC2D24]/40 px-2 py-0.5 text-[10px] font-semibold text-red-200">
                        {inGroupSelected} enabled
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/40">{group.description}</p>
                </div>
                <div className="flex items-center gap-2 text-white/40">
                  <span className="text-xs">{isCollapsed ? 'Expand' : 'Collapse'}</span>
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </div>
              </button>

              {/* Group Body Items */}
              {!isCollapsed && (
                <div className="border-t border-[#252528] p-5 space-y-3 bg-black/10">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item) => {
                      const source = capabilitiesMap[item];
                      const isSelected = Boolean(source);

                      return (
                        <div
                          key={item}
                          className={cn(
                            'flex flex-col justify-between p-3 rounded-xl border transition',
                            isSelected
                              ? 'border-[#CC2D24]/60 bg-[#CC2D24]/10 shadow-sm'
                              : 'border-[#252528] bg-white/[0.02] hover:border-white/20',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-white">{item}</span>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCapability(item, 'in_house');
                                } else {
                                  setCapability(item, null);
                                }
                              }}
                              className="h-4 w-4 rounded border-[#252528] bg-black/40 text-[#CC2D24] focus:ring-[#CC2D24] cursor-pointer"
                            />
                          </div>

                          {/* Source Radio Pill Toggle: In-House vs Outsourced */}
                          {isSelected && (
                            <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-white/5">
                              <button
                                type="button"
                                onClick={() => setCapability(item, 'in_house')}
                                className={cn(
                                  'flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition',
                                  source === 'in_house'
                                    ? 'bg-[#CC2D24] text-white shadow-sm'
                                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white',
                                )}
                              >
                                <Building className="h-2.5 w-2.5" />
                                In-house
                              </button>
                              <button
                                type="button"
                                onClick={() => setCapability(item, 'outsourced')}
                                className={cn(
                                  'flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition',
                                  source === 'outsourced'
                                    ? 'bg-amber-600/80 text-white shadow-sm'
                                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white',
                                )}
                              >
                                <Handshake className="h-2.5 w-2.5" />
                                Outsourced
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Additional Capabilities Section */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Additional Custom Capabilities</h3>
          <p className="mt-0.5 text-xs text-white/40">
            Offer proprietary machinery or niche methods not listed above (e.g. Ultrasonic bonding, Laser cutting, Dip dye).
          </p>
        </div>

        <div className="flex max-w-md gap-2">
          <Input
            value={customCapInput}
            onChange={(e) => setCustomCapInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomCapability();
              }
            }}
            placeholder="Add technique name..."
            className="border-white/10 bg-white/[0.03] text-xs text-white placeholder:text-white/30"
          />
          <Button
            type="button"
            onClick={addCustomCapability}
            className="bg-white/10 text-white hover:bg-white/20 text-xs px-4"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>

        {profile.customCapabilities && profile.customCapabilities.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {profile.customCapabilities.map((custom) => {
              const source = capabilitiesMap[custom] || 'in_house';
              return (
                <div
                  key={custom}
                  className="flex items-center gap-2 rounded-xl border border-[#CC2D24]/40 bg-[#CC2D24]/10 px-3 py-1.5 text-xs text-white"
                >
                  <span className="font-semibold">{custom}</span>
                  <div className="flex items-center gap-1 rounded bg-black/40 p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setCapability(custom, 'in_house')}
                      className={cn(
                        'px-1.5 py-0.5 rounded',
                        source === 'in_house' ? 'bg-[#CC2D24] text-white font-medium' : 'text-white/40',
                      )}
                    >
                      In-house
                    </button>
                    <button
                      type="button"
                      onClick={() => setCapability(custom, 'outsourced')}
                      className={cn(
                        'px-1.5 py-0.5 rounded',
                        source === 'outsourced' ? 'bg-amber-600 text-white font-medium' : 'text-white/40',
                      )}
                    >
                      Outsourced
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomCapability(custom)}
                    className="text-white/40 hover:text-red-300 ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
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
          Continue to Capacity & Pricing
        </Button>
      </div>
    </div>
  );
}
