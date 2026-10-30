/** Transient input is consumed at display rate; flush before committing a gesture. */
export function frameGesture<T>(apply:(value:T)=>void,request:(callback:()=>void)=>number=callback=>requestAnimationFrame(callback),cancel:(id:number)=>void=id=>cancelAnimationFrame(id)){
 let frame:number|null=null,pending:T|undefined;
 const flush=()=>{if(frame!==null)cancel(frame);frame=null;if(pending!==undefined){const value=pending;pending=undefined;apply(value);}};
 return {push(value:T){pending=value;if(frame===null)frame=request(()=>{frame=null;flush();});},flush,cancel(){if(frame!==null)cancel(frame);frame=null;pending=undefined;}};
}
