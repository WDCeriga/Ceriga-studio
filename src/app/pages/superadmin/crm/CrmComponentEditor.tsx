import { useState, type ChangeEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getMergedGroupOptions,
  isCustomOptionId,
  optionIdFromLabel,
  stepAllowsCustomOptions,
  type BaseComponent,
  type GarmentBaseId,
  type StepOption,
} from '../../../data/crmCatalogMock';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { cn } from '../../../components/ui/utils';

type EditorPatch = {
  enabledComponentIds?: number[];
  enabledOptions?: Record<string, string[]>;
  customOptions?: Record<string, StepOption[]>;
};

type BuilderComponentEditorProps = {
  baseId: GarmentBaseId;
  components: BaseComponent[];
  enabledComponentIds: number[];
  enabledOptions: Record<string, string[]>;
  customOptions: Record<string, StepOption[]>;
  allowCustomOptions: boolean;
  /** Product mode: holders/options cannot exceed base */
  allowedComponentIds?: number[];
  allowedOptionsByGroup?: Record<string, string[]>;
  onChange: (patch: EditorPatch) => void;
};

export function BuilderComponentEditor({
  components,
  enabledComponentIds,
  enabledOptions,
  customOptions,
  allowCustomOptions,
  allowedComponentIds,
  allowedOptionsByGroup,
  onChange,
}: BuilderComponentEditorProps) {
  const [newOptionNames, setNewOptionNames] = useState<Record<string, string>>({});
  const isProductMode = !!allowedComponentIds;

  const toggleComponent = (stepId: number, enabled: boolean) => {
    if (isProductMode && enabled && !allowedComponentIds!.includes(stepId)) return;
    const next = enabled
      ? [...new Set([...enabledComponentIds, stepId])].sort((a, b) => a - b)
      : enabledComponentIds.filter((id) => id !== stepId);
    onChange({ enabledComponentIds: next });
  };

  const canToggleOption = (groupKey: string, optionId: string) => {
    if (!allowedOptionsByGroup) return true;
    return (allowedOptionsByGroup[groupKey] ?? []).includes(optionId);
  };

  const toggleOption = (groupKey: string, optionId: string) => {
    if (!canToggleOption(groupKey, optionId)) return;
    const current = enabledOptions[groupKey] ?? [];
    const next = current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId];
    onChange({ enabledOptions: { ...enabledOptions, [groupKey]: next } });
  };

  const setGroupOptions = (groupKey: string, optionIds: string[]) => {
    const allowed = allowedOptionsByGroup?.[groupKey];
    const next = allowed ? optionIds.filter((id) => allowed.includes(id)) : optionIds;
    onChange({ enabledOptions: { ...enabledOptions, [groupKey]: next } });
  };

  const addCustomOption = (groupKey: string, baseGroupOptions: StepOption[]) => {
    const name = (newOptionNames[groupKey] ?? '').trim();
    if (!name) {
      toast.error('Enter a label');
      return;
    }
    const merged = [...baseGroupOptions, ...(customOptions[groupKey] ?? [])];
    if (merged.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
      toast.error('That label already exists');
      return;
    }
    const id = optionIdFromLabel(name, groupKey);
    const option = { id, name };
    onChange({
      customOptions: {
        ...customOptions,
        [groupKey]: [...(customOptions[groupKey] ?? []), option],
      },
      enabledOptions: {
        ...enabledOptions,
        [groupKey]: [...(enabledOptions[groupKey] ?? []), id],
      },
    });
    setNewOptionNames((prev) => ({ ...prev, [groupKey]: '' }));
    toast.success(`Added spec label “${name}”`);
  };

  const removeCustomOption = (groupKey: string, optionId: string) => {
    onChange({
      customOptions: {
        ...customOptions,
        [groupKey]: (customOptions[groupKey] ?? []).filter((o) => o.id !== optionId),
      },
      enabledOptions: {
        ...enabledOptions,
        [groupKey]: (enabledOptions[groupKey] ?? []).filter((id) => id !== optionId),
      },
    });
  };

  return (
    <div className="space-y-3">
      {components.map((comp) => {
        const holderInBase = !allowedComponentIds || allowedComponentIds.includes(comp.stepId);
        const holderEnabled = enabledComponentIds.includes(comp.stepId);
        const groups = comp.groups;
        const hasOptions = groups.length > 0;

        return (
          <div
            key={comp.stepId}
            className={cn(
              'rounded-xl border px-4 py-3.5 transition',
              !holderInBase && 'opacity-40',
              holderEnabled
                ? 'border-white/[0.08] bg-black/25'
                : 'border-white/[0.04] bg-black/15 opacity-60',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{comp.title}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/35">{holderEnabled ? 'On' : 'Off'}</span>
                  <Switch
                    checked={holderEnabled}
                    disabled={isProductMode && !holderInBase}
                    onCheckedChange={(v) => toggleComponent(comp.stepId, v)}
                  />
                </div>
                {holderEnabled && hasOptions ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {groups.map((group) => {
                      const pool = allowedOptionsByGroup
                        ? getMergedGroupOptions(group, customOptions).filter((o) =>
                            (allowedOptionsByGroup[group.key] ?? []).includes(o.id),
                          )
                        : getMergedGroupOptions(group, customOptions);
                      const enabled = enabledOptions[group.key] ?? [];
                      const poolIds = pool.map((o) => o.id);
                      if (poolIds.length === 0) return null;
                      return (
                        <button
                          key={group.key}
                          type="button"
                          className="text-[10px] font-medium text-white/35 hover:text-[#CC2D24]"
                          onClick={() =>
                            setGroupOptions(
                              group.key,
                              enabled.length === poolIds.length ? [] : poolIds,
                            )
                          }
                        >
                          {group.label}: {enabled.length === poolIds.length ? 'Clear' : 'All'}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            {hasOptions ? (
              <div
                className={cn(
                  'mt-3 space-y-3',
                  !holderEnabled && 'pointer-events-none opacity-40',
                )}
              >
                {groups.map((group) => {
                  const merged = allowedOptionsByGroup
                    ? getMergedGroupOptions(group, customOptions).filter((o) =>
                        (allowedOptionsByGroup[group.key] ?? []).includes(o.id),
                      )
                    : getMergedGroupOptions(group, customOptions);

                  if (merged.length === 0 && isProductMode) return null;

                  return (
                    <div key={group.key}>
                      {groups.length > 1 ? (
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                          {group.label}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        {merged.map((option) => {
                          const selected = (enabledOptions[group.key] ?? []).includes(option.id);
                          const isCustom = isCustomOptionId(option.id, group.key, customOptions);
                          return (
                            <span key={`${group.key}-${option.id}`} className="inline-flex">
                              <button
                                type="button"
                                disabled={!holderEnabled}
                                onClick={() => toggleOption(group.key, option.id)}
                                className={cn(
                                  'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
                                  isCustom && allowCustomOptions && 'rounded-r-none border-r-0 pr-2',
                                  selected
                                    ? isCustom
                                      ? 'border-amber-500/45 bg-amber-500/15 text-white'
                                      : 'border-[#CC2D24]/45 bg-[#CC2D24]/15 text-white'
                                    : isCustom
                                      ? 'border-amber-500/25 bg-amber-500/5 text-white/55'
                                      : 'border-white/[0.08] bg-white/[0.02] text-white/40 hover:border-white/15 hover:text-white/65',
                                )}
                              >
                                {option.name}
                                {isCustom ? (
                                  <span className="ml-1 text-[9px] uppercase tracking-wide opacity-60">
                                    spec
                                  </span>
                                ) : null}
                              </button>
                              {isCustom && allowCustomOptions ? (
                                <button
                                  type="button"
                                  disabled={!holderEnabled}
                                  onClick={() => removeCustomOption(group.key, option.id)}
                                  className="rounded-r-lg border border-l-0 border-amber-500/30 px-1.5 py-1 text-white/50 hover:text-white"
                                  aria-label={`Remove ${option.name}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              ) : null}
                            </span>
                          );
                        })}
                      </div>

                      {allowCustomOptions &&
                      holderEnabled &&
                      stepAllowsCustomOptions(comp.stepName) ? (
                        <div className="mt-2 flex gap-2">
                          <Input
                            value={newOptionNames[group.key] ?? ''}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              setNewOptionNames((prev) => ({
                                ...prev,
                                [group.key]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addCustomOption(group.key, group.options);
                              }
                            }}
                            placeholder={`Spec-only ${group.label.toLowerCase()} label…`}
                            className="h-8 flex-1 border-white/12 bg-white/[0.03] text-xs text-white placeholder:text-white/25"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0 border-white/15 bg-transparent text-white hover:bg-white/10"
                            onClick={() => addCustomOption(group.key, group.options)}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add label
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
