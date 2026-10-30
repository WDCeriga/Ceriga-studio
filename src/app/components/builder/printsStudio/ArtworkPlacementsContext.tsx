import {createContext,useContext,useMemo,useState,useEffect,type ReactNode} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import type {ArtworkPlacements,ArtworkPlacement} from '../../../lib/artworkPlacements';
import type {ArtworkSlotOverrides} from '../../../lib/artworkColourSlots';

import {measureText} from '../../../lib/textMetrics';
import {loadFontLibrary} from './designLibrary';
import type {ArtworkCheckMeasurements} from '../../../lib/artworkPlacementChecks';
type PlacementContext={sourceElements:DesignElement[];onCommit:(elements:DesignElement[],document:ArtworkPlacements,id?:string)=>void;measurements:ArtworkCheckMeasurements;document:ArtworkPlacements;elements:DesignElement[];overrides:ArtworkSlotOverrides;colourwayId?:string;selectedId:string|null;focusRequest:number;select:(id:string|null,focus?:boolean)=>void;onDocument:(document:ArtworkPlacements)=>void;onElements:(elements:DesignElement[],id?:string)=>void;onOverrides:(overrides:ArtworkSlotOverrides)=>void;onSelectArtwork:(id:string|null)=>void;onSide:(side:'front'|'back')=>void};
const Context=createContext<PlacementContext|null>(null);
export function ArtworkPlacementsProvider({children,...props}:Omit<PlacementContext,'selectedId'|'focusRequest'|'select'|'measurements'>&{children:ReactNode}){
 const [selectedId,setSelectedId]=useState<string|null>(null),[focusRequest,setFocusRequest]=useState(0);
 const [measurements,setMeasurements]=useState<ArtworkCheckMeasurements>({});
 const measurementKey=JSON.stringify([props.elements,props.document.unitsPerCm]);
 useEffect(()=>{let active=true;const timer=setTimeout(()=>{void(async()=>{const next:ArtworkCheckMeasurements={};const walk=async(elements:DesignElement[])=>{for(const element of elements){if(element.hidden||element.tracingReference||element.sketchOnly)continue;if(element.type==='text')try{const metrics=await measureText(element,loadFontLibrary());next[element.id]={capMm:metrics.capHeight*10/props.document.unitsPerCm,strokeMm:metrics.strokeWidth===undefined?undefined:metrics.strokeWidth*10/props.document.unitsPerCm,missing:metrics.missing};}catch(error){next[element.id]={error:error instanceof Error?error.message:'Font could not be read.'}}if(element.type==='image'&&!element.imagePixels)try{const image=new Image();image.src=element.content;await image.decode();next[element.id]={pixels:{width:image.naturalWidth,height:image.naturalHeight}}}catch{next[element.id]={error:'Image source could not be read.'}}if(element.children)await walk(element.children);}};await walk(props.elements);if(active)setMeasurements(next)})()},180);return()=>{active=false;clearTimeout(timer)}},[measurementKey]);
 const value=useMemo(()=>({...props,measurements,selectedId:props.document.placements.some(item=>item.id===selectedId)?selectedId:null,focusRequest,select:(id:string|null,focus=false)=>{setSelectedId(id);if(focus){setFocusRequest(value=>value+1);props.onSelectArtwork(null);const placement=props.document.placements.find(item=>item.id===id);if(placement)props.onSide(placement.side);}}}),[measurements,props.sourceElements,props.onCommit,props.document,props.elements,props.overrides,props.colourwayId,selectedId,focusRequest,props.onDocument,props.onElements,props.onOverrides,props.onSelectArtwork,props.onSide]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useArtworkPlacements=()=>useContext(Context);
export function updatePlacement(context:PlacementContext,id:string,patch:Partial<ArtworkPlacement>){context.onDocument({...context.document,placements:context.document.placements.map(item=>item.id===id?{...item,...patch}:item)});}

export function useCanonicalArtworkElements(elements:DesignElement[],enabled=true){const context=useArtworkPlacements();return enabled&&context?elements.map(element=>context.sourceElements.find(source=>source.id===element.id)??element):elements;}
