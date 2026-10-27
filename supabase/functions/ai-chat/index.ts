const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(status:number,error:string)=>new Response(JSON.stringify({error}),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json(405,'Method not allowed');
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,key=Deno.env.get('OPENROUTER_API_KEY');
 const auth=req.headers.get('authorization');if(!auth)return json(401,'Sign in to use the assistant');
 try{
  const identity=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,Authorization:auth}});if(!identity.ok)return json(401,'Your session has expired');const user=await identity.json();
  if(!key)return json(503,'The assistant has not been configured');
  const raw=await req.text();if(raw.length>250000)return json(413,'Conversation is too large');const input=JSON.parse(raw);
  if(typeof input.model!=='string'||!input.model.endsWith(':free')||input.model.length>150||!Array.isArray(input.messages)||input.messages.length>32||input.messages.some((m:any)=>!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'&&!Array.isArray(m.content)))return json(400,'Invalid conversation');
  const allowed=await fetch(url+'/rest/v1/rpc/authorise_ai_request',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({p_user:user.id})});if(!allowed.ok)return json(503,'The assistant is temporarily unavailable');if(await allowed.json()!==true)return json(429,'Please wait a minute before sending another message');
  const upstream=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','X-Title':'Ceriga Studio'},body:JSON.stringify({model:input.model,messages:input.messages,stream:true,max_tokens:1200,temperature:0.4}),signal:AbortSignal.timeout(45000)});
  if(!upstream.ok)return json(upstream.status===429?429:502,'The assistant is temporarily unavailable');
  return new Response(upstream.body,{headers:{...cors,'Content-Type':'text/event-stream','Cache-Control':'no-cache'}});
 }catch{return json(503,'The assistant is temporarily unavailable');}
});
