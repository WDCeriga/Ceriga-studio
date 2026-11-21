// Dev-only design review board for the Phase 1 visual system (route /dev/builder-primitives, DEV builds only).
// Every primitive in every state, side by side, on the real Ceriga garment, for visual QA before propagation.
import { useState, type ReactNode } from 'react';
import {
  ArrowDownToLine, ArrowUpToLine, Copy, Eraser, FlipHorizontal2, Hand, Layers, Lock, MousePointer2, PenTool, Pencil, Pipette, Redo2,
  Shapes, Trash2, Type, Undo2, Image as ImageIcon, Tag,
} from 'lucide-react';
import {
  BuilderInspector, InspectorHeader, InspectorSection, StickySubTabs, SelectionSummary, VisualOptionGrid, CompactField, ToolButton,
  CxTooltipProvider, CanvasToolbar, ToolbarSeparator, Segmented, ZoomControl, ContextToolbar, CanvasValueChip, SnapGuide,
  PrintAreaOverlay, FloatingPopover, SelectionFrame, PathHandles, DragPreview, CanvasEmptySlot, Skeleton, OptionGridSkeleton,
  InspectorEmpty, FitSilhouette, GarmentSkeleton, type VisualOption, type InspectorTransition,
} from '../../components/builder/design-system';
import garment from '../../../assets/studio-tshirt/regular-tshirt-composite-bold.png';
import { FIT_SILHOUETTES, FIT_SILHOUETTE_VIEWBOX } from '../../components/builder/design-system/fitSilhouettes';

type Fit = 'slim' | 'regular' | 'boxy' | 'oversized';
const fitOptions: VisualOption<Fit>[] = [
  { id: 'slim', label: 'Slim', detail: 'Close to body', preview: <FitSilhouette fit="slim" /> },
  { id: 'regular', label: 'Regular', detail: 'Classic ease', preview: <FitSilhouette fit="regular" /> },
  { id: 'boxy', label: 'Boxy', detail: 'Wide, cropped', preview: <FitSilhouette fit="boxy" /> },
  { id: 'oversized', label: 'Oversized', detail: 'Dropped, long', preview: <FitSilhouette fit="oversized" />, disabled: true, disabledReason: 'Not available in 160 GSM jersey' },
];

const STATES = ['Resting', 'Hover', 'Pressed', 'Selected', 'Disabled', 'Focus'] as const;

function Board({ id, title, why, children, dark }: { id: string; title: string; why: string; children: ReactNode; dark?: boolean }) {
  return (
    <section id={id} className="review-board" style={{ scrollMarginTop: 64 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '0 0 14px' }}>
        <h2 style={{ font: '600 15px/1.3 var(--cx-font)', margin: 0, letterSpacing: '-.01em' }}>{title}</h2>
        <p className="cx-helper" style={{ maxWidth: 720 }}>{why}</p>
      </header>
      <div style={{ borderRadius: 12, background: dark ? '#e9e9e7' : 'var(--cx-stage)', padding: 24, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / .04)' }}>{children}</div>
    </section>
  );
}
const Panel = ({ children, width = 320, title, density }: { children: ReactNode; width?: number; title?: string; density?: string }) => (
  <div className="cx" data-density={density} style={{ width, background: 'var(--cx-panel)', borderRadius: 10, boxShadow: 'var(--cx-shadow-float)', padding: 16, display: 'flex', flexDirection: 'column', gap: 'var(--cx-group-gap)' }}>
    {title && <p className="cx-helper" style={{ margin: '-4px 0 -8px', textTransform: 'none' }}>{title}</p>}{children}
  </div>
);
const Cell = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
    <div style={{ minHeight: 64, display: 'grid', placeItems: 'center' }}>{children}</div>
    <span className="cx-helper" style={{ fontSize: 11 }}>{label}</span>
  </div>
);

