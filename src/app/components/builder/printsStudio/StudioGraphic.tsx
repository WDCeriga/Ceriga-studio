import {SurfacePrecisionGraphic} from './SurfacePrecisionGraphic';
import {precisionGeometryChanged} from '../../../lib/svgPrecision';
import {ShapeAppearanceArtwork} from './ShapeAppearanceArtwork';
import {BrushVectorArtwork} from './BrushVectorArtwork';
import {garmentWearMarks} from '../../../lib/wearEditing';
import type {DistressMark,DistressMarkKind} from '../../../lib/distressScatter';
import {distressPaths,singleDistressMarks} from '../../../lib/distressRendering';
import {useGarmentWearPalette} from './GarmentWearAppearance';
import type { DesignElement } from '../PrintStudioEditor';
import { memo,useId } from 'react';
import { svgPaint } from '../../../lib/studioPaint';
import { PatternGraphic } from './PatternGraphic';
import { artworkFlipStyle } from '../../../lib/artworkFlip';
import { canFillShape } from './studioAssets';
import { shapeToEditablePath, shapePathData, type ShapePath } from '../../../lib/shapeGeometry';
import { ShapeEffectsArtwork } from './ShapeEffectsArtwork';

function strokeOf(el: DesignElement) {
  return el.shapeStrokeColor ?? el.color ?? '#FFFFFF';
}

function scaledPath(path: ShapePath, width: number, height: number): ShapePath {
  const point = (p: { x: number; y: number }) => ({ x: p.x * width / 100, y: p.y * height / 100 });
  return { ...path,closed: path.closed, nodes: path.nodes.map(n => ({ ...point(n), ...(n.in ? { in: point(n.in) } : {}), ...(n.out ? { out: point(n.out) } : {}) })), subpaths: path.subpaths?.map(part => scaledPath(part, width, height)) };
}

function weightOf(el: DesignElement) {
  return Math.max(0, el.borderWidth ?? (el.shapeFilled?0:4));
}

export const StudioGraphic=memo(function StudioGraphic({ element }: { element: DesignElement }) {
  if(element.svgPrecision&&!precisionGeometryChanged(element))return <SurfacePrecisionGraphic element={element}/>;
  if(element.type==='shape'&&element.artworkAppearance)return <ShapeAppearanceArtwork element={element}/>;
  if(element.type==='shape'&&canFillShape(element)&&element.shapeEffects?.some(e=>e.id==='textile-ink'&&e.enabled!==false)){
    const filled={...element,borderWidth:0,shapeFilled:true};
    const outline={...element,shapeFilled:false,shapeEffects:element.shapeEffects.filter(e=>e.id!=='textile-ink')};
    return <div className="relative h-full w-full"><ShapeEffectsArtwork element={filled}><StudioGraphicBase element={filled}/></ShapeEffectsArtwork>{(element.borderWidth??0)>0&&<div className="pointer-events-none absolute inset-0"><ShapeEffectsArtwork element={outline}><StudioGraphicBase element={outline}/></ShapeEffectsArtwork></div>}</div>;
  }
  const artwork = <StudioGraphicBase element={element} />;
  return element.type === 'shape' && element.shapeEffects?.some(effect => effect.enabled !== false)
    ? <ShapeEffectsArtwork element={element}>{artwork}</ShapeEffectsArtwork>
    : artwork;
});

