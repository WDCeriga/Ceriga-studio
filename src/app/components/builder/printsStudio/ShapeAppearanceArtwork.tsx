import {useMemo} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import {expandShapeAppearance} from '../../../lib/shapeAppearance';
import {DesignGroupArtwork} from './DesignGroupArtwork';
import {StudioGraphic} from './StudioGraphic';
export function ShapeAppearanceArtwork({element}:{element:DesignElement}){const key=JSON.stringify(element),result=useMemo(()=>{try{return{element:expandShapeAppearance(element)}}catch(error){return{error:error instanceof Error?error.message:'Could not build this appearance.'}}},[key]);return result.element?<DesignGroupArtwork element={result.element}/>:<div><StudioGraphic element={{...element,artworkAppearance:undefined}}/><span data-editor-chrome role="alert">{result.error}</span></div>;}
