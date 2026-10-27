import{useFactoryAccess}from '../contexts/FactoryAccessContext';
import{currentFactoryId}from './factoryTeam';
import{privateAssetUrl}from './privateAssetUrls';
import {useCallback,useEffect,useRef,useState}from 'react';
import {useAuth}from '../contexts/AuthContext';
import {getSupabase}from './supabaseClient';
import {prepareQcFile}from './qcReportFiles';
export const fieldClass='mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white';
export const actionClass='min-h-11 rounded-xl bg-[#CC2D24] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40';
export async function featureAction(name:string,parameters:Record<string,unknown>){const{data,error}=await getSupabase().rpc(name,parameters);if(error)throw new Error(error.message);if(data===null||data===undefined)throw new Error('The database did not confirm this action');window.dispatchEvent(new Event('ceriga-manufacturer-data-updated'));return data;}
export function useDatabaseRows<T>(table:string,owner?:string,sort='created_at'){
 const{access}=useFactoryAccess();const {user}=useAuth();const scopedOwner=owner===user?.id&&access?.factoryId?access.factoryId:owner;const key=`${user?.id||''}:${table}:${scopedOwner||''}:${sort}`;const active=useRef(key);active.current=key;
 const [rows,setRows]=useState<T[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[limit,setLimit]=useState(100);
 const refresh=useCallback(async()=>{const requested=key;try{let query=getSupabase().from(table).select('*').order(sort,{ascending:false}).range(0,limit-1);if(scopedOwner)query=query.eq('manufacturer_id',scopedOwner);const{data,error}=await query;if(error)throw new Error(error.message);if(active.current===requested){setRows(data||[]);setError('');}}catch(cause){if(active.current===requested)setError(cause instanceof Error?cause.message:'Could not load factory data');}finally{if(active.current===requested)setLoading(false);}},[key,limit]);
 useEffect(()=>{setRows([]);setLoading(true);void refresh();const reload=()=>{if(document.visibilityState==='visible')void refresh();};window.addEventListener('ceriga-manufacturer-data-updated',reload);window.addEventListener('focus',reload);const timer=setInterval(reload,30000);return()=>{clearInterval(timer);window.removeEventListener('focus',reload);window.removeEventListener('ceriga-manufacturer-data-updated',reload);};},[refresh]);
 return{rows,loading,error,refresh,more:()=>setLimit(v=>v+100),hasMore:rows.length===limit};
}
export async function uploadManufacturerAsset(file:File,photo=false){const prepared=await prepareQcFile(file,photo);const client=getSupabase();const{data:{user},error}=await client.auth.getUser();if(error||!user)throw new Error('Sign in to upload documents');const path=`${await currentFactoryId()}/${crypto.randomUUID()}/${prepared.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const response=await client.storage.from('manufacturer-assets').upload(path,prepared,{contentType:prepared.type,upsert:false});if(response.error)throw new Error(response.error.message);return path;}
export async function manufacturerAssetUrl(path:string){return privateAssetUrl('manufacturer-assets',path,60);}
export async function openManufacturerAsset(path:string){const url=await manufacturerAssetUrl(path);const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.click();}
