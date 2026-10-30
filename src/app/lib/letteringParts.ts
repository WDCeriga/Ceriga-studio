import type {DesignElement} from '../components/builder/PrintStudioEditor';
import type {ShapePath} from './shapeGeometry';
import {reframeEditedPath} from './artworkPathOperations';
export type LetteringPart={key:string;label:string};
export function letteringContours(path:ShapePath):ShapePath[]{return [{...path,subpaths:undefined},...(path.subpaths??[]).flatMap(letteringContours)];}
export function canSeparateLettering(element:DesignElement){
  return element.type==='shape'&&!!element.shapePath&&!!element.letteringParts?.length&&!element.locked&&!element.warp&&!element.perspective&&!element.eraseContours?.length&&!element.cropLeft&&!element.cropRight&&!element.cropTop&&!element.cropBottom;
}
function letterShape(element:DesignElement,parts:LetteringPart[],makeId:()=>string):DesignElement{
  const contours=letteringContours(element.shapePath!).filter(p=>parts.some(part=>part.key===p.letterKey));
  if(!contours.length)throw new Error('The selected letter has no outline.');
  const path={...contours[0],subpaths:contours.slice(1)},content=parts.map(p=>p.label).join('');
  return {...element,...reframeEditedPath(element,path),id:makeId(),content:'custom-lettering',layerName:parts.length===1?`Letter ${content}`:'Remaining letters',letteringParts:parts,
    letteringSource:element.letteringSource?{...element.letteringSource,content,letteringParts:undefined}:undefined,shapeOperationSources:undefined,shapeOperationFrame:undefined};
}
/** Preserve every counter and disconnected contour (for example the dot on i). */
export function separateLettering(elements:DesignElement[],id:string,key?:string,copy=false,makeId=()=>crypto.randomUUID()):{elements:DesignElement[];selectedId:string}{
  const element=elements.find(e=>e.id===id);if(!element||!canSeparateLettering(element))throw new Error('Choose unlocked lettering without a crop or distortion.');
  const parts=element.letteringParts!;
  if(letteringContours(element.shapePath!).some(p=>!parts.some(part=>part.key===p.letterKey)))throw new Error('Separate the letters before combining new regions with the word.');
  const chosen=key?parts.filter(p=>p.key===key):parts;if(!chosen.length)throw new Error('Choose a letter first.');
  if(copy){const letter=letterShape(element,chosen,makeId);letter.x+=20;letter.y+=20;letter.layerName=`${letter.layerName} copy`;return {elements:[...elements,letter],selectedId:letter.id};}
  const result=key?[letterShape(element,chosen,makeId),...(parts.length>chosen.length?[letterShape(element,parts.filter(p=>p.key!==key),makeId)]:[])]:parts.map(part=>letterShape(element,[part],makeId));
  return {elements:elements.flatMap(e=>e.id===id?result:[e]),selectedId:result[0].id};
}
/** Associate older outlines by contour order, without replacing edited points. */
export function labelExistingLettering(element:DesignElement,template:Partial<DesignElement>):Partial<DesignElement>{
  if(!element.shapePath||!template.shapePath||!template.letteringParts?.length)throw new Error('The original font outlines are unavailable.');
  const current=letteringContours(element.shapePath),original=letteringContours(template.shapePath);
  if(template.letteringParts.length!==1&&current.length!==original.length)throw new Error('These contours have been combined. Separate letters from a fresh text copy to keep this design intact.');
  const labelled=current.map((p,i)=>({...p,letterKey:template.letteringParts!.length===1?template.letteringParts![0].key:original[i].letterKey}));
  return {shapePath:{...labelled[0],subpaths:labelled.slice(1)},letteringParts:template.letteringParts};
}
