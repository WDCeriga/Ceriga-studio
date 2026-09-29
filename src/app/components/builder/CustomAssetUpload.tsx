import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, Check, Copy, Crop, LoaderCircle, Pencil, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { acceptedAssetBundle, compatibleAsset, type AssetView, type CustomAssetCategory, type CustomAssetDefinition, type CustomDetailType } from '../../data/customAssets';
import { getPotraceSvgBBox, renderFabricSvg } from '../../lib/tshirtSvgUtils';

interface Props {
  category: CustomAssetCategory;
  garmentType: string;
  fit: string;
  view: AssetView;
  assets: CustomAssetDefinition[];
  selectedIds: string[];
  onAccept: (asset: CustomAssetDefinition, additionalAssets?: CustomAssetDefinition[]) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  renderPreview: (asset: CustomAssetDefinition, additionalAssets?: CustomAssetDefinition[]) => ReactNode;
  previewColor?: string;
}

const labels = { collar: 'Neck / Collar', sleeve: 'Sleeve', pocket: 'Pockets, Buttons, Zips & Patches' };
const control = 'min-h-9 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-xs text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-40';
const imageUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function collarCloseup(svg: string, color: string): string {
  const bounds = getPotraceSvgBBox(svg);
  const document = new DOMParser().parseFromString(renderFabricSvg(svg, color), 'image/svg+xml');
  if (bounds) {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const padding = Math.max(width, height) * 0.06;
    document.documentElement.setAttribute('viewBox', `${bounds.minX - padding} ${bounds.minY - padding} ${width + padding * 2} ${height + padding * 2}`);
    document.documentElement.setAttribute('width', String(width + padding * 2));
    document.documentElement.setAttribute('height', String(height + padding * 2));
  }
  return imageUrl(new XMLSerializer().serializeToString(document.documentElement));
}

