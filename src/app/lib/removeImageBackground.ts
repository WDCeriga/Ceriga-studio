/** Remove an edge-connected background while retaining enclosed matching colours and source RGB. */
export function removeImageBackground(data:Uint8ClampedArray,width:number,height:number,tolerance=45,softness=18,manual?:[number,number,number]){
 const out=new Uint8ClampedArray(data),total=width*height;if(!total)return out;
 const bins=new Map<number,{count:number;r:number;g:number;b:number}>();
 const border:number[]=[];for(let x=0;x<width;x++){border.push(x,(height-1)*width+x)}for(let y=1;y<height-1;y++)border.push(y*width,y*width+width-1);
 for(const p of border){const i=p*4;if(data[i+3]<32)continue;const key=(data[i]>>5)*64+(data[i+1]>>5)*8+(data[i+2]>>5),bin=bins.get(key)??{count:0,r:0,g:0,b:0};bin.count++;bin.r+=data[i];bin.g+=data[i+1];bin.b+=data[i+2];bins.set(key,bin)}
 const dominant=[...bins.values()].sort((a,b)=>b.count-a.count)[0],bg=manual??(dominant?[dominant.r/dominant.count,dominant.g/dominant.count,dominant.b/dominant.count]:[255,255,255]);
 const seen=new Uint8Array(total),queue=new Int32Array(total);let head=0,tail=0;
 const distance=(p:number)=>{const i=p*4;return Math.hypot(data[i]-bg[0],data[i+1]-bg[1],data[i+2]-bg[2])};
 const visit=(p:number)=>{if(seen[p])return;seen[p]=1;if(data[p*4+3]<1||distance(p)<tolerance+softness)queue[tail++]=p};
 border.forEach(visit);
 while(head<tail){const p=queue[head++],i=p*4,x=p%width,d=distance(p),keep=Math.max(0,Math.min(1,(d-tolerance)/Math.max(1,softness)));
  out[i+3]=Math.round(data[i+3]*keep);
  if(keep>0&&keep<1)for(let c=0;c<3;c++)out[i+c]=Math.max(0,Math.min(255,(data[i+c]-bg[c]*(1-keep))/keep));
  if(x>0)visit(p-1);if(x<width-1)visit(p+1);if(p>=width)visit(p-width);if(p<total-width)visit(p+width);
 }
 return out;
}
