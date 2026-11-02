import {SuperAdminDashboardView} from './SuperAdminDashboardView';
import {ManufacturerDashboardView} from './ManufacturerDashboardView';
import{useFactoryAccess}from '../../contexts/FactoryAccessContext';
import {useEffect,useState} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {getSupabase,isSupabaseConfigured} from '../../lib/supabaseClient';
import {useCurrency} from '../../lib/accountCurrency';
import {type DashboardData} from '../../lib/dashboard';

export function OperationsDashboard({admin=false}:{admin?:boolean}){
 const{access,ready:factoryReady}=useFactoryAccess();
 const{user,authReady}=useAuth();useCurrency();
 const[days,setDays]=useState(30),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[stage,setStage]=useState('all'),[sort,setSort]=useState('desc'),[tick,setTick]=useState(0);
 const[loaded,setLoaded]=useState<{key:string;data:DashboardData}|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');const accountKey=`${user?.id||''}:${admin}:${admin?'':access?.factoryId||''}`;const data=loaded?.key===accountKey?loaded.data:null;
 useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim()),300);return()=>clearTimeout(timer);},[search]);
 useEffect(()=>{let active=true,inFlight=false,pending=false;const abort=new AbortController();let scheduled:ReturnType<typeof setTimeout>|undefined;setError('');
  if(!authReady||(!admin&&!factoryReady))return;if(!isSupabaseConfigured||!user?.id){setLoading(false);setError(isSupabaseConfigured?'Sign in to load your dashboard.':'Connect the database to load your dashboard.');return;}
  const load=async()=>{if(inFlight){pending=true;return;}inFlight=true;setLoading(true);try{const{data:next,error}=await getSupabase().rpc('portal_dashboard',{p_admin:admin,p_days:days,p_search:query,p_stage:stage,p_sort:sort}).abortSignal(abort.signal);if(!active)return;if(error)throw new Error(error.message);if(!next||next.audience!==(admin?'admin':'manufacturer'))throw new Error('The dashboard did not return the expected account data');setLoaded({key:accountKey,data:next as DashboardData});setError('');}catch(cause){if(active)setError(cause instanceof Error?cause.message:'Could not load dashboard data');}finally{inFlight=false;if(active){setLoading(false);if(pending){pending=false;scheduled=setTimeout(()=>void load(),250);}}}};
  void load();const update=()=>{if(document.visibilityState==='visible')void load();};const events=['focus','ceriga-orders-updated','ceriga-qc-updated','ceriga-manufacturer-data-updated'];events.forEach(event=>window.addEventListener(event,update));const timer=setInterval(update,30000);return()=>{active=false;abort.abort();clearInterval(timer);clearTimeout(scheduled);events.forEach(event=>window.removeEventListener(event,update));};
 },[authReady,factoryReady,accountKey,days,query,stage,sort,tick]);
 if(!admin)return <ManufacturerDashboardView data={data} loading={loading} error={error} days={days} search={search} stage={stage} sort={sort} permissions={access?.permissions||[]} onDays={setDays} onSearch={setSearch} onStage={setStage} onSort={()=>setSort(v=>v==='desc'?'asc':'desc')} onRefresh={()=>setTick(n=>n+1)}/>;
 return <SuperAdminDashboardView data={data} loading={loading} error={error} days={days} search={search} stage={stage} sort={sort} onDays={setDays} onSearch={setSearch} onStage={setStage} onSort={()=>setSort(v=>v==='desc'?'asc':'desc')} onRefresh={()=>setTick(n=>n+1)}/>;
}
