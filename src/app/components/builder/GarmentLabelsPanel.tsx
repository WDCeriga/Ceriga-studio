import { useRef, useState, type ReactNode } from 'react';
import { Copy, Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CARE_OPTIONS, LABEL_CATEGORIES, LABEL_FOLDS, LABEL_FONTS, LABEL_METHODS, LABEL_POSITIONS, LABEL_SHAPES, createGarmentLabel, labelPositions, labelSpecification, labelWarnings, normalizeLabel, unfoldedLabelSize, type CareCategory, type GarmentLabel, type LabelCategory } from '../../data/garmentLabels';
import { LabelArtwork, labelLayout, loadLabelFont } from './LabelArtwork';

const fieldClass = 'w-full min-w-0 rounded border border-white/15 bg-[#161619] px-2 py-2 text-xs text-white [color-scheme:dark]';
function Field({ title, children }: { title: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1 text-[11px] text-white/65">{title}{children}</label>;
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
  downloadFile(svg, `${label.category}-${label.id}.svg`, 'image/svg+xml');
}
export async function downloadLabelPdf(labels: GarmentLabel[]) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  for (const [index, label] of labels.entries()) {
    if (index) pdf.addPage();
    await loadLabelFont(label); await document.fonts.ready;
    pdf.setFontSize(14); pdf.text(`${LABEL_CATEGORIES[label.category]} ${index + 1}`, 20, 18);
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
      `Ink: ${label.foreground}; fabric: ${label.background}; border: ${label.borderEnabled ? label.border : 'none'}`,
      ...[['Brand / text', label.brand], ['Size', label.size], ['Composition', label.composition], ['Origin', label.origin], ['Business', label.business], ['Care text', label.careText], ['Additional', label.additional]].map(([name, value]) => `${name}: ${value || 'Incomplete'}`),
      ...Object.entries(label.care).map(([category, value]) => `${category}: ${(CARE_OPTIONS[category as CareCategory] as Record<string, string>)[value] ?? 'Incomplete'}`),
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
  downloadFile(JSON.stringify({ schemaVersion: 1, units: 'mm', labels: labels.map(labelSpecification) }, null, 2), 'ceriga-label-specifications.json', 'application/json');
}
function readData(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('File could not be read')); reader.readAsDataURL(file); });
}

