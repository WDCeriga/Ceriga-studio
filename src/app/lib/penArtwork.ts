import type {DesignElement} from '../components/builder/PrintStudioEditor';
import type {ShapePath} from './shapeGeometry';
import {fitPenPath} from './artworkPathOperations';
/** Closing describes geometry, never a request to paint its interior or boundary. */
export function createPenArtwork(path:ShapePath,color:string,side:'front'|'back',id=crypto.randomUUID()):DesignElement{
 return {id,type:'shape',content:'custom-path',...fitPenPath(path,2),shapeGeometry:'bounds',rotation:0,color,shapeFilled:false,borderWidth:2,shapeStrokeColor:'#000000',opacity:100,side,aspectLocked:false};
}
/** Fill and outline are independent, including when both are disabled. */
export function shapePaintPatch(element:DesignElement,kind:'fill'|'outline',enabled:boolean,outlineWidth=2):Partial<DesignElement>{
 return kind==='fill'?{shapeFilled:enabled,...(enabled?{shapeFillColor:element.shapeFillColor??element.color??'#262626'}:{})}:{borderWidth:enabled?outlineWidth:0,...(enabled?{shapeStrokeColor:element.shapeStrokeColor??element.color??'#262626'}:{})};
}
