import {cleanSketchCurve as curvePath} from './cleanSketchCurves';
import {contours} from 'd3-contour';
import type {RecordedDrawing} from './drawingReplay';
import type {ShapePath} from './shapeGeometry';
type P={x:number;y:number};
const distance=(a:P,b:P)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Join only nearby stroke ends. Separate petals, stems and islands stay separate. */
export function joinSketchStrokes(source:P[][],gap:number){
 const paths=source.map(row=>row.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({...p}))).filter(p=>p.length>1);
 for(let changed=true;changed;){changed=false;
  for(let i=0;i<paths.length&&!changed;i++){
   if(distance(paths[i][0],paths[i].at(-1)!)<=gap)continue;
   for(let j=i+1;j<paths.length;j++){
    if(distance(paths[j][0],paths[j].at(-1)!)<=gap)continue;
    const a=paths[i],b=paths[j],options=[{d:distance(a.at(-1)!,b[0]),a,b},{d:distance(a.at(-1)!,b.at(-1)!),a,b:[...b].reverse()},{d:distance(a[0],b.at(-1)!),a:b,b:a},{d:distance(a[0],b[0]),a:[...a].reverse(),b}].sort((x,y)=>x.d-y.d);
    if(options[0].d>gap)continue;
    const best=options[0];paths[i]=[...best.a,...best.b];paths.splice(j,1);changed=true;break;
   }
  }
 }
 return paths;
}
export function vectorizeSketchLines(source:RecordedDrawing,detail=55,closeGaps=true,preserveStrokes=false):ShapePath{
 const gap=closeGaps?Math.hypot(source.width,source.height)*.055:0;
 const rows=source.strokes.flatMap(stroke=>{const p=stroke.points.map(({x,y})=>({x,y}));return stroke.mirrorAxis===undefined?[p]:[p,p.map(p=>({x:stroke.mirrorAxis!*2-p.x,y:p.y}))]});
 const paths=(preserveStrokes?rows.filter(row=>row.length>1&&row.some(p=>distance(p,row[0])>.001)):joinSketchStrokes(rows,gap)).map(row=>curvePath(row,row.length>3&&distance(row[0],row.at(-1)!)<=Math.max(.05,gap),detail,source.width,source.height)).filter(p=>p.nodes.length>=2);
 if(!paths.length)throw new Error('Draw a line first, or use Ink silhouette for painted marks.');
 return {...paths[0],subpaths:paths.slice(1)};
}
/** Trace alpha, not background RGB: holes and disconnected painted islands survive. */
export function vectorizeSketchAlpha(alpha:Float32Array,width:number,height:number,detail=55):ShapePath{
 const paths=contours().size([width,height]).smooth(true).thresholds([.25])(alpha)[0]?.coordinates.flatMap(polygon=>polygon.map(ring=>curvePath(ring.map(([x,y])=>({x,y})),true,detail,width,height))).filter(p=>p.nodes.length>=3)??[];
 if(!paths.length)throw new Error('There is no visible ink to trace.');
 if(paths.reduce((sum,p)=>sum+p.nodes.length,0)>6000)throw new Error('This texture has too much fine detail. Lower the detail or use Line drawing.');
 return {...paths[0],subpaths:paths.slice(1)};
}
