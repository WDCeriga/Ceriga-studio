import {createContext,useContext,useMemo,useRef,type ReactNode} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import type {ArtworkSlotOverrides} from '../../../lib/artworkColourSlots';
type ArtworkContextValue={sourceElements:DesignElement[];overrides:ArtworkSlotOverrides;colourwayId?:string;onOverrides:(overrides:ArtworkSlotOverrides)=>void;onSelectArtwork:(id:string|null)=>void};
const Context=createContext<ArtworkContextValue|null>(null);
export function ArtworkProvider({children,sourceElements,overrides,colourwayId,onOverrides,onSelectArtwork}:ArtworkContextValue&{children:ReactNode}){
 const handlers=useRef({onOverrides,onSelectArtwork});handlers.current={onOverrides,onSelectArtwork};
 const value=useMemo<ArtworkContextValue>(()=>({sourceElements,overrides,colourwayId,onOverrides:next=>handlers.current.onOverrides(next),onSelectArtwork:id=>handlers.current.onSelectArtwork(id)}),[sourceElements,overrides,colourwayId]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useArtwork=()=>useContext(Context);
export function useCanonicalArtworkElements(elements:DesignElement[],enabled=true){const context=useArtwork();return useMemo(()=>enabled&&context?elements.map(element=>context.sourceElements.find(source=>source.id===element.id)??element):elements,[elements,enabled,context?.sourceElements]);}
