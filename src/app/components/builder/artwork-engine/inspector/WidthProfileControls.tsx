import { useRef, useState } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { StudioNumber } from '../../shell/StudioControls';
import { WIDTH_PRESETS, profilePreview, widthAt, type WidthStop } from '../geometry/widthProfile';
import './colour-field.css';

const GRAPH_W = 260, GRAPH_H = 64, PAD = 7;

/** Line width along the path: a preset, then drag the graph. Click to add a point, double-click to remove. */
export function WidthProfileControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const profile = element.shapeWidthProfile, [active, setActive] = useState(0), svg = useRef<SVGSVGElement>(null);
  const stops = profile?.stops ?? [], presetId = WIDTH_PRESETS.find(item => JSON.stringify(item.stops) === JSON.stringify(stops))?.id;
  const write = (next: WidthStop[]) => update({ shapeWidthProfile: { stops: next } });
  const toStop = (clientX: number, clientY: number) => {
    const box = svg.current!.getBoundingClientRect(), x = (clientX - box.left) / box.width * GRAPH_W, y = (clientY - box.top) / box.height * GRAPH_H;
    return { t: Math.max(0, Math.min(1, (x - PAD) / (GRAPH_W - PAD * 2))), width: Math.round(Math.max(0, Math.min(100, Math.abs(y - GRAPH_H / 2) / (GRAPH_H / 2 - 3) * 100))) };
  };
  const drag = (event: React.PointerEvent, index: number) => {
    event.preventDefault(); event.stopPropagation(); setActive(index);
    const base = stops, isEnd = index === 0 || index === base.length - 1;
    const move = (e: PointerEvent) => {
      const p = toStop(e.clientX, e.clientY), low = index > 0 ? base[index - 1].t + .01 : 0, high = index < base.length - 1 ? base[index + 1].t - .01 : 1;
      write(base.map((stop, i) => i === index ? { t: isEnd ? stop.t : Math.max(low, Math.min(high, p.t)), width: p.width } : stop));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const addAt = (event: React.PointerEvent) => {
    if (!profile || event.button !== 0) return;
    const p = toStop(event.clientX, event.clientY), next = [...stops, { t: p.t, width: Math.round(widthAt(stops, p.t) * 100) }].sort((a, b) => a.t - b.t);
    write(next); setActive(next.findIndex(stop => stop.t === p.t));
  };
  const remove = (index: number) => { if (index === 0 || index === stops.length - 1) return; write(stops.filter((_, i) => i !== index)); setActive(Math.max(0, index - 1)); };
  const current = stops[Math.min(active, stops.length - 1)], currentIndex = Math.min(active, stops.length - 1), isEnd = currentIndex === 0 || currentIndex === stops.length - 1;
  return <div className="cx-width">
    <span className="cx-width__title">Line width</span>
    <div className="cx-width__tiles" role="group" aria-label="Width profile">
      <button type="button" aria-pressed={!profile} onClick={() => update({ shapeWidthProfile: undefined })}><svg viewBox="0 0 36 12" aria-hidden="true"><rect y="4.5" width="36" height="3" /></svg><span>Even</span></button>
      {WIDTH_PRESETS.map(item => <button key={item.id} type="button" aria-pressed={presetId === item.id} onClick={() => { update({ shapeWidthProfile: { stops: item.stops.map(stop => ({ ...stop })) }, shapeStrokeStyle: 'solid' }); setActive(0); }}><svg viewBox="0 0 36 12" aria-hidden="true"><path d={profilePreview(item.stops, 36, 12)} /></svg><span>{item.label}</span></button>)}
    </div>
    {profile && <>
      <svg ref={svg} className="cx-width__graph" viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} preserveAspectRatio="none" role="img" aria-label="Width graph" onPointerDown={addAt}>
        <g transform={`translate(${PAD} 0)`}><path className="shape" d={profilePreview(stops, GRAPH_W - PAD * 2, GRAPH_H)} /></g>
        {stops.map((stop, index) => <circle key={index} className={index === currentIndex ? 'is-active' : undefined} cx={PAD + stop.t * (GRAPH_W - PAD * 2)} cy={GRAPH_H / 2 - stop.width / 100 * (GRAPH_H / 2 - 3)} r={4.5} onPointerDown={event => drag(event, index)} onDoubleClick={() => remove(index)} />)}
      </svg>
      {current && <div className="studio-two-columns">
        <StudioNumber label="Position" unit="%" min={0} max={100} step={1} disabled={isEnd} value={Math.round(current.t * 100)} onChange={value => write(stops.map((stop, i) => i === currentIndex ? { ...stop, t: Math.max(i ? stops[i - 1].t + .01 : 0, Math.min(i < stops.length - 1 ? stops[i + 1].t - .01 : 1, value / 100)) } : stop))} />
        <StudioNumber label="Width" unit="%" min={0} max={100} step={1} value={current.width} onChange={width => write(stops.map((stop, i) => i === currentIndex ? { ...stop, width } : stop))} />
      </div>}
    </>}
  </div>;
}
