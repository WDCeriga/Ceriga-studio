import { useState, type ReactNode } from 'react';
import { Pipette, Plus, X } from 'lucide-react';

const STORAGE_KEY = 'ceriga.patternSavedColors';
const HEX = /^#[\da-f]{6}$/i;

const readSaved = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((color): color is string => typeof color === 'string' && HEX.test(color)).slice(0, 16) : [];
  } catch { return []; }
};

type EyeDropperWindow = Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };

export function PatternPaletteEditor({ colors, labels, min, max, onChange, groups }: {
  colors: string[];
  labels: string[];
  min: number;
  max: number;
  onChange: (colors: string[]) => void;
  /** Optional extra controls rendered under each colour (e.g. plaid stripe widths). */
  groups?: (index: number) => ReactNode;
}) {
  const [saved, setSaved] = useState(readSaved);
  const supportsEyedropper = typeof window !== 'undefined' && !!(window as EyeDropperWindow).EyeDropper;
  const set = (index: number, color: string) => onChange(colors.map((item, i) => i === index ? color : item));
  const save = (color: string) => {
    const next = [color, ...saved.filter(item => item.toLowerCase() !== color.toLowerCase())].slice(0, 16);
    setSaved(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const pick = async (index: number) => {
    const Dropper = (window as EyeDropperWindow).EyeDropper;
    if (!Dropper) return;
    try { set(index, (await new Dropper().open()).sRGBHex); } catch { /* cancelled */ }
  };
  return <div className="space-y-2 rounded-lg border border-[#dce3ec] bg-[#f6f8f9] p-2.5" data-pattern-palette>
    {colors.map((color, index) => {
      const label = labels[index] ?? `Colour ${index + 1}`;
      return <div key={index} className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[10px] text-[#8192a8]">{label}</span>
          <input type="color" aria-label={label} value={HEX.test(color) ? color : '#888888'} onChange={event => set(index, event.target.value)}
            className="h-7 w-9 cursor-pointer rounded border border-[#dce3ec] bg-transparent" />
          <input type="text" key={color} aria-label={`${label} HEX`} defaultValue={color} maxLength={7} spellCheck={false}
            onChange={event => { const value = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`; if (HEX.test(value)) set(index, value.toUpperCase()); }}
            onBlur={event => { event.target.value = color; }}
            className="h-7 w-[4.6rem] rounded border border-[#dce3ec] bg-[#171719] px-1.5 text-[10px] uppercase text-[#35414e]" />
          {supportsEyedropper && <button type="button" aria-label={`Pick ${label} from screen`} onClick={() => void pick(index)}
            className="rounded border border-[#dce3ec] p-1.5 text-[#8192a8] hover:text-[#35414e]"><Pipette className="size-3" /></button>}
          <button type="button" aria-label={`Save ${label}`} title="Save colour" onClick={() => HEX.test(color) && save(color)}
            className="rounded border border-[#dce3ec] p-1.5 text-[#8192a8] hover:text-[#35414e]"><Plus className="size-3" /></button>
          {colors.length > min && index > 0 && <button type="button" aria-label={`Remove ${label}`} onClick={() => onChange(colors.filter((_, i) => i !== index))}
            className="rounded border border-[#dce3ec] p-1.5 text-[#8192a8] hover:text-[#35414e]"><X className="size-3" /></button>}
        </div>
        {groups?.(index)}
      </div>;
    })}
    {colors.length < max && <button type="button" onClick={() => onChange([...colors, colors[colors.length - 1] ?? '#888888'])}
      className="w-full rounded-lg border border-[#dce3ec] py-1.5 text-[10px] font-semibold text-[#8192a8] hover:bg-[#eef2f5]">Add colour</button>}
    {saved.length > 0 && <div className="space-y-1"><span className="text-[9px] uppercase tracking-wider text-[#8192a8]">Saved colours</span>
      <div className="flex flex-wrap gap-1">{saved.map(color => <button key={color} type="button" aria-label={`Saved colour ${color}`} title={color}
        onClick={() => onChange([...colors.slice(0, -1), color])}
        className="size-5 rounded border border-[#dce3ec]" style={{ background: color }} />)}</div>
      <span className="block text-[9px] text-[#8192a8]">Click a saved colour to apply it to the last colour slot.</span></div>}
  </div>;
}