export function CustomAssetUpload(props: Props) {
  const [open, setOpen] = useState(false);
  const category = props.category;
  const [source, setSource] = useState<'photo' | 'drawing'>('photo');
  const [side, setSide] = useState<'both' | 'left' | 'right'>('both');
  const [detailType, setDetailType] = useState<CustomDetailType>('pocket');
  const [image, setImage] = useState('');
  const [crop, setCrop] = useState<[number, number, number, number]>([0, 0, 1, 1]);
  const [cropping, setCropping] = useState(true);
  const [tab, setTab] = useState<'original' | 'drawing' | 'final'>('original');
  const [finalView, setFinalView] = useState<'garment' | 'collar'>('garment');
  const [results, setResults] = useState<CustomAssetDefinition[]>([]);
  const result = results[0];
  const [drawing, setDrawing] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [renaming, setRenaming] = useState<string>();
  const request = useRef<AbortController>();
  const fileReader = useRef<FileReader>();
  const busyRef = useRef(false);
  const accepted = useRef(false);
  const origin = useRef<[number, number]>();
  const input = useRef<HTMLInputElement>(null);
  const context = `${category}:${props.garmentType}:${props.fit}:${props.view}`;
  const contextRef = useRef(context);
  contextRef.current = context;
  const cancel = () => {
    fileReader.current?.abort();
    fileReader.current = undefined;
    origin.current = undefined;
    request.current?.abort();
    request.current = undefined;
    busyRef.current = false;
    setBusy(false);
    setResults([]);
    setDrawing('');
  };
  useEffect(() => () => { request.current?.abort(); fileReader.current?.abort(); }, []);
  useEffect(() => { cancel(); setOpen(false); }, [context]);
  const invalidate = () => { setResults([]); setDrawing(''); setTab('original'); setFinalView('garment'); setError(''); accepted.current = false; };
  const process = async () => {
    if (busyRef.current || !image) return;
    busyRef.current = true;
    setBusy(true);
    invalidate();
    setCropping(false);
    setProgress('Upload');
    const controller = new AbortController();
    request.current = controller;
    const startedContext = context;
    try {
      const processSide = async (requestedSide: 'left' | 'right') => {
      const response = await fetch('/api/custom-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ image: image.split(',')[1], category, contextCategory: props.category, ...(category === 'pocket' ? { detailType } : {}), source, side: requestedSide, crop, garmentType: props.garmentType, fit: props.fit, view: props.view }) });
      if (!response.body) throw new Error('No processing response. Check the local server.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let completed: (CustomAssetDefinition & { cleanDrawing?: string; additionalAssets?: CustomAssetDefinition[] }) | undefined;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const message = JSON.parse(line);
        if (message.type === 'error') throw new Error(message.error);
        if (message.type === 'progress') setProgress(`${category === 'sleeve' && side === 'both' ? `${requestedSide === 'left' ? 'Left' : 'Right'} sleeve: ` : ''}${message.label || message.step}`);
        if (message.type === 'result') completed = message.asset;
      };
      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        lines.forEach(consume);
        if (done) { consume(pending); break; }
      }
      if (!response.ok || !completed) throw new Error('Processing did not complete. Retry the upload.');
      if (controller.signal.aborted || contextRef.current !== startedContext) throw new Error('Upload cancelled.');
      const definitions = acceptedAssetBundle(completed);
      const definition = definitions[0];
      if (category === 'collar' && !definition.validation.checks.includes('drawing-fidelity')) throw new Error('Final asset differs significantly from generated drawing: fidelity validation is missing.');
      if (definition.category !== category || (category === 'sleeve' && definition.registration.side !== requestedSide)) throw new Error('Wrong asset type or sleeve side returned. Nothing was installed.');
      if (category === 'pocket' && definition.detailType !== detailType) throw new Error('Wrong detail type returned. Nothing was installed.');
      if (definitions.some(asset => !compatibleAsset(asset, props.garmentType, props.fit, props.view))) throw new Error('A detected asset does not match the current fit and view. Nothing was installed.');
      return { definitions, drawing: completed.cleanDrawing ?? '' };
      };
      const sides: ('left' | 'right')[] = category === 'sleeve' && side === 'both' ? ['left', 'right'] : [side === 'right' ? 'right' : 'left'];
      const processed = [];
      for (const requestedSide of sides) processed.push(await processSide(requestedSide));
      if (controller.signal.aborted || contextRef.current !== startedContext) return;
      const definitions = processed.flatMap(item => item.definitions);
      if (new Set(definitions.map(asset => asset.id)).size !== definitions.length) throw new Error('Duplicate component identities. Nothing was installed.');
      setResults(definitions);
      setDrawing(processed[0].drawing);
      setTab('final');
      setProgress('Preview');
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Upload failed. Retry.');
      controller.abort();
    } finally {
      if (request.current === controller) { request.current = undefined; busyRef.current = false; setBusy(false); }
    }
  };
  const limited = category === 'collar' && (!['tshirt', 'tshirtTest'].includes(props.garmentType) || props.fit !== 'slim' || props.view !== 'front')
    ? 'Collar registration supports Slim tees, front view only. Your fit will not change.'
    : category === 'sleeve' && (props.garmentType !== 'tshirt' || props.view !== 'front')
    ? 'Sleeve registration supports the main tee, front view only. Rear geometry is not verified.' : '';
  return <section className="space-y-2 border-t border-white/10 pt-3">
    <div className="flex items-center justify-between gap-2"><h3 className="text-xs text-white/80">Custom {labels[props.category]}</h3>
      <button className={control} onClick={() => { cancel(); setImage(''); invalidate(); setCropping(true); setOpen(true); }}><Upload className="mr-2 inline size-3.5"/>Upload</button></div>
    {props.assets.filter(asset => asset.category === props.category).map(asset => {
      const compatible = compatibleAsset(asset, props.garmentType, props.fit, props.view);
      const selected = props.selectedIds.includes(asset.id);
      return <div key={asset.id} className="flex min-w-0 items-center gap-2 border-b border-white/10 py-2">
        {renaming === asset.id ? <input aria-label="Asset name" autoFocus defaultValue={asset.name} maxLength={60}
          className="w-full rounded bg-white/10 p-1 text-xs" onBlur={event => { if (event.target.value.trim()) props.onRename(asset.id, event.target.value.trim()); setRenaming(undefined); }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setRenaming(undefined); }}/>
          : <button type="button" aria-label={asset.name} aria-pressed={selected} disabled={!compatible}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-md border p-2 text-left text-xs text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 ${selected ? 'border-[#CC2D24] bg-[#CC2D24]/10' : 'border-white/15 hover:bg-white/10'}`}
            onClick={() => props.onAccept(asset)}>
            <img src={imageUrl(asset.svg)} alt="" className="size-12 shrink-0 bg-white object-contain"/>
            <span className="min-w-0 flex-1"><span className="block break-words">{asset.name}</span>
              <span className="block text-[10px] text-white/45">{asset.provenance} · {asset.registration.side ?? asset.compatibility.fits.join(', ')}{!compatible ? ' · incompatible' : selected ? ' · active' : ''}</span></span>
            {selected && <Check className="size-3.5 shrink-0"/>}
          </button>}
        {props.category === 'pocket' && <button title={`Add another ${asset.detailType ?? 'pocket'}`} aria-label={`Add another ${asset.detailType ?? 'pocket'}`} disabled={!compatible} onClick={() => props.onAccept(asset)}><Copy className="size-3.5"/></button>}
        <button title="Rename asset" aria-label="Rename asset" onClick={() => setRenaming(asset.id)}><Pencil className="size-3.5"/></button>
        <button title="Remove asset" aria-label="Remove asset" onClick={() => props.onRemove(asset.id)}><Trash2 className="size-3.5"/></button>
      </div>;
    })}
    <Dialog open={open} onOpenChange={value => { if (!value) cancel(); setOpen(value); }}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto rounded-lg border-white/15 bg-[#171719] p-4 text-white shadow-2xl sm:max-w-3xl sm:p-6" aria-describedby={undefined}>
        <div className="space-y-1 pr-7"><DialogTitle className="text-base font-semibold">Custom {labels[category]} Upload</DialogTitle>
          <p className="text-xs capitalize text-white/50">{props.garmentType === 'tshirtTest' ? 'Test tee' : 'T-shirt'} / {props.fit} / {props.view}</p></div>
        <div className="flex flex-wrap items-end gap-3 border-y border-white/10 py-3">
          <label className="grid min-w-0 gap-1.5 text-[11px] text-white/50">Asset type
          <select aria-label="Asset type" disabled={busy || category !== 'pocket'} value={category === 'pocket' ? detailType : category}
            onChange={event => { setDetailType(event.target.value as CustomDetailType); invalidate(); }} className={control} style={{ colorScheme: 'dark' }}>
            {category === 'pocket' ? <><option value="pocket">Pockets</option><option value="button">Buttons</option><option value="zip">Zips</option><option value="patch">Patches</option></> : <option value={category}>{labels[category]}</option>}</select></label>
          <label className="grid min-w-0 gap-1.5 text-[11px] text-white/50">Reference
          <select aria-label="Reference type" disabled={busy} value={source} onChange={event => { setSource(event.target.value as 'photo' | 'drawing'); invalidate(); }} className={control} style={{ colorScheme: 'dark' }}>
            <option value="photo">Photo · Azure AI</option><option value="drawing">Technical drawing · Local trace</option></select></label>
          {category === 'sleeve' && <select aria-label="Sleeve side" disabled={busy} value={side} onChange={event => { setSide(event.target.value as 'both' | 'left' | 'right'); invalidate(); }} className={control} style={{ colorScheme: 'dark' }}><option value="both">Both sleeves</option><option value="left">Left sleeve</option><option value="right">Right sleeve</option></select>}
          <button className={control} disabled={busy} onClick={() => input.current?.click()}><Upload className="mr-2 inline size-3.5"/>{image ? 'Replace image' : 'Choose image'}</button>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            if (file.size > 12 * 1024 * 1024) { invalidate(); setError('Maximum image size is 12 MB.'); return; }
            fileReader.current?.abort();
            const reader = new FileReader();
            fileReader.current = reader;
            invalidate();
            setImage('');
            reader.onload = () => { if (fileReader.current !== reader) return; fileReader.current = undefined; setImage(String(reader.result)); setCrop([0, 0, 1, 1]); setCropping(true); invalidate(); };
            reader.onerror = () => { if (fileReader.current !== reader) return; fileReader.current = undefined; setError('Could not read the selected image.'); };
            reader.readAsDataURL(file);
          }}/>
        </div>
        {limited && <p role="status" className="text-xs text-amber-200">{limited}</p>}
        <div role="tablist" aria-label="Asset preview" className="flex border-b border-white/15">
          {(['original', 'drawing', 'final'] as const).map(value => <button key={value} role="tab" aria-selected={tab === value} disabled={value === 'drawing' ? !drawing : value === 'final' ? !result : !image}
            className={`flex-1 border-b-2 px-2 py-2 text-[10px] disabled:opacity-30 ${tab === value ? 'border-emerald-400 text-white' : 'border-transparent text-white/50'}`} onClick={() => setTab(value)}>{value === 'drawing' ? 'CLEAN DRAWING' : value === 'final' ? 'FINAL ASSET' : 'ORIGINAL'}</button>)}
        </div>
        {tab === 'final' && result && category === 'collar' && <div role="group" aria-label="Final asset view" className="flex gap-1">
          {(['garment', 'collar'] as const).map(value => <button key={value} type="button" aria-pressed={finalView === value}
            className={`${control} ${finalView === value ? '!border-emerald-400 !bg-emerald-900/40' : ''}`}
            onClick={() => setFinalView(value)}>{value === 'garment' ? 'Garment' : 'Collar Close-up'}</button>)}
        </div>}
        <div role="tabpanel" aria-label={tab === 'final' ? 'FINAL ASSET' : tab === 'drawing' ? 'CLEAN DRAWING' : 'ORIGINAL'} aria-busy={busy} className="flex h-[min(32dvh,280px)] min-h-40 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-[#eeeeec] sm:h-[min(46dvh,430px)]">
          {tab === 'final' && result ? category === 'collar' && finalView === 'collar'
            ? <img alt="Registered collar close-up" src={collarCloseup(result.svg, props.previewColor ?? '#e4e4e4')} className="h-full w-full object-contain"/>
            : props.renderPreview(result, results.slice(1)) : tab === 'drawing' ? <img alt="Clean technical drawing" src={drawing} className="h-full w-full object-contain"/>
            : image ? <div className="relative max-h-full max-w-full touch-none select-none" onPointerDown={event => {
              if (!cropping || busy) return;
              const rect = event.currentTarget.getBoundingClientRect();
              origin.current = [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height];
              event.currentTarget.setPointerCapture(event.pointerId);
            }} onPointerMove={event => {
              if (!origin.current) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const pointX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
              const pointY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
              setCrop([Math.min(origin.current[0], pointX), Math.min(origin.current[1], pointY), Math.max(origin.current[0], pointX), Math.max(origin.current[1], pointY)]);
              invalidate();
            }} onPointerUp={() => { origin.current = undefined; }} onPointerCancel={() => { origin.current = undefined; }}>
              <img alt="Original reference" draggable={false} src={image} className="max-h-[min(32dvh,280px)] max-w-full object-contain sm:max-h-[min(46dvh,430px)]"/>
              <div className="pointer-events-none absolute border-2 border-emerald-500 bg-emerald-400/10" style={{ left: `${crop[0] * 100}%`, top: `${crop[1] * 100}%`, width: `${(crop[2] - crop[0]) * 100}%`, height: `${(crop[3] - crop[1]) * 100}%` }}/>
            </div> : <Upload className="size-8 text-neutral-400"/>}
        </div>
        {busy && <p role="status" className="flex items-center gap-2 text-xs text-emerald-300"><LoaderCircle className="size-4 shrink-0 animate-spin"/>{progress}…</p>}
        {results.length > 1 && <section aria-label="Detected assets" className="space-y-1 border-t border-white/10 pt-2">
          <h3 className="text-xs font-semibold">Detected assets ({results.length})</h3>
          {results.map(asset => <div key={asset.id} className="flex items-center justify-between gap-3 py-1 text-xs">
            <span className="min-w-0 break-words">{asset.name}</span><span className="shrink-0 text-white/50">{asset.category === 'pocket' ? { pocket: 'Pockets', button: 'Buttons', zip: 'Zips', patch: 'Patches' }[asset.detailType ?? 'pocket'] : labels[asset.category]}</span>
          </div>)}
        </section>}
        {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200"><AlertCircle className="size-4 shrink-0"/><span className="min-w-0 break-words">{error}</span></div>}
        <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-3">
          <div className="flex gap-2"><button className={control} disabled={busy || !image} onClick={() => { invalidate(); setCropping(true); }}><Crop className="mr-1 inline size-3.5"/>Adjust Crop</button>
            <button title="Reset crop" aria-label="Reset crop" className={control} disabled={busy || !image} onClick={() => { setCrop([0, 0, 1, 1]); invalidate(); }}><RotateCcw className="size-3.5"/></button></div>
          <div className="flex gap-2"><button className={control} onClick={() => { cancel(); setOpen(false); }}><X className="mr-1 inline size-3.5"/>Cancel</button>
            <button className={control} disabled={busy || !image || !!limited} onClick={process}>{result || error ? 'Retry' : 'Process'}</button>
            <button className={`${control} !bg-emerald-700`} disabled={busy || !result} onClick={() => {
              if (!result || result.category !== props.category || contextRef.current !== context || busyRef.current || accepted.current) return;
              accepted.current = true;
              props.onAccept(result, results.slice(1));
              setOpen(false);
              cancel();
            }}><Check className="mr-1 inline size-3.5"/>Accept</button></div>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}