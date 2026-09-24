import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, FlipHorizontal2, FlipVertical2, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CARE_OPTIONS, DEFAULT_REGION_TRANSFORM, LABEL_CATEGORIES, LABEL_FOLDS, LABEL_FONTS, LABEL_METHODS, LABEL_POSITIONS, LABEL_PRESETS, LABEL_REGIONS, LABEL_SHAPES, LABEL_SIZE_VERTICAL, applyLabelPreset, createGarmentLabel, labelPositions, labelSpecification, labelWarnings, normalizeLabel, unfoldedLabelSize, type CareCategory, type GarmentLabel, type LabelCategory, type LabelRegion, type LabelRegionTransform } from '../../data/garmentLabels';
import { LabelArtwork, labelLayout, loadLabelFont } from './LabelArtwork';
import { LABEL_BLOCKS, LABEL_HIERARCHIES, MANUFACTURER_CARE_NOTE, applyLabelHierarchy, labelBlocks, labelExportFaces, type LabelBlock, type LabelBlockKey } from '../../data/garmentLabels';

const fieldClass = 'w-full min-w-0 rounded border border-white/15 bg-[#161619] px-2 py-2 text-xs text-white [color-scheme:dark]';
function Field({ title, children }: { title: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1 text-[11px] text-white/65">{title}{children}</label>;
}
function NumberField({ title, value, min, max, step, onCommit }: { title: string; value: number; min: number; max: number; step: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    const next = draft.trim() && Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : value;
    setDraft(String(next)); onCommit(next);
  };
  return <Field title={title}><input className={fieldClass} type="number" inputMode="decimal" min={min} max={max} step={step} value={draft}
    onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => {
      if (event.key === 'Enter') event.currentTarget.blur();
      if (event.key === 'Escape') { setDraft(String(value)); event.preventDefault(); }
    }} /></Field>;
}
function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadLabelArtwork(label: GarmentLabel) {
  await loadLabelFont(label);
  await document.fonts.ready;
  const svg = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={`${label.widthMm}mm`} height={`${label.heightMm}mm`} viewBox={`0 0 ${label.widthMm} ${label.heightMm}`}><LabelArtwork label={label} /></svg>);
  downloadFile(svg, `${label.category}-${label.id}${label.category === 'tag' ? `-${label.exteriorView}` : ''}.svg`, 'image/svg+xml');
}
export async function downloadLabelPdf(labels: GarmentLabel[]) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  for (const [index, label] of labels.flatMap(labelExportFaces).entries()) {
    if (index) pdf.addPage();
    await loadLabelFont(label); await document.fonts.ready;
    pdf.setFontSize(14); pdf.text(`${LABEL_CATEGORIES[label.category]} ${index + 1}${label.category === 'tag' ? ` - ${label.exteriorView}` : ''}`, 20, 18);
    const scale = Math.min(1, 170 / label.widthMm, 240 / label.heightMm);
    const pixelsPerMm = Math.min(24, 4096 / Math.max(label.widthMm, label.heightMm));
    const rasterWidth = Math.ceil(label.widthMm * pixelsPerMm);
    const rasterHeight = Math.ceil(label.heightMm * pixelsPerMm);
    pdf.setFontSize(9); pdf.text(`Finished: ${label.widthMm} x ${label.heightMm} mm; artwork scale: ${(scale * 100).toFixed(1)}%`, 20, 25);
    const svg = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={rasterWidth} height={rasterHeight} viewBox={`0 0 ${label.widthMm} ${label.heightMm}`}><LabelArtwork label={label} /></svg>);
    const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = rasterWidth; canvas.height = rasterHeight;
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 20, 32, label.widthMm * scale, label.heightMm * scale);
    pdf.addPage(); pdf.setFontSize(14); pdf.text(`Label ${index + 1} specifications`, 20, 18);
    const unfolded = unfoldedLabelSize(label);
    const lines = [
      `ID: ${label.id}`, `Method: ${LABEL_METHODS[label.method]}`, `Fold: ${LABEL_FOLDS[label.fold]}`,
      `Finished: ${label.widthMm} x ${label.heightMm} mm; unfolded: ${unfolded.width} x ${unfolded.height} mm`,
      `Safe margin: ${label.marginMm} mm; fold allowance: ${label.foldMm} mm`,
      `Attachment: ${LABEL_POSITIONS[label.position]}; exterior view: ${label.exteriorView}`,
      `Offsets: ${label.offsetXmm}, ${label.offsetYmm} mm; rotation: ${label.rotation} degrees; sleeve: ${label.sleeveLayer ?? 'outer'}`,
      `Font: ${label.font}; size: ${label.fontSizeMm} mm; weight: ${label.fontWeight}; spacing: ${label.letterSpacingMm} mm`,
      `Size area: ${LABEL_SIZE_VERTICAL[label.sizeVertical ?? 'center']}; alignment: ${label.sizePosition ?? 'center'}; font: ${label.sizeFontSizeMm ?? label.fontSizeMm * 1.15} mm; scale: ${label.sizeScale ?? 100}%`,
      `Ink: ${label.foreground}; fabric: ${label.background}; border: ${label.borderEnabled ? label.border : 'none'}`,
      ...(label.blocks ? label.blocks.filter(block => block.enabled).map(block => `${LABEL_BLOCKS[block.key]}: ${block.key === 'careText' ? `${MANUFACTURER_CARE_NOTE} Preview instructions are illustrative only.` : block.key === 'brand' && label.logo ? 'Uploaded artwork' : label[block.key] || 'Incomplete'}`) : [['Brand / text', label.brand], ['Size', label.size], ['Composition', label.composition], ['Origin', label.origin], ['Business', label.business], ['Care text', label.careText], ['Additional', label.additional]].map(([name, value]) => `${name}: ${value || 'Incomplete'}`)),
      ...(!label.blocks ? Object.entries(label.care).map(([category, value]) => `${category}: ${(CARE_OPTIONS[category as CareCategory] as Record<string, string>)[value] ?? 'Incomplete'}`) : []),
      ...(label.blocks ?? []).map(block => `${LABEL_BLOCKS[block.key]}: ${block.enabled ? 'Enabled' : 'Disabled'}; ${block.font}; ${block.fontSizeMm} mm; ${block.fontWeight}; ${block.color}; ${block.alignment}; spacing ${block.spaceAboveMm}/${block.spaceBelowMm} mm; share ${block.share}`),
      ...labelWarnings(label), ...(labelLayout(label).overflow ? ['WARNING: artwork exceeds safe area'] : []),
      'Confirm artwork, care instructions, fold allowances and attachment with the manufacturer before production.',
    ];
    pdf.setFontSize(9);
    let top = 28;
    for (const text of lines) {
      for (const line of pdf.splitTextToSize(text, 170) as string[]) {
        if (top > 277) { pdf.addPage(); top = 20; }
        pdf.text(line, 20, top); top += 5;
      }
      top += 2;
    }
  }
  pdf.save('ceriga-label-production.pdf');
}
export function downloadLabelSpecs(labels: GarmentLabel[]) {
  downloadFile(JSON.stringify({ schemaVersion: 2, units: 'mm', labels: labels.map(labelSpecification) }, null, 2), 'ceriga-label-specifications.json', 'application/json');
}
function readData(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('File could not be read')); reader.readAsDataURL(file); });
}

