import {Plus,Pencil,ArrowLeft,ChevronDown,Check,Layers} from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import './asset-workspace.css';
import {AdvancedColorPopover} from '../PrintStudioColorPopover';
import type { useAssetWorkspace } from './useAssetWorkspace';
export const ASSET_LIBRARY_DRAG_MIME = 'application/x-ceriga-saved-asset';
type Workspace = ReturnType<typeof useAssetWorkspace>;
const Context = createContext<Workspace | null>(null);
export function AssetWorkspaceProvider({ value, children }: { value: Workspace | null; children: ReactNode }) { return <Context.Provider value={value}>{children}</Context.Provider>; }
export const useAssetWorkspaceContext = () => useContext(Context);
const button = 'rounded-md border border-[#e2e2e2] px-3 py-2 text-xs font-semibold text-[#262626] hover:bg-[#f2f2f2] disabled:opacity-40';
const input = 'min-w-0 rounded-md border border-[#e2e2e2] bg-[#fafafa] px-2 py-1.5 text-xs text-[#262626]';

function DimensionInput({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const number = Number(text);
    if (Number.isInteger(number) && number >= 32 && number <= 4096) onChange(number);
    else setText(String(value));
  };
  return <input aria-label={label} type="number" min={32} max={4096} className={`${input} w-20`} disabled={disabled} value={text} onChange={event => setText(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}

export function AssetWorkspaceEntry({onActivate}:{onActivate?:()=>void}) {
 const workspace=useAssetWorkspaceContext();
 if(!workspace)return null;
 const active=Boolean(workspace.project),recovery=Boolean(workspace.recovery);
 return <div className="asset-workspace-entry"><button className="asset-workspace-launch" aria-pressed={active} disabled={workspace.busy||!workspace.authReady} onClick={()=>{if(!active){if(recovery)workspace.resume();else workspace.enter();}onActivate?.();}}>{active?<Layers size={16}/>:<Plus size={16}/>}<span>{active?'Asset workspace':recovery?'Resume asset':'Create asset'}</span>{active&&<Check size={13}/>}</button><p>{active?'All tools now edit your asset.':'Build a reusable design with any tool.'}</p></div>;
}

export function AssetWorkspaceHeader() {
 const workspace=useAssetWorkspaceContext();
 const menu=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(menu.current&&!menu.current.contains(event.target as Node)&&!(event.target as Element).closest(".asset-canvas-colour-panel"))menu.current.open=false;};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menu.current?.open&&!(event.target as Element).closest(".asset-canvas-colour-panel")){menu.current.open=false;menu.current.querySelector('summary')?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 if(!workspace?.project)return null;
 const {project,busy,changeProject}=workspace;

 const existing=workspace.library.some(asset=>asset.id===project.id);
 const sizes=[{name:'Square',width:600,height:600},{name:'Portrait',width:600,height:900},{name:'Landscape',width:900,height:600}];
 return <header data-asset-workspace-header className="asset-workspace-header">
  <div className="asset-workspace-topline"><button className="asset-return" disabled={busy} onClick={workspace.back}><ArrowLeft size={15}/><span>Garment</span></button><div className="asset-workspace-identity"><span>ASSET WORKSPACE</span><input aria-label="Asset name" disabled={busy} value={project.name} maxLength={120} onChange={event=>changeProject({name:event.target.value})}/></div><div className="asset-workspace-save"><span role="status">{busy?'Saving…':workspace.dirty?'Unsaved changes':existing?'Saved':'New asset'}</span>{existing&&<button className="asset-save-copy" disabled={busy} onClick={()=>void workspace.save(true)}>Save a copy</button>}<button className="asset-save-primary" disabled={busy} onClick={()=>void workspace.save()}>{busy?'Saving…':existing?'Save changes':'Save asset'}</button></div></div>
  <div className="asset-workspace-settings"><details ref={menu} className="asset-canvas-size"><summary>Canvas <span>{project.width} × {project.height} px</span><ChevronDown size={13}/></summary><div className="asset-size-panel"><h3>Canvas size</h3><p>Choose a format or set your own dimensions.</p><div className="asset-size-presets">{sizes.map(size=><button key={size.name} disabled={busy} aria-pressed={project.width===size.width&&project.height===size.height} onClick={()=>changeProject({width:size.width,height:size.height})}><span className="asset-format-preview" style={{width:size.width>size.height?28:20,height:size.height>size.width?28:20}}/><span>{size.name}</span></button>)}</div><div className="asset-size-dimensions"><label>Width<DimensionInput label="Asset width" disabled={busy} value={project.width} onChange={width=>changeProject({width})}/></label><span>×</span><label>Height<DimensionInput label="Asset height" disabled={busy} value={project.height} onChange={height=>changeProject({height})}/></label><span>px</span></div><div className="asset-background-controls"><h3>Background</h3><div className="asset-background-options"><button disabled={busy} aria-pressed={!project.background} onClick={()=>changeProject({background:undefined})}><span className="asset-transparent-swatch"/>Transparent</button><button disabled={busy} aria-pressed={Boolean(project.background)} onClick={()=>changeProject({background:project.background??'#ffffff'})}><span style={{background:project.background??'#ffffff'}}/>Colour</button></div>{project.background&&<div className="asset-background-colour"><span>Canvas colour</span><AdvancedColorPopover value={project.background} onChange={background=>{if(!busy)changeProject({background});}} contentClassName="asset-canvas-colour-panel"><button className="asset-background-picker" disabled={busy} aria-label="Choose canvas background colour"><i style={{background:project.background}}/><span>{project.background.toUpperCase()}</span><ChevronDown size={12}/></button></AdvancedColorPopover></div>}{project.background&&<div className="asset-background-swatches" role="group" aria-label="Canvas background swatches">{['#ffffff','#171717','#d4d4d4','#f3eadb','#c8d4c2','#a9bfd1','#dec5ca','#d8bf93'].map(colour=><button key={colour} disabled={busy} aria-label={`Canvas colour ${colour}`} aria-pressed={project.background?.toLowerCase()===colour} style={{background:colour}} onClick={()=>changeProject({background:colour})}/>)}</div>}</div></div></details></div>
  {workspace.error&&<p role="alert" className="asset-workspace-error">{workspace.error}</p>}
 </header>;
}

export function AssetLibraryPanel({query='',showCreate=true,showHeading=true,recent=false}:{query?:string;showCreate?:boolean;showHeading?:boolean;recent?:boolean}={}) {
  const workspace = useAssetWorkspaceContext();
  if (!workspace) return null;
  return <section data-studio-assets className="space-y-3 pb-4">
    {showCreate&&<button className="asset-create-action" disabled={!!workspace.project || workspace.busy || !workspace.authReady || !!workspace.recovery} onClick={() => workspace.enter()}>+ Create Asset</button>}
    {workspace.recovery && !workspace.project && <div className="space-y-2 rounded border border-amber-300/30 p-2 text-xs text-[#737373]"><p>An unfinished asset is saved on this device.</p><button className={button} onClick={workspace.resume}>Resume asset draft</button></div>}
    {showHeading&&<h3 className="artwork-section-title">Saved assets</h3>}
    {workspace.libraryError && <p role="alert" className="text-xs text-amber-200">{workspace.libraryError}</p>}
    {!workspace.project && workspace.error && <p role="alert" className="text-xs text-red-300">{workspace.error}</p>}
    {!workspace.library.length && <p className="text-xs text-[#737373]">Create a graphic with the studio tools and save it here.</p>}
    {workspace.library.length>0&&!workspace.library.some(asset=>asset.name.toLowerCase().includes(query.trim().toLowerCase()))&&<p className="artwork-library-hint">No saved assets match this search.</p>}
    <div className="artwork-saved-grid" role="region" aria-label="Saved artwork" tabIndex={0}>{workspace.library.filter(asset=>asset.name.toLowerCase().includes(query.trim().toLowerCase())).slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,recent?6:undefined).map(asset => <article key={asset.id} className="artwork-saved-card">
      <button className="artwork-saved-place" aria-label={`Place ${asset.name}`} disabled={workspace.busy} draggable={!workspace.busy} onDragStart={event => { event.dataTransfer.setData(ASSET_LIBRARY_DRAG_MIME, asset.id); event.dataTransfer.effectAllowed = 'copy'; }} onClick={() => workspace.insert(asset)}>
        <div className="artwork-library-preview"><img src={asset.preview} alt=""/></div><span>{asset.name}<Plus size={12}/></span>
      </button>
      <button className="artwork-saved-edit" disabled={!!workspace.project || workspace.busy || !!workspace.recovery} onClick={() => workspace.enter(asset)}><Pencil size={12}/>Edit asset</button>
    </article>)}</div>
  </section>;
}

