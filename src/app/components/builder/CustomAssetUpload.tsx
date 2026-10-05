import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, Check, Copy, Crop, LoaderCircle, Pencil, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { acceptedAssetBundle, compatibleAsset, deriveOppositeSleeve, validateCollarReview, type CollarDrawingReview, type AssetView, type CustomAssetCategory, type CustomAssetDefinition, type CustomDetailType } from '../../data/customAssets';
import { getPotraceSvgBBox, renderFabricSvg } from '../../lib/tshirtSvgUtils';
import { mirroredSleeveEdits, reconstructSleeve, sleeveCuffPreview, sleeveFromDraft, sleeveGeometry, traceSleeveDraft, type SleeveDraft, type SleeveReconstruction } from '../../data/sleeveReconstruction';
import { SleeveReconstructionEditor } from './SleeveReconstructionEditor';
import { collarEditGeometry, type CollarManualEdits } from '../../data/customCollarEditing';

interface Props {
  category: CustomAssetCategory;
  garmentType: string;
  fit: string;
  view: AssetView;
  assets: CustomAssetDefinition[];
  selectedIds: string[];
  onAccept: (asset: CustomAssetDefinition, additionalAssets?: CustomAssetDefinition[], collarEdits?: CollarManualEdits) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  renderPreview: (asset: CustomAssetDefinition, additionalAssets?: CustomAssetDefinition[], canvasOverlay?: ReactNode,
    collarEditor?: { edits?: CollarManualEdits; onChange: (edits?: CollarManualEdits) => void }) => ReactNode;
  previewColor?: string;
}

const labels = { collar: 'Neck / Collar', sleeve: 'Sleeve', pocket: 'Pockets, Buttons, Zips & Patches' };
const control = 'min-h-9 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-xs text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-40';
const imageUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

interface SleeveIsolation {
  status: 'confirm' | 'isolated';
  contextDrawing: string;
  overlay: string;
  rawIsolation?: string;
  normalization?: { landmarks: { armhole: number[][]; cuff: number[][] } };
  guidance: { outline: number[][]; armhole: number[][]; cuff: number[][]; confidence: string; side: string };
}
interface IsolationProposal {
  isolationToken: string;
  isolation: SleeveIsolation;
  cleanDrawing: string;
  stageProvenance: Record<string, string>;
}

type CollarMask = 'fabric' | 'opening' | 'outerBoundary' | 'innerBoundary' | 'attachment' | 'constructionInk';
interface CollarTopology {
  version: 1;
  previews: Record<CollarMask, string>;
}