function ShapeGroup({ density }: { density: 'compact' | 'standard' | 'visual-grid' }) {
  const [w, setW] = useState(12); const [h, setH] = useState(8); const [x, setX] = useState(0); const [y, setY] = useState(6); const [r, setR] = useState(0);
  return (
    <>
      <InspectorSection title="Position & size" summary="Centre chest">
        <div className="cx-field-pair">
          <CompactField layout="inline" label="X" value={x} onChange={setX} unit="cm" step={0.1} ariaLabel="X position" />
          <CompactField layout="inline" label="Y" value={y} onChange={setY} unit="cm" step={0.1} ariaLabel="Y position" />
          <CompactField layout="inline" label="W" value={w} onChange={setW} unit="cm" step={0.1} ariaLabel="Width" />
          <CompactField layout="inline" label="H" value={h} onChange={setH} unit="cm" step={0.1} ariaLabel="Height" />
        </div>
        <CompactField label="Rotation" value={r} onChange={setR} unit="°" step={1} />
      </InspectorSection>
      <InspectorSection title="Fit" summary="Regular" density={density}>
        <VisualOptionGrid label={`Fit (${density})`} options={fitOptions} value="regular" onChange={() => {}} columns={density === 'compact' ? 4 : 3} density={density} />
      </InspectorSection>
    </>
  );
}

