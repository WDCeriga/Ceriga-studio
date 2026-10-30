import {createContext,useContext} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
export const ArtworkDocumentContext=createContext<{
  elements:DesignElement[];
  onChange:(elements:DesignElement[],selectedId?:string)=>void;
  onSelect:(id:string|null)=>void;
  side:'front'|'back';
}|null>(null);
export const useArtworkDocument=()=>useContext(ArtworkDocumentContext);
