import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Ruler } from 'lucide-react';
import type { GarmentLabel } from '../../../data/garmentLabels';
import { LABEL_FOLDS } from '../../../data/garmentLabels';
import { labelFoldZones } from '../../../lib/labelSurfaceRules';
import './label-canvas.css';

const KEY = 'ceriga.labels.canvasGuides.v1';
const readSaved = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
let visible = typeof localStorage === 'undefined' ? true : readSaved();
const listeners = new Set<() => void>();
const setVisible = (next: boolean) => { visible = next; try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* Still works for this session. */ } listeners.forEach(listener => listener()); };
const useVisible = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => visible, () => visible);

export function LabelGuidesToggle() {
  const on = useVisible();
  return <button type="button" className="cx-dock-toggle label-guides-toggle" aria-pressed={on} title="Show fold lines, stitching and measurements" onPointerDown={event => event.stopPropagation()} onClick={() => setVisible(!on)}><Ruler size={14} /><span>Guides</span></button>;
}

const trim = (value: number) => String(Number(value.toFixed(1)));
const STITCH_NAMES: Record<string, string> = { top: 'Top edge', bottom: 'Bottom edge', 'top-bottom': 'Top & bottom', sides: 'Both sides' };

/** Production marks around the label. They sit outside the artwork and are never saved or printed. */
export function LabelCanvasGuides({ label, width, height }: { label: GarmentLabel; width: number; height: number }) {
  const on = useVisible(), host = useRef<SVGSVGElement>(null), [perMm, setPerMm] = useState(10);
  useEffect(() => {
    if (!on) return;
    let frame = 0, last = 0;
    const measure = () => { const box = host.current?.getBoundingClientRect(); if (box?.width) { const next = box.width / Math.max(.01, width); if (Math.abs(next - last) > .01) { last = next; setPerMm(next); } } frame = requestAnimationFrame(measure); };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [on, width]);
  if (!on) return null;
  const px = (value: number) => value / Math.max(.01, perMm), font = px(11), gap = px(16), tick = px(5), line = px(1), folds = labelFoldZones(label), margin = Math.max(0, label.marginMm), sewn = label.construction === 'physical', stitch = sewn ? label.stitchingPlacement ?? 'none' : 'none';
  const verticalFolds = folds.filter(zone => zone.height >= height - .01), horizontalFolds = folds.filter(zone => zone.height < height - .01), foldSize = folds[0] ? Math.min(folds[0].width, folds[0].height) : 0;
  const foldName = sewn && LABEL_FOLDS[label.fold] ? LABEL_FOLDS[label.fold] : '';
  const barLength = Math.min(10, width), showSafe = margin > 0 && width > margin * 2 && height > margin * 2;
  return <svg ref={host} data-editor-chrome data-label-canvas-guides className="label-canvas-guides" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
    {showSafe && <rect data-label-safe x={margin} y={margin} width={width - margin * 2} height={height - margin * 2} className="is-safe" strokeWidth={line} strokeDasharray={`${px(2)} ${px(4)}`} />}
    {folds.map((zone, index) => <rect key={index} data-label-fold x={zone.x} y={zone.y} width={zone.width} height={zone.height} className="is-fold-zone" />)}
    {verticalFolds.map((zone, index) => { const x = zone.x === 0 ? zone.width : zone.x; return <line key={index} data-label-fold-line x1={x} x2={x} y1={0} y2={height} className="is-fold" strokeWidth={line} strokeDasharray={`${px(5)} ${px(4)}`} />; })}
    {horizontalFolds.map((zone, index) => <line key={index} data-label-fold-line x1={0} x2={width} y1={zone.y} y2={zone.y} className="is-fold" strokeWidth={line} strokeDasharray={`${px(5)} ${px(4)}`} />)}
    <g className="is-measure" strokeWidth={line}>
      <path d={`M0 ${-gap - tick}V${-gap + tick}M0 ${-gap}H${width}M${width} ${-gap - tick}V${-gap + tick}`} />
      <text x={width / 2} y={-gap - px(5)} fontSize={font} textAnchor="middle">{trim(width)} mm</text>
      <path d={`M${-gap - tick} 0H${-gap + tick}M${-gap} 0V${height}M${-gap - tick} ${height}H${-gap + tick}`} />
      <text transform={`translate(${-gap - px(6)} ${height / 2}) rotate(-90)`} fontSize={font} textAnchor="middle">{trim(height)} mm</text>
    </g>
    <g className="is-note">
      {folds.length > 0 && foldName && <text x={0} y={height + gap + px(2)} fontSize={font}>{foldName} · {trim(foldSize)} mm</text>}
      {stitch !== 'none' && <text x={width} y={height + gap + px(2)} fontSize={font} textAnchor="end">Stitching · {STITCH_NAMES[stitch] ?? stitch}</text>}
      <path data-label-scale d={`M${width - barLength} ${height + gap * 2 + px(2)}H${width}M${width - barLength} ${height + gap * 2 - px(1)}V${height + gap * 2 + px(5)}M${width} ${height + gap * 2 - px(1)}V${height + gap * 2 + px(5)}`} strokeWidth={line} />
      <text x={width - barLength - px(6)} y={height + gap * 2 + px(6)} fontSize={font} textAnchor="end">{trim(barLength / 10)} cm</text>
    </g>
  </svg>;
}