export function GarmentLabelsPanel({ labels, selectedId, onSelect, onChange, layeredSleeves = false }: {
  labels: GarmentLabel[]; selectedId: string | null; onSelect: (id: string | null) => void; onChange: (labels: GarmentLabel[]) => void;
  layeredSleeves?: boolean;
}) {
  const [category, setCategory] = useState<LabelCategory>('neck');
  const [error, setError] = useState('');
  const latest = useRef({ labels, onChange });
  latest.current = { labels, onChange };
  const selected = labels.find(label => label.id === selectedId);
  const activeCategory = selected?.category ?? category;
  const update = (patch: Partial<GarmentLabel>) => {
    if (patch.font !== undefined) patch.fontData = labels.find(label => label.font === patch.font)?.fontData;
    onChange(labels.map(label => label.id === selectedId ? normalizeLabel({ ...label, ...patch }) : label));
  };
  const add = () => { const label = createGarmentLabel(activeCategory); onChange([...labels, label]); onSelect(label.id); };
  const text = (key: keyof GarmentLabel, title: string, multiline = false) => <Field title={title}>{multiline ? <textarea className={fieldClass} rows={3} value={String(selected?.[key] ?? '')} onChange={event => update({ [key]: event.target.value })} /> : <input className={fieldClass} value={String(selected?.[key] ?? '')} onChange={event => update({ [key]: event.target.value })} />}</Field>;
  const number = (key: keyof GarmentLabel, title: string, min: number, max: number, step = .5) => <Field title={title}><input className={fieldClass} type="number" min={min} max={max} step={step} value={Number(selected?.[key] ?? 0)} onChange={event => update({ [key]: event.target.valueAsNumber })} /></Field>;
  const select = (key: keyof GarmentLabel, title: string, options: Record<string, string>) => <Field title={title}><select className={fieldClass} value={String(selected?.[key] ?? '')} onChange={event => update({ [key]: event.target.value })}>{Object.entries(options).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field>;
  const upload = (font: boolean) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = font ? '.woff,.woff2,.ttf,.otf' : 'image/png,image/svg+xml';
    const id = selectedId;
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
        latest.current.onChange(latest.current.labels.map(label => label.id === id ? normalizeLabel({ ...label, ...patch }) : label)); setError('');
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed'); }
    }; input.click();
  };
  const layout = selected ? labelLayout(selected) : null;
  return <div className="space-y-4" data-garment-label-panel="">
    <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Label category">{Object.entries(LABEL_CATEGORIES).map(([key, title]) => <button key={key} type="button" role="tab" aria-selected={activeCategory === key} className={`min-h-11 rounded px-1 py-2 text-[10px] ${activeCategory === key ? 'bg-[#CC2D24] text-white' : 'bg-white/5 text-white/65'}`} onClick={() => { setCategory(key as LabelCategory); onSelect(labels.find(label => label.category === key)?.id ?? null); }}>{title}</button>)}</div>
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">{LABEL_CATEGORIES[activeCategory]}</h3><button type="button" onClick={add} title="Add label" aria-label="Add label" className="rounded p-2 text-white hover:bg-white/10"><Plus size={18} /></button></div>
    <div className="space-y-1">{labels.filter(label => label.category === activeCategory).map((label, index) => <button key={label.id} type="button" onClick={() => onSelect(label.id)} className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs ${selectedId === label.id ? 'border-[#CC2D24] text-white' : 'border-white/10 text-white/60'}`}><span className="min-w-0 truncate">{label.brand || `${LABEL_CATEGORIES[label.category]} ${index + 1}`}</span><span className="ml-2 shrink-0 text-[10px]">{label.widthMm} x {label.heightMm} mm</span></button>)}</div>
    {selected && <>
      <div className="flex justify-end gap-1">{[{ Icon: Copy, title: 'Duplicate label', action: () => { const copy = { ...selected, id: crypto.randomUUID() }; onChange([...labels, copy]); onSelect(copy.id); } }, { Icon: RotateCcw, title: 'Restore default placement', action: () => update({ position: labelPositions(selected.category)[0], offsetXmm: 0, offsetYmm: 0, rotation: 0 }) }, { Icon: Trash2, title: 'Delete label', action: () => { onChange(labels.filter(label => label.id !== selected.id)); onSelect(null); } }].map(({ Icon, title, action }) => <button key={title} type="button" title={title} aria-label={title} onClick={action} className="rounded p-2 text-white/70 hover:bg-white/10"><Icon size={16} /></button>)}</div>
      {selected.category === 'neck' && select('construction', 'Construction', { physical: 'Sewn label', printed: 'Direct neck print' })}
      {select('method', 'Manufacturing method', Object.fromEntries(Object.entries(LABEL_METHODS).filter(([key]) => selected.construction === 'printed' ? ['heat', 'dtf', 'dtg', 'screen'].includes(key) : ['woven', 'fabric'].includes(key))))}
      {selected.construction === 'physical' && select('fold', 'Fold', LABEL_FOLDS)}
      {select('shape', 'Shape', LABEL_SHAPES)}
      <div className="grid grid-cols-2 gap-2">{number('widthMm', 'Finished width (mm)', 8, 150)}{number('heightMm', 'Finished height (mm)', 8, 250)}{number('marginMm', 'Safe margin (mm)', .5, 25)}{selected.construction === 'physical' && number('foldMm', 'Fold allowance (mm)', 2, 15)}</div>
      <fieldset className="space-y-3 border-t border-white/10 pt-3"><legend className="px-1 text-xs text-white/70">Text sections</legend>
        {text('brand', 'Brand / heading', true)}{text('size', 'Size section')}
        {selected.category === 'care' && <>{text('composition', 'Fibre composition', true)}{text('careText', 'Care instructions', true)}{text('origin', 'Country of origin')}{text('business', 'Business information', true)}</>}
        {text('additional', 'Footer / additional text', true)}
      </fieldset>
      <fieldset className="space-y-3 border-t border-white/10 pt-3"><legend className="px-1 text-xs text-white/70">Artwork</legend>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => upload(false)} className="flex items-center gap-2 rounded border border-white/15 px-3 py-2 text-xs text-white"><Upload size={14} />Logo PNG / SVG</button>{selected.logo && <button type="button" onClick={() => update({ logo: undefined })} title="Remove logo" aria-label="Remove logo" className="p-2 text-white/60"><Trash2 size={16} /></button>}</div>
        {selected.logo && <><p className="truncate text-[11px] text-white/60">{selected.logo.name}</p><div className="grid grid-cols-3 gap-2">{number('logoWidth', 'Logo size (%)', 5, 100, 1)}{number('logoX', 'Logo X (%)', 0, 100, 1)}{number('logoY', 'Logo Y (%)', 0, 100, 1)}</div></>}
        {select('font', 'Font', Object.fromEntries([...new Set([...LABEL_FONTS, ...labels.map(label => label.font)])].map(font => [font, font.startsWith('LabelFont-') ? 'Imported font' : font])))}
        <button type="button" onClick={() => upload(true)} className="flex items-center gap-2 text-xs text-white/70"><Upload size={14} />Import font</button>
        <div className="grid grid-cols-2 gap-2">{number('fontSizeMm', 'Text size (mm)', 1.5, 20)}{number('letterSpacingMm', 'Letter spacing (mm)', 0, 5, .1)}{select('fontWeight', 'Weight', { 400: 'Regular', 600: 'Semibold', 700: 'Bold' })}{select('textAlign', 'Alignment', { left: 'Left', center: 'Centre', right: 'Right' })}</div>
        <div className="flex flex-wrap gap-4">{(['foreground', ...(selected.construction === 'physical' ? ['background', 'border'] : [])] as const).map(key => <Field key={key} title={key === 'foreground' ? 'Ink / thread' : key === 'background' ? 'Fabric' : 'Edge'}><input type="color" aria-label={`${key} colour`} value={String(selected[key as keyof GarmentLabel])} onChange={event => update({ [key]: event.target.value })} className="h-8 w-9 cursor-pointer bg-transparent" /></Field>)}</div>
        {selected.construction === 'physical' && <label className="flex gap-2 text-xs text-white/65"><input type="checkbox" checked={selected.borderEnabled} onChange={event => update({ borderEnabled: event.target.checked })} />Custom border</label>}
      </fieldset>
      {selected.category === 'care' && <fieldset className="space-y-3 border-t border-white/10 pt-3"><legend className="px-1 text-xs text-white/70">Care symbols</legend>{Object.entries(CARE_OPTIONS).map(([key, options]) => <Field key={key} title={key.charAt(0).toUpperCase() + key.slice(1)}><select className={fieldClass} value={selected.care[key as CareCategory]} onChange={event => update({ care: { ...selected.care, [key]: event.target.value } })}>{Object.entries(options).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></Field>)}</fieldset>}
      <fieldset className="space-y-3 border-t border-white/10 pt-3"><legend className="px-1 text-xs text-white/70">Attachment</legend>{select('position', 'Position', Object.fromEntries(labelPositions(selected.category).map(position => [position, LABEL_POSITIONS[position]])))}{selected.category === 'tag' && select('exteriorView', 'Visible side', { front: 'Front', back: 'Back' })}{layeredSleeves && selected.position.startsWith('sleeve-') && select('sleeveLayer', 'Sleeve layer', { outer: 'Outer sleeve', under: 'Under sleeve' })}<div className="grid grid-cols-2 gap-2">{number('offsetXmm', 'Horizontal offset (mm)', -40, 40)}{number('offsetYmm', 'Vertical offset (mm)', -50, 100)}{selected.category === 'tag' && number('rotation', 'Rotation (degrees)', -30, 30, 1)}</div></fieldset>
      <div className="space-y-1 border-t border-white/10 pt-3 text-[11px] text-white/65"><strong className="text-white">Manufacturing summary</strong><p>{LABEL_METHODS[selected.method]}{selected.construction === 'physical' ? ` / ${LABEL_FOLDS[selected.fold]}` : ''}</p><p>Finished: {selected.widthMm} x {selected.heightMm} mm</p>{selected.construction === 'physical' && <p>Unfolded: {unfoldedLabelSize(selected).width} x {unfoldedLabelSize(selected).height} mm</p>}<p>{LABEL_POSITIONS[selected.position]}</p><p>Safe margin: {selected.marginMm} mm</p></div>
      {(labelWarnings(selected).length > 0 || layout?.overflow) && <div role="status" className="space-y-1 text-[11px] text-amber-300">{labelWarnings(selected).map(warning => <p key={warning}>{warning}</p>)}{layout?.overflow && <><p>Artwork exceeds safe area. Increase dimensions or reduce artwork.</p>{layout.requiredHeight > selected.heightMm && layout.requiredHeight <= 250 && <button type="button" className="underline" onClick={() => update({ heightMm: layout.requiredHeight + 2 })}>Increase length to {layout.requiredHeight + 2} mm</button>}</>}</div>}
      <button type="button" onClick={() => void downloadLabelArtwork(selected).catch(() => setError('Artwork export failed'))} className="flex items-center gap-2 rounded border border-white/15 px-3 py-2 text-xs text-white"><Download size={14} />Label SVG</button>
    </>}
    {labels.length > 0 && <button type="button" onClick={() => downloadLabelSpecs(labels)} className="flex items-center gap-2 text-xs text-white/70"><Download size={14} />All label specifications</button>}
    {labels.length > 0 && <button type="button" onClick={() => void downloadLabelPdf(labels).catch(() => setError('Label PDF export failed'))} className="flex items-center gap-2 text-xs text-white/70"><Download size={14} />Label production PDF</button>}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}