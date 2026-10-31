type SaveTask={work:()=>Promise<void>;automatic:boolean;resolve:(written:boolean)=>void;reject:(error:unknown)=>void};
/** Preserve manual saves and write order; replace only autosaves that have not started. */
export class ProjectSaveQueue{
 private tasks:SaveTask[]=[];
 private active=false;
 get pending(){return this.tasks.length+Number(this.active)}
 enqueue(work:()=>Promise<void>,automatic=false):Promise<boolean>{
  if(automatic){this.tasks=this.tasks.filter(task=>{if(!task.automatic)return true;task.resolve(false);return false})}
  const result=new Promise<boolean>((resolve,reject)=>this.tasks.push({work,automatic,resolve,reject}));
  void this.drain();return result;
 }
 private async drain(){
  if(this.active)return;
  const task=this.tasks.shift();if(!task)return;
  this.active=true;
  try{await task.work();task.resolve(true)}catch(error){task.reject(error)}
  finally{this.active=false;void this.drain()}
 }
}
