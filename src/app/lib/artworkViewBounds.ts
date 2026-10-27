import type {DesignElement} from '../components/builder/PrintStudioEditor';
/** Fit the whole visible design on this side, independently of object selection. */
export function artworkViewBounds(elements:DesignElement[],side:'front'|'back'){
 const boxes=elements.filter(el=>(el.side??'front')===side&&!el.hidden&&!el.customAreaOpen&&el.width>0&&el.height>0).map(el=>{
  const angle=el.rotation*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  return {x:el.x,y:el.y,width:c*el.width+s*el.height,height:s*el.width+c*el.height};
 });
 if(!boxes.length)return null;
 const left=Math.min(...boxes.map(b=>b.x-b.width/2)),right=Math.max(...boxes.map(b=>b.x+b.width/2)),top=Math.min(...boxes.map(b=>b.y-b.height/2)),bottom=Math.max(...boxes.map(b=>b.y+b.height/2));
 return {x:(left+right)/2,y:(top+bottom)/2,width:right-left,height:bottom-top};
}
