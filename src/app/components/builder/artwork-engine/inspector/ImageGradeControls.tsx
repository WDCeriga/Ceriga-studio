import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Wand2 } from 'lucide-react';
import type { DesignElement } from '../../PrintStudioEditor';
import { StudioFold, StudioRange } from '../../shell/StudioControls';
import { filteredImagePixels } from '../../../../lib/imageFilterRendering';
import { GRADIENT_MAPS, HUE_BANDS, autoLevels, curveTable, gradeIsActive, imageHistogram, type CurveChannel, type CurvePoint, type HueBand, type ImageGrade } from '../image/grade';
import './image-grade.css';

const SIZE = 256, IDENTITY: CurvePoint[] = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
const CHANNELS: { id: CurveChannel; label: string }[] = [{ id: 'rgb', label: 'RGB' }, { id: 'r', label: 'R' }, { id: 'g', label: 'G' }, { id: 'b', label: 'B' }];
const CHANNEL_COLOUR: Record<CurveChannel, string> = { rgb: '#1f1f1d', r: '#d92d2d', g: '#22963c', b: '#2f6fed' };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mapCss = (stops: { position: number; color: string }[]) => `linear-gradient(90deg,${stops.map(s => `${s.color} ${s.position}%`).join(',')})`;

function useHistogram(source: string) {
  const [counts, setCounts] = useState<Uint32Array>();
  useEffect(() => { let live = true; filteredImagePixels(source, { id: 'none' }, 96).then(pixels => { if (live) setCounts(imageHistogram(pixels.original)); }).catch(() => {}); return () => { live = false; }; }, [source]);
  return counts;
}
const histogramPath = (counts?: Uint32Array) => {
  if (!counts) return '';
  const top = Math.max(1, ...[...counts].sort((a, b) => b - a).slice(4, 5));
  return `M0 64${[...counts].map((value, x) => `L${x} ${64 - Math.min(1, value / top) * 60}`).join('')}L255 64Z`;
};

