import {useCallback,useEffect,useState} from 'react';
import {getSupabase} from './supabaseClient';
import {useAuth} from '../contexts/AuthContext';
import type {WorkerPermissions} from './platformWorkerCatalog';
export async function workerRpc(name:string,args:Record<string,unknown>={}){const{data,error}=await getSupabase().rpc(name,args);if(error)throw new Error(error.message);return data;}
export type WorkerContext={status:string;superadmin?:boolean;permissions:WorkerPermissions;name?:string;email?:string;roleName?:string;needsPassword?:boolean};
export function useWorkerContext(){const{user,authReady}=useAuth(),[context,setContext]=useState<WorkerContext|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);const refresh=useCallback(async()=>{if(!user){setContext(null);setLoading(false);return;}try{setContext(await workerRpc('platform_worker_context'));setError('');}catch(e){setContext(null);setError((e as Error).message);}finally{setLoading(false);}},[user?.id]);useEffect(()=>{if(!authReady)return;void refresh();const t=setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('ceriga-workers-updated',refresh);return()=>{clearInterval(t);window.removeEventListener('focus',refresh);window.removeEventListener('ceriga-workers-updated',refresh);};},[refresh,authReady]);return{context,error,loading,refresh};}
export const workerChanged=()=>window.dispatchEvent(new Event('ceriga-workers-updated'));
export const workerPanel='rounded-xl border border-white/10 bg-[#111113] p-5';
export const workerField='mt-1 block w-full rounded-lg border border-white/15 bg-[#171719] p-2.5 text-sm';
export const workerButton='rounded-lg bg-[#CC2D24] px-4 py-2 text-sm text-white disabled:opacity-40';
