import { useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Grid3x3 } from 'lucide-react';
import { DEFAULT_GUIDES, guidePaths, guidesActive, hasLineGuides, type StudioGuides as Guides, type SymmetryMode } from '../geometry/studioGuides';
import { setGuides, useGuides } from '../state/studioGuides';
import './studio-guides.css';

/** Sits beside the artboard rather than inside it, so saved assets and print files can never include it. */
export function StudioGuidesOverlay({ width, height }: { width: number; height: number }) {
  const guides = useGuides(), paths = useMemo(() => guidesActive(guides) ? guidePaths(guides, width, height) : null, [guides, width, height]);
  if (!paths) return null;
  return <svg data-editor-chrome data-studio-guides className="cx-guides" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" style={{ color: guides.colour, opacity: guides.opacity / 100 }}>
    <path d={paths.minor} strokeWidth=".5" opacity=".45" /><path d={paths.major} strokeWidth=".75" opacity=".8" /><path d={paths.axis} strokeWidth="1.25" />
  </svg>;
}

const Slider = ({ label, value, min, max, unit = '', onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) => <label className="cx-guides-range"><span>{label}</span><input type="range" aria-label={label} min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} /><output>{value}{unit}</output></label>;
const Section = ({ label, on, onToggle, children }: { label: string; on: boolean; onToggle: (on: boolean) => void; children: React.ReactNode }) => <section><label className="cx-guides-head"><span>{label}</span><input type="checkbox" aria-label={label} checked={on} onChange={event => onToggle(event.target.checked)} /></label>{on && <div className="cx-guides-body">{children}</div>}</section>;
const SYMMETRY: { id: SymmetryMode; label: string }[] = [{ id: 'off', label: 'Off' }, { id: 'vertical', label: 'Vertical' }, { id: 'horizontal', label: 'Horizontal' }, { id: 'quadrant', label: 'Quarter' }, { id: 'radial', label: 'Radial' }];

/** Bottom-bar menu for every drawing guide. */
export function GuidesMenu() {
  const g = useGuides(), active = guidesActive(g);
  const part = <K extends 'grid' | 'isometric' | 'lettering' | 'symmetry'>(key: K, patch: Partial<Guides[K]>) => setGuides({ ...g, [key]: { ...g[key], ...patch } });
  return <Popover.Root modal={false}>
    <Popover.Trigger asChild><button type="button" className="cx-dock-toggle cx-snap-trigger" aria-label="Guides" title="Guides" aria-pressed={active}><Grid3x3 size={15} /><span>Guides</span></button></Popover.Trigger>
    <Popover.Portal><Popover.Content className="cx-guides-panel" side="top" sideOffset={10} align="center" collisionPadding={12} aria-label="Drawing guides">
      <Section label="Grid" on={g.grid.on} onToggle={on => part('grid', { on })}><Slider label="Grid size" min={10} max={300} unit=" px" value={g.grid.size} onChange={size => part('grid', { size })} /><Slider label="Divisions" min={1} max={12} value={g.grid.divisions} onChange={divisions => part('grid', { divisions })} /></Section>
      <Section label="Isometric" on={g.isometric.on} onToggle={on => part('isometric', { on })}><Slider label="Iso size" min={10} max={200} unit=" px" value={g.isometric.size} onChange={size => part('isometric', { size })} /><Slider label="Angle" min={10} max={70} unit="°" value={g.isometric.angle} onChange={angle => part('isometric', { angle })} /></Section>
      <Section label="Lettering" on={g.lettering.on} onToggle={on => part('lettering', { on })}><Slider label="Rows" min={1} max={12} value={g.lettering.rows} onChange={rows => part('lettering', { rows })} /><Slider label="x-height" min={20} max={90} unit="%" value={g.lettering.xHeight} onChange={xHeight => part('lettering', { xHeight })} /><Slider label="Cap height" min={30} max={100} unit="%" value={g.lettering.capHeight} onChange={capHeight => part('lettering', { capHeight })} /><Slider label="Slant" min={-45} max={45} unit="°" value={g.lettering.slant} onChange={slant => part('lettering', { slant })} /></Section>
      <section><span className="cx-guides-title">Symmetry</span><div className="cx-guides-seg" role="group" aria-label="Symmetry guide">{SYMMETRY.map(item => <button key={item.id} type="button" aria-pressed={g.symmetry.mode === item.id} onClick={() => part('symmetry', { mode: item.id })}>{item.label}</button>)}</div>{g.symmetry.mode === 'radial' && <div className="cx-guides-body"><Slider label="Segments" min={2} max={32} value={g.symmetry.segments} onChange={segments => part('symmetry', { segments })} /></div>}</section>
      <section><label className="cx-guides-head" title="Strokes follow the nearest guide line"><span>Assisted drawing</span><input type="checkbox" aria-label="Assisted drawing" disabled={!hasLineGuides(g)} checked={g.assisted && hasLineGuides(g)} onChange={event => setGuides({ ...g, assisted: event.target.checked })} /></label></section>
      <footer><label className="cx-guides-colour"><span>Colour</span><input type="color" aria-label="Guide colour" value={g.colour} onChange={event => setGuides({ ...g, colour: event.target.value })} /></label><Slider label="Opacity" min={10} max={100} unit="%" value={g.opacity} onChange={opacity => setGuides({ ...g, opacity })} /><button type="button" disabled={!active} onClick={() => setGuides({ ...DEFAULT_GUIDES, colour: g.colour, opacity: g.opacity })}>Clear guides</button></footer>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
