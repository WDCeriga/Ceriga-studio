// Local visual regression harness: uses the same Canvas and topology as Builder.
import React, {useCallback, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PanellingCanvas} from '../src/app/features/panelling/PanellingCanvas';
import {PANELLING_GARMENT_MARKUP} from '../src/app/features/panelling/panellingGarment';
import {recomputeGarmentPanellingTopology} from '../src/app/features/panelling/panellingTopology';
import {pointInSurface, signedArea} from '../src/app/features/panelling/panellingGeometry';
import {runPanellingSelfTests} from '../src/app/features/panelling/panellingSelfTest';
import type {BoundaryLoop, PanellingSeam} from '../src/app/features/panelling/panellingTypes';
import '../src/styles/index.css';
import '../src/app/features/panelling/builder-panelling.css';
const tests=runPanellingSelfTests();
const noop=()=>{};
function intersections(loops: BoundaryLoop[], y: number) {
  const xs:number[]=[];
  for(const loop of loops) for(let i=0;i<loop.points.length;i++) {const a=loop.points[i],b=loop.points[(i+1)%loop.points.length];
    if((a.y>y)!==(b.y>y)) xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));}
  return xs.sort((a,b)=>a-b);
}
function Review(){
  const [boundaries,setBoundaries]=useState<BoundaryLoop[]>([]), [mode,setMode]=useState('Body only'),[colours,setColours]=useState(false),[zoom,setZoom]=useState(100);
  const onBoundaries=useCallback((loops:BoundaryLoop[])=>setBoundaries(loops),[]);
  const [edits,setEdits]=useState<PanellingSeam[]|null>(null);
  const seam=useMemo<PanellingSeam[]>(()=>{
    if(!boundaries.length)return [];
    const id=mode==='Left sleeve only'?'sleeveLeft':'base';const loops=boundaries.filter(b=>b.surfaceId===id);
    const pts=loops.flatMap(b=>b.points), minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
    const y=mode==='Across all three'?700:minY+(maxY-minY)*(id==='base'?.56:.58);
    const xs=intersections(mode==='Across all three'?boundaries.filter(b=>['base','sleeveLeft','sleeveRight'].includes(b.surfaceId!)):loops,y);
    if(xs.length<2)return [];
    const left=xs[0],right=xs.at(-1)!,width=right-left;
    return [{id:'review-seam',label:mode,construction:'standard',anchors:[{id:'a',x:left,y},{id:'b',x:left+width*.33,y:y+12},{id:'c',x:left+width*.66,y:y-12},{id:'d',x:right,y}]}];
  },[boundaries,mode]);
  const graph=useMemo(()=>recomputeGarmentPanellingTopology(boundaries,edits??seam),[boundaries,edits,seam]);
  const baseline=useMemo(()=>recomputeGarmentPanellingTopology(boundaries,[]),[boundaries]);
  const counts=['base','sleeveLeft','sleeveRight'].map(id=>[id,graph.panels.filter(p=>p.parentId===id).length]);
  const error=Math.max(0,...baseline.panels.map(p=>Math.abs(graph.panels.filter(q=>q.parentId===p.parentId).reduce((a,q)=>a+q.area,0)-p.area)));
  const panels=graph.panels.map((p,i)=>({...p,fillOverride:colours&&p.seamIds.length?['#648cb7','#88a991'][i%2]:undefined}));
  return <main style={{height:'100dvh',background:'#08090b',color:'white',fontFamily:'Arial',display:'flex',flexDirection:'column'}}>
    <header style={{padding:'16px 24px',borderBottom:'1px solid #292929',display:'flex',gap:16,alignItems:'center'}}><strong>Panelling · topology review</strong>{['Body only','Left sleeve only','Across all three'].map(name=><button key={name} onClick={()=>{setMode(name);setEdits(null)}} style={{padding:'8px 14px',background:mode===name?'#bd2b26':'#222',border:0,borderRadius:6}}>{name}</button>)}<label><input type="checkbox" checked={colours} onChange={e=>setColours(e.target.checked)}/> Show panel colours</label></header>
    <div style={{display:'flex',flex:1,minHeight:0}}><aside style={{width:260,padding:24,borderRight:'1px solid #292929'}}><h1 style={{fontSize:22,marginBottom:24}}>{mode}</h1><p>One continuous seam · four anchors</p><div style={{marginTop:24}}>{counts.map(([id,count])=><p key={id} data-count={id}>{id}: {count} panels</p>)}</div><p style={{marginTop:24}}>Default: inherited garment colour</p><p data-area-error={error}>Area error: {error.toFixed(4)} units²</p><p>Regression checks: {tests.length} passed</p><label>Zoom <select aria-label="Review zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option>100</option><option>150</option><option>200</option></select>%</label><pre id="review-data" style={{display:'none'}}>{JSON.stringify({boundaries,graph,baseline,seam,counts,error})}</pre></aside>
    <div style={{flex:1,minWidth:0,padding:24,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',containerType:'size'}}><div className="relative aspect-square h-[min(100cqh,100cqw)] w-[min(100cqh,100cqw)] shrink-0" style={{transform:'scale('+zoom/100+')'}}><PanellingCanvas className="builder-panelling-canvas h-full w-full" surfaceAware garmentMarkup={PANELLING_GARMENT_MARKUP} parentSurfaceId="base" parentLabel="Body" parentFill="#5c84b2" boundaries={boundaries} symmetryAxis={1024} seams={edits??seam} panels={panels} mirror={false} tool="pen" selectedPanelId={null} onSeamsChange={setEdits} onPanelSelect={noop} onBoundariesChange={onBoundaries} onDrawingStateChange={noop} onSelectionChange={noop}/></div></div></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Review/>);