export function GarmentLabelsPanel({ labels, selectedId, onSelect, onChange, layeredSleeves = false, tagView = 'front', onTagViewChange }: {
  labels: GarmentLabel[]; selectedId: string | null; onSelect: (id: string | null) => void; onChange: (labels: GarmentLabel[]) => void;
  layeredSleeves?: boolean;
  tagView?: 'front' | 'back'; onTagViewChange?: (side: 'front' | 'back') => void;
}) {
  const [category, setCategory] = useState<LabelCategory>('neck');
  const [region, setRegion] = useState<LabelRegion>('top');
  const [blockKey, setBlockKey] = useState<LabelBlockKey>('brand');
  const [error, setError] = useState('');
  const initialized = useRef(false);
  const latest = useRef({ labels, onChange });
  latest.current = { labels, onChange };
  const current = labels.find(label => label.id === selectedId);
  const activeCategory = current?.category ?? category;
  const selected = current?.category === 'tag' && current.exteriorView !== tagView ? undefined : current;
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (current) return;
    const first = labels[0] ?? createGarmentLabel('neck');
    if (!labels.length) onChange([first]);
    onSelect(first.id);
  }, [labels, selected, onChange, onSelect]);
  const update = (patch: Partial<GarmentLabel>) => {
    if (patch.font !== undefined) patch.fontData = labels.find(label => label.font === patch.font)?.fontData;
    onChange(labels.map(label => label.id === selectedId ? normalizeLabel({ ...label, ...patch }) : label));
    if (patch.exteriorView && selected?.category === 'tag') onTagViewChange?.(patch.exteriorView);
  };
  const blocks = selected ? labelBlocks(selected) : [];
  const activeBlock = blocks.find(block => block.key === blockKey);
  const updateBlock = (patch: Partial<LabelBlock>) => update({ blocks: blocks.map(block => block.key === blockKey ? { ...block, ...patch } : block) });
  const moveBlock = (index: number, direction: number) => {
    const reordered = [...blocks];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    update({ blocks: reordered });
  };
  const add = () => { const label = { ...createGarmentLabel(activeCategory), exteriorView: activeCategory === 'tag' ? tagView : 'front' as const }; onChange([...labels, label]); onSelect(label.id); };
  const changeTagView = (side: 'front' | 'back') => {
    onTagViewChange?.(side);
    const next = labels.find(label => label.category === 'tag' && label.exteriorView === side);
    if (next) onSelect(next.id);
  };
  const updateText = (key: keyof GarmentLabel, value: string) => update({ [key]: value, blocks: blocks.map(block => block.key === key && value.trim() ? { ...block, enabled: true } : block) });
  const text = (key: keyof GarmentLabel, title: string, multiline = false) => <Field title={title}>{multiline ? <textarea className={fieldClass} rows={3} value={String(selected?.[key] ?? '')} onChange={event => updateText(key, event.target.value)} /> : <input className={fieldClass} value={String(selected?.[key] ?? '')} onChange={event => updateText(key, event.target.value)} />}</Field>;
  const number = (key: keyof GarmentLabel, title: string, min: number, max: number, step = .5) => <NumberField key={`${selectedId}-${key}`} title={title} value={Number(selected?.[key] ?? 0)} min={min} max={max} step={step} onCommit={value => update({ [key]: value })} />;
  const select = (key: keyof GarmentLabel, title: string, options: Record<string, string>) => <Field title={title}><select className={fieldClass} value={String(selected?.[key] ?? '')} onChange={event => update({ [key]: event.target.value })}>{Object.entries(options).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field>;
  const upload = (font: boolean) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = font ? '.woff,.woff2,.ttf,.otf' : 'image/png,image/svg+xml';
    const id = selectedId;
    const targetBlock = blockKey;
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error('Maximum file size is 5 MB');
        if (!(font ? /\.(woff2?|ttf|otf)$/i : /\.(png|svg)$/i).test(file.name)) throw new Error('Unsupported file format');
        const data = await readData(file);
        let patch: Partial<GarmentLabel>;
        if (font) {
          const family = `LabelFont-${crypto.randomUUID()}`;
          const face = await new FontFace(family, await file.arrayBuffer()).load(); document.fonts.add(face);
          patch = { font: family, fontData: data };
        } else {
          if (/\.svg$/i.test(file.name)) {
            const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml');
            if (doc.querySelector('parsererror, script, foreignObject, animate, set') || doc.documentElement.localName !== 'svg' || Array.from(doc.querySelectorAll('*')).some(element => Array.from(element.attributes).some(attribute => /^on/i.test(attribute.name) || (/(href|src)$/i.test(attribute.name) && !attribute.value.startsWith('#') && !attribute.value.startsWith('data:image/'))))) throw new Error('SVG must be a self-contained, static image');
          }
          const image = new Image(); image.src = data; await image.decode();
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('Artwork has no usable dimensions');
          patch = { logo: { name: file.name, data, aspect: image.naturalWidth / image.naturalHeight } };
        }
        latest.current.onChange(latest.current.labels.map(label => {
          if (label.id !== id) return label;
          return normalizeLabel({ ...label, ...(!font ? patch : {}), blocks: labelBlocks(label).map(block => block.key === (font ? targetBlock : 'brand') ? { ...block, ...(font ? { font: patch.font!, fontData: patch.fontData } : { enabled: true }) } : block) });
        })); setError('');
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed'); }
    }; input.click();
  };
  const layout = selected ? labelLayout(selected) : null;
  const direct = selected?.construction === 'printed';
  const custom = selected?.editingMode === 'custom';
  const availableRegions = Object.fromEntries(Object.entries(LABEL_REGIONS).filter(([key]) => layout?.zones.some(zone => zone.key === key)));
  const activeRegion = region in availableRegions ? region : 'top';
  const regionTransform = { ...DEFAULT_REGION_TRANSFORM, ...selected?.regions?.[activeRegion] };
  const updateRegion = (patch: Partial<LabelRegionTransform>) => update({ regions: { ...selected?.regions, [activeRegion]: { ...regionTransform, ...patch } } });
  const sectionClass = 'space-y-3 border-t border-white/10 pt-4';
  const legendClass = 'pr-3 text-xs font-semibold text-white/90';
  return <div className="space-y-5" data-garment-label-panel="">
    <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Label category">{Object.entries(LABEL_CATEGORIES).map(([key, title]) => <button key={key} type="button" role="tab" aria-selected={activeCategory === key} className={`min-h-10 rounded px-2 py-2 text-xs ${activeCategory === key ? 'bg-[#CC2D24] text-white' : 'bg-white/5 text-white/65 hover:bg-white/10'}`} onClick={() => {
      setCategory(key as LabelCategory); setRegion('top'); setBlockKey('brand');
      const next = labels.find(label => label.category === key && (key !== 'tag' || label.exteriorView === tagView)) ?? labels.find(label => label.category === key) ?? { ...createGarmentLabel(key as LabelCategory), exteriorView: key === 'tag' ? tagView : 'front' as const };
      if (!labels.some(label => label.id === next.id)) onChange([...labels, next]);
      onSelect(next.id);
    }}>{title}</button>)}</div>
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">{LABEL_CATEGORIES[activeCategory]}</h3><button type="button" onClick={add} title="Add label" aria-label="Add label" className="rounded p-2 text-white hover:bg-white/10"><Plus size={18} /></button></div>
    {activeCategory === 'tag' && <div className="grid grid-cols-2 gap-1" role="group" aria-label="Tag garment side">{(['front', 'back'] as const).map(side => <button key={side} type="button" aria-pressed={tagView === side} onClick={() => changeTagView(side)} className="rounded bg-white/5 px-3 py-2 text-xs text-white/70 aria-pressed:bg-white/20">{side === 'front' ? 'Front' : 'Back'}</button>)}</div>}
    <div className="space-y-1">{labels.filter(label => label.category === activeCategory && (label.category !== 'tag' || label.exteriorView === tagView)).map((label, index) => <button key={label.id} type="button" onClick={() => onSelect(label.id)} className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs ${selectedId === label.id ? 'border-[#CC2D24] text-white' : 'border-white/10 text-white/60'}`}><span className="min-w-0 truncate">{label.brand || `${LABEL_CATEGORIES[label.category]} ${index + 1}`}</span><span className="ml-2 shrink-0 text-[10px]">{label.widthMm} x {label.heightMm} mm</span></button>)}</div>
    {activeCategory === 'tag' && !labels.some(label => label.category === 'tag' && label.exteriorView === tagView) && <p className="text-xs text-white/55">No tags on the {tagView}.</p>}
    {selected && <>
      <div className="flex justify-end gap-1">{[{ Icon: Copy, title: 'Duplicate label', action: () => { const copy = { ...selected, id: crypto.randomUUID() }; onChange([...labels, copy]); onSelect(copy.id); } }, { Icon: RotateCcw, title: 'Restore default placement', action: () => update({ position: labelPositions(selected.category)[0], offsetXmm: 0, offsetYmm: 0, rotation: 0 }) }, { Icon: Trash2, title: 'Delete label', action: () => { const remaining = labels.filter(label => label.id !== selected.id); onChange(remaining); onSelect(remaining.find(label => label.category === activeCategory)?.id ?? remaining[0]?.id ?? null); } }].map(({ Icon, title, action }) => <button key={title} type="button" title={title} aria-label={title} onClick={action} className="rounded p-2 text-white/70 hover:bg-white/10"><Icon size={16} /></button>)}</div>
      <div className="grid grid-cols-2 gap-1 rounded bg-white/5 p-1" role="group" aria-label="Label editing mode">{(['preset', 'custom'] as const).map(mode => <button key={mode} type="button" aria-pressed={(selected.editingMode ?? 'preset') === mode} onClick={() => update({ editingMode: mode })} className="rounded px-2 py-2 text-xs text-white/60 aria-pressed:bg-white/15 aria-pressed:text-white">{mode === 'preset' ? 'Preset Labels' : 'Custom Labels'}</button>)}</div>
      {selected.category === 'neck' && select('construction', 'Label type', { physical: 'Sewn neck label', printed: 'Direct neck print' })}
      {selected.category === 'tag' && tagView === 'front' && <button type="button" onClick={() => { const copy = { ...structuredClone(selected), id: crypto.randomUUID(), exteriorView: 'back' as const, faces: undefined }; onChange([...labels, copy]); onTagViewChange?.('back'); onSelect(copy.id); }} className="flex items-center gap-2 text-xs text-white/70"><Copy size={14} />Copy front to back</button>}
      {!custom && <div className="grid grid-cols-3 gap-2" role="group" aria-label="Label presets">{Object.entries(LABEL_PRESETS).filter(([key]) => key !== 'care-stack' || direct || selected.method !== 'woven').map(([key, title]) => <button key={key} type="button" aria-pressed={(selected.preset ?? 'classic') === key} onClick={() => { update(applyLabelPreset(selected, key as keyof typeof LABEL_PRESETS)); if (key === 'care-stack') setBlockKey('careText'); }} className="min-w-0 overflow-hidden rounded border border-white/15 bg-white/5 p-1.5 text-[11px] text-white/70 aria-pressed:border-[#e45449] aria-pressed:text-white">
        <svg aria-hidden="true" viewBox={`-2 -2 ${selected.widthMm + 4} ${selected.heightMm + 4}`} className="mb-2 h-20 w-full rounded bg-[#e7e9ec] p-2"><LabelArtwork label={applyLabelPreset(selected, key as keyof typeof LABEL_PRESETS)} /></svg>{title}
      </button>)}</div>}
      <fieldset className={sectionClass}><legend className={legendClass}>Construction & size</legend>
        {select('method', direct ? 'Print method' : 'Manufacturing method', Object.fromEntries(Object.entries(LABEL_METHODS).filter(([key]) => direct ? ['heat', 'dtf', 'dtg', 'screen'].includes(key) : ['woven', 'fabric'].includes(key))))}
        {!direct && <div className="grid grid-cols-2 gap-3">{select('fold', 'Construction', LABEL_FOLDS)}{select('shape', 'Shape', LABEL_SHAPES)}</div>}
        <div className="grid grid-cols-2 gap-3">{number('widthMm', 'Finished width (mm)', 8, 150)}{number('heightMm', 'Finished height (mm)', 8, 250)}{custom && number('marginMm', 'Safe margin (mm)', .5, 25)}{custom && !direct && !['straight', 'die'].includes(selected.fold) && number('foldMm', 'Fold allowance (mm)', 2, 15)}</div>
      </fieldset>
      <fieldset className={sectionClass}><legend className={legendClass}>Content & hierarchy</legend>
        <Field title="Layout hierarchy"><select className={fieldClass} value={selected.hierarchy ?? 'brand-first'} onChange={event => update(applyLabelHierarchy(selected, event.target.value as NonNullable<GarmentLabel['hierarchy']>))}>{Object.entries(LABEL_HIERARCHIES).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></Field>
        <div className="divide-y divide-white/10">{blocks.map((block, index) => <div key={block.key} className="flex min-h-10 items-center gap-2 py-1">
          <input type="checkbox" aria-label={`Enable ${LABEL_BLOCKS[block.key]}`} checked={block.enabled} onChange={event => { update({ blocks: blocks.map(entry => entry.key === block.key ? { ...entry, enabled: event.target.checked } : entry) }); setBlockKey(block.key); }} className="accent-[#CC2D24]" />
          <button type="button" aria-pressed={blockKey === block.key} onClick={() => setBlockKey(block.key)} className="min-w-0 flex-1 py-2 text-left text-xs text-white/55 aria-pressed:text-white">{LABEL_BLOCKS[block.key]}</button>
          <button type="button" title={`Move ${LABEL_BLOCKS[block.key]} up`} aria-label={`Move ${LABEL_BLOCKS[block.key]} up`} disabled={index === 0} onClick={() => moveBlock(index, -1)} className="p-1.5 text-white/65 disabled:opacity-20"><ArrowUp size={14} /></button>
          <button type="button" title={`Move ${LABEL_BLOCKS[block.key]} down`} aria-label={`Move ${LABEL_BLOCKS[block.key]} down`} disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} className="p-1.5 text-white/65 disabled:opacity-20"><ArrowDown size={14} /></button>
        </div>)}</div>
      </fieldset>
      {(blocks.some(block => block.key === 'careText' && block.enabled) || blockKey === 'careText') && <p className="text-xs leading-relaxed text-white/65" role="note">{MANUFACTURER_CARE_NOTE} Preview instructions are illustrative only.</p>}
      {activeBlock && blockKey !== 'careText' && <fieldset className={sectionClass}><legend className={legendClass}>{LABEL_BLOCKS[blockKey]}</legend>
        {blockKey === 'brand' ? <>
          {!selected.logo && text('brand', 'Brand / company name')}
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => upload(false)} className="flex items-center gap-2 rounded border border-white/15 px-3 py-2 text-xs text-white"><Upload size={14} />Logo PNG / SVG</button>{selected.logo && <button type="button" onClick={() => update({ logo: undefined })} title="Remove logo" aria-label="Remove logo" className="p-2 text-white/60"><Trash2 size={16} /></button>}</div>
          {selected.logo && <><p className="truncate text-[11px] text-white/60">{selected.logo.name}</p>{number('logoWidth', 'Logo size (%)', 5, 100, 1)}</>}
        </> : text(blockKey, LABEL_BLOCKS[blockKey], ['composition', 'business', 'additional'].includes(blockKey))}
        <div className="grid grid-cols-2 gap-3">
          <Field title="Section alignment"><select className={fieldClass} value={activeBlock.alignment} onChange={event => updateBlock({ alignment: event.target.value as LabelBlock['alignment'] })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></Field>
          <Field title="Section font"><select className={fieldClass} value={activeBlock.font} onChange={event => { const source = blocks.find(block => block.font === event.target.value); updateBlock({ font: event.target.value, fontData: source?.fontData }); }}>{[...new Set([...LABEL_FONTS, ...blocks.map(block => block.font)])].map(font => <option key={font} value={font}>{font.startsWith('LabelFont-') ? 'Imported font' : font}</option>)}</select></Field>
          <NumberField title="Section font size (mm)" value={activeBlock.fontSizeMm} min={1.5} max={20} step={.25} onCommit={fontSizeMm => updateBlock({ fontSizeMm })} />
          <Field title="Section weight"><select className={fieldClass} value={activeBlock.fontWeight} onChange={event => updateBlock({ fontWeight: Number(event.target.value) })}>{[100, 200, 300, 400, 500, 600, 700, 800, 900].map(weight => <option key={weight} value={weight}>{weight}</option>)}</select></Field>
          <NumberField title="Space above (mm)" value={activeBlock.spaceAboveMm} min={0} max={20} step={.25} onCommit={spaceAboveMm => updateBlock({ spaceAboveMm })} />
          <NumberField title="Space below (mm)" value={activeBlock.spaceBelowMm} min={0} max={20} step={.25} onCommit={spaceBelowMm => updateBlock({ spaceBelowMm })} />
          <Field title="Section colour"><input type="color" aria-label="Section colour" value={activeBlock.color} onChange={event => updateBlock({ color: event.target.value })} className="h-8 w-9 cursor-pointer bg-transparent" /></Field>
        </div>
        <Field title={`Space share (${activeBlock.share})`}><input aria-label="Section space share" type="range" min="1" max="10" step="1" value={activeBlock.share} onChange={event => updateBlock({ share: Number(event.target.value) })} className="w-full accent-[#CC2D24]" /></Field>
        <button type="button" onClick={() => upload(true)} className="flex items-center gap-2 text-xs text-white/70"><Upload size={14} />Import section font</button>
      </fieldset>}
      {!selected.blocks && <fieldset className={sectionClass}><legend className={legendClass}>Saved region positioning</legend>
        <Field title="Content region"><select className={fieldClass} value={activeRegion} onChange={event => setRegion(event.target.value as LabelRegion)}>{Object.entries(availableRegions).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">{([['x', 'Horizontal (%)', -100, 100], ['y', 'Vertical (%)', -100, 100], ['scale', 'Region size (%)', 20, 150], ['rotation', 'Text rotation (deg)', -180, 180]] as const).map(([key, title, min, max]) => <NumberField key={`${selected.id}-${activeRegion}-${key}`} title={title} value={regionTransform[key]} min={min} max={max} step={1} onCommit={value => updateRegion({ [key]: value })} />)}</div>
        <div className="flex gap-2">{([{ key: 'flipX', Icon: FlipHorizontal2, title: 'Flip text horizontally' }, { key: 'flipY', Icon: FlipVertical2, title: 'Flip text vertically' }] as const).map(({ key, Icon, title }) => <button key={key} type="button" title={title} aria-label={title} aria-pressed={regionTransform[key]} onClick={() => updateRegion({ [key]: !regionTransform[key] })} className="rounded border border-white/15 p-2 text-white/70 aria-pressed:bg-white/20"><Icon size={16} /></button>)}<button type="button" title="Reset region" aria-label="Reset region" onClick={() => updateRegion(DEFAULT_REGION_TRANSFORM)} className="rounded p-2 text-white/70 hover:bg-white/10"><RotateCcw size={16} /></button></div>
      </fieldset>}
      <fieldset className={sectionClass}><legend className={legendClass}>Typography & colour</legend>
        <button type="button" onClick={() => { const brand = blocks.find(block => block.key === 'brand')!; update({ blocks: blocks.map(block => ({ ...block, font: brand.font, fontData: brand.fontData, fontWeight: brand.fontWeight, fontSizeMm: brand.fontSizeMm, color: brand.color })) }); }} className="flex items-center gap-2 text-xs text-white/70"><Copy size={14} />Apply brand typography to all</button>
        <div className="flex flex-wrap gap-4">{(selected.construction === 'physical' ? ['background', 'border'] : ['border']).map(key => <Field key={key} title={key === 'background' ? 'Label fabric' : 'Border colour'}><input type="color" aria-label={`${key} colour`} value={String(selected[key as keyof GarmentLabel])} onChange={event => update({ [key]: event.target.value })} className="h-8 w-9 cursor-pointer bg-transparent" /></Field>)}</div>
        <label className="flex gap-2 text-xs text-white/65"><input type="checkbox" checked={selected.borderEnabled} onChange={event => update({ borderEnabled: event.target.checked })} />Custom border</label>
      </fieldset>
      {selected.category !== 'hand' && <fieldset className={sectionClass}><legend className={legendClass}>Garment attachment</legend>{select('position', 'Position on garment', Object.fromEntries(labelPositions(selected.category).map(position => [position, LABEL_POSITIONS[position]])))}{selected.category === 'tag' && select('exteriorView', 'Visible side', { front: 'Front', back: 'Back' })}{layeredSleeves && selected.position.startsWith('sleeve-') && select('sleeveLayer', 'Sleeve layer', { outer: 'Outer sleeve', under: 'Under sleeve' })}<div className="grid grid-cols-2 gap-3">{number('offsetXmm', 'Horizontal offset (mm)', -40, 40)}{number('offsetYmm', 'Vertical offset (mm)', -50, 100)}{selected.category === 'tag' && number('rotation', 'Rotation (degrees)', -30, 30, 1)}</div></fieldset>}
      <div className="space-y-1 border-t border-white/10 pt-3 text-[11px] text-white/65"><strong className="text-white">Manufacturing summary</strong><p>{LABEL_METHODS[selected.method]}{selected.construction === 'physical' ? ` / ${LABEL_FOLDS[selected.fold]}` : ''}</p><p>Finished: {selected.widthMm} x {selected.heightMm} mm</p>{selected.construction === 'physical' && <p>Unfolded: {unfoldedLabelSize(selected).width} x {unfoldedLabelSize(selected).height} mm</p>}<p>{LABEL_POSITIONS[selected.position]}</p><p>Safe margin: {selected.marginMm} mm</p></div>
      {(labelWarnings(selected).length > 0 || layout?.overflow) && <div role="status" className="space-y-1 text-[11px] text-amber-300">{labelWarnings(selected).map(warning => <p key={warning}>{warning}</p>)}{layout?.overflow && <><p>Artwork exceeds safe area. Increase dimensions or reduce artwork.</p>{layout.requiredHeight > selected.heightMm && layout.requiredHeight <= 250 && <button type="button" className="underline" onClick={() => update({ heightMm: layout.requiredHeight + 2 })}>Increase length to {layout.requiredHeight + 2} mm</button>}</>}</div>}
      <button type="button" onClick={() => void downloadLabelArtwork(selected).catch(() => setError('Artwork export failed'))} className="flex items-center gap-2 rounded border border-white/15 px-3 py-2 text-xs text-white"><Download size={14} />Label SVG</button>
    </>}
    {labels.length > 0 && <button type="button" onClick={() => downloadLabelSpecs(labels)} className="flex items-center gap-2 text-xs text-white/70"><Download size={14} />All label specifications</button>}
    {labels.length > 0 && <button type="button" onClick={() => void downloadLabelPdf(labels).catch(() => setError('Label PDF export failed'))} className="flex items-center gap-2 text-xs text-white/70"><Download size={14} />Label production PDF</button>}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}