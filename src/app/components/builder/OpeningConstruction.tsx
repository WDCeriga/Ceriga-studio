import {zipRoute,zipPolyline} from '../../lib/zipCurve';
import { useId, useMemo, useRef, type PointerEvent } from 'react';
import polygonClipping from 'polygon-clipping';
import { constructOpenings, openingGap, openingGapProfile, openingNecklineReach, openingPolygonPath, setOpeningEndpoint, validateOpening, type OpeningPoint } from '../../data/garmentOpenings';
import { detailAsset, type DetailBounds, type GarmentDetail } from '../../data/garmentDetails';
import { resolveStitchSettings, stitchPatternPath, type TshirtStitching } from '../../data/tshirtStitching';
import { constructionColor } from '../../lib/tshirtSvgUtils';

export function OpeningConstruction({ details, bounds, selectedId, onSelect, onChange, onDraftChange, stitching, stage = 'final' }: {
  details: GarmentDetail[]; bounds: DetailBounds; selectedId?: string | null;
  stage?: 'path' | 'construction' | 'final';
  onSelect?: (id: string) => void; onChange?: (detail: GarmentDetail) => void;
  onDraftChange?: (detail: GarmentDetail | null) => void; stitching?: TshirtStitching;
}) {
  const prefix = useId().replace(/:/g, '');
  const root = useRef<SVGSVGElement>(null);
  const combined = useMemo(() => stage === 'path' ? undefined : constructOpenings(details, bounds), [details, bounds.openingGeometry, stage]);
  const gesture = useRef<{ id: number; origin: GarmentDetail; endpoint: 'start' | 'end' | 'curve'; anchorIndex?:number;handle?:'incoming'|'outgoing'; pointer: OpeningPoint; inverse: DOMMatrix; draft?: GarmentDetail } | null>(null);
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(current.inverse);
    if(current.endpoint==='curve'){
      const opening=current.origin.opening!,curve=opening.curve?.map((a,i)=>{if(i!==current.anchorIndex||!current.handle)return a;const h=a[current.handle];if(!h)return a;return {...a,[current.handle]:{x:h.x+point.x-current.pointer.x,y:h.y+point.y-current.pointer.y}}});
      current.draft={...current.origin,opening:{...opening,curve}};
    }else{const origin = current.origin.opening![current.endpoint];
    current.draft = setOpeningEndpoint(current.origin, bounds, current.endpoint, {
      x: origin.x + point.x - current.pointer.x, y: origin.y + point.y - current.pointer.y,
    });}
    onDraftChange?.(current.draft);
  };
  const cancel = () => { gesture.current = null; onDraftChange?.(null); };
  return <svg ref={root} viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" style={{ zIndex: 235 }} data-opening-construction="" data-opening-stage={stage}
    onPointerMove={move} onPointerCancel={cancel} onLostPointerCapture={cancel}
    onPointerUp={event => {
      if (gesture.current?.id !== event.pointerId) return;
      move(event);
      if (gesture.current?.draft) onChange?.(gesture.current.draft);
      cancel();
    }}>
    {details.filter(detail => detail.opening && !detail.hidden).map((detail, index) => {
      const opening = detail.opening!;
      const validation = validateOpening(detail, bounds);
      const individual = stage === 'path' ? undefined : combined?.active.length === 1 && combined.active[0].id === detail.id ? combined : constructOpenings([detail], bounds);
      const facing = individual?.facing ?? [];
      const geometry = { facing: combined && combined.active.length > 1 && combined.removed.length && facing.length ? polygonClipping.difference(facing, combined.removed) : facing };
      const color = /^#[\da-f]{6}$/i.test(opening.facingColor) ? opening.facingColor : '#777777';
      const ink = constructionColor(color, detail.outline);
      const route=zipRoute(opening);
      const length = route.length;
      const normal = { x: -(opening.end.y - opening.start.y) / length, y: (opening.end.x - opening.start.x) / length };
      const stitch = resolveStitchSettings(stitching ?? {}, opening.attachment === 'hem' ? 'bottom' : opening.attachment === 'shoulder' ? 'shoulder' : opening.attachment === 'side-seam' ? 'side' : 'neckline');
      const profile = openingGapProfile(detail, opening.width, length);
      const reach = openingNecklineReach(detail, bounds);
      const stations = reach ? [-reach, ...profile.stations] : profile.stations;
      const point = (x: number, y: number): [number, number] => {const p=route.at(y,-x);return[p.x,p.y]};
      const extension = reach && bounds.openingGeometry?.fabric.length ? polygonClipping.intersection(
        polygonClipping.difference(openingGap(detail, opening.width * .45, reach), openingGap(detail, 0, reach)),
        bounds.openingGeometry.fabric,
        [[point(-2048, -reach), point(2048, -reach), point(2048, 0), point(-2048, 0), point(-2048, -reach)]],
      ) : [];
      const sourceWidth = Number(new DOMParser().parseFromString(detailAsset(detail).svg, 'image/svg+xml').documentElement.getAttribute('viewBox')?.split(/\s+/)[2]) || 48;
      const unit = opening.width / sourceWidth;
      const localExtension = extension.flatMap(polygon => polygon[0].map(([x, y]) => ({
        x: -(x - opening.start.x) * normal.x - (y - opening.start.y) * normal.y,
        y: (x - opening.start.x) * normal.y - (y - opening.start.y) * normal.x,
      })));
      const stops = [-1, 1].map(side => {
        const edge = side * profile.halfGap(0);
        const top = localExtension.filter(p => Math.abs(p.x - edge) < .1).reduce((y, p) => Math.min(y, p.y), 0);
        return { side, top, edge };
      });
      const rows = [-1, 1].map(side => Array.from({length:97},(_,i)=>{const y=length*i/96;return route.at(y,side*(profile.halfGap(y)+opening.width/2+5))}));
      const clip = `${prefix}-facing-${index}`;
      return <g key={detail.id} data-opening-id={detail.id} data-opening-status={validation.status}>
        {stage === 'path' && <g data-opening-path="" fill="none" stroke={validation.status === 'Invalid' ? '#dc2626' : '#404040'}>
          <path d={route.points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ')} strokeWidth={opening.width} strokeOpacity=".2" />
          <path d={route.points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ')} strokeWidth="3" strokeDasharray="10 7" />
        </g>}
        {stage !== 'path' && geometry.facing.length > 0 && <>
          <defs><clipPath id={clip}><path d={openingPolygonPath(geometry.facing)} clipRule="evenodd" /></clipPath></defs>
          <path data-opening-facing="" d={openingPolygonPath(geometry.facing)} fill={color} fillRule="evenodd" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
          <g clipPath={`url(#${clip})`}>
            {stitch.style !== 'none' && rows.map((row, side) => <path key={side} data-opening-stitch="" d={stitchPatternPath(row, stitch.style ?? 'standard')} fill="none"
              stroke={constructionColor(color, stitch.color ?? detail.stitch)} strokeWidth={stitch.thread === 'heavy' ? 2.1 : stitch.thread === 'fine' ? .8 : 1.3} strokeLinecap="round" />)}
          </g>
        </>}
        {stage !== 'path' && extension.length > 0 && <g data-opening-neckline-join="">
          <defs><clipPath id={`${clip}-join`}><path d={openingPolygonPath(extension)} clipRule="evenodd" /></clipPath></defs>
          <path d={openingPolygonPath(extension)} fill={detail.fill} fillRule="evenodd" />
          <g clipPath={`url(#${clip}-join)`} fill="none" stroke={ink} strokeWidth={unit}>
            {[-1, 1].flatMap(side => [0, opening.width * .45].map(offset => <path key={`${side}-${offset}`} d={`M${point(side * (profile.halfGap(0) + offset), -reach)}L${point(side * (profile.halfGap(0) + offset), 0)}`} />))}
          </g>
          {stitch.style !== 'none' && <g clipPath={`url(#${clip}-join)`} fill="none" stroke={constructionColor(detail.fill, stitch.color ?? detail.stitch)} strokeWidth={unit} strokeDasharray={`${4 * unit} ${4 * unit}`}>
            {[-1, 1].map(side => <path key={side} data-neckline-tape-stitch="" d={`M${point(side * (profile.halfGap(0) + opening.width * .45 - 3 * unit), -reach)}L${point(side * (profile.halfGap(0) + opening.width * .45 - 3 * unit), 0)}`} />)}
          </g>}
          {stage === 'final' && <g clipPath={`url(#${clip}-join)`} data-neckline-zip-teeth="" stroke={detail.zipTeethColor ?? detail.outline} strokeWidth={1.4 * unit}>
            {[-1, 1].flatMap(side => Array.from({ length: Math.ceil(reach / (8 * unit)) }, (_, i) => {
              const y = -i * 8 * unit;
              const a = point(side * profile.halfGap(0), y);
              const b = point(side * (profile.halfGap(0) + 3 * unit), y);
              return <path key={`${side}-${i}`} d={`M${a}L${b}`} />;
            }))}
            {stops.map(({ side, top, edge }) => <path key={side} data-neckline-zip-stop="" d={`M${point(edge, top + 2 * unit)}L${point(edge + side * 3 * unit, top + 2 * unit)}`} stroke={detail.hardware} strokeWidth={3 * unit} />)}
          </g>}
        </g>}
        {onChange&&selectedId===detail.id&&opening.curve?.map((anchor,anchorIndex)=>(['incoming','outgoing'] as const).map(handle=>{const h=anchor[handle];if(!h)return null;return <g key={anchorIndex+handle} className="zip-path-handle"><line x1={anchor.x} y1={anchor.y} x2={h.x} y2={h.y} stroke="#737373" strokeWidth="1" vectorEffect="non-scaling-stroke"/><circle cx={h.x} cy={h.y} r="7" fill="white" stroke="#404040" strokeWidth="1" vectorEffect="non-scaling-stroke"/><circle cx={h.x} cy={h.y} r="25" fill="transparent" role="button" tabIndex={0} aria-label={'Adjust zip curve '+(anchorIndex+1)+' '+handle} className="pointer-events-auto cursor-move touch-none" onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const inverse=root.current?.getScreenCTM()?.inverse();if(!inverse)return;gesture.current={id:event.pointerId,origin:detail,endpoint:'curve',anchorIndex,handle,pointer:new DOMPoint(event.clientX,event.clientY).matrixTransform(inverse),inverse};event.currentTarget.setPointerCapture(event.pointerId)}} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=event.shiftKey?10:1;onChange({...detail,opening:{...opening,curve:opening.curve!.map((a,i)=>i!==anchorIndex?a:{...a,[handle]:{x:h.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),y:h.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)}})}})}}/></g>}))}
        {onChange && selectedId === detail.id && (['start', 'end'] as const).map(endpoint => {
          const point: OpeningPoint = opening[endpoint];
          return <g key={endpoint}>
            <circle cx={point.x} cy={point.y} r="8" fill="white" stroke={validation.status === 'Invalid' ? '#dc2626' : '#404040'} strokeWidth="2" />
            <circle cx={point.x} cy={point.y} r="36" fill="transparent"
              role="button" tabIndex={0} aria-label={`Drag ${detail.name} opening ${endpoint}`} className="pointer-events-auto cursor-crosshair touch-none"
              onPointerDown={event => {
                if (event.button !== 0) return;
                event.preventDefault(); event.stopPropagation(); onSelect?.(detail.id);
                const inverse = root.current?.getScreenCTM()?.inverse();
                if (!inverse) return;
                const pointer = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
                gesture.current = { id: event.pointerId, origin: detail, endpoint, pointer, inverse };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 10 : 1;
                onChange(setOpeningEndpoint(detail, bounds, endpoint, { x: point.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y: point.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) }));
              }} />
          </g>;
        })}
      </g>;
    })}
  </svg>;
}
