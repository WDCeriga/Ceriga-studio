import {fabricCategoryForPart,type FabricPart} from '../../data/garmentFabrics';
import type {PanelRegion,PanellingSeam} from './panellingTypes';

/** Seam panels keep stable topology IDs and inherit their source piece until assigned. */
export function withPanellingFabricParts(parts:FabricPart[],panels:PanelRegion[]):FabricPart[]{
 const result=[...parts];
 for(const panel of panels.filter(panel=>panel.seamIds.length>0)){
  if(result.some(part=>part.id===panel.id))continue;
  const parent=parts.find(part=>part.id===panel.parentId);
  result.push({id:panel.id,label:`${panel.label} · ${panel.view==='back'?'Back':'Front'}`,role:'panel',parentId:panel.parentId,materialCategory:parent?fabricCategoryForPart(parent):undefined,interior:parent?.interior});
 }
 return result;
}
/** Removing a panel removes its separating seams; it never cuts a hole in the garment. */
export function seamsWithoutPanel(seams:PanellingSeam[],panel:PanelRegion):PanellingSeam[]{
 const ids=new Set(panel.seamIds.flatMap(id=>[id,id.replace(/:mirror$/,'')]));
 const groups=new Set(seams.filter(seam=>ids.has(seam.id)).map(seam=>seam.mirrorGroupId).filter(Boolean));
 return seams.filter(seam=>!ids.has(seam.id)&&!(seam.mirrorGroupId&&groups.has(seam.mirrorGroupId)));
}

export function inPanellingScope(item:{fit?:string;view?:'front'|'back'},fit:string,view:'front'|'back',legacyFit:string){return (item.fit??legacyFit)===fit&&(item.view??'front')===view;}
export function scopedPanelId(fit:string,view:'front'|'back',id:string){return `${view}:${encodeURIComponent(fit)}:${id}`;}

/** Adopt geometry-keyed assignments once when opening projects made before stable seam-face IDs. */
export function adoptPanellingAssignments<T extends {partColors?:Partial<Record<string,string>>;panellingPanelColours?:Record<string,string>;fabricAssignments?:import('../../data/garmentFabrics').FabricAssignments}>(state:T,panels:PanelRegion[],legacyFit:string):T{
 let changed=false;const colours={...state.partColors},panelColours={...state.panellingPanelColours},fabrics={...state.fabricAssignments?.assignments};
 for(const panel of panels){if(!panel.legacyId)continue;const aliases=[panel.legacyId];if(panel.fit===legacyFit)aliases.push(panel.legacyId.replace((panel.view??'front')+':'+encodeURIComponent(panel.fit)+':',(panel.view??'front')+':'));
  for(const [target,source] of [[colours,state.partColors],[panelColours,state.panellingPanelColours],[fabrics,state.fabricAssignments?.assignments]] as const){if(target[panel.id])continue;const alias=aliases.find(id=>source?.[id]);if(alias){target[panel.id]=source![alias]!;changed=true;}}
 }
 return changed?{...state,partColors:colours,panellingPanelColours:panelColours,...(state.fabricAssignments?{fabricAssignments:{...state.fabricAssignments,assignments:fabrics}}:{})}:state;
}