async function sha256(value: string, binary = false) {
  const bytes = binary ? Uint8Array.from(atob(value), character => character.charCodeAt(0)) : new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

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
  const [finalView, setFinalView] = useState<'garment' | 'collar' | 'drawing' | CollarMask>('garment');
  const [collarTopology, setCollarTopology] = useState<CollarTopology>();
  const [results, setResults] = useState<CustomAssetDefinition[]>([]);
  const [collarEdits, setCollarEdits] = useState<CollarManualEdits>();
  const result = results[0];
  const [drawing, setDrawing] = useState('');
  const [collarComparison, setCollarComparison] = useState<{ review: CollarDrawingReview; sourceCrop: string; cleanDrawing: string }>();
  const [isolation, setIsolation] = useState<SleeveIsolation>();
  const [proposal, setProposal] = useState<IsolationProposal>();
  const [stageProvenance, setStageProvenance] = useState<Record<string, string>>();
  const [sleeveDraft, setSleeveDraft] = useState<SleeveDraft>();
  const [applyBoth, setApplyBoth] = useState(true);
  const [reviewed, setReviewed] = useState(false);
  const [previewHash, setPreviewHash] = useState('');
  useEffect(() => {
    let current = true;
    setPreviewHash('');
    if (result) void sha256(result.svg).then(hash => { if (current) setPreviewHash(hash); });
    return () => { current = false; };
  }, [result?.svg]);
  const [isolationView, setIsolationView] = useState<'context' | 'raw' | 'isolated' | 'cuff'>('context');
  const [adjustingIsolation, setAdjustingIsolation] = useState(false);
  const isolationDrag = useRef<{ key: 'outline' | 'armhole' | 'cuff'; index: number }>();
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
  const isolationToken = useRef<string>();
  const discardIsolation = () => {
    const token = isolationToken.current;
    isolationToken.current = undefined;
    if (token) void fetch('/api/custom-assets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isolationToken: token }) }).catch(() => {});
  };
  const cancel = () => {
    fileReader.current?.abort();
    fileReader.current = undefined;
    origin.current = undefined;
    request.current?.abort();
    request.current = undefined;
    discardIsolation();
    busyRef.current = false;
    setBusy(false);
    setResults([]);
    setCollarEdits(undefined);
    setDrawing('');
    setCollarComparison(undefined);
    setCollarTopology(undefined);
    setProposal(undefined);
    setIsolation(undefined);
    setStageProvenance(undefined);
    setSleeveDraft(undefined);
    setReviewed(false);
  };
  useEffect(() => () => { request.current?.abort(); fileReader.current?.abort(); discardIsolation(); }, []);
  useEffect(() => { cancel(); setOpen(false); }, [context]);
  const invalidate = () => { discardIsolation(); setResults([]); setCollarEdits(undefined); setDrawing(''); setCollarComparison(undefined); setCollarTopology(undefined); setProposal(undefined); setIsolation(undefined); setStageProvenance(undefined); setSleeveDraft(undefined); setReviewed(false); setIsolationView('context'); setAdjustingIsolation(false); isolationDrag.current = undefined; setTab('original'); setFinalView('garment'); setProgress(''); setError(''); accepted.current = false; };
  const refineSleeve = (id: string, model: SleeveReconstruction) => {
    setReviewed(false);
    setResults(current => current.map(asset => {
      if (!asset.sleeveReconstruction || (asset.id !== id && !applyBoth)) return asset;
      const next = asset.id === id ? model : { ...asset.sleeveReconstruction, style: structuredClone(model.style), edits: mirroredSleeveEdits(model.edits) };
      return reconstructSleeve(asset, next);
    }));
  };
  const process = async (confirmIsolation = false) => {
    if (busyRef.current || !image) return;
    busyRef.current = true;
    setBusy(true);
    if (!confirmIsolation) invalidate();
    else setError('');
    setCropping(false);
    setProgress('Upload');
    const controller = new AbortController();
    const requestId = crypto.randomUUID();
    request.current = controller;
    const startedContext = context;
    try {
      const processSide = async (requestedSide: 'left' | 'right') => {
      const response = await fetch('/api/custom-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ image: image.split(',')[1], requestId, ...(confirmIsolation && proposal ? { isolationToken: proposal.isolationToken, confirmIsolation: true, isolationGuidance: isolation?.guidance } : {}), category, contextCategory: props.category, ...(category === 'pocket' ? { detailType } : {}), source, side: requestedSide, ...(category === 'sleeve' ? { selectionMode: side, sleeveMode: 'reconstruction-v1' } : {}), crop, garmentType: props.garmentType, fit: props.fit, view: props.view }) });
      if (!response.body) throw new Error('No processing response. Check the local server.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let completed: (CustomAssetDefinition & { collarTopology?: CollarTopology; stageProvenance?: Record<string, string>; cleanDrawing?: string; additionalAssets?: CustomAssetDefinition[]; sleeveIsolation?: SleeveIsolation; oppositeSleeve?: CustomAssetDefinition & { stageProvenance?: Record<string, string> } }) | undefined;
      let proposed: IsolationProposal | undefined;
      let draft: (SleeveDraft & { cleanDrawing: string; sleeveIsolation: SleeveIsolation }) | undefined;
      let collarReview: CollarDrawingReview | undefined;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const message = JSON.parse(line);
        if (controller.signal.aborted || request.current !== controller || contextRef.current !== startedContext) return;
        if (message.type === 'error') throw new Error(message.error);
        if (message.requestId !== requestId) throw new Error('Processing response belongs to a different upload. Nothing was installed.');
        if (message.type === 'collar-review' && category === 'collar') {
          collarReview = validateCollarReview(message.review);
          if (![message.sourceCrop, message.cleanDrawing].every(value => typeof value === 'string' && value.startsWith('data:image/png;base64,'))) throw new Error('Collar comparison images are missing. Retry processing.');
          setCollarComparison({ review: collarReview, sourceCrop: message.sourceCrop, cleanDrawing: message.cleanDrawing });
          setDrawing(message.cleanDrawing);
          setReviewed(false);
          setTab('drawing');
        }
        if (message.type === 'progress') setProgress(`${category === 'sleeve' && side === 'both' ? `${requestedSide === 'left' ? 'Left' : 'Right'} sleeve: ` : ''}${message.label || message.step}`);
        if (message.type === 'result') {
          if (message.asset?.reconstructionDraft) draft = message.asset;
          else completed = message.asset;
        }
        if (message.type === 'isolation') proposed = message;
      };
      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        lines.forEach(consume);
        if (done) { consume(pending); break; }
      }
      if (controller.signal.aborted || request.current !== controller || contextRef.current !== startedContext) throw new Error('Upload cancelled.');
      const provenance = proposed?.stageProvenance ?? draft?.stageProvenance ?? completed?.stageProvenance;
      if (response.ok && category === 'sleeve') {
        const isolated = proposed?.isolation ?? draft?.sleeveIsolation ?? completed?.sleeveIsolation;
        const normalized = proposed?.cleanDrawing ?? draft?.cleanDrawing ?? completed?.cleanDrawing;
        if (!provenance || !isolated?.rawIsolation || !normalized
          || provenance.sourceImageHash !== await sha256(image.split(',')[1], true)
          || provenance.detectedRasterId !== await sha256(isolated.contextDrawing)
          || provenance.isolationId !== await sha256(isolated.rawIsolation)
          || provenance.normalizedAssetId !== await sha256(normalized)
          || (completed && (provenance.tracedSvgId !== provenance.finalSvgId || !provenance.registrationId
            || provenance.finalSvgId !== await sha256(completed.svg)))) throw new Error('Sleeve stage identity mismatch. Nothing was installed.');
        if (completed?.oppositeSleeve) {
          const opposite = completed.oppositeSleeve;
          if (['sourceImageHash', 'uploadIdentity', 'isolationId', 'normalizedAssetId', 'registrationInputId'].some(key => provenance[key] !== opposite.stageProvenance?.[key])
            || opposite.stageProvenance?.finalSvgId !== await sha256(opposite.svg)) throw new Error('Opposite sleeve does not belong to the current canonical asset. Nothing was installed.');
        }
      }
      if (controller.signal.aborted || request.current !== controller || contextRef.current !== startedContext) throw new Error('Upload cancelled.');
      if (response.ok && proposed) return { proposed, definitions: [], drawing: proposed.cleanDrawing, oppositeSleeve: undefined, provenance, draft: undefined };
      if (response.ok && draft) {
        if (draft.fit !== props.fit || draft.side !== requestedSide || draft.source !== source) throw new Error('Sleeve style belongs to a different upload context.');
        if (!draft.sleeveIsolation.normalization) throw new Error('Sleeve contour landmarks are missing. Review the isolation and retry.');
        if (!draft.style.sourceGarment || !draft.sockets.left.bodyWidth || !draft.sockets.right.bodyWidth || !draft.stageProvenance.garmentContextId) throw new Error('Whole-garment proportions are missing. Process a full garment reference again.');
        setProgress('Preserving source sleeve contours');
        const traced = await traceSleeveDraft(draft, draft.cleanDrawing, draft.sleeveIsolation.normalization.landmarks);
        if (controller.signal.aborted || request.current !== controller || contextRef.current !== startedContext) throw new Error('Upload cancelled.');
        const definitions = [sleeveFromDraft(traced, requestedSide)];
        if (side === 'both') definitions.push(sleeveFromDraft(traced, requestedSide === 'left' ? 'right' : 'left'));
        return { definitions, drawing: draft.cleanDrawing, isolation: draft.sleeveIsolation, proposed: undefined, oppositeSleeve: undefined, provenance: traced.stageProvenance, draft: traced };
      }
      if (!response.ok || !completed) throw new Error('Processing did not complete. Retry the upload.');
      if (category === 'collar' && source === 'photo' && (!collarReview || collarReview.status === 'Rejected'
        || JSON.stringify(collarReview) !== JSON.stringify(completed.collarReview))) throw new Error('Source comparison is missing or rejected. Nothing was installed.');
      const definitions = acceptedAssetBundle(completed);
      const definition = definitions[0];
      if (category === 'collar' && !definition.validation.checks.includes('drawing-fidelity')) throw new Error('Final asset differs significantly from generated drawing: fidelity validation is missing.');
      if (category === 'collar') {
        const topology = completed.collarTopology;
        if (topology && (topology.version !== 1 || !(['fabric', 'opening', 'outerBoundary', 'innerBoundary', 'attachment', 'constructionInk'] as const)
          .every(key => typeof topology.previews?.[key] === 'string' && topology.previews[key].startsWith('data:image/png;base64,')))) throw new Error('Collar topology diagnostics are incomplete.');
        setCollarTopology(topology);
        setFinalView('garment');
      }
      if (definition.category !== category || (category === 'sleeve' && definition.registration.side !== requestedSide)) throw new Error('Wrong asset type or sleeve side returned. Nothing was installed.');
      if (category === 'pocket' && definition.detailType !== detailType) throw new Error('Wrong detail type returned. Nothing was installed.');
      if (definitions.some(asset => !compatibleAsset(asset, props.garmentType, props.fit, props.view))) throw new Error('A detected asset does not match the current fit and view. Nothing was installed.');
      return { definitions, drawing: completed.cleanDrawing ?? '', isolation: completed.sleeveIsolation, proposed: undefined, oppositeSleeve: completed.oppositeSleeve, provenance, draft: undefined };
      };
      const processed = [await processSide(side === 'right' ? 'right' : 'left')];
      if (processed[0].proposed) {
        isolationToken.current = processed[0].proposed.isolationToken;
        setProposal(processed[0].proposed);
        setStageProvenance(processed[0].provenance);
        setIsolation(processed[0].proposed.isolation);
        setDrawing(processed[0].drawing);
        setIsolationView('context');
        setAdjustingIsolation(false);
        setTab('drawing');
        return;
      }
      if (category === 'sleeve' && side === 'both' && !processed[0].draft) {
        if (!processed[0].oppositeSleeve) throw new Error('Opposite sleeve registration is missing. Retry processing.');
        processed.push({ ...processed[0], definitions: deriveOppositeSleeve(processed[0].definitions, processed[0].oppositeSleeve) });
      }
      if (controller.signal.aborted || contextRef.current !== startedContext) return;
      const definitions = processed.flatMap(item => item.definitions);
      if (new Set(definitions.map(asset => asset.id)).size !== definitions.length) throw new Error('Duplicate component identities. Nothing was installed.');
      setResults(definitions);
      setSleeveDraft(processed[0].draft);
      setApplyBoth(side === 'both');
      setReviewed(false);
      setStageProvenance(processed[0].provenance);
      setDrawing(processed[0].drawing);
      setIsolation(processed[0].isolation);
      setProposal(undefined);
      isolationToken.current = undefined;
      setAdjustingIsolation(false);
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
          <button className={control} onClick={() => { cancel(); invalidate(); setImage(''); setCropping(true); setCrop([0, 0, 1, 1]); input.current?.click(); }}><Upload className="mr-2 inline size-3.5"/>{image ? 'Replace image' : 'Choose image'}</button>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            cancel();
            if (file.size > 12 * 1024 * 1024) { invalidate(); setError('Maximum image size is 12 MB.'); return; }
            fileReader.current?.abort();
            const reader = new FileReader();
            fileReader.current = reader;
            invalidate();
            setImage('');
            reader.onload = () => { if (fileReader.current !== reader) return; fileReader.current = undefined; setImage(String(reader.result)); setCrop([0, 0, 1, 1]); setCropping(category !== 'sleeve'); invalidate(); };
            reader.onerror = () => { if (fileReader.current !== reader) return; fileReader.current = undefined; setError('Could not read the selected image.'); };
            reader.readAsDataURL(file);
          }}/>
        </div>
        {limited && <p role="status" className="text-xs text-amber-200">{limited}</p>}
        <div role="tablist" aria-label="Asset preview" className="flex border-b border-white/15">
          {(['original', 'drawing', 'final'] as const).map(value => <button key={value} role="tab" aria-selected={tab === value} disabled={value === 'drawing' ? !drawing : value === 'final' ? !result : !image}
            className={`flex-1 border-b-2 px-2 py-2 text-[10px] disabled:opacity-30 ${tab === value ? 'border-emerald-400 text-white' : 'border-transparent text-white/50'}`} onClick={() => setTab(value)}>{value === 'drawing' ? 'CLEAN DRAWING' : value === 'final' ? 'FINAL ASSET' : 'ORIGINAL'}</button>)}
        </div>
        {tab === 'final' && result && category === 'collar' && <div role="group" aria-label="Final asset view" className="flex flex-wrap gap-1">
          {(collarTopology ? ['drawing', 'fabric', 'collar', 'garment'] as const : ['collar', 'garment'] as const).map(value => <button key={value} type="button" aria-pressed={finalView === value}
            className={`${control} ${finalView === value ? '!border-emerald-400 !bg-emerald-900/40' : ''}`}
            onClick={() => setFinalView(value)}>{value === 'drawing' ? '1. Clean Drawing' : value === 'fabric' ? '2. Fabric Mask' : value === 'collar' ? '3. Registered Collar' : '4. Final Garment'}</button>)}
        </div>}
        {tab === 'final' && result && category === 'collar' && collarTopology && <div role="group" aria-label="Collar topology diagnostics" className="flex flex-wrap gap-1">
          {([['outerBoundary', 'Outer Boundary'], ['opening', 'Inner Opening Mask'], ['innerBoundary', 'Opening Boundary'], ['attachment', 'Attachment Edge'], ['constructionInk', 'Construction Ink']] as const).map(([value, label]) =>
            <button key={value} type="button" aria-pressed={finalView === value} className={`${control} ${finalView === value ? '!border-emerald-400' : ''}`} onClick={() => setFinalView(value)}>{label}</button>)}
        </div>}
        {tab === 'drawing' && isolation && <div role="group" aria-label="Sleeve isolation view" className="flex flex-wrap gap-1">
          {(['context', 'raw', 'isolated', 'cuff'] as const).filter(value => (value !== 'raw' || isolation.rawIsolation) && (value !== 'cuff' || result?.sleeveReconstruction)).map(value => <button key={value} type="button" aria-pressed={isolationView === value} className={`${control} ${isolationView === value ? '!border-emerald-400' : ''}`} onClick={() => setIsolationView(value)}>{value === 'context' ? 'Detected Sleeve' : value === 'raw' ? 'Raw Isolation' : value === 'cuff' ? 'Cuff Isolation' : isolation.rawIsolation ? 'Normalized Asset' : 'Isolated Asset'}</button>)}
        </div>}
        {!(tab === 'final' && result?.sleeveReconstruction) && !(tab === 'drawing' && collarComparison) && <div role="tabpanel" aria-label={tab === 'final' ? 'FINAL ASSET' : tab === 'drawing' ? 'CLEAN DRAWING' : 'ORIGINAL'} aria-busy={busy} className={`flex ${tab === 'final' && category === 'collar' && finalView === 'garment' ? 'h-[min(44dvh,360px)]' : 'h-[min(32dvh,280px)]'} min-h-40 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-[#eeeeec] sm:h-[min(46dvh,430px)]`}>
          {tab === 'final' && result ? category === 'collar' && collarTopology && finalView !== 'garment' && finalView !== 'collar'
            ? <img alt={finalView === 'drawing' ? 'Approved clean collar drawing' : `Collar topology ${finalView}`} src={finalView === 'drawing' ? collarComparison?.cleanDrawing ?? drawing : collarTopology.previews[finalView]} className="h-full w-full object-contain p-3"/>
            : category === 'collar' && finalView === 'collar'
            ? <img alt="Registered collar close-up" src={collarCloseup(result.svg, props.previewColor ?? '#e4e4e4')} className="h-full w-full object-contain"/>
            : <div key={result.id} data-preview-asset-id={result.id} data-preview-svg-id={previewHash} className="h-full w-full">{props.renderPreview(result, results.slice(1), undefined,
              category === 'collar' && collarEditGeometry(result.svg) ? { edits: collarEdits, onChange: setCollarEdits } : undefined)}</div> : tab === 'drawing' ? isolation && isolationView === 'context' ? <div className="relative max-h-full max-w-full">
              <img alt="Detected sleeve area" src={adjustingIsolation ? isolation.contextDrawing : isolation.overlay} className="max-h-[min(32dvh,280px)] max-w-full object-contain sm:max-h-[min(46dvh,430px)]"/>
              {adjustingIsolation && <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full touch-none" onPointerMove={event => {
                const drag = isolationDrag.current;
                if (!drag || busy) return;
                const rect = event.currentTarget.getBoundingClientRect();
                const point = [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))];
                setIsolation(current => current && ({ ...current, guidance: { ...current.guidance, [drag.key]: current.guidance[drag.key].map((existing, index) => index === drag.index ? point : existing) } }));
              }} onPointerUp={() => { isolationDrag.current = undefined; }} onPointerCancel={() => { isolationDrag.current = undefined; }}>
                <polygon points={isolation.guidance.outline.map(point => point.join(',')).join(' ')} fill="#10b98133" stroke="#059669" strokeWidth=".004"/>
                {(['outline', 'armhole', 'cuff'] as const).map(key => <g key={key}>
                  {key !== 'outline' && <polyline points={isolation.guidance[key].map(point => point.join(',')).join(' ')} fill="none" stroke={key === 'armhole' ? '#dc2626' : '#2563eb'} strokeWidth=".005"/>}
                  {isolation.guidance[key].map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r=".012" fill={key === 'armhole' ? '#dc2626' : key === 'cuff' ? '#2563eb' : '#059669'} stroke="white" strokeWidth=".003" role="slider" tabIndex={0} aria-label={`${key} point ${index + 1}`} aria-valuetext={`${Math.round(point[0] * 100)}, ${Math.round(point[1] * 100)}`} onPointerDown={event => { isolationDrag.current = { key, index }; event.currentTarget.setPointerCapture(event.pointerId); }} onKeyDown={event => {
                    const delta = { ArrowLeft: [-.005, 0], ArrowRight: [.005, 0], ArrowUp: [0, -.005], ArrowDown: [0, .005] }[event.key];
                    if (!delta || busy) return;
                    event.preventDefault();
                    setIsolation(current => current && ({ ...current, guidance: { ...current.guidance, [key]: current.guidance[key].map((existing, pointIndex) => pointIndex === index ? existing.map((coordinate, dimension) => Math.max(0, Math.min(1, coordinate + delta[dimension]))) : existing) } }));
                  }}><title>{key} point {index + 1}</title></circle>)}
                </g>)}
              </svg>}
            </div> : isolationView === 'cuff' && result?.sleeveReconstruction ? result.sleeveReconstruction.style.cuff ? <img alt="Source cuff isolation mask and construction" src={`data:image/svg+xml,${encodeURIComponent(sleeveCuffPreview(result.sleeveReconstruction.style)!)}`} className="h-full w-full object-contain p-4"/> : <p className="p-4 text-sm text-black/70">{result.sleeveReconstruction.style.cuffStyle === 'plain' ? 'No separate cuff in this sleeve.' : 'Cuff boundary unresolved. No cuff mask generated.'}</p>
            : <img alt={isolation?.rawIsolation ? isolationView === 'raw' ? 'Raw isolated sleeve' : 'Normalized sleeve, armhole top and cuff bottom' : 'Clean technical drawing'} src={isolationView === 'raw' && isolation?.rawIsolation ? isolation.rawIsolation : drawing} className="h-full w-full object-contain"/>
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
        </div>}
        {collarComparison && <section aria-label="Collar reference comparison" className="min-w-0 space-y-3 border-t border-white/15 pt-3">
          <p role="status" aria-label="Collar drawing match" className={`text-sm font-semibold ${collarComparison.review.status === 'Rejected' ? 'text-red-300' : collarComparison.review.status === 'Needs Review' ? 'text-amber-200' : 'text-emerald-300'}`}>{collarComparison.review.status}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <figure className="min-w-0"><figcaption className="mb-1 text-xs text-white/70">Source crop</figcaption><img src={collarComparison.sourceCrop} alt="Source crop used for collar comparison" className="h-64 w-full rounded bg-[#eeeeec] object-contain"/></figure>
            <figure className="min-w-0"><figcaption className="mb-1 text-xs text-white/70">Generated clean drawing</figcaption><img src={collarComparison.cleanDrawing} alt="Generated collar drawing reviewed by validator" className="h-64 w-full rounded bg-[#eeeeec] object-contain"/></figure>
          </div>
          <h3 className="text-xs font-semibold">Detected differences</h3>
          {!collarComparison.review.differences.length && <p className="text-xs text-white/70">No visible differences reported.{collarComparison.review.confidence !== 'high' ? ' Source evidence is uncertain.' : ''}</p>}
          <ul className="space-y-3 text-xs">
            {collarComparison.review.differences.map((difference, index) => <li key={index} className="min-w-0 space-y-1 break-words border-l-2 border-white/20 pl-3">
              <p className="font-semibold">{difference.feature} <span className="font-normal text-white/60">({difference.severity}; {difference.confidence} confidence)</span></p>
              <p><span className="text-white/50">Source: </span>{difference.referenceEvidence}</p>
              <p><span className="text-white/50">Drawing: </span>{difference.drawingEvidence}</p>
              {difference.basis !== 'visible' && <p className="text-amber-200">{difference.basis === 'preset' ? 'Preset-only expectation: excluded from the match decision.' : 'Ambiguous source evidence: not grounds for rejection.'}</p>}
            </li>)}
          </ul>
          <details className="text-xs text-white/70"><summary className="cursor-pointer py-1">Observed collar construction</summary>
            <dl className="space-y-2 pt-2">{(['construction', 'texture', 'opening', 'height', 'attachment', 'seams'] as const).map(key => <div key={key} className="min-w-0 break-words"><dt className="font-semibold capitalize">{key}</dt><dd>Source: {collarComparison.review.reference[key]}</dd><dd>Drawing: {collarComparison.review.generated[key]}</dd></div>)}</dl>
          </details>
          {result && collarComparison.review.status === 'Needs Review' && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/>Reviewed collar differences against source</label>}
        </section>}
        {tab === 'final' && result?.sleeveReconstruction && <>
          <SleeveReconstructionEditor assets={results.filter(asset => asset.sleeveReconstruction)}
            renderPreview={overlay => <div data-preview-asset-id={result.id} data-preview-svg-id={previewHash} className="h-full w-full">{props.renderPreview(result, results.slice(1), overlay)}</div>}
            applyBoth={applyBoth} onChange={refineSleeve} onApplyBoth={value => {
            setApplyBoth(value); setReviewed(false);
            if (value && sleeveDraft) setResults(current => {
              const first = current[0];
              const model = first.sleeveReconstruction!;
              const oppositeSide = first.registration.side === 'left' ? 'right' : 'left';
              const opposite = current.find(asset => asset.registration.side === oppositeSide) ?? sleeveFromDraft(sleeveDraft, oppositeSide);
              return [first, reconstructSleeve(opposite, { ...opposite.sleeveReconstruction!, style: structuredClone(model.style), edits: mirroredSleeveEdits(model.edits) })];
            });
          }}/>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/>Reviewed sleeve style and fit</label>
        </>}
        {category === 'sleeve' && stageProvenance && <details className="text-[10px] text-white/60" aria-label="Sleeve provenance">
          <summary className="cursor-pointer py-1">Stage provenance (temporary)</summary>
          <dl className="grid gap-1 py-2">
            {Object.entries(stageProvenance).map(([key, value]) => <div key={key} className="min-w-0"><dt>{key === 'tracedSvgId' ? 'tracedSvgId (after registration)' : key}</dt><dd className="break-all font-mono" data-provenance={key}>{value}</dd></div>)}
            {result?.sleeveReconstruction && <div><dt>reconstructionSvgId</dt><dd className="break-all font-mono">{previewHash}</dd></div>}
          </dl>
        </details>}
        {proposal && !busy && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm sleeve area">
          <span className="mr-auto text-xs">Confirm sleeve area</span>
          <button className={control} onClick={() => { setTab('drawing'); setIsolationView('context'); setAdjustingIsolation(true); }}><Pencil className="mr-1 inline size-3.5"/>Adjust</button>
          <button className={`${control} !bg-emerald-700`} onClick={() => process(true)}><Check className="mr-1 inline size-3.5"/>Confirm</button>
        </div>}
        {busy && <p role="status" className="flex items-center gap-2 text-xs text-emerald-300"><LoaderCircle className="size-4 shrink-0 animate-spin"/>{progress}…</p>}
        {!busy && result?.sleeveReview && category === 'sleeve' && <p role="status" aria-label="Sleeve drawing match" className="text-xs text-white/80">
          Clean drawing: {result.sleeveReview.status}
        </p>}
        {!busy && result && category === 'sleeve' && <p role="status" aria-label="Sleeve registration status" className="text-xs text-white/80">
          {result.registration.status === 'Exact registration' ? 'Exact registration' : `Adapted to garment${result.registration.status === 'Needs review' ? ' · Needs review' : ''}`}
        </p>}
        {results.length > 1 && <section aria-label="Detected assets" className="space-y-1 border-t border-white/10 pt-2">
          <h3 className="text-xs font-semibold">Detected assets ({results.length})</h3>
          {results.map(asset => <div key={asset.id} className="flex items-center justify-between gap-3 py-1 text-xs">
            <span className="min-w-0 break-words">{asset.name}</span><span className="shrink-0 text-white/50">{asset.category === 'pocket' ? { pocket: 'Pockets', button: 'Buttons', zip: 'Zips', patch: 'Patches' }[asset.detailType ?? 'pocket'] : labels[asset.category]}</span>
          </div>)}
        </section>}
        {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200"><AlertCircle className="size-4 shrink-0"/><span className="min-w-0 break-words">{category === 'sleeve' ? `Rejected: ${error}` : error}</span></div>}
        <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-3">
          <div className="flex gap-2"><button className={control} disabled={busy || !image || category === 'sleeve'} onClick={() => { invalidate(); setCropping(true); }}><Crop className="mr-1 inline size-3.5"/>Adjust Crop</button>
            <button title="Reset crop" aria-label="Reset crop" className={control} disabled={busy || !image} onClick={() => { setCrop([0, 0, 1, 1]); invalidate(); }}><RotateCcw className="size-3.5"/></button></div>
          <div className="flex gap-2"><button className={control} onClick={() => { cancel(); setOpen(false); }}><X className="mr-1 inline size-3.5"/>Cancel</button>
            <button className={control} disabled={busy || !image || !!limited} onClick={() => process()}>{result || error || proposal ? 'Retry' : 'Process'}</button>
            <button className={`${control} !bg-emerald-700`} disabled={busy || !result || collarComparison?.review.status === 'Rejected' || (collarComparison?.review.status === 'Needs Review' && !reviewed) || (Boolean(result?.sleeveReconstruction) && (!reviewed || results.some(asset => asset.sleeveReconstruction && sleeveGeometry(asset.sleeveReconstruction).issues.length > 0)))} onClick={() => {
              if (!result || result.category !== props.category || contextRef.current !== context || busyRef.current || accepted.current) return;
              if (collarComparison?.review.status === 'Rejected' || (collarComparison?.review.status === 'Needs Review' && !reviewed)) return;
              if (result.sleeveReconstruction && (!reviewed || results.some(asset => asset.sleeveReconstruction && sleeveGeometry(asset.sleeveReconstruction).issues.length > 0))) return;
              accepted.current = true;
              props.onAccept(result, results.slice(1), collarEdits);
              setOpen(false);
              cancel();
            }}><Check className="mr-1 inline size-3.5"/>Accept</button></div>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}