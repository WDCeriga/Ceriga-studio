import {Check,ChevronDown,Layers} from 'lucide-react';
import type {DesignElement} from '../PrintStudioEditor';
import {useAssetWorkspaceContext} from '../printsStudio/AssetWorkspace';
import {productionOptions,isFabricArtwork} from '../../../lib/artworkProduction';
import {StudioFold} from './StudioControls';
import './artwork-production.css';
export function ArtworkPrintMethod({element,update,initiallyOpen=true}:{element:DesignElement;update:(patch:Partial<DesignElement>)=>void;initiallyOpen?:boolean}){
 const workspace=useAssetWorkspaceContext();if(workspace?.project||element.type==='distress'||element.type==='group')return null;
 const fabric=isFabricArtwork(element),methods=productionOptions(element),current=element.printMethod??(fabric?'Fabric Print':'DTG');
 const selected=methods.find(method=>method.id===current),invalid=!selected?.available;
 const repeat=element.type==='pattern'||element.type==='customArea'&&Boolean(element.customAreaPattern);
 return <StudioFold title="Production method" hint={invalid?'Choose a suitable method':current} open={initiallyOpen||invalid}>
  {fabric?<div className="production-fabric-summary"><div className="production-fabric-heading"><span className="production-fabric-icon"><Layers size={19} strokeWidth={1.5}/></span><span><strong>Fabric print</strong><small>Printed into the garment fabric</small></span><span className="production-fabric-badge">Fabric fill</span></div>{invalid?<button className="production-fabric-confirm" disabled={element.locked} onClick={()=>update({printMethod:'Fabric Print'})}><Check size={14}/>Use fabric print</button>:<div className="production-fabric-applied"><Check size={13}/><span>Applied to {element.patternTarget==='sleeveLeft'?'left sleeve':element.patternTarget==='sleeveRight'?'right sleeve':element.patternTarget==='base'||element.patternTarget==='body'?'body':element.patternTarget?'this garment part':'the garment'}</span></div>}<details className="production-fabric-details"><summary>Fabric & process<ChevronDown size={14}/></summary><p>{methods.find(method=>method.id==='Fabric Print')?.note}</p><small>The maker confirms the process for your fabric.</small></details></div>:<>
  {repeat&&<p className="production-coverage-label">{fabric?'Fabric fill':'Placed fabric'}</p>}
  <p className="print-method-help">{fabric?'A repeat covering fabric is produced before garment assembly.':'Choose how this graphic will be applied to the garment.'}</p>
  {invalid&&<div className="production-review" role="status"><strong>Review this saved method</strong><p>{selected?.note??'This saved process is not supported here. Choose a production method below.'}</p></div>}
  <div className="advanced-finish-grid production-method-grid">{methods.filter(method=>method.available).map(method=><button key={method.id} disabled={element.locked} aria-pressed={current===method.id} onClick={()=>update({printMethod:method.id})}><strong>{method.id}</strong><small>{method.label}</small></button>)}</div>
  {selected?.available&&<div className="production-process-note"><strong>{current==='Fabric Print'?'Fabric & process':current==='Embroidery'?'Stitch preparation':current==='Puff Print'?'Raised ink preparation':'Production notes'}</strong><p>{selected.note}</p></div>}
  <p className="production-preview-note">Final size and fabric are checked before production.</p>
  </>}
 </StudioFold>
}
