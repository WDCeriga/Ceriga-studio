import type {AssetMeasurement} from '../../components/builder/CustomAssetMeasurements';
import type {DetailBounds} from '../../data/garmentDetails';
import type {PanelRegion,PanellingSeam} from './panellingTypes';
import {flattenSeam,projectToSegment} from './panellingGeometry';
import {linkedMirrorSeams} from './panellingMirroring';

/** Dimensions are live extents of the seam-defined piece, calibrated to the body reference. */
export function measurePanellingPanels(panels:PanelRegion[],seams:PanellingSeam[],mirror:boolean,bounds:DetailBounds,referenceWidthCm:number,view:'front'|'back'):AssetMeasurement[]{
 const scale=referenceWidthCm/(bounds.maxX-bounds.minX);
 if(!Number.isFinite(scale)||scale<=0)return [];
 const visible=linkedMirrorSeams(seams,1024,mirror);
 return panels.filter(panel=>panel.seamIds.length>0&&panel.points.length>2&&(panel.view??view)===view).map(panel=>{
  const xs=panel.points.map(p=>p.x),ys=panel.points.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),center={x:(left+right)/2,y:(top+bottom)/2};
  const liesOnPanel=(point:{x:number;y:number})=>panel.points.some((a,index)=>{const hit=projectToSegment(point,a,panel.points[(index+1)%panel.points.length]);return Math.hypot(point.x-hit.point.x,point.y-hit.point.y)<=2;});
  const seamLength=visible.filter(seam=>panel.seamIds.includes(seam.id)).reduce((sum,seam)=>{const points=flattenSeam(seam,96);return sum+points.slice(1).reduce((length,point,index)=>length+(liesOnPanel({x:(point.x+points[index].x)/2,y:(point.y+points[index].y)/2})?Math.hypot(point.x-points[index].x,point.y-points[index].y):0),0)},0)*scale;
  return {id:'panel:'+panel.id,sourceId:panel.id,name:panel.label,kind:'seam panel',view,corners:[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}],center,width:(right-left)*scale,height:(bottom-top)*scale,rotation:0,left:(center.x-bounds.minX)*scale,top:(center.y-bounds.minY)*scale,centerOffset:(center.x-(bounds.minX+bounds.maxX)/2)*scale,cmPerUnit:scale,referenceWidthCm,bounds,readOnly:true,outlinePath:panel.path,seamLength,areaCm2:panel.area*scale*scale};
 });
}
