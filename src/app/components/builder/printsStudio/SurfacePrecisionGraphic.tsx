import type{DesignElement}from'../PrintStudioEditor';import{precisionMarkup,scopeSvgMarkup}from'../../../lib/svgPrecision';
export function SurfacePrecisionGraphic({element}:{element:DesignElement}){return <div className="h-full w-full" style={{width:'100%',height:'100%',pointerEvents:'none'}} dangerouslySetInnerHTML={{__html:scopeSvgMarkup(precisionMarkup(element,true),element.id)}}/>}
