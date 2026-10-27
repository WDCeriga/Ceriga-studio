import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { PortalNotification, PortalNotificationAudience } from './portalNotifications';

type Row = {
  id: string;
  audience: PortalNotificationAudience;
  user_id: string | null;
  category: PortalNotification['category'];
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  created_at: string;
};

function rowToNotification(row: Row): PortalNotification {
  return {
    id: row.id,
    audience: row.audience,
    category: row.category,
    title: row.title,
    body: row.body,
    href: row.href ?? undefined,
    at: row.created_at,
    read: row.read,
  };
}

/** Fetch notifications for the current viewer (RLS scopes superadmin vs manufacturer). */
export async function fetchPortalNotifications(
  audience: PortalNotificationAudience, limit=50,
): Promise<PortalNotification[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (audience === 'manufacturer' && !user) return [];
  if (audience === 'superadmin' && !user) return [];

  const rows:Row[]=[];
  for(let offset=0;offset<limit;offset+=100){const size=Math.min(100,limit-offset);const{data,error}=await supabase.from('portal_notifications').select('*').eq('audience',audience).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+size-1);if(error)throw error;rows.push(...(data||[]) as Row[]);if(!data||data.length<size)break;}
  return rows.map(rowToNotification);
}

export async function markPortalNotificationReadInDb(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from('portal_notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllPortalNotificationsReadInDb(
  audience: PortalNotificationAudience,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from('portal_notifications')
    .update({ read: true })
    .eq('audience', audience)
    .eq('read', false);
  if (error) throw error;
}


export function usePortalNotificationsDb(audience:PortalNotificationAudience,enabled:boolean,accountKey=''){
 const[limit,setLimit]=useState(50);
 const [items,setItems]=useState<PortalNotification[]>([]),[unread,setUnread]=useState(0),[loading,setLoading]=useState(enabled),[error,setError]=useState('');
 const active=useRef('');const key=audience+':'+accountKey+':'+enabled;active.current=key;
 const refresh=useCallback(async()=>{const requestKey=key;if(!enabled){setItems([]);setUnread(0);setLoading(false);return;}try{const [next,count]=await Promise.all([fetchPortalNotifications(audience,limit),getSupabase().from('portal_notifications').select('id',{count:'exact',head:true}).eq('audience',audience).eq('read',false)]);if(active.current!==requestKey)return;if(count.error)throw new Error(count.error.message);setItems(next);setUnread(count.count??0);setError('');}catch(cause){if(active.current===requestKey)setError(cause instanceof Error?cause.message:'Could not load notifications');}finally{if(active.current===requestKey)setLoading(false);}},[audience,enabled,accountKey,limit]);
 useEffect(()=>{setItems([]);setUnread(0);setError('');setLoading(enabled);let current=true;const update=()=>{if(current&&document.visibilityState==='visible')void refresh();};void refresh();if(!enabled)return;const timer=setInterval(update,30000);return()=>{current=false;clearInterval(timer);};},[refresh,enabled]);
 const mutate=useCallback(async(action:()=>Promise<unknown>)=>{try{await action();await refresh();return true;}catch(cause){setError(cause instanceof Error?cause.message:'Notification change failed');return false;}},[refresh]);
 return{items,unread,loading,error,refresh,hasMore:items.length===limit,loadMore:()=>setLimit(n=>n+50),markRead:(id:string)=>mutate(()=>markPortalNotificationReadInDb(id)),markAllRead:()=>mutate(()=>markAllPortalNotificationsReadInDb(audience)),remove:(id:string)=>mutate(async()=>{const r=await getSupabase().rpc('dismiss_portal_notifications',{p_audience:audience,p_id:id});if(r.error)throw new Error(r.error.message);if(r.data!==1)throw new Error('Notification was not removed');}),clearAll:()=>mutate(async()=>{const r=await getSupabase().rpc('dismiss_portal_notifications',{p_audience:audience,p_id:null});if(r.error)throw new Error(r.error.message);})};
}