function StudioGraphicBase({ element }: { element: DesignElement }) {
  const id = useId().replace(/:/g, '');
  if (element.type === 'pattern') return <PatternGraphic element={element} />;
  if(element.type==='shape'&&element.shapeBrush&&element.shapePath)return <BrushVectorArtwork element={element}/>;
  const paintWidth = element.shapeGeometry === 'bounds' ? element.width : 100;
  const paintHeight = element.shapeGeometry === 'bounds' ? element.height : paintWidth;
  const paint = svgPaint(strokeOf(element), `paint-${id}`, paintWidth, paintHeight);
  const fillPaint = svgPaint(element.shapeFillColor ?? element.color ?? '#FFFFFF', `fill-${id}`, paintWidth, paintHeight);
  const stroke = paint.color;
  const fill = element.shapeFilled && canFillShape(element) ? fillPaint.color : 'none';
  const definitions = <defs dangerouslySetInnerHTML={{ __html: paint.defs + fillPaint.defs }} />;
  const sw = weightOf(element);
  const flip = artworkFlipStyle(element);
  const legacy = ['ellipse', 'rect', 'line', 'zigzag', 'squiggly', 'triangle', 'star', 'arrow'];
  const boundsLegacy = ['ellipse', 'circle', 'rect', 'semicircle-open', 'semicircle-closed', 'line'];
  const parametric = Boolean(element.shapeStrokeStyle&&element.shapeStrokeStyle!=='solid') || !!element.shapePath || !!Object.keys(element.shapeParameters ?? {}).length
    || !(element.shapeGeometry === 'bounds' ? boundsLegacy : legacy).includes(element.content);

  if (element.type === 'shape' && parametric) {
    const width = element.shapeGeometry === 'bounds' ? Math.max(sw, element.width) : 100;
    const height = element.shapeGeometry === 'bounds' ? Math.max(sw, element.height) : 100;
    const path = scaledPath(shapeToEditablePath(element), width, height);
    return <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" style={flip} aria-hidden>
      {definitions}
      {element.shapeStrokeAlign==='inside'&&<defs><clipPath id={'stroke-inside-'+id}><path d={shapePathData(path)} fillRule={element.shapeFillRule??'evenodd'}/></clipPath></defs>}
      {element.shapeStrokeAlign==='outside'&&<><defs><mask id={'stroke-outside-'+id} maskUnits="userSpaceOnUse" x={-sw*3} y={-sw*3} width={width+sw*6} height={height+sw*6}><rect x={-sw*3} y={-sw*3} width={width+sw*6} height={height+sw*6} fill="white"/><path d={shapePathData(path)} fill="black" fillRule={element.shapeFillRule??'evenodd'}/></mask></defs><path d={shapePathData(path)} fill={fill} fillRule={element.shapeFillRule??'evenodd'} stroke="none"/></>}
      {element.drawingVectorSource&&element.shapeFilled&&<path d={[path,...(path.subpaths??[])].filter(p=>p.closed).map(p=>shapePathData({...p,subpaths:undefined})).join(' ')} fill={fill} fillRule="evenodd" stroke="none"/>}
      {element.shapeStrokeStyle==='double'&&sw>0&&<path data-editable-ink d={shapePathData(path)} fill="none" stroke={element.shapeOutlineAccent??'#f0eadb'} strokeWidth={sw*1.8} strokeLinejoin="round"/>}
      {element.letteringPaints?.length&&element.shapeFilled?element.letteringPaints.map((paint,index)=>{const parts=[path,...(path.subpaths??[])].filter(p=>p.letterKey===paint.key);const ink=svgPaint(paint.fill,`glyph-${id}-${index}`,width,height);return parts.length?<g key={index}><defs dangerouslySetInnerHTML={{__html:ink.defs}}/><path d={shapePathData({...parts[0],subpaths:parts.slice(1)})} fill={ink.color} fillRule={element.shapeFillRule??'evenodd'} stroke="none"/></g>:null;}):null}
      <path data-editable-ink d={shapePathData(path)} strokeDasharray={element.shapeStrokeStyle==='dashed'?`${sw*3} ${sw*2}`:element.shapeStrokeStyle==='dotted'?`.01 ${sw*2}`:undefined} fill={element.letteringPaints?.length||element.drawingVectorSource||element.shapeStrokeAlign==='outside'?'none':fill} clipPath={element.shapeStrokeAlign==='inside'?`url(#stroke-inside-${id})`:undefined} mask={element.shapeStrokeAlign==='outside'?`url(#stroke-outside-${id})`:undefined} fillRule={element.shapeFillRule??(element.paintStain?'nonzero':'evenodd')} stroke={stroke} strokeWidth={element.shapeStrokeAlign&&element.shapeStrokeAlign!=='center'?sw*2:sw}
        strokeLinecap={element.shapeStrokeCap??(element.content === 'zigzag' ? 'butt' : 'round')} strokeLinejoin={element.shapeStrokeJoin??(element.content === 'zigzag' ? 'miter' : 'round')} strokeMiterlimit={8} />
    </svg>;
  }

  if (element.type === 'shape' && element.shapeGeometry === 'bounds') {
    const width = Math.max(sw, element.width);
    const height = Math.max(sw, element.height);
    return <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" style={flip} aria-hidden>
      {definitions}
      {element.content === 'ellipse' || element.content === 'circle' ? <ellipse cx={width / 2} cy={height / 2} rx={(width - sw) / 2} ry={(height - sw) / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
        : element.content === 'semicircle-open' || element.content === 'semicircle-closed' ? <path
            d={`M ${sw / 2} ${height - sw / 2} A ${(width - sw) / 2} ${height - sw} 0 0 1 ${width - sw / 2} ${height - sw / 2}${element.content === 'semicircle-closed' ? ' Z' : ''}`}
            fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        : element.content === 'rect' ? <rect x={sw / 2} y={sw / 2} width={width - sw} height={height - sw} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        : <line x1={sw / 2} y1={height / 2} x2={width - sw / 2} y2={height / 2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />}
    </svg>;
  }

  if (element.type === 'shape') {
    return (
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
        style={flip}
        aria-hidden
      >
        {definitions}
        {element.content === 'ellipse' ? (
          <ellipse cx="50" cy="50" rx="42" ry="32" fill={fill} stroke={stroke} strokeWidth={sw} />
        ) : element.content === 'rect' ? (
          <rect x="12" y="18" width="76" height="64" fill={fill} stroke={stroke} strokeWidth={sw} rx="4" />
        ) : element.content === 'line' ? (
          <line x1="8" y1="50" x2="92" y2="50" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        ) : element.content === 'zigzag' ? (
          <polyline
            points="4,86 16,14 28,86 40,14 52,86 64,14 76,86 88,14 96,86"
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="miter"
            strokeLinecap="butt"
            strokeMiterlimit={8}
          />
        ) : element.content === 'squiggly' ? (
          <path
            d="M4 50 C 12.25 12, 19.75 12, 28 50 S 43.75 88, 52 50 S 67.75 12, 76 50 S 91.75 88, 96 50"
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : element.content === 'triangle' ? (
          <polygon points="50,12 90,86 10,86" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        ) : element.content === 'star' ? (
          <polygon
            points="50,8 61,38 94,38 67,58 78,90 50,70 22,90 33,58 6,38 39,38"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        ) : (
          <polygon points="8,30 62,30 62,18 92,50 62,82 62,70 8,70" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        )}
      </svg>
    );
  }

  return <DistressGraphic element={element}/>;
}

function DistressGraphic({element}:{element:DesignElement}) {
  const kind=element.wear?.kind??(element.content==='rips'?'rips':element.content==='abrasion'?'abrasion':'holes');
  const seed=Array.from(element.id??'wear').reduce((v,c)=>Math.imul(v^c.charCodeAt(0),16777619),2166136261);
  const marks=element.wear?.marks??singleDistressMarks(kind,element.width,element.height,seed);
  const world=element.wear?garmentWearMarks(element):[{x:element.x,y:element.y}];
  return element.content.startsWith('data:')&&!element.wear?<LegacyWearGraphic element={element}/>:<svg viewBox={`0 0 ${element.wear?.sourceWidth??element.width} ${element.wear?.sourceHeight??element.height}`} className="h-full w-full" preserveAspectRatio="none" style={artworkFlipStyle(element)} aria-hidden data-wear-graphic={kind}>
    {marks.map((mark,i)=><WearVectorMark key={i} mark={{...mark,...element.wearDetail,...(element.wearDetail?.roughness!==undefined?{roughness:element.wearDetail.roughness/100}:{}),...(element.wearDetail?.fray!==undefined?{fray:element.wearDetail.fray/100}:{})}} kind={kind} x={world[i]?.x??element.x} y={world[i]?.y??element.y}/>)}</svg>;
}
function WearVectorMark({mark,kind,x,y}:{mark:DistressMark;kind:DistressMarkKind;x:number;y:number}) {
 const palette=useGarmentWearPalette(x,y);
 return <g opacity={mark.opacity} transform={`translate(${mark.x} ${mark.y}) rotate(${mark.rotation*180/Math.PI})`}>
  {distressPaths(mark,kind,palette).map((p,j)=><path key={j} d={p.d} data-wear-detail={p.role} fill={p.fill??'none'} stroke={p.stroke} strokeWidth={p.strokeWidth} opacity={p.opacity??1} strokeLinecap="round" strokeLinejoin="round"/>)}</g>;
}
/** Older flattened wear layers have no recoverable hole geometry. Keep their alpha and recolour the old white backing. */
function LegacyWearGraphic({element}:{element:DesignElement}) {
 const palette=useGarmentWearPalette(element.x,element.y),id=useId().replace(/:/g,'');
 const rgb=(color:string)=>(color.match(/[\d.]+/g)??['0','0','0']).slice(0,3).map(v=>Number(v)/255);
 const dark=rgb(palette.shadow),inner=rgb(palette.opening);
 const matrix=inner.flatMap((v,i)=>[.2126*(v-dark[i]),.7152*(v-dark[i]),.0722*(v-dark[i]),0,dark[i]]).concat([0,0,0,1,0]).join(' ');
 return <svg viewBox={`0 0 ${element.width} ${element.height}`} preserveAspectRatio="none" className="h-full w-full" style={artworkFlipStyle(element)} aria-hidden data-wear-legacy><defs><filter id={id} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values={matrix}/></filter></defs><image href={element.content} width={element.width} height={element.height} preserveAspectRatio="none" filter={element.wearRasterTinted?undefined:`url(#${id})`}/></svg>;
}
