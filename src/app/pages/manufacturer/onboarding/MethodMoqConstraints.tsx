import { useState } from 'react';
import { ChevronsUpDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../../components/ui/command';
import type { CompleteManufacturerProfile, CustomMethodMoq } from '../../../data/manufacturerOnboardingTypes';
import { getCapabilityCatalog, getSelectedMethods, isValidMethodMoq, METHOD_CATEGORIES, resolveConstraintMethod } from '../../../data/manufacturerMethodConstraints';

type Props = { profile: CompleteManufacturerProfile; onChange: (patch: Partial<CompleteManufacturerProfile>) => void };

export function MethodMoqConstraints({ profile, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [moq, setMoq] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const catalog = getCapabilityCatalog(profile), methods = getSelectedMethods(profile);
  const constraints = profile.customMethodMoqs ?? [];
  const assigned = new Set(constraints.filter((_, index) => index !== editing).map(constraint => resolveConstraintMethod(constraint, catalog)?.id).filter(Boolean));
  const options = methods.filter(method => !assigned.has(method.id));
  const selected = options.find(method => method.id === selectedId);
  const clear = () => { setSelectedId(''); setMoq(''); setEditing(null); setError(''); };
  const save = () => {
    if (!selected) { setError('Select an active method from Production Capabilities.'); return; }
    const value = Number(moq);
    if (!moq.trim() || !isValidMethodMoq(value)) { setError('MOQ must be a positive whole number.'); return; }
    const constraint: CustomMethodMoq = { capabilityId: selected.id, method: selected.name, moq: value };
    onChange({ customMethodMoqs: editing === null ? [...constraints, constraint] : constraints.map((entry, index) => index === editing ? constraint : entry), capabilityCatalog: catalog });
    clear();
  };
  const edit = (index: number) => {
    const constraint = constraints[index];
    setEditing(index); setSelectedId(resolveConstraintMethod(constraint, catalog)?.id ?? ''); setMoq(String(constraint.moq)); setError('');
  };
  const remove = (index: number) => {
    onChange({ customMethodMoqs: constraints.filter((_, itemIndex) => itemIndex !== index) });
    if (editing === index) clear();
    else if (editing !== null && editing > index) setEditing(editing - 1);
  };

  return (
    <section className="pt-3 border-t border-[#252528]" aria-label="Customisation Method Constraints">
      <h4 className="text-xs text-white/70 font-medium">Customisation Method Constraints</h4>
      <p className="mt-1 text-xs text-white/40">Set minimum quantities for methods enabled in Production Capabilities.</p>
      {!methods.length && <p className="mt-3 text-xs text-white/50">Select methods in Production Capabilities to add method-specific MOQs.</p>}
      <div className="mt-3 flex max-w-2xl flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger type="button" role="combobox" aria-label="Customisation method" aria-expanded={open} className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-xs text-white hover:border-[#CC2D24]/60 focus-visible:outline focus-visible:outline-[#CC2D24] sm:w-80">
              <span className="truncate">{selected?.name ?? 'Select a customisation method...'}</span><ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 text-white/50" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(360px,90vw)] border-[#252528] bg-[#111113] p-0 text-white">
            <Command className="bg-transparent text-white">
              <CommandInput placeholder="Search selected methods..." aria-label="Search selected methods" />
              <CommandList>
                <CommandEmpty>{!methods.length ? 'No methods selected in Production Capabilities.' : !options.length ? 'All selected methods already have an MOQ.' : 'No selected methods match your search.'}</CommandEmpty>
                {METHOD_CATEGORIES.map(category => {
                  const items = options.filter(method => method.category === category.id);
                  return items.length ? <CommandGroup key={category.id} heading={category.label}>
                    {items.map(method => <CommandItem key={method.id} value={method.id} keywords={[method.name, category.label]} onSelect={() => { setSelectedId(method.id); setOpen(false); setError(''); }} className="text-xs text-white/80 data-[selected=true]:bg-[#CC2D24]/20 data-[selected=true]:text-white">
                      {method.name}{method.custom && <span className="ml-auto text-[10px] text-white/40">Custom</span>}
                    </CommandItem>)}
                  </CommandGroup> : null;
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input type="number" min="1" step="1" aria-label="Method MOQ" value={moq} onChange={event => { setMoq(event.target.value); setError(''); }} placeholder="MOQ" className="h-9 w-28 border-white/10 bg-white/[0.03] text-xs text-white" />
        <Button type="button" size="sm" onClick={save} className="h-9 bg-white/10 text-xs text-white hover:bg-[#CC2D24]"><Plus className="mr-1 h-3.5 w-3.5" />{editing === null ? 'Add' : 'Save changes'}</Button>
        {editing !== null && <Button type="button" size="sm" variant="ghost" onClick={clear} className="text-xs text-white/60">Cancel</Button>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      <ul className="mt-3 space-y-2">
        {constraints.map((constraint, index) => {
          const method = resolveConstraintMethod(constraint, catalog);
          const active = methods.some(selectedMethod => selectedMethod.id === method?.id);
          const duplicate = method && constraints.some((entry, entryIndex) => entryIndex !== index && resolveConstraintMethod(entry, catalog)?.id === method.id);
          return <li key={`${constraint.capabilityId ?? constraint.method}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#CC2D24]/30 bg-[#CC2D24]/10 px-3 py-2 text-xs text-white">
            <div><strong>{method?.name ?? constraint.method}</strong> — {constraint.moq} units
              {!active && <p className="mt-1 text-[11px] text-amber-300">Inactive: method is no longer selected or could not be linked. Retained for your records; excluded from matching.</p>}
              {!isValidMethodMoq(constraint.moq) && <p className="mt-1 text-[11px] text-amber-300">Enter a positive whole-number MOQ to use this constraint.</p>}
              {duplicate && <p className="mt-1 text-[11px] text-amber-300">Duplicate saved entry. Remove an extra record to consolidate; matching uses the highest active MOQ.</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" aria-label={`Edit ${constraint.method} MOQ`} onClick={() => edit(index)} className="text-white/60 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label={`Remove ${constraint.method} MOQ`} onClick={() => remove(index)} className="text-white/60 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </li>;
        })}
      </ul>
    </section>
  );
}
