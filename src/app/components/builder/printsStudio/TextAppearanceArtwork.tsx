import {useEffect,useState} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import {expandTextAppearance} from '../../../lib/textAppearance';
import {DesignGroupArtwork} from './DesignGroupArtwork';
import {loadFontLibrary} from './designLibrary';
import {TextEffectsArtwork} from './TextEffectsArtwork';
export function TextAppearanceArtwork({element,onDoubleClick,onFrameChange}:{element:DesignElement;onDoubleClick?:React.MouseEventHandler<HTMLDivElement>;onFrameChange?:(frame:{width:number;height:number})=>void}){
  const [result,setResult]=useState<DesignElement>(),[error,setError]=useState(''),[fontRevision,setFontRevision]=useState(0),key=JSON.stringify(element);
  useEffect(()=>{const changed=()=>setFontRevision(value=>value+1);window.addEventListener('ceriga-font-library-change',changed);return()=>window.removeEventListener('ceriga-font-library-change',changed)},[]);
  useEffect(()=>{let live=true;expandTextAppearance(element,loadFontLibrary(),false,true).then(value=>{if(live){setResult(value);setError('')}},reason=>{if(live)setError(reason.message)});return()=>{live=false}},[key,fontRevision]);
  useEffect(()=>{if(result&&element.textFrameMode==='point'&&!element.textBadge&&!element.textStackFit)onFrameChange?.({width:element.autoWidth===false?element.width:result.textLayoutWidth??element.width,height:element.autoHeight===false?element.height:result.textLayoutHeight??element.height})},[result]);
  const artwork=error?<span role="alert">{error}</span>:result?<DesignGroupArtwork element={result}/>:null;
  return <div data-vector-text data-text-appearance style={{width:element.width,height:element.height,position:'relative',overflow:'visible'}} onDoubleClick={onDoubleClick}>{element.textEffects?.some(effect=>effect.enabled)?<TextEffectsArtwork effects={element.textEffects} sourceKey={key} width={element.width} height={element.height} text={element.content}>{artwork}</TextEffectsArtwork>:artwork}</div>;
}
