import type { PanelRegion } from './panellingTypes';

export function BuilderPanellingSidebar({
  tool,
  mirror,
  panels,
  selectedPanelId,
  panelColours,
  onToolChange,
  onMirrorChange,
  onFinish,
  onCancel,
  onUndo,
  onSelectPanel,
  onPanelColour,
}: {
  tool: 'pen' | 'select';
  mirror: boolean;
  panels: PanelRegion[];
  selectedPanelId: string | null;
  panelColours: Record<string, string>;
  onToolChange: (tool: 'pen' | 'select') => void;
  onMirrorChange: (value: boolean) => void;
  onFinish: () => void;
  onCancel: () => void;
  onUndo: () => void;
  onSelectPanel: (id: string | null) => void;
  onPanelColour: (id: string, colour: string) => void;
}) {
  const selectedColour = selectedPanelId ? panelColours[selectedPanelId] ?? '#5c84b2' : '#5c84b2';
  return (
    <div className="space-y-4" aria-label="Production panelling controls">
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/55">Parent surface</div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white">Body</div>
      </div>
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/55">Seam tool</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={tool === 'pen'} onClick={() => onToolChange('pen')} className={`rounded-lg border px-2 py-2 text-xs ${tool === 'pen' ? 'border-white/50 bg-white/15 text-white' : 'border-white/10 text-white/60'}`}>Pen Tool <kbd className="ml-1 text-[9px] text-white/40">P</kbd></button>
          <button type="button" aria-pressed={tool === 'select'} onClick={() => onToolChange('select')} className={`rounded-lg border px-2 py-2 text-xs ${tool === 'select' ? 'border-white/50 bg-white/15 text-white' : 'border-white/10 text-white/60'}`}>Select / Edit <kbd className="ml-1 text-[9px] text-white/40">V</kbd></button>
        </div>
      </div>
      <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80">
        Mirror seam
        <input type="checkbox" checked={mirror} onChange={event => onMirrorChange(event.target.checked)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onFinish} className="rounded-lg bg-white px-2 py-2 text-xs font-semibold text-black">Finish Path</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-white/15 px-2 py-2 text-xs text-white/75">Cancel</button>
      </div>
      <button type="button" onClick={onUndo} className="w-full rounded-lg border border-white/10 px-2 py-2 text-xs text-white/65">Undo last point / path</button>
      <div>
        <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-white/55"><span>Generated panels</span><span>{panels.length}</span></div>
        {panels.length ? <div className="space-y-1">{panels.map((panel, index) => <button key={panel.id} type="button" aria-pressed={selectedPanelId === panel.id} onClick={() => onSelectPanel(panel.id)} className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs ${selectedPanelId === panel.id ? 'border-white/45 bg-white/10 text-white' : 'border-white/10 text-white/70'}`}><span className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: panelColours[panel.id] ?? '#5c84b2' }} />Body panel {index + 1}</span><span className="text-[10px] text-white/40">{Math.round(panel.area).toLocaleString()}</span></button>)}</div> : <p className="text-xs leading-relaxed text-white/45">Draw a neckline-to-hem seam on Body to generate two panels.</p>}
      </div>
      {selectedPanelId && <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/75">Panel colour<input aria-label="Selected panel colour" type="color" value={selectedColour} onChange={event => onPanelColour(selectedPanelId, event.target.value)} /></label>}
    </div>
  );
}
