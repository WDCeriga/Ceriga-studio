import {useId} from 'react';
import {seamPath} from '../../../features/panelling/panellingGeometry';
import {linkedMirrorSeams} from '../../../features/panelling/panellingMirroring';
import type {BoundaryLoop,PanellingSeam,PanelRegion} from '../../../features/panelling/panellingTypes';

/** Finished construction stays visible independently of any page's editing controls. */
export function PanellingReadOnlyOverlay({seams,mirror,colour='#141414',boundaries=[]}:{seams:PanellingSeam[];panels?:PanelRegion[];mirror:boolean;colour?:string;boundaries?:BoundaryLoop[]}){
 const clipId='saved-seams-'+useId().replace(/:/g,'');
 const boundaryPath=boundaries.map(boundary=>'M'+boundary.points.map(point=>point.x+','+point.y).join('L')+'Z').join(' ');
 return <svg viewBox="0 0 2048 2048" className="absolute inset-0 h-full w-full pointer-events-none" style={{zIndex:90}} aria-label="Saved garment seams">
  {boundaryPath&&<defs><clipPath id={clipId}><path d={boundaryPath} fillRule="nonzero" clipRule="nonzero"/></clipPath></defs>}
  <g clipPath={boundaryPath?`url(#${clipId})`:undefined}>{linkedMirrorSeams(seams,1024,mirror).map(seam=><path key={seam.id} data-construction-seam="" d={seamPath(seam.anchors)} fill="none" stroke={colour} strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>)}</g>
 </svg>;
}
