import type {PanelRegion,PanellingPoint} from '../features/panelling/panellingTypes';
import {pointInLoop} from '../features/panelling/panellingGeometry';
/** Extend the adjacent panel's paint into the retired button-placket notch. */
export function poloRepairPanel(panels:PanelRegion[],point:PanellingPoint){
 const candidates=panels.filter(panel=>panel.parentId==='base'&&(panel.seamIds.length>0||panel.fillOverride)&&panel.points.length>2);
 const containing=candidates.find(panel=>pointInLoop(point,panel.points));if(containing)return containing;
 const distance=(panel:PanelRegion)=>Math.min(...panel.points.map((a,i)=>{const b=panel.points[(i+1)%panel.points.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy)}));
 return candidates.reduce<PanelRegion|undefined>((best,panel)=>!best||distance(panel)<distance(best)?panel:best,undefined);
}
