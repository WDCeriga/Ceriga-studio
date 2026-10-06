import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { useAssetWorkspace } from './useAssetWorkspace';
export const ASSET_LIBRARY_DRAG_MIME = 'application/x-ceriga-saved-asset';
type Workspace = ReturnType<typeof useAssetWorkspace>;
const Context = createContext<Workspace | null>(null);
export function AssetWorkspaceProvider({ value, children }: { value: Workspace; children: ReactNode }) { return <Context.Provider value={value}>{children}</Context.Provider>; }
export const useAssetWorkspaceContext = () => useContext(Context);
const button = 'rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40';
const input = 'min-w-0 rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white';

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

export function AssetWorkspaceHeader() {
  const workspace = useAssetWorkspaceContext();
  const [customSize, setCustomSize] = useState(false);
  if (!workspace?.project) return null;
  const { project, busy, changeProject } = workspace;
  const existing = workspace.library.some(asset => asset.id === project.id);
  const dimension = (key: 'width' | 'height', value: number) => { setCustomSize(true); changeProject({ [key]: value }); };
  return <header data-asset-workspace-header className="relative z-30 flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#171719] p-3">
    <button className={button} disabled={busy} onClick={workspace.back}>← Back to Garment</button>
    <span className="text-xs font-semibold text-white/70">Asset Builder</span>
    <input aria-label="Asset name" className={`${input} flex-1`} disabled={busy} value={project.name} maxLength={120} onChange={event => changeProject({ name: event.target.value })} />
    <select aria-label="Asset size preset" className={input} disabled={busy} value={customSize ? 'custom' : project.width === 600 && project.height === 600 ? 'square' : project.width === 600 && project.height === 900 ? 'portrait' : project.width === 900 && project.height === 600 ? 'landscape' : 'custom'} onChange={event => { setCustomSize(event.target.value === 'custom'); const sizes = { square: [600, 600], portrait: [600, 900], landscape: [900, 600] }; const size = sizes[event.target.value as keyof typeof sizes]; if (size) changeProject({ width: size[0], height: size[1] }); }}>
      <option value="square">Square</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="custom">Custom</option>
    </select>
    <DimensionInput label="Asset width" disabled={busy} value={project.width} onChange={value => dimension('width', value)} />
    <span className="text-white/50">×</span>
    <DimensionInput label="Asset height" disabled={busy} value={project.height} onChange={value => dimension('height', value)} />
    {existing && <button className={button} disabled={busy} onClick={() => void workspace.save(true)}>Save as New Asset</button>}
    <button className={`${button} bg-[#CC2D24]`} disabled={busy} onClick={() => void workspace.save()}>{busy ? 'Saving…' : existing ? 'Save Changes' : 'Save Asset'}</button>
    {workspace.error && <p role="alert" className="w-full text-xs text-red-300">{workspace.error}</p>}
  </header>;
}

export function AssetLibraryPanel() {
  const workspace = useAssetWorkspaceContext();
  if (!workspace) return null;
  return <section className="space-y-3 pb-4">
    <button className={`${button} w-full bg-[#CC2D24]`} disabled={!!workspace.project || workspace.busy || !workspace.authReady || !!workspace.recovery} onClick={() => workspace.enter()}>+ Create Asset</button>
    {workspace.recovery && !workspace.project && <div className="space-y-2 rounded border border-amber-300/30 p-2 text-xs text-white/70"><p>An unfinished asset is saved on this device.</p><button className={button} onClick={workspace.resume}>Resume asset draft</button></div>}
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60">My Assets</h3>
    {workspace.libraryError && <p role="alert" className="text-xs text-amber-200">{workspace.libraryError}</p>}
    {!workspace.project && workspace.error && <p role="alert" className="text-xs text-red-300">{workspace.error}</p>}
    {!workspace.library.length && <p className="text-xs text-white/45">Create a graphic with the studio tools and save it here.</p>}
    <div className="grid grid-cols-2 gap-2">{workspace.library.map(asset => <article key={asset.id} className="min-w-0 rounded-lg border border-white/10 p-2">
      <button className="w-full" aria-label={`Place ${asset.name}`} disabled={workspace.busy} draggable={!workspace.busy} onDragStart={event => { event.dataTransfer.setData(ASSET_LIBRARY_DRAG_MIME, asset.id); event.dataTransfer.effectAllowed = 'copy'; }} onClick={() => workspace.insert(asset)}>
        <img src={asset.preview} alt={asset.name} className="h-20 w-full rounded bg-white/10 object-contain" /><span className="mt-1 block truncate text-xs text-white">{asset.name}</span>
      </button>
      <button className="mt-1 text-[10px] text-white/60 hover:text-white disabled:opacity-30" disabled={!!workspace.project || workspace.busy || !!workspace.recovery} onClick={() => workspace.enter(asset)}>Edit Asset</button>
    </article>)}</div>
  </section>;
}

export function AssetWorkspaceDialogs() {
  const workspace = useAssetWorkspaceContext();
  if (!workspace || (!workspace.confirmBack && !workspace.nameRequest)) return null;
  return <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={workspace.nameRequest ? 'Asset Name' : 'Unsaved asset changes'}>
    <div className="w-full max-w-md space-y-4 rounded-xl border border-white/15 bg-[#1b1b1e] p-5 text-white">
      {workspace.nameRequest ? <form onSubmit={event => { event.preventDefault(); if (workspace.nameInput.trim()) void workspace.save(workspace.nameRequest!.asNew, workspace.nameInput); }}>
        <label className="mb-3 block text-sm">Asset Name<input autoFocus aria-label="Save asset name" className={`${input} mt-2 w-full`} maxLength={120} value={workspace.nameInput} onChange={event => workspace.setNameInput(event.target.value)} /></label>
        <div className="flex justify-end gap-2"><button type="button" className={button} onClick={() => workspace.setNameRequest(null)}>Cancel</button><button className={`${button} bg-[#CC2D24]`} disabled={!workspace.nameInput.trim()}>Save Asset</button></div>
      </form> : <><p>You have unsaved changes to this asset.</p><div className="flex flex-wrap gap-2"><button className={button} onClick={() => void workspace.discard()}>Discard Changes</button><button className={button} onClick={() => workspace.setConfirmBack(false)}>Continue Editing</button><button className={`${button} bg-[#CC2D24]`} onClick={() => void workspace.save()}>Save Asset</button></div></>}
    </div>
  </div>;
}
