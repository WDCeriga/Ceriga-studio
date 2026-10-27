import svgpath from 'svgpath';
import type {ShapePath,ShapePathNode} from './shapeGeometry';
/** Author scalable motifs as real editable line/cubic paths, never baked images. */
export function editableSvgPath(d:string):ShapePath{
 const paths:ShapePath[]=[];let path:ShapePath|undefined,last:ShapePathNode|undefined;
 svgpath(d).abs().unshort().unarc().iterate(segment=>{
  const v=segment.slice(1) as number[],cmd=segment[0];
  if(cmd==='M'){path={closed:false,nodes:[{x:v[0],y:v[1]}]};paths.push(path);last=path.nodes[0];}
  else if(path&&last){
   if(cmd==='Z'){path.closed=true;const first=path.nodes[0];if(Math.hypot(last.x-first.x,last.y-first.y)<1e-8&&path.nodes.length>1){if(last.in)first.in=last.in;path.nodes.pop()}last=path.nodes.at(-1);}
   else if(cmd==='L'||cmd==='H'||cmd==='V'){last={x:cmd==='V'?last.x:v[0],y:cmd==='H'?last.y:cmd==='V'?v[0]:v[1]};path.nodes.push(last);}
   else if(cmd==='C'){last.out={x:v[0],y:v[1]};last={x:v[4],y:v[5],in:{x:v[2],y:v[3]}};path.nodes.push(last);}
   else if(cmd==='Q'){const old=last;old.out={x:old.x+(v[0]-old.x)*2/3,y:old.y+(v[1]-old.y)*2/3};last={x:v[2],y:v[3],in:{x:v[2]+(v[0]-v[2])*2/3,y:v[3]+(v[1]-v[3])*2/3}};path.nodes.push(last);}
  }
 });
 return paths.length?{...paths[0],...(paths.length>1?{subpaths:paths.slice(1)}:{})}:{closed:false,nodes:[]};
}
export const ARTWORK_MOTIFS:Record<string,string>={
 'party-silhouette':'M35 29 C20 28 17 20 20 8 C21 1 30 1 30 9 L29 18 Q34 23 43 20 Q51 16 58 22 Q68 20 70 8 C72 0 82 3 79 12 Q76 29 62 35 L63 52 L74 87 Q77 99 67 99 Q61 98 59 88 L50 65 L44 92 Q42 101 33 98 Q29 97 32 87 L39 51Z M38 12 C38 0 57 0 57 12 C57 26 38 26 38 12Z',
 'tribal-sigil':'M1 88 L18 18 L10 9 L28 13 L38 98 L25 75 L21 53 L14 65 L9 85Z M18 33 L14 51 L22 48Z M37 91 L41 25 L32 10 L66 20 L72 42 L55 52 L72 95 L56 79 L49 57 L47 78Z M49 30 L48 43 L60 37Z M73 81 L78 30 L69 19 L99 8 L94 28 L86 36 L85 43 L98 39 L91 55 L83 62 L81 77 L96 67 L88 90Z M3 12 Q30 37 43 5 Q28 26 3 12Z',
};
