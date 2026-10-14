import { useCallback, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PanellingCanvas, type PanellingCanvasHandle } from './PanellingCanvas';
import { PanellingToolbar } from './PanellingToolbar';
import { closestBoundaryPoint, signedArea } from './panellingGeometry';
import { PANELLING_GARMENT_MARKUP, PANELLING_SURFACES, panellingSurfaceLabel, panellingSurfaceSource, REGISTERED_TSHIRT_SYMMETRY_AXIS } from './panellingGarment';
import { linkedMirrorSeams } from './panellingMirroring';
import { runPanellingSelfTests } from './panellingSelfTest';
import { convertSeamToCurve, insertSeamAnchor, moveSeamAnchor } from './panellingSeams';
import { recomputePanellingTopology } from './panellingTopology';
import type { BoundaryLoop, PanellingPoint, PanellingSeam } from './panellingTypes';
import './panelling-lab.css';

function runChecks() {
  try { return runPanellingSelfTests(); }
  catch (error) { return [{ name: error instanceof Error ? error.message : String(error), passed: false }]; }
}

function demoSeam(boundaries: BoundaryLoop[], axis: number, parentSurfaceId: string): PanellingSeam | undefined {
  const outer = boundaries.filter(boundary => boundary.role === 'outer').sort((a, b) => Math.abs(signedArea(b.points)) - Math.abs(signedArea(a.points)))[0];
  if (!outer) return undefined;
  const xs = outer.points.map(point => point.x), ys = outer.points.map(point => point.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys), bodyHeight = maxY - minY, bodyWidth = Math.max(...xs) - Math.min(...xs);
  const neckline = outer.points.filter(point => point.y < minY + bodyHeight * .42 && Math.abs(point.x - axis) < bodyWidth * .2)
    .sort((a, b) => b.y - a.y || Math.abs(a.x - axis) - Math.abs(b.x - axis))[0];
  const hem = outer.points.filter(point => point.y > maxY - bodyHeight * .12)
    .sort((a, b) => Math.abs(a.x - axis) - Math.abs(b.x - axis))[0];
  if (!neckline || !hem) return undefined;
  return { id: crypto.randomUUID(), label: 'Centre neckline to hem', parentSurfaceId, construction: 'standard', anchors: [
    { id: crypto.randomUUID(), ...neckline, boundaryId: outer.id },
    { id: crypto.randomUUID(), ...hem, boundaryId: outer.id },
  ] };
}

