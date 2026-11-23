export type BackgroundOptions = {
 /** Also remove matching colour inside the artwork, such as the middle of an O. */
 inner?: boolean;
 /** Move the cut edge: positive keeps more, negative trims in. Pixels at a 600px reference. */
 shift?: number;
 feather?: number;
 /** 0–100: removes small leftover islands. */
 specks?: number;
 /** 0–100: removes background colour from soft edge pixels. */
 defringe?: number;
};

function boxBlur(source:Float32Array,w:number,h:number,r:number){
 const across=new Float32Array(source.length),out=new Float32Array(source.length);
 for(let y=0;y<h;y++){let sum=0,count=0;for(let x=0;x<=Math.min(r,w-1);x++){sum+=source[y*w+x];count++}for(let x=0;x<w;x++){across[y*w+x]=sum/count;if(x-r>=0){sum-=source[y*w+x-r];count--}if(x+r+1<w){sum+=source[y*w+x+r+1];count++}}}
 for(let x=0;x<w;x++){let sum=0,count=0;for(let y=0;y<=Math.min(r,h-1);y++){sum+=across[y*w+x];count++}for(let y=0;y<h;y++){out[y*w+x]=sum/count;if(y-r>=0){sum-=across[(y-r)*w+x];count--}if(y+r+1<h){sum+=across[(y+r+1)*w+x];count++}}}
 return out;
}

/** Remove a background sampled from the image edges. Backdrops with up to three main colours are handled, and every refinement is optional. */
export function removeImageBackground(data:Uint8ClampedArray,width:number,height:number,tolerance=45,softness=18,manual?:[number,number,number],options:BackgroundOptions={}){
 const out=new Uint8ClampedArray(data),total=width*height;if(!total)return out;
 const bins=new Map<number,{count:number;r:number;g:number;b:number}>();
 const border:number[]=[];for(let x=0;x<width;x++){border.push(x,(height-1)*width+x)}for(let y=1;y<height-1;y++)border.push(y*width,y*width+width-1);
 let sampled=0;
 for(const p of border){const i=p*4;if(data[i+3]<32)continue;sampled++;const key=(data[i]>>5)*64+(data[i+1]>>5)*8+(data[i+2]>>5),bin=bins.get(key)??{count:0,r:0,g:0,b:0};bin.count++;bin.r+=data[i];bin.g+=data[i+1];bin.b+=data[i+2];bins.set(key,bin)}
 const ranked=[...bins.values()].sort((a,b)=>b.count-a.count),found=ranked.filter((bin,index)=>!index||(index<3&&bin.count>=sampled*.18)).map(bin=>[bin.r/bin.count,bin.g/bin.count,bin.b/bin.count] as [number,number,number]);
 const palette:[number,number,number][]=manual?[manual]:found.length?found:[[255,255,255]];
 const nearest=(p:number)=>{const i=p*4;let best=Infinity,colour=palette[0];for(const bg of palette){const d=Math.hypot(data[i]-bg[0],data[i+1]-bg[1],data[i+2]-bg[2]);if(d<best){best=d;colour=bg}}return {d:best,colour}};
 const matte=new Float32Array(total).fill(1),seen=new Uint8Array(total),queue=new Int32Array(total),keepOf=(d:number)=>Math.max(0,Math.min(1,(d-tolerance)/Math.max(1,softness)));
 if(options.inner){for(let p=0;p<total;p++)matte[p]=data[p*4+3]<1?0:keepOf(nearest(p).d)}
 else{let head=0,tail=0;const visit=(p:number)=>{if(seen[p])return;seen[p]=1;if(data[p*4+3]<1||nearest(p).d<tolerance+softness)queue[tail++]=p};border.forEach(visit);
  while(head<tail){const p=queue[head++],x=p%width;matte[p]=keepOf(nearest(p).d);if(x>0)visit(p-1);if(x<width-1)visit(p+1);if(p>=width)visit(p-width);if(p<total-width)visit(p+width)}}
 let mask=matte;
 const specks=Math.max(0,Math.min(100,options.specks??0));
 if(specks>0){mask=mask.slice();const limit=Math.max(4,total*.005*specks/100),label=new Uint8Array(total);
  for(let s=0;s<total;s++){if(label[s]||mask[s]<=.5)continue;let head=0,tail=0;queue[tail++]=s;label[s]=1;while(head<tail){const p=queue[head++],x=p%width,go=(n:number)=>{if(!label[n]&&mask[n]>.5){label[n]=1;queue[tail++]=n}};if(x>0)go(p-1);if(x<width-1)go(p+1);if(p>=width)go(p-width);if(p<total-width)go(p+width)}if(tail<limit)for(let k=0;k<tail;k++)mask[queue[k]]=0}}
 const reach=Math.max(width,height)/600,shift=options.shift??0,feather=options.feather??0;
 if(shift){const blurred=boxBlur(mask,width,height,Math.max(1,Math.round(Math.abs(shift)*reach)));mask=new Float32Array(total);for(let p=0;p<total;p++)mask[p]=Math.max(0,Math.min(1,shift>0?blurred[p]*2:blurred[p]*2-1))}
 if(feather>0)mask=boxBlur(mask,width,height,Math.max(1,Math.round(feather*reach)));
 const defringe=Math.max(0,Math.min(100,options.defringe??100))/100;
 for(let p=0;p<total;p++){const i=p*4,keep=mask[p],edge=matte[p];
  out[i+3]=Math.round(data[i+3]*keep);
  if(defringe&&edge>0&&edge<1){const bg=nearest(p).colour;for(let c=0;c<3;c++){const clean=Math.max(0,Math.min(255,(data[i+c]-bg[c]*(1-edge))/edge));out[i+c]=data[i+c]+(clean-data[i+c])*defringe}}
 }
 return out;
}
