import {createContext,useContext,type ReactNode} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import type {ArtworkSlotOverrides} from '../../../lib/artworkColourSlots';
type ArtworkContextValue={sourceElements:DesignElement[];overrides:ArtworkSlotOverrides;colourwayId?:string;onOverrides:(overrides:ArtworkSlotOverrides)=>void;onSelectArtwork:(id:string|null)=>void};
const Context=createContext<ArtworkContextValue|null>(null);
export function ArtworkProvider({children,...value}:ArtworkContextValue&{children:ReactNode}){return <Context.Provider value={value}>{children}</Context.Provider>}
export const useArtwork=()=>useContext(Context);
export function useCanonicalArtworkElements(elements:DesignElement[],enabled=true){const context=useArtwork();return enabled&&context?elements.map(element=>context.sourceElements.find(source=>source.id===element.id)??element):elements;}