export function BuilderPrimitives() {
  const [fit, setFit] = useState<Fit>('regular');
  const [tab, setTab] = useState<'shapes' | 'type' | 'effects'>('shapes');
  const [view, setView] = useState<'front' | 'back'>('front');
  const [zoom, setZoom] = useState(100);
  const [object, setObject] = useState(false);
  const [transition, setTransition] = useState<InspectorTransition>('swap');
  const [measure, setMeasure] = useState('A');
  const [chest, setChest] = useState(51);
  const tools: [string, string, string, ReactNode][] = [['select', 'Select', 'V', <MousePointer2 />], ['hand', 'Hand', 'H', <Hand />], ['pen', 'Pen', 'P', <PenTool />],
    ['pencil', 'Pencil', 'N', <Pencil />], ['shape', 'Shape', 'S', <Shapes />], ['type', 'Type', 'T', <Type />], ['image', 'Image', 'I', <ImageIcon />]];
  const nav = [['density', 'Density'], ['states', 'States'], ['inspector', 'Inspector'], ['options', 'Option grids'], ['tools', 'Tools'], ['canvas', 'Canvas states'],
    ['guides', 'Guides & drop'], ['popovers', 'Popovers'], ['empty', 'Empty & loading']];
  return (
    <CxTooltipProvider>
      <div className="cx" style={{ minHeight: '100dvh', background: '#fbfbfa' }}>
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 4, height: 52, padding: '0 32px', background: 'rgb(251 251 250 / .92)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 0 var(--cx-line)' }}>
          <strong style={{ font: 'var(--cx-heading)', marginRight: 16 }}>Ceriga · Builder visual system</strong>
          {nav.map(([id, label]) => <a key={id} href={`#${id}`} className="cx-btn" style={{ background: 'transparent', height: 28, textDecoration: 'none', color: 'var(--cx-ink-2)' }}>{label}</a>)}
        </nav>
        <main style={{ display: 'flex', flexDirection: 'column', gap: 48, padding: '32px 32px 120px', maxWidth: 1360, margin: '0 auto' }}>

          <Board id="density" title="Density modes" why="One system, three densities. The same Position & size and Fit groups rendered in each mode: compact for creative tools, standard for builder controls, visual-grid for previews.">
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              {(['compact', 'standard', 'visual-grid'] as const).map(d => <Panel key={d} density={d} title={d}><ShapeGroup density={d} /></Panel>)}
            </div>
          </Board>

          <Board id="states" title="Interaction states" why="Every control, every state. Hover darkens one step; press scales to .97–.98; selected uses ink, never red; disabled stays legible and explains why; focus is a single blue-violet ring.">
            <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(6, 1fr)', gap: '18px 12px', alignItems: 'center' }}>
              <span />{STATES.map(s => <span key={s} className="cx-helper" style={{ textAlign: 'center', fontWeight: 600, color: 'var(--cx-ink-2)' }}>{s}</span>)}
              <span className="cx-helper">Option card</span>
              {STATES.map(s => (
                <div key={s} style={{ width: 92, justifySelf: 'center' }}>
                  <VisualOptionGrid label={`Option ${s}`} columns={1} value={s === 'Selected' ? 'regular' : null} onChange={() => {}}
                    options={[{ ...fitOptions[1], detail: undefined, disabled: s === 'Disabled', force: s === 'Hover' ? 'hover' : s === 'Pressed' ? 'press' : s === 'Focus' ? 'focus' : undefined }]} />
                </div>))}
              <span className="cx-helper">Tool button</span>
              {STATES.map(s => <Cell key={s} label="">{<ToolButton icon={<PenTool />} label="Pen" shortcut="P" active={s === 'Selected'} disabledReason={s === 'Disabled' ? 'Select a path first' : undefined}
                force={s === 'Hover' ? 'hover' : s === 'Pressed' ? 'press' : s === 'Focus' ? 'focus' : undefined} />}</Cell>)}
              <span className="cx-helper">Icon button</span>
              {STATES.map(s => <Cell key={s} label=""><button className="cx-icon-btn" aria-label="Duplicate" aria-pressed={s === 'Selected' || undefined} disabled={s === 'Disabled'}
                data-force={s === 'Hover' ? 'hover' : s === 'Pressed' ? 'press' : s === 'Focus' ? 'focus' : undefined}><Copy size={16} /></button></Cell>)}
              <span className="cx-helper">Numeric field</span>
              {STATES.map(s => <div key={s} style={{ width: 110, justifySelf: 'center' }}><CompactField layout="inline" label="W" value={12} onChange={() => {}} unit="cm" ariaLabel={`Width ${s}`}
                disabled={s === 'Disabled'} force={s === 'Hover' ? 'hover' : s === 'Focus' || s === 'Selected' ? 'focus' : undefined} /></div>)}
              <span className="cx-helper">Canvas chip</span>
              {STATES.map(s => <div key={s} style={{ position: 'relative', height: 40 }}><CanvasValueChip x={60} y={20} letter="A" value={51} unit="cm" active={s === 'Selected' || s === 'Pressed'}
                onClick={s === 'Disabled' ? undefined : () => {}} label={`Chip ${s}`} /></div>)}
            </div>
          </Board>

          <Board id="inspector" title="Inspector" why="One-line header, sticky sub-tabs, a selection line instead of a mini garment, groups separated by space not dividers, summaries in collapsed headers. Selecting an object pushes its panel; Back pops it and restores scroll.">
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <div style={{ width: 320, height: 640, borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--cx-shadow-float)' }}>
                <BuilderInspector label="Artwork inspector" viewKey={object ? 'object' : tab} transition={object ? 'push' : transition}
                  header={object
                    ? <InspectorHeader title="Circle" meta="DTG · 1 colour" onBack={() => { setTransition('pop'); setObject(false); }} actions={<button className="cx-icon-btn" aria-label="Lock"><Lock size={15} /></button>} />
                    : <InspectorHeader title="Artwork" meta="Front · 3 layers" />}
                  subTabs={object ? undefined : <StickySubTabs label="Artwork areas" value={tab} onChange={t => { setTransition('swap'); setTab(t); }}
                    items={[{ id: 'shapes', label: 'Shapes & paths' }, { id: 'type', label: 'Typography' }, { id: 'effects', label: 'Finishes' }] as const} />}>
                  {object ? <ShapeGroup density="compact" /> : <>
                    <SelectionSummary empty name="Select artwork on the garment" />
                    <InspectorSection title="Add a shape">
                      <VisualOptionGrid label="Shapes" columns={4} density="compact" value={null} onChange={() => { setObject(true); }}
                        options={(['circle', 'square', 'star', 'arrow'] as const).map(id => ({ id, label: id[0].toUpperCase() + id.slice(1), preview: <svg viewBox="0 0 24 24" width="22" height="22" fill="#171717">{id === 'circle' ? <circle cx="12" cy="12" r="9" /> : id === 'square' ? <rect x="4" y="4" width="16" height="16" rx="1.5" /> : id === 'star' ? <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z" /> : <path d="M3 10h11V5l7 7-7 7v-5H3z" />}</svg> }))} />
                    </InspectorSection>
                    <InspectorSection title="Print method" summary="DTG" collapsible>
                      <p className="cx-helper">Default for 180 GSM cotton jersey. Change per object at any time.</p>
                    </InspectorSection>
                    {['Layers', 'Colour', 'Production notes'].map(t => <InspectorSection key={t} title={t} summary={t === 'Layers' ? '3' : t === 'Colour' ? '#171717' : 'None'} collapsible defaultOpen={false}><p className="cx-helper">…</p></InspectorSection>)}
                  </>}
                </BuilderInspector>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
                <p className="cx-helper"><strong style={{ color: 'var(--cx-ink)' }}>Try it:</strong> click a shape to push the object panel; use Back to pop. Switch sub-tabs to see the swap. Drag the “X / Y / W / H” letters to scrub; arrow keys step (Shift ×10).</p>
                <Panel width={320} title="Standard density · measurement rows">
                  <InspectorSection title="Measurements" summary="M · cm" collapsible>
                    <CompactField label="Chest width" value={chest} onChange={setChest} unit="cm" step={0.5} />
                    <CompactField label="Body length" value={68} onChange={() => {}} unit="cm" step={0.5} />
                    <CompactField label="Locked by preset" value={41} onChange={() => {}} unit="cm" disabled />
                  </InspectorSection>
                </Panel>
              </div>
            </div>
          </Board>

          <Board id="options" title="Option grids" why="Picture-first choices. Tiles show the real garment silhouette; selected is an ink ring with a check; disabled stays visible with its reason on hover; arrow keys move between options and skip disabled ones.">
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <Panel title="4 columns · label only"><VisualOptionGrid label="Fit, four columns" options={fitOptions.map(o => ({ ...o, detail: undefined }))} value={fit} onChange={setFit} columns={4} /></Panel>
              <Panel title="2 columns · label + detail"><VisualOptionGrid label="Fit, two columns" options={fitOptions} value={fit} onChange={setFit} columns={2} /></Panel>
              <Panel title="Loading (same footprint, no layout shift)"><OptionGridSkeleton count={4} columns={2} /></Panel>
            </div>
          </Board>

          <Board id="tools" title="Tools" why="Icon tools with name + shortcut tooltips, grouped by function. Disabled tools stay focusable and explain why. One active tool at a time, shown in ink.">
            <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
              <div className="cx-tool-strip" role="toolbar" aria-label="Tools" aria-orientation="vertical">
                {tools.slice(0, 2).map(([id, l, k, icon]) => <ToolButton key={id} icon={icon} label={l} shortcut={k} active={id === 'select'} />)}
                <hr />
                {tools.slice(2).map(([id, l, k, icon]) => <ToolButton key={id} icon={icon} label={l} shortcut={k} />)}
                <hr />
                <ToolButton icon={<Eraser />} label="Eraser" shortcut="E" disabledReason="Select a drawing to erase" />
                <ToolButton icon={<Pipette />} label="Pick colour" shortcut="K" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span className="cx-helper">Tooltip (static specimen)</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div className="cx-tooltip" style={{ animation: 'none', width: 'max-content' }}><span>Pen</span><kbd>P</kbd></div>
                  <div className="cx-tooltip" style={{ animation: 'none', width: 'max-content' }}><span>Eraser</span><kbd>E</kbd><span className="cx-tip-reason">· Select a drawing to erase</span></div>
                </div>
                <span className="cx-helper" style={{ marginTop: 12 }}>Canvas toolbar (one island, bottom centre)</span>
                <CanvasToolbar isStatic>
                  <Segmented label="View" items={[{ id: 'front', label: 'Front' }, { id: 'back', label: 'Back' }] as const} value={view} onChange={setView} />
                  <ToolbarSeparator /><ZoomControl value={zoom} onChange={setZoom} onFit={() => setZoom(100)} />
                  <ToolbarSeparator /><button className="cx-icon-btn" aria-label="Undo"><Undo2 size={15} /></button><button className="cx-icon-btn" aria-label="Redo" disabled><Redo2 size={15} /></button>
                </CanvasToolbar>
                <span className="cx-helper" style={{ marginTop: 12 }}>Context toolbar (follows the selection)</span>
                <div style={{ position: 'relative', height: 50 }}>
                  <ContextToolbar anchor={{ x: 130, y: 48, width: 0, height: 0 }}>
                    <button className="cx-icon-btn" aria-label="Duplicate"><Copy size={15} /></button>
                    <button className="cx-icon-btn" aria-label="Flip"><FlipHorizontal2 size={15} /></button>
                    <button className="cx-icon-btn" aria-label="Bring forward"><ArrowUpToLine size={15} /></button>
                    <button className="cx-icon-btn" aria-label="Send backward"><ArrowDownToLine size={15} /></button>
                    <ToolbarSeparator /><button className="cx-btn" style={{ height: 28, fontSize: 12 }}>Centre on chest</button>
                    <ToolbarSeparator /><button className="cx-icon-btn" aria-label="Delete"><Trash2 size={15} /></button>
                  </ContextToolbar>
                </div>
              </div>
            </div>
          </Board>

          <Board id="canvas" title="Canvas interaction states" why="Drawn in screen space on the real garment: constant 1px lines and 8px handles at any zoom. Ink for selection, grey for hover and locked, chips for live values. No red.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {([['Hover', 'hover'], ['Selected', 'selected'], ['Resizing', 'resizing'], ['Rotating', 'rotating'], ['Locked', 'locked']] as const).map(([label, mode]) => (
                <Stage key={mode} label={label} tone="dark">
                  <svg style={{ position: 'absolute', left: 132, top: 118, transform: mode === 'rotating' ? 'rotate(12deg)' : undefined }} width="76" height="76" viewBox="0 0 76 76"><circle cx="38" cy="38" r="36" fill="#f2efe8" /><text x="38" y="44" textAnchor="middle" fontFamily="Inter" fontWeight="700" fontSize="15" fill="#171717">CERIGA</text></svg>
                  <SelectionFrame rect={{ x: 132, y: 118, width: 76, height: 76 }} mode={mode} name="Logo · 9 × 9 cm" dimension="9.4 × 9.4 cm" angle={12} rotation={mode === 'rotating' ? 12 : 0} activeHandle={mode === 'resizing' ? 'se' : undefined} />
                  {mode === 'selected' && <ContextToolbar gap={40} anchor={{ x: 132, y: 118, width: 76, height: 76 }}><button className="cx-icon-btn" aria-label="Duplicate"><Copy size={14} /></button><button className="cx-icon-btn" aria-label="Flip"><FlipHorizontal2 size={14} /></button><button className="cx-icon-btn" aria-label="Arrange"><Layers size={14} /></button><ToolbarSeparator /><button className="cx-icon-btn" aria-label="Delete"><Trash2 size={14} /></button></ContextToolbar>}
                </Stage>))}
              <Stage label="Path editing · anchors + Bézier handles" tone="dark">
                <PathHandles d="M120 200 C 120 140, 220 140, 220 200 L 170 250 Z" anchors={[{ x: 120, y: 200, kind: 'smooth', selected: true, handleIn: { x: 120, y: 236 }, handleOut: { x: 120, y: 160 } },
                  { x: 220, y: 200, kind: 'smooth', handleIn: { x: 220, y: 140 } }, { x: 170, y: 250, kind: 'corner' }]} />
              </Stage>
            </div>
          </Board>

          <Board id="guides" title="Guides, warnings, drag & drop" why="Print areas are optional (Guides menu) and named only while relevant. Snap guides use the single focus tint. Seam conflicts are amber with a plain-language chip. Drop targets brighten; empty states live where the action happens.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <Stage label="Print areas · idle, dark garment (Guides on)" tone="dark"><PrintAreaOverlay areas={AREAS} /></Stage>
              <Stage label="Dragging · active area + snap"><PrintAreaOverlay areas={AREAS} activeId="chest" /><SnapGuide orientation="vertical" position={170} from={96} to={300} label="Centre front" />
                <DragPreview x={170} y={170}><svg width="60" height="60" viewBox="0 0 24 24" fill="#f2efe8"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z" /></svg></DragPreview></Stage>
              <Stage label="Drop target"><PrintAreaOverlay areas={AREAS} dropId="left-chest" /></Stage>
              <Stage label="Seam warning"><svg className="cx-overlay" aria-hidden="true"><path className="cx-seam-warning" d="M216 92 L262 132" /></svg>
                <SelectionFrame rect={{ x: 196, y: 92, width: 56, height: 40 }} mode="selected" /><CanvasValueChip x={232} y={156} value="Crosses shoulder seam" tone="warning" /></Stage>
              <Stage label="Measurement chips"><svg className="cx-overlay" aria-hidden="true"><line x1="104" x2="236" y1="150" y2="150" stroke="#171717" strokeWidth="1" /><line x1="104" x2="236" y1="286" y2="286" stroke="#a3a3a3" strokeWidth="1" /></svg>
                {[['A', 51, 170, 150], ['E', 47, 170, 286]].map(([l, v, x, y]) => <CanvasValueChip key={l as string} x={x as number} y={y as number} letter={l as string} value={v as number} unit="cm" active={measure === l} onClick={() => setMeasure(l as string)} label={`Measurement ${l}`} />)}</Stage>
              <Stage label="Empty state · label slot (where labels go)"><CanvasEmptySlot rect={{ x: 138, y: 64, width: 64, height: 24 }} title="+ Label" state="idle" surface="light" /></Stage>
            </div>
          </Board>

          <Board id="popovers" title="Popovers & menus" why="Quick edits open next to what they change and scale from their trigger. Full precision stays in the inspector.">
            <div style={{ display: 'flex', gap: 64, alignItems: 'flex-start', minHeight: 230 }}>
              <div style={{ position: 'relative', width: 340, height: 300 }}>
                <button className="cx cx-chip" style={{ left: 40, top: 30 }} data-active>A · 51 <span>cm</span></button>
                <div className="cx-popover" data-density="compact" role="dialog" aria-label="Edit chest width" style={{ position: 'absolute', left: 84, top: 18, animation: 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 208 }}>
                    <p className="cx-popover-title">Chest width<span>Preset 51 cm</span></p>
                    <CompactField label="Value" value={chest} onChange={setChest} unit="cm" step={0.5} />
                    <CompactField label="Tolerance ±" value={1.5} onChange={() => {}} unit="cm" step={0.5} />
                    <p className="cx-helper">Measure flat across, 2.5 cm below the armhole.</p>
                    <div style={{ display: 'flex', gap: 6 }}><button className="cx-btn" style={{ flex: 1 }}>Reset to preset</button><button className="cx-btn" data-variant="primary" style={{ flex: 1 }}>Done</button></div>
                  </div>
                </div>
                <FloatingPopover label="Live popover" trigger={<button className="cx-btn" style={{ position: 'absolute', left: 40, top: 262 }}>Open live popover</button>}>
                  <p className="cx-helper" style={{ margin: 0 }}>Scales in from its trigger (150 ms), Escape or outside click closes.</p>
                </FloatingPopover>
              </div>
              <div className="cx-popover" role="menu" aria-label="Arrange" style={{ animation: 'none', width: 220, position: 'relative' }}>
                {[['Bring to front', '⇧⌘]'], ['Bring forward', '⌘]'], ['Send backward', '⌘['], ['Send to back', '⇧⌘[']].map(([l, k], i) =>
                  <button key={l} role="menuitem" className="cx-btn" style={{ width: '100%', justifyContent: 'space-between', background: i === 1 ? 'var(--cx-fill)' : 'transparent', height: 32 }}>{l}<span style={{ color: 'var(--cx-ink-3)' }}>{k}</span></button>)}
              </div>
            </div>
          </Board>

          <Board id="empty" title="Empty & loading states" why="Empty states are one line of guidance and one action, placed where work happens. Loading keeps the final shape so nothing jumps when content arrives.">
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <Panel title="Inspector · no layers yet"><InspectorEmpty icon={<Layers size={16} />} title="No artwork yet" hint="Pick a shape, add text, or drop an image onto the garment." action={<button className="cx-btn" data-variant="primary"><Type size={14} />Add text</button>} /></Panel>
              <Panel title="Inspector · no labels"><InspectorEmpty icon={<Tag size={16} />} title="No labels" hint="Most garments start with a main label at the inside back neck." action={<button className="cx-btn">Add main label</button>} /></Panel>
              <Panel title="Inspector · loading">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton height={16} width="45%" radius={4} /><Skeleton height={36} radius={6} /><Skeleton height={36} radius={6} /><Skeleton height={12} width="70%" radius={4} /></div>
                <OptionGridSkeleton count={3} columns={3} />
              </Panel>
              <Panel title="Canvas · loading garment" width={240}><div style={{ height: 230, display: 'grid', placeItems: 'center' }}><GarmentSkeleton width={170} height={210} /></div></Panel>
            </div>
          </Board>
        </main>
      </div>
    </CxTooltipProvider>
  );
}

const AREAS = [
  { id: 'chest', name: 'Centre chest', size: '28 × 30 cm', x: 118, y: 120, width: 104, height: 112 },
  { id: 'left-chest', name: 'Left chest', size: '10 × 10 cm', x: 188, y: 100, width: 36, height: 36 },
];

function Stage({ label, children, tone = 'light' }: { label: string; children: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ position: 'relative', height: 330, borderRadius: 10, background: 'var(--cx-stage)', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / .04)' }}>
        {tone === 'light'
          ? <img src={garment} alt="" style={{ position: 'absolute', left: 20, top: 20, width: 300, height: 300, objectFit: 'contain', userSelect: 'none', mixBlendMode: 'multiply' }} draggable={false} />
          : <svg viewBox={FIT_SILHOUETTE_VIEWBOX} style={{ position: 'absolute', left: 20, top: 20, width: 300, height: 300 }} aria-hidden="true">
              <path d={FIT_SILHOUETTES.regular.outer} fill="#34353b" stroke="#141416" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>}
        {children}
      </div>
      <figcaption className="cx-helper" style={{ marginTop: 8 }}>{label}</figcaption>
    </figure>
  );
}
