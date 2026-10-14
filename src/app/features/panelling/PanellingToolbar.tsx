import { Check, MousePointer2, PenTool, RotateCcw, X } from 'lucide-react';

export function PanellingToolbar({ tool, mirror, active, selectedPanel, panelColor, selectedAnchor, tests, onToolChange, onMirrorChange, onFinish, onCancel, onUndo, onDemo, onPanelColor, onAnchorMode, onConvertToCurve, onRunTests, onScenario }: {
  tool: 'pen' | 'select';
  mirror: boolean;
  active: boolean;
  selectedPanel: string | null;
  panelColor: string;
  selectedAnchor: { mode: 'corner' | 'smooth' | 'independent'; hasCurve: boolean } | null;
  tests: { name: string; passed: boolean }[];
  onToolChange: (tool: 'pen' | 'select') => void;
  onMirrorChange: (mirror: boolean) => void;
  onFinish: () => void;
  onCancel: () => void;
  onUndo: () => void;
  onDemo: () => void;
  onPanelColor: (color: string) => void;
  onAnchorMode: (mode: 'corner' | 'smooth' | 'independent') => void;
  onConvertToCurve: () => void;
  onRunTests: () => void;
  onScenario: (scenario: string) => void;
}) {
  return <aside className="panelling-toolbar">
    <div className="lab-mark"><span className="lab-mark-dot" /><span>CERIGA <b>LAB</b></span><span className="lab-build">DEV FEATURE</span></div>
    <div className="toolbar-section">
      <div className="section-label">Tools</div>
      <div className="tool-grid">
        <button type="button" className={tool === 'pen' ? 'tool-button active' : 'tool-button'} aria-pressed={tool === 'pen'} onClick={() => onToolChange('pen')}><PenTool size={16} /><span>Pen Tool</span><kbd>P</kbd></button>
        <button type="button" className={tool === 'select' ? 'tool-button active' : 'tool-button'} aria-pressed={tool === 'select'} onClick={() => onToolChange('select')}><MousePointer2 size={16} /><span>Select / Edit</span><kbd>V</kbd></button>
      </div>
    </div>
    <div className="toolbar-section">
      <div className="section-label">Options</div>
      <button type="button" role="switch" aria-checked={mirror} className="mirror-switch" onClick={() => onMirrorChange(!mirror)}><span>Mirror construction</span><span className={mirror ? 'switch-state on' : 'switch-state'}>{mirror ? 'On' : 'Off'}<i /></span></button>
      <div className="toolbar-actions">
        <button type="button" className="action-primary" disabled={!active} onClick={onFinish}><Check size={15} />Finish Path</button>
        <button type="button" className="action-secondary" disabled={!active} onClick={onCancel}><X size={15} />Cancel</button>
      </div>
      <button type="button" className="quiet-button" onClick={onUndo}><RotateCcw size={14} />Undo last point / path</button>
      <button type="button" className="demo-button" onClick={onDemo}>Run neck-to-hem split</button>
      <label className="scenario-select"><span>Visual review case</span><select aria-label="Visual review case" defaultValue="" onChange={event => { if (event.target.value) onScenario(event.target.value); event.target.value = ''; }}>
        <option value="" disabled>Choose test A–F</option>
        <option value="straight">A · Straight split</option>
        <option value="yoke">B · Curved yoke</option>
        <option value="mixed">C · Straight + curve</option>
        <option value="convert">D · Bend straight seam</option>
        <option value="insert">E · Insert and reshape</option>
        <option value="mirror">F · Mirrored curve</option>
      </select></label>
      {tool === 'select' && selectedAnchor && <div className="anchor-context">
        <div className="section-label">Anchor type</div>
        <div className="anchor-mode-group" role="group" aria-label="Selected anchor type">
          {(['corner', 'smooth', 'independent'] as const).map(mode => <button key={mode} type="button" aria-pressed={selectedAnchor.mode === mode} onClick={() => onAnchorMode(mode)}>{mode}</button>)}
        </div>
        {!selectedAnchor.hasCurve && <button type="button" className="convert-curve-button" onClick={onConvertToCurve}>Convert adjacent line to curve</button>}
      </div>}
    </div>
    <div className="toolbar-section panel-proof">
      <div className="section-label">Panel proof</div>
      {selectedPanel ? <label className="color-control"><span>Temporary colour</span><input type="color" aria-label="Temporary selected panel colour" value={panelColor} onChange={event => onPanelColor(event.target.value)} /></label> : <p>Select a generated panel to test independent colour.</p>}
    </div>
    <div className="toolbar-section test-section">
      <div className="section-label">Engine checks <span>{tests.filter(test => test.passed).length}/{tests.length || 0}</span></div>
      <button type="button" className="quiet-button" onClick={onRunTests}>Run self-tests</button>
      {tests.length > 0 && <ul>{tests.map(test => <li key={test.name} data-passed={test.passed}>{test.passed ? 'PASS' : 'FAIL'} · {test.name}</li>)}</ul>}
    </div>
    <div className="toolbar-footer"><span>STANDARD SEAM</span><span>2048 × 2048</span></div>
  </aside>;
}