function reviewSeam(kind: string, boundaries: BoundaryLoop[], axis: number, parentSurfaceId: string): { seam?: PanellingSeam; mirror?: boolean } {
  const outer = boundaries.filter(boundary => boundary.role === 'outer').sort((a, b) => Math.abs(signedArea(b.points)) - Math.abs(signedArea(a.points)))[0];
  if (!outer) return {};
  const xs = outer.points.map(point => point.x), ys = outer.points.map(point => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = maxX - minX, height = maxY - minY;
  const onBoundary = (x: number, y: number) => ({ ...closestBoundaryPoint({ x, y }, boundaries)!.point,
    id: crypto.randomUUID(), handleMode: 'corner' as const, boundaryId: closestBoundaryPoint({ x, y }, boundaries)!.boundaryId });
  const make = (label: string, anchors: PanellingSeam['anchors'], mirror = false) => ({
    seam: { id: crypto.randomUUID(), label, parentSurfaceId, anchors, construction: 'standard' as const, ...(mirror ? { mirrorGroupId: undefined, mirrorLinked: true } : {}) },
    mirror,
  });
  if (kind === 'straight') return { seam: demoSeam(boundaries, axis, parentSurfaceId) };
  if (kind === 'yoke') {
    const left = onBoundary(minX + width * .14, minY + height * .28), right = onBoundary(maxX - width * .14, minY + height * .28);
    const middle = { id: crypto.randomUUID(), x: axis, y: minY + height * .44, handleMode: 'smooth' as const,
      incoming: { x: axis - width * .14, y: minY + height * .34 }, outgoing: { x: axis + width * .14, y: minY + height * .34 } };
    return make('Curved yoke', [left, middle, right]);
  }
  if (kind === 'mixed') {
    const start = onBoundary(minX + width * .05, minY + height * .58), finish = onBoundary(maxX - width * .05, minY + height * .49);
    const corner = { id: crypto.randomUUID(), x: axis - width * .12, y: minY + height * .56, handleMode: 'corner' as const };
    const smooth = { id: crypto.randomUUID(), x: axis + width * .1, y: minY + height * .52, handleMode: 'smooth' as const,
      incoming: { x: axis + width * .02, y: minY + height * .47 }, outgoing: { x: axis + width * .19, y: minY + height * .47 } };
    return make('Mixed straight and curved seam', [start, corner, smooth, finish]);
  }
  if (kind === 'convert' || kind === 'insert') {
    const straight = make(kind === 'convert' ? 'Converted straight seam' : 'Inserted anchor seam', [
      onBoundary(minX + width * .04, minY + height * .56),
      onBoundary(maxX - width * .04, minY + height * .56),
    ]).seam;
    if (kind === 'convert') {
      let curved = convertSeamToCurve(straight, 0);
      curved = { ...curved, anchors: curved.anchors.map((anchor, index) => ({ ...anchor,
        ...(index === 0 && anchor.outgoing ? { outgoing: { x: anchor.outgoing.x, y: anchor.outgoing.y - height * .18 } } : {}),
        ...(index === 1 && anchor.incoming ? { incoming: { x: anchor.incoming.x, y: anchor.incoming.y - height * .18 } } : {}),
      })) };
      return { seam: curved };
    }
    const inserted = insertSeamAnchor(straight, { x: axis, y: minY + height * .56 });
    const middle = inserted.anchors[1];
    const reshaped = moveSeamAnchor(inserted, middle.id, { x: middle.x, y: middle.y - height * .18 });
    return { seam: reshaped };
  }
  if (kind === 'mirror') {
    const start = onBoundary(minX + width * .02, minY + height * .38);
    const end = { id: crypto.randomUUID(), x: axis, y: minY + height * .56, handleMode: 'smooth' as const,
      incoming: { x: axis - width * .12, y: minY + height * .45 }, outgoing: { x: axis + width * .12, y: minY + height * .45 } };
    return make('Mirrored curved side panel', [start, end], true);
  }
  return {};
}

function PanellingLabApp() {
  const canvas = useRef<PanellingCanvasHandle>(null);
  const [parentSurfaceId, setParentSurfaceId] = useState<string>('base');
  const [boundariesBySurface, setBoundariesBySurface] = useState<Record<string, BoundaryLoop[]>>({});
  const [seamsBySurface, setSeamsBySurface] = useState<Record<string, PanellingSeam[]>>({});
  const [mirror, setMirror] = useState(false);
  const [tool, setTool] = useState<'pen' | 'select'>('pen');
  const [selection, setSelection] = useState<{ seamId: string; anchorId: string; mode: 'corner' | 'smooth' | 'independent'; hasCurve: boolean } | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [pathActive, setPathActive] = useState(false);
  const [panelColours, setPanelColours] = useState<Record<string, string>>({});
  const [tests, setTests] = useState(runChecks);
  const surface = PANELLING_SURFACES.find(item => item.id === parentSurfaceId) ?? PANELLING_SURFACES[0];
  const boundaries = boundariesBySurface[parentSurfaceId] ?? [];
  const seams = seamsBySurface[parentSurfaceId] ?? [];
  const symmetryAxis = REGISTERED_TSHIRT_SYMMETRY_AXIS;
  const graphSeams = useMemo(() => linkedMirrorSeams(seams, symmetryAxis, mirror), [seams, symmetryAxis, mirror]);
  const topology = useMemo(() => recomputePanellingTopology(boundaries, graphSeams, parentSurfaceId), [boundaries, graphSeams, parentSurfaceId]);
  const panels = useMemo(() => topology.panels.map(panel => ({ ...panel, fillOverride: panelColours[panel.id] })), [topology.panels, panelColours]);
  const selectedPanel = panels.find(panel => panel.id === selectedPanelId);
  const onBoundariesChange = useCallback((next: BoundaryLoop[]) => setBoundariesBySurface(current => ({ ...current, [parentSurfaceId]: next })), [parentSurfaceId]);
  const onSeamsChange = useCallback((next: PanellingSeam[]) => setSeamsBySurface(current => ({ ...current, [parentSurfaceId]: next })), [parentSurfaceId]);
  const parentFill = parentSurfaceId === 'neck' || parentSurfaceId.includes('Hem') || parentSurfaceId.includes('cuff') ? '#496f9d' : '#5c84b2';

  const runDemo = () => {
    const result = demoSeam(boundaries, symmetryAxis, parentSurfaceId);
    if (result) { onSeamsChange([...seams, result]); setTool('select'); setSelectedPanelId(null); }
  };
  const runReviewCase = (kind: string) => {
    const result = reviewSeam(kind, boundaries, symmetryAxis, parentSurfaceId);
    if (!result.seam) return;
    onSeamsChange([result.seam]);
    setMirror(Boolean(result.mirror));
    setTool('select');
    setSelection(null);
    setSelectedPanelId(null);
    setPanelColours({});
  };

  return <main className="panelling-lab">
    <header className="lab-header"><div><span className="lab-kicker">FEATURE SANDBOX / 01</span><h1>Panelling <span>Lab</span></h1></div><div className="lab-header-status"><span className="status-light" />ISOLATED ENGINE <i /> COMPLETE SLIM TEE</div></header>
    <div className="lab-workspace">
      <PanellingToolbar tool={tool} mirror={mirror} active={pathActive} selectedPanel={selectedPanelId} panelColor={selectedPanel?.fillOverride ?? '#5c84b2'} selectedAnchor={selection} tests={tests}
        onToolChange={setTool} onMirrorChange={setMirror} onFinish={() => canvas.current?.finish()} onCancel={() => canvas.current?.cancel()}
        onUndo={() => canvas.current?.undo()} onDemo={runDemo} onPanelColor={color => selectedPanelId && setPanelColours(current => ({ ...current, [selectedPanelId]: color }))}
        onAnchorMode={mode => canvas.current?.setSelectedAnchorMode(mode)} onConvertToCurve={() => canvas.current?.convertSelectedToCurve()}
        onRunTests={() => setTests(runChecks())} onScenario={runReviewCase} />
      <section className="lab-stage" aria-label="T-shirt body panelling work area">
        <div className="stage-heading"><div><span className="section-label">PARENT SURFACE / FRONT</span><div className="parent-surface-heading"><select aria-label="Parent surface" value={parentSurfaceId} onChange={event => { setParentSurfaceId(event.target.value); setSelectedPanelId(null); setSelection(null); }}>
          {PANELLING_SURFACES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select><span className="parent-source">{panellingSurfaceSource(parentSurfaceId)}</span></div></div><div className="stage-stats"><span>{seams.length} <b>SEAMS</b></span><span>{topology.panels.length} <b>PANELS</b></span><span>{topology.nodes.filter(node => node.kind === 'intersection').length} <b>JUNCTIONS</b></span></div></div>
        <div className="stage-canvas-wrap">
          <PanellingCanvas key={parentSurfaceId} ref={canvas} garmentMarkup={PANELLING_GARMENT_MARKUP} parentSurfaceId={parentSurfaceId} parentLabel={surface.label} parentFill={parentFill} boundaries={boundaries} symmetryAxis={symmetryAxis} seams={seams} panels={panels} mirror={mirror} tool={tool} selectedPanelId={selectedPanelId}
            onSeamsChange={onSeamsChange} onPanelSelect={setSelectedPanelId} onBoundariesChange={onBoundariesChange} onDrawingStateChange={setPathActive} onSelectionChange={setSelection} />
          {!boundaries.length && <div className="geometry-loading">Sampling current {surface.label} SVG geometry…</div>}
        </div>
        <div className="stage-footer"><span>{surface.label.toUpperCase()} GEOMETRY {boundaries.length ? 'READY' : 'LOADING'}</span><span>REGISTERED SYMMETRY AXIS X {symmetryAxis}</span><span>SHIFT · 45° CONSTRAINT</span><span>ESC · CANCEL PATH</span></div>
      </section>
      <aside className="topology-inspector"><div className="inspector-title"><span className="section-label">GRAPH INSPECTOR</span><span className="inspector-dot" /></div>
        <section><span className="inspector-label">Parent surface</span><strong>{surface.label}</strong><small>Source SVG · {surface.source}</small></section>
        <section><span className="inspector-label">Seam graph</span><strong>{topology.nodes.length} <small>nodes</small> / {topology.edges.length} <small>edges</small></strong><small>Boundary + construction geometry</small></section>
        <section><span className="inspector-label">Generated regions</span>{panels.length ? <ul className="panel-list">{panels.map((panel, index) => <li key={panel.id}><button type="button" aria-pressed={selectedPanelId === panel.id} onClick={() => setSelectedPanelId(panel.id)}><i style={{ background: panel.fillOverride ?? '#5c84b2' }} /><span>{panel.label || `Body Panel ${index + 1}`}</span><small>{Math.round(panel.area).toLocaleString()} u²</small></button></li>)}</ul> : <p className="inspector-empty">Draw a boundary-connected seam to generate panels.</p>}</section>
        <section className="model-note"><span className="inspector-label">Data separation</span><p><b>Seams</b> keep their anchors, curves and links. <b>Panels</b> are recomputed graph faces. The default panel material is inherited from Body.</p></section>
      </aside>
    </div>
  </main>;
}

const mount = document.getElementById('panelling-lab-root');
const hotData = import.meta.hot?.data as { panellingRoot?: Root } | undefined;
const root = mount ? hotData?.panellingRoot ?? createRoot(mount) : undefined;
if (root) root.render(<PanellingLabApp />);
if (import.meta.hot && root) import.meta.hot.dispose(data => { (data as { panellingRoot?: Root }).panellingRoot = root; });