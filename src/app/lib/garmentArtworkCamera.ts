type Point={x:number;y:number};
/** Map the baseline garment square into the displayed camera in artwork-board coordinates. */
export function garmentArtworkCamera({root,parent,canvas,zone,unit}:{root:Point;parent:Point&{width:number;height:number};canvas:Point&{width:number};zone:Point;unit:number}){
 const side=Math.min(parent.width,parent.height);
 if(side<=0||unit<=0)return undefined;
 const scale=canvas.width/side;
 const left=(parent.x-root.x+(parent.width-side)/2)/unit;
 const top=(parent.y-root.y+(parent.height-side)/2)/unit;
 const x=(canvas.x-root.x)/unit-scale*left+(scale-1)*zone.x;
 const y=(canvas.y-root.y)/unit-scale*top+(scale-1)*zone.y;
 if(Math.abs(scale-1)<.00001&&Math.abs(x)<.001&&Math.abs(y)<.001)return undefined;
 const n=(v:number)=>Number(v.toFixed(5));
 return `translate(${n(x)}px, ${n(y)}px) scale(${n(scale)})`;
}
