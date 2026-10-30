import type {DesignElement} from '../components/builder/PrintStudioEditor';
export type ArtworkResizeHandle='nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';
/** Resize in object coordinates, keeping the opposite handle fixed unless Alt is held. */
export function resizeArtwork(start:DesignElement,handle:ArtworkResizeHandle,delta:{x:number;y:number},options:{fromCenter:boolean;constrain:boolean}):Partial<DesignElement>{
 const angle=start.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),local={x:delta.x*cos+delta.y*sin,y:-delta.x*sin+delta.y*cos},sx=handle.includes('w')?-1:handle.includes('e')?1:0,sy=handle.includes('n')?-1:handle.includes('s')?1:0,m=options.fromCenter?2:1;
 let width=Math.max(1,start.width+sx*local.x*m),height=Math.max(1,start.height+sy*local.y*m);
 if(options.constrain){const sw=width/start.width,sh=height/start.height,s=!sx?sh:!sy?sw:Math.abs(sw-1)>Math.abs(sh-1)?sw:sh;width=Math.max(1,start.width*s);height=Math.max(1,start.height*s);}
 const ox=options.fromCenter?0:sx*(width-start.width)/2,oy=options.fromCenter?0:sy*(height-start.height)/2;
 return {x:start.x+ox*cos-oy*sin,y:start.y+ox*sin+oy*cos,width,height,...(start.type==='text'?{autoWidth:false,autoHeight:false,...(options.constrain?{fontSize:(start.fontSize??30)*width/start.width}:{})}:{})};
}
