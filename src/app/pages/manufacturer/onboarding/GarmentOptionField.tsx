import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../components/ui/utils';

type Props = {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  customOptions: string[];
  onToggle: (value: string) => void;
  onSelectAll: (values: string[]) => void;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  green?: boolean;
};

export function GarmentOptionField({ label, placeholder, options, selected, customOptions, onToggle, onSelectAll, onAdd, onRemove, green }: Props) {
  const [text, setText] = useState('');
  const add = () => {
    const value = text.trim();
    if (value) { onAdd(value); setText(''); }
  };
  const choices = [...new Set([...options, ...selected, ...customOptions])];
  return (
    <fieldset>
      <legend className="text-xs text-white/80 font-medium">{label}</legend>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`Select all ${label.toLowerCase()}`}
        disabled={!choices.length || choices.every(value => selected.includes(value))}
        onClick={() => onSelectAll(choices)}
        className="mt-2 h-8 border-white/15 text-xs text-white hover:bg-white/10"
      >
        Select all
      </Button>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {choices.map(option => (
          <span key={option} className="inline-flex items-center gap-1">
            <button
              type="button"
              aria-pressed={selected.includes(option)}
              onClick={() => onToggle(option)}
              className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                selected.includes(option)
                  ? green ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-100' : 'border-[#CC2D24] bg-[#CC2D24]/20 text-white'
                  : 'border-[#252528] bg-white/[0.02] text-white/60 hover:text-white')}
            >{option}</button>
            {customOptions.includes(option) && (
              <button type="button" aria-label={`Remove ${option}`} onClick={() => onRemove(option)} className="px-1 text-white/50 hover:text-white">&times;</button>
            )}
          </span>
        ))}
      </div>
      <div className="mt-3 flex max-w-sm gap-2">
        <Input
          aria-label={`Custom ${label.toLowerCase()}`}
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-8 text-xs border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
        />
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-8 text-xs border-white/15 text-white hover:bg-white/10">
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>
    </fieldset>
  );
}
