import type {GarmentDetail} from '../../data/garmentDetails';
import type {PanellingSeam} from './panellingTypes';
/** Includes panel zips saved before sourceSeamId was introduced. */
export function zipBelongsToSeam(detail:GarmentDetail,seam:PanellingSeam,view:'front'|'back'){
 if(detail.type!=='zip'||!detail.opening||(detail.view??'front')!==view)return false;
 if(detail.opening.sourceSeamId)return detail.opening.sourceSeamId===seam.id;
 const curve=detail.opening.curve;
 return Boolean(curve?.length===seam.anchors.length&&curve.every((point,i)=>Math.hypot(point.x-seam.anchors[i].x,point.y-seam.anchors[i].y)<.01));
}