export function AssetWorkspaceDialogs() {
  const workspace = useAssetWorkspaceContext();
  if (!workspace || (!workspace.confirmBack && !workspace.nameRequest)) return null;
  return <div className="asset-dialog-backdrop" role="dialog" aria-modal="true" aria-label={workspace.nameRequest ? 'Asset Name' : 'Unsaved asset changes'}>
    <div className="asset-dialog">
      {workspace.nameRequest ? <form onSubmit={event => { event.preventDefault(); if (workspace.nameInput.trim()) void workspace.save(workspace.nameRequest!.asNew, workspace.nameInput); }}>
        <label className="mb-3 block text-sm">Asset Name<input autoFocus aria-label="Save asset name" className={`${input} mt-2 w-full`} maxLength={120} value={workspace.nameInput} onChange={event => workspace.setNameInput(event.target.value)} /></label>
        <div className="flex justify-end gap-2"><button type="button" className={button} onClick={() => workspace.setNameRequest(null)}>Cancel</button><button className={`${button} asset-save-primary`} disabled={!workspace.nameInput.trim()}>Save Asset</button></div>
      </form> : <><p>You have unsaved changes to this asset.</p><div className="flex flex-wrap gap-2"><button className={button} onClick={() => void workspace.discard()}>Discard Changes</button><button className={button} onClick={() => workspace.setConfirmBack(false)}>Continue Editing</button><button className={`${button} asset-save-primary`} onClick={() => void workspace.save()}>Save Asset</button></div></>}
    </div>
  </div>;
}
