import {createContext,useContext,type Dispatch,type SetStateAction} from 'react';
export const LABEL_TOOLS=['Your labels','Design','Construction & size','Placement'] as const;
export const PACKAGING_TOOLS=['Packaging type','Design','Material & size'] as const;
export const StudioWorkflowContext=createContext({tool:'Your labels',setTool:(_s:string)=>{},selection:null as string|null,setSelection:(_s:string|null)=>{},controlsHost:null as HTMLElement|null,setControlsHost:((_s:HTMLElement|null)=>{}) as Dispatch<SetStateAction<HTMLElement|null>>});
export const useStudioWorkflow=()=>useContext(StudioWorkflowContext);
