import{getSupabase}from './supabaseClient';
const cache=new Map<string,{until:number;request:Promise<string>}>();let watching=false;
/** Memory-only, account-scoped URLs. A session change immediately clears the cache. */
export async function privateAssetUrl(bucket:string,path:string,seconds=600):Promise<string>{
 const client=getSupabase();if(!watching){watching=true;client.auth.onAuthStateChange(()=>cache.clear());window.addEventListener('ceriga-team-updated',()=>cache.clear());}
 const{data:{session},error}=await client.auth.getSession();if(error||!session)throw new Error('Sign in to view private files');
 const key=session.user.id+':'+bucket+':'+path;const saved=cache.get(key);if(saved&&saved.until>Date.now())return saved.request;
 const request=client.storage.from(bucket).createSignedUrl(path,seconds).then(({data,error})=>{if(error||!data?.signedUrl)throw new Error(error?.message||'File unavailable');return data.signedUrl;}).catch(cause=>{cache.delete(key);throw cause;});
 if(cache.size>=300)cache.delete(cache.keys().next().value!);cache.set(key,{request,until:Date.now()+Math.max(1,seconds-Math.min(60,Math.floor(seconds/5)))*1000});return request;
}
export function createTaskLimiter(maximum=3){let active=0;const waiting:(()=>void)[]=[];return async<T>(work:()=>Promise<T>):Promise<T>=>{if(active>=maximum)await new Promise<void>(resolve=>waiting.push(resolve));else active++;try{return await work();}finally{const next=waiting.shift();if(next)next();else active--;}};}
