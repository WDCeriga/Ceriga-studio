import polygonClipping,{type MultiPolygon,type Pair} from 'polygon-clipping';
/** Resolve nearly coincident traced edges on an integer grid only if exact union fails. */
function operation(kind:'union'|'difference',inputs:MultiPolygon[]):MultiPolygon{
 if(!inputs.length||!inputs[0].length)return[];
 const run=(values:MultiPolygon[])=>kind==='union'?polygonClipping.union(values[0],...values.slice(1)):polygonClipping.difference(values[0],...values.slice(1));
 try{return run(inputs);}catch(original){
  for(const grid of [100,10,1]){
   const snapped=inputs.map(g=>g.flatMap(poly=>{
    const rings=poly.map(r=>r.map(([x,y])=>[Math.round(x*grid),Math.round(y*grid)] as Pair).filter((p,i,all)=>!i||p[0]!==all[i-1][0]||p[1]!==all[i-1][1]));
    if(new Set(rings[0]?.map(p=>p.join(','))).size<3)return[];
    return[rings.filter(r=>new Set(r.map(p=>p.join(','))).size>=3)];
   }));
   if(kind==='difference'&&!snapped[0].length)return[];
   const nonempty=snapped.filter(g=>g.length);
   if(!nonempty.length)return[];
   try{return run(nonempty).map(p=>p.map(r=>r.map(([x,y])=>[x/grid,y/grid] as Pair)));}catch{}
  }
  throw original;
 }
}

export function stablePolygonUnion(...geometries:MultiPolygon[]):MultiPolygon{return operation('union',geometries.filter(g=>g.length));}
export function stablePolygonDifference(subject:MultiPolygon,...cuts:MultiPolygon[]):MultiPolygon{return subject.length?operation('difference',[subject,...cuts.filter(g=>g.length)]):[];}
