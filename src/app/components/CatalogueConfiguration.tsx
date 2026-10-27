import{useEffect,useState,type ReactNode}from'react';
import{getSupabase,isSupabaseConfigured}from'../lib/supabaseClient';
import{hydrateCatalogueConfiguration}from'../data/crmCatalogMock';
import{useAuth}from'../contexts/AuthContext';
export function CatalogueConfiguration({children}:{children:ReactNode}){
 const{user}=useAuth();const[ready,setReady]=useState(!isSupabaseConfigured),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!isSupabaseConfigured)return;let active=true;setReady(false);setError('');void getSupabase().rpc('portal_configuration').then(({data,error})=>{if(!active)return;if(error)setError(error.message);else{hydrateCatalogueConfiguration(data||{});setReady(true);}});return()=>{active=false;};},[user?.id,retry]);
 if(error)return <div role="alert" className="min-h-screen bg-[#09090b] p-8 text-white"><p>Could not load the product catalogue: {error}</p><button className="mt-4 rounded bg-[#CC2D24] px-4 py-2" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>;
 if(!ready)return <p role="status" className="min-h-screen bg-[#09090b] p-8 text-white/60">Loading catalogue…</p>;
 return children;
}
