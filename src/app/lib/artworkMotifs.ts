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
 'shield':'M12 12 Q50 2 88 12 V48 C88 70 71 87 50 97 C29 87 12 70 12 48Z',
 'shield-frame':'M12 12 Q50 2 88 12 V48 C88 70 71 87 50 97 C29 87 12 70 12 48Z M20 18 V48 C20 66 34 81 50 89 C66 81 80 66 80 48 V18 Q50 10 20 18Z',
 'swallowtail-ribbon':'M4 24 H96 L83 50 L96 76 H4 L17 50Z',
 'arch-ribbon':'M5 60 Q50 8 95 60 L77 67 L87 88 Q50 43 13 88 L23 67Z',
 'hangtag':'M10 30 L34 6 H66 L90 30 V94 H10Z M50 14 A6 6 0 1 0 50 26 A6 6 0 1 0 50 14Z',
 'ticket-tag':'M6 23 H94 V40 Q82 40 82 50 Q82 60 94 60 V77 H6 V60 Q18 60 18 50 Q18 40 6 40Z',
 'neck-label':'M7 24 H93 Q96 24 96 27 V73 Q96 76 93 76 H7 Q4 76 4 73 V27 Q4 24 7 24Z',
 'pennant':'M8 7 L95 50 L8 93Z',
 'racing-plate':'M13 17 H89 L96 29 L87 83 H11 L4 71Z',
 'speed-stripe':'M18 22 H96 L86 40 H8Z M14 46 H83 L73 64 H4Z',
 'utility-patch':'M12 15 H88 L96 23 V77 L88 85 H12 L4 77 V23Z M15 23 L12 26 V74 L15 77 H85 L88 74 V26 L85 23Z',
 'measurement-tag':'M4 26 H96 V74 H4Z M12 36 H88 V64 H12Z',
 'location-pin':'M50 4 C28 4 16 19 16 37 C16 56 35 78 50 96 C65 78 84 56 84 37 C84 19 72 4 50 4Z M50 22 A14 14 0 1 0 50 50 A14 14 0 1 0 50 22Z',
 'party-silhouette':'M35 29 C20 28 17 20 20 8 C21 1 30 1 30 9 L29 18 Q34 23 43 20 Q51 16 58 22 Q68 20 70 8 C72 0 82 3 79 12 Q76 29 62 35 L63 52 L74 87 Q77 99 67 99 Q61 98 59 88 L50 65 L44 92 Q42 101 33 98 Q29 97 32 87 L39 51Z M38 12 C38 0 57 0 57 12 C57 26 38 26 38 12Z',
 'tribal-sigil':'M1 88 L18 18 L10 9 L28 13 L38 98 L25 75 L21 53 L14 65 L9 85Z M18 33 L14 51 L22 48Z M37 91 L41 25 L32 10 L66 20 L72 42 L55 52 L72 95 L56 79 L49 57 L47 78Z M49 30 L48 43 L60 37Z M73 81 L78 30 L69 19 L99 8 L94 28 L86 36 L85 43 L98 39 L91 55 L83 62 L81 77 L96 67 L88 90Z M3 12 Q30 37 43 5 Q28 26 3 12Z',
};
