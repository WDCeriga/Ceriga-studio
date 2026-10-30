type Point={x:number;y:number};
/** Place thread just inside the upper fold, using the current (possibly angled) hem band. */
export function sleeveHemStitchRow(ring:Point[]):Point[]{
 if(ring.length<3)return [];
 const cx=ring.reduce((n,p)=>n+p.x,0)/ring.length,cy=ring.reduce((n,p)=>n+p.y,0)/ring.length;
 const xx=ring.reduce((n,p)=>n+(p.x-cx)**2,0),yy=ring.reduce((n,p)=>n+(p.y-cy)**2,0),xy=ring.reduce((n,p)=>n+(p.x-cx)*(p.y-cy),0);
 const angle=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(angle),uy=Math.sin(angle),nx=-uy,ny=ux;
 const local=ring.map(p=>({t:p.x*ux+p.y*uy,n:p.x*nx+p.y*ny}));
 const top=Math.min(...local.map(p=>p.n)),bottom=Math.max(...local.map(p=>p.n));
 const n=top+Math.min(6,(bottom-top)*.2),hits:number[]=[];
 for(let i=0;i<local.length;i++){const a=local[i],b=local[(i+1)%local.length];if((a.n>n)!==(b.n>n))hits.push(a.t+(n-a.n)*(b.t-a.t)/(b.n-a.n));}
 hits.sort((a,b)=>a-b);let lo=0,hi=0;
 for(let i=0;i+1<hits.length;i+=2)if(hits[i+1]-hits[i]>hi-lo){lo=hits[i];hi=hits[i+1];}
 if(hi<=lo)return [];
 const inset=Math.min(8,(hi-lo)*.08);
 return [lo+inset,hi-inset].map(t=>({x:t*ux+n*nx,y:t*uy+n*ny}));
}
