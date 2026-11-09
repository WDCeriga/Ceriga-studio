import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {PackagingPanel} from '../../data/packaging';
const Context=createContext({panel:null as PackagingPanel|null,setPanel:(_panel:PackagingPanel|null)=>{}});
export const usePackagingPanelPreview=()=>useContext(Context);
export function PackagingPanelPreviewProvider({enabled,children}:{enabled:boolean;children:ReactNode}) {
  const [panel,setPanel]=useState<PackagingPanel|null>(null);
  useEffect(()=>{if(!enabled)setPanel(null)},[enabled]);
  return <Context.Provider value={{panel:enabled?panel:null,setPanel}}>{children}</Context.Provider>;
}