function Levels({ grade, counts, write }: { grade: ImageGrade; counts?: Uint32Array; write: (patch: Partial<ImageGrade>) => void }) {
  const svg = useRef<SVGSVGElement>(null), black = grade.black ?? 0, white = grade.white ?? 255, mid = grade.mid ?? Math.round((black + white) / 2);
  const drag = (event: React.PointerEvent, key: 'black' | 'mid' | 'white') => {
    event.preventDefault();
    const move = (e: PointerEvent) => {
      const box = svg.current!.getBoundingClientRect(), x = Math.round(clamp((e.clientX - box.left) / box.width * 255, 0, 255));
      if (key === 'black') write({ black: Math.min(x, white - 2), ...(grade.mid !== undefined ? { mid: Math.max(grade.mid, Math.min(x, white - 2) + 1) } : {}) });
      else if (key === 'white') write({ white: Math.max(x, black + 2), ...(grade.mid !== undefined ? { mid: Math.min(grade.mid, Math.max(x, black + 2) - 1) } : {}) });
      else write({ mid: clamp(x, black + 1, white - 1) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const handle = (key: 'black' | 'mid' | 'white', x: number, fill: string, label: string) => <path role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={255} aria-valuenow={x} d={`M${x} 66l6 11h-12z`} fill={fill} stroke="#1f1f1d" strokeWidth="1" vectorEffect="non-scaling-stroke" style={{ cursor: 'ew-resize', touchAction: 'none' }} onPointerDown={event => drag(event, key)} />;
  return <div className="cx-grade-block"><span className="cx-grade-title">Levels</span>
    <svg ref={svg} className="cx-levels" viewBox="0 0 255 80" preserveAspectRatio="none" role="group" aria-label="Levels"><path d={histogramPath(counts)} fill="#bdbdb8" />{handle('black', black, '#1f1f1d', 'Black point')}{handle('mid', mid, '#8d8d89', 'Midtones')}{handle('white', white, '#ffffff', 'White point')}</svg>
    <div className="cx-grade-values"><span>{black}</span><span>{mid}</span><span>{white}</span></div>
  </div>;
}

function Curves({ grade, counts, write }: { grade: ImageGrade; counts?: Uint32Array; write: (patch: Partial<ImageGrade>) => void }) {
  const [channel, setChannel] = useState<CurveChannel>('rgb'), [active, setActive] = useState<number | null>(null), svg = useRef<SVGSVGElement>(null), points = grade.curves?.[channel] ?? IDENTITY;
  const line = useMemo(() => { const table = curveTable(points); return 'M' + [...table].map((y, x) => `${x} ${255 - y}`).join('L'); }, [points]);
  const save = (next: CurvePoint[]) => write({ curves: { ...grade.curves, [channel]: next } });
  const at = (e: { clientX: number; clientY: number }) => { const box = svg.current!.getBoundingClientRect(); return { x: Math.round(clamp((e.clientX - box.left) / box.width * 255, 0, 255)), y: Math.round(clamp(255 - (e.clientY - box.top) / box.height * 255, 0, 255)) }; };
  const follow = (start: CurvePoint[], index: number) => {
    const move = (e: PointerEvent) => { const p = at(e), low = index ? start[index - 1].x + 1 : 0, high = index < start.length - 1 ? start[index + 1].x - 1 : 255; save(start.map((item, i) => i === index ? { x: index === 0 ? Math.min(p.x, start[1].x - 1) : index === start.length - 1 ? Math.max(p.x, start[index - 1].x + 1) : clamp(p.x, low, high), y: p.y } : item)); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const add = (event: React.PointerEvent) => {
    if (event.button !== 0 || points.length >= 12) return;
    const p = at(event), table = curveTable(points), next = [...points.filter(item => item.x !== p.x), { x: p.x, y: table[p.x] }].sort((a, b) => a.x - b.x), index = next.findIndex(item => item.x === p.x);
    if (index <= 0 || index >= next.length - 1) return;
    save(next); setActive(index); follow(next, index);
  };
  return <div className="cx-grade-block"><div className="cx-grade-row"><span className="cx-grade-title">Curves</span><div className="cx-grade-tabs" role="group" aria-label="Curve channel">{CHANNELS.map(item => <button key={item.id} type="button" aria-pressed={channel === item.id} onClick={() => { setChannel(item.id); setActive(null); }}>{item.label}</button>)}</div></div>
    <svg ref={svg} className="cx-curve" viewBox={`0 0 ${SIZE - 1} ${SIZE - 1}`} role="group" aria-label="Tone curve" onPointerDown={add}>
      {[64, 128, 191].map(v => <g key={v}><line x1={v} x2={v} y1="0" y2="255" /><line y1={v} y2={v} x1="0" x2="255" /></g>)}
      <path className="hist" d={counts ? histogramPath(counts).replace(/([ML])(\d+) ([\d.]+)/g, (_, c, x, y) => `${c}${x} ${255 - (64 - Number(y)) * 2.2}`).replace('M0 255', 'M0 255') : ''} />
      <line className="base" x1="0" y1="255" x2="255" y2="0" /><path className="value" d={line} style={{ stroke: CHANNEL_COLOUR[channel] }} />
      {points.map((point, index) => <circle key={index} className={active === index ? 'is-active' : undefined} cx={point.x} cy={255 - point.y} r={6} role="slider" aria-label={`Curve point ${index + 1}`} aria-valuenow={point.y} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setActive(index); follow(points, index); }} onDoubleClick={() => { if (index && index < points.length - 1) { save(points.filter((_, i) => i !== index)); setActive(null); } }} />)}
    </svg>
  </div>;
}

/** Levels, curves, colour mixer and detail. Every step is live and non-destructive. */
export function ImageGradeControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const grade = element.imageGrade ?? {}, counts = useHistogram(element.content), [band, setBand] = useState<HueBand>('red'), shift = grade.hsl?.[band] ?? {}, active = gradeIsActive({ ...grade, cutout: undefined, recolour: undefined, enabled: true }), latest = useRef(grade);
  latest.current = grade;
  const write = (patch: Partial<ImageGrade>) => { const next = { ...latest.current, ...patch }; latest.current = next; update({ imageGrade: next }); };
  const setShift = (key: 'h' | 's' | 'l', value: number) => write({ hsl: { ...latest.current.hsl, [band]: { ...latest.current.hsl?.[band], [key]: value } } });
  const on = grade.enabled !== false, mapId = GRADIENT_MAPS.find(item => JSON.stringify(item.stops) === JSON.stringify(grade.map?.stops))?.id;
  return <StudioFold title="Pro colour" rowHeight={40} value={!active ? 'Off' : on ? 'On' : 'Hidden'}>
    <div className="cx-grade-actions">
      <button type="button" onClick={() => counts && write(autoLevels(counts))} disabled={!counts}><Wand2 size={14} />Auto tone</button>
      <button type="button" aria-pressed={!on} disabled={!active} onClick={() => write({ enabled: !on })}>{on ? <Eye size={14} /> : <EyeOff size={14} />}{on ? 'Compare' : 'Show grade'}</button>
    </div>
    <Levels grade={grade} counts={counts} write={write} />
    <Curves grade={grade} counts={counts} write={write} />
    <div className="cx-grade-block"><span className="cx-grade-title">Colour mixer</span>
      <div className="cx-grade-bands" role="group" aria-label="Colour to adjust">{HUE_BANDS.map(item => { const changed = Boolean(grade.hsl?.[item.id]?.h || grade.hsl?.[item.id]?.s || grade.hsl?.[item.id]?.l); return <button key={item.id} type="button" aria-label={item.label} title={item.label} aria-pressed={band === item.id} data-changed={changed || undefined} style={{ background: item.swatch }} onClick={() => setBand(item.id)} />; })}</div>
      <StudioRange label="Hue" min={-60} max={60} value={shift.h ?? 0} unit="°" onChange={value => setShift('h', value)} />
      <StudioRange label="Saturation" min={-100} max={100} value={shift.s ?? 0} unit="" onChange={value => setShift('s', value)} />
      <StudioRange label="Lightness" min={-100} max={100} value={shift.l ?? 0} unit="" onChange={value => setShift('l', value)} />
    </div>
    <div className="cx-grade-block"><span className="cx-grade-title">Detail</span>
      <StudioRange label="Vibrance" min={-100} max={100} value={grade.vibrance ?? 0} unit="" onChange={vibrance => write({ vibrance })} />
      <StudioRange label="Clarity" min={-100} max={100} value={grade.clarity ?? 0} unit="" onChange={clarity => write({ clarity })} />
      <StudioRange label="Noise reduction" min={0} max={100} value={grade.denoise ?? 0} unit="%" onChange={denoise => write({ denoise })} />
    </div>
    <div className="cx-grade-block"><span className="cx-grade-title">Gradient map</span>
      <div className="cx-grade-maps" role="group" aria-label="Gradient maps">{GRADIENT_MAPS.map(item => <button key={item.id} type="button" aria-pressed={mapId === item.id} onClick={() => write({ map: mapId === item.id ? undefined : { stops: item.stops.map(stop => ({ ...stop })), amount: grade.map?.amount ?? 100 } })}><span style={{ background: mapCss(item.stops) }} /><small>{item.label}</small></button>)}</div>
      {grade.map && <><div className="cx-grade-stops">{grade.map.stops.map((stop, index) => <input key={index} type="color" aria-label={`Map colour ${index + 1}`} value={stop.color} onChange={event => write({ map: { ...latest.current.map!, stops: latest.current.map!.stops.map((item, i) => i === index ? { ...item, color: event.target.value } : item) } })} />)}</div>
        <StudioRange label="Strength" min={0} max={100} value={grade.map.amount} unit="%" onChange={amount => write({ map: { ...latest.current.map!, amount } })} /></>}
    </div>
    {active && <button type="button" className="artwork-reset" onClick={() => update({ imageGrade: grade.cutout || grade.recolour ? { cutout: grade.cutout, recolour: grade.recolour } : undefined })}>Reset pro colour</button>}
  </StudioFold>;
}
