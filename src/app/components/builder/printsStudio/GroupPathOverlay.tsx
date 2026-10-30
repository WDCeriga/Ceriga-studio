import {useEffect,type ReactNode} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import type {ShapePath} from '../../../lib/shapeGeometry';
import {shapeToEditablePath} from '../../../lib/shapeGeometry';
import {reframeEditedPath} from '../../../lib/artworkPathOperations';
import {ShapePathEditor} from './ShapePathEditor';
import {usePrintsStudio} from './PrintsStudioContext';
export function GroupPathOverlay({root,scale,onChange,onPreview}:{root:DesignElement;scale:number;onChange:(patch:Partial<DesignElement>)=>void;onPreview:(id:string,path:ShapePath|null)=>void}){
 const studio=usePrintsStudio(),id=studio.logoRegionEditing?.rootId===root.id?studio.logoRegionEditing.regionId:null;
 useEffect(()=>()=>{if(id)onPreview(id,null)},[id]);
 if(!id||root.logoTrace)return null;
 const ancestry:DesignElement[]=[];
 const find=(element:DesignElement):boolean=>{if(element.id===id){ancestry.push(element);return true;}for(const child of element.children??[])if(find(child)){ancestry.unshift(element);return true;}return false;};
 if(!find(root))return null;const child=ancestry.at(-1)!;if(child.type!=='shape'||child.locked||!child.shapePath)return null;
 const patch=(path:ShapePath)=>{const visit=(element:DesignElement):DesignElement=>element.id===id?{...element,...reframeEditedPath(element,path),shapeCornerRadius:0}:element.children?{...element,children:element.children.map(visit)}:element;onChange({children:visit(root).children})};
 let actualScale=scale;for(const parent of ancestry.slice(0,-1))actualScale*=Math.min(parent.width/(parent.groupSourceWidth??parent.width),parent.height/(parent.groupSourceHeight??parent.height));
 let overlay:ReactNode=<ShapePathEditor key={child.id} element={{...child,shapePath:shapeToEditablePath(child)}} scale={actualScale} onChange={patch} onPreview={path=>onPreview(child.id,path)} onDone={()=>studio.setLogoRegionEditing(null)}/>;
 for(let index=ancestry.length-1;index>=0;index--){const element=ancestry[index],group=Boolean(element.children),w=element.groupSourceWidth??element.width,h=element.groupSourceHeight??element.height;overlay=<div style={{position:'absolute',left:element.x,top:element.y,width:element.width,height:element.height,transform:`translate(-50%,-50%) rotate(${element.rotation}deg) scale(${element.flipHorizontal?-1:1},${element.flipVertical?-1:1})`,transformOrigin:'center'}}>{group?<div style={{position:'absolute',width:w,height:h,transform:`scale(${element.width/w},${element.height/h})`,transformOrigin:'0 0'}}>{overlay}</div>:overlay}</div>;}
 return <div data-editor-chrome data-group-path-overlay className="absolute inset-0 pointer-events-none" style={{zIndex:80}}>{overlay}</div>;
}
