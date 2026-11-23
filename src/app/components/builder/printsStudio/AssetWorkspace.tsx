import {Plus,Pencil,ArrowLeft,Check,Layers,FileClock,ArrowRight} from 'lucide-react';
import { createContext, useContext, type ReactNode } from 'react';
import './asset-workspace.css';
import './asset-studio.css';
import { AddToGarmentMenu, BackgroundMenu, CanvasMenu } from './AssetStudioMenus';
import type { useAssetWorkspace } from './useAssetWorkspace';
export const ASSET_LIBRARY_DRAG_MIME = 'application/x-ceriga-saved-asset';
type Workspace = ReturnType<typeof useAssetWorkspace>;
const Context = createContext<Workspace | null>(null);
export function AssetWorkspaceProvider({ value, children }: { value: Workspace | null; children: ReactNode }) { return <Context.Provider value={value}>{children}</Context.Provider>; }
export const useAssetWorkspaceContext = () => useContext(Context);
/** Copy and controls that only make sense with a garment on the canvas. */
export const GarmentOnly = ({ children }: { children: ReactNode }) => useContext(Context)?.project ? null : <>{children}</>;
export const CanvasWord = () => <>{useContext(Context)?.project ? 'canvas' : 'garment'}</>;
const button = 'rounded-md border border-[#e2e2e2] px-3 py-2 text-xs font-semibold text-[#262626] hover:bg-[#f2f2f2] disabled:opacity-40';
const input = 'min-w-0 rounded-md border border-[#e2e2e2] bg-[#fafafa] px-2 py-1.5 text-xs text-[#262626]';

export function AssetWorkspaceEntry({onActivate}:{onActivate?:()=>void}) {
 const workspace=useAssetWorkspaceContext();
 if(!workspace)return null;
 const active=Boolean(workspace.project),recovery=Boolean(workspace.recovery);
 return <div className="asset-workspace-entry"><button className="asset-workspace-launch" aria-pressed={active} disabled={workspace.busy||!workspace.authReady} onClick={()=>{if(!active){if(recovery)workspace.resume();else workspace.enter();}onActivate?.();}}>{active?<Layers size={16}/>:<Plus size={16}/>}<span>{active?'Asset Studio':recovery?'Resume asset':'Create asset'}</span>{active&&<Check size={13}/>}</button><p>{active?'All tools now edit your asset.':'Build a reusable design with any tool.'}</p></div>;
}

export function AssetWorkspaceHeader() {
 const workspace=useAssetWorkspaceContext();
 if(!workspace?.project)return null;
 const {project,busy,changeProject}=workspace,existing=workspace.library.some(asset=>asset.id===project.id);
 return <header data-asset-workspace-header className="asset-workspace-header as-header">
  <div className="as-bar">
   <div className="as-left"><button className="as-back" aria-label="Close Asset Studio" title="Close Asset Studio" disabled={busy} onClick={workspace.back}><ArrowLeft size={16}/></button><div className="as-name"><small>Asset Studio</small><input aria-label="Asset name" disabled={busy} value={project.name} maxLength={120} onChange={event=>changeProject({name:event.target.value})}/></div></div>
   <div className="as-center"><CanvasMenu workspace={workspace}/><BackgroundMenu workspace={workspace}/></div>
   <div className="as-right"><span className="as-status" role="status">{busy?'Saving…':workspace.dirty?'Unsaved':existing?'Saved':'New'}</span>{existing&&<button className="as-copy" disabled={busy} onClick={()=>void workspace.save(true)}>Save a copy</button>}<AddToGarmentMenu workspace={workspace}/></div>
  </div>
  {workspace.error&&<p role="alert" className="asset-workspace-error">{workspace.error}</p>}
 </header>;
}

export function AssetLibraryPanel({query='',showCreate=true,showHeading=true,recent=false}:{query?:string;showCreate?:boolean;showHeading?:boolean;recent?:boolean}={}) {
  const workspace = useAssetWorkspaceContext();
  if (!workspace) return null;
  return <section data-studio-assets className="space-y-3 pb-4">
    {showCreate&&<button className="asset-create-action" disabled={!!workspace.project || workspace.busy || !workspace.authReady || !!workspace.recovery} onClick={() => workspace.enter()}>+ Create Asset</button>}
    {workspace.recovery && !workspace.project && (
      <button type="button" className="asset-library-draft" disabled={workspace.busy || !workspace.authReady} onClick={workspace.resume}>
        <span className="asset-action-icon"><FileClock size={16} aria-hidden="true" /></span>
        <span className="asset-action-copy">
          <strong>Resume asset draft</strong>
          <small>Saved on this device</small>
        </span>
        <ArrowRight className="asset-action-arrow" size={15} aria-hidden="true" />
      </button>
    )}
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
