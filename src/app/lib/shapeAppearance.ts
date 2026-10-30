import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {shapeToEditablePath} from './shapeGeometry';
import {paintOutlinedText,localAppearanceSource,type TextAppearanceItem} from './textAppearance';
export function shapeAppearance(element:DesignElement,units=element.textUnitsPerCm??10):TextAppearanceItem[]{return element.artworkAppearance??[
 {id:'shape-fill',type:'fill',enabled:element.shapeFilled??false,colour:element.shapeFillColor??element.color??'#171717'},
 {id:'shape-stroke',type:'stroke',enabled:(element.borderWidth??(element.shapeFilled?0:4))>0,colour:element.shapeStrokeColor??element.color??'#171717',widthMm:(element.borderWidth??(element.shapeFilled?0:4))*10/units,join:element.shapeStrokeJoin??'round',position:element.shapeStrokeAlign??'center'},
];}
export function expandShapeAppearance(element:DesignElement,byColour=false):DesignElement{
 const units=element.textUnitsPerCm??10,base={...localAppearanceSource(element),x:element.width/2,y:element.height/2,rotation:0,flipHorizontal:false,flipVertical:false,shapePath:shapeToEditablePath(element),artworkAppearance:undefined,shapeEffects:undefined,letteringPaints:undefined,opacity:100};
 return {...paintOutlinedText({...element,textAppearance:shapeAppearance(element,units),textUnitsPerCm:units},base,byColour),artworkAppearance:undefined,textAppearance:undefined};
}
