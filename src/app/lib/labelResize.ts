/** Solve dimensions against the rendered handle, including centre/hem attachment offsets. */
export function resizeLabelDimensions(start:{width:number;height:number},delta:{x:number;y:number},handleAt:(width:number,height:number)=>{x:number;y:number}){
 const origin=handleAt(start.width,start.height),target={x:origin.x+delta.x,y:origin.y+delta.y};let width=start.width,height=start.height;
 for(let i=0;i<3;i++){const p=handleAt(width,height),x=handleAt(width+.1,height),y=handleAt(width,height+.1),a=(x.x-p.x)*10,b=(y.x-p.x)*10,c=(x.y-p.y)*10,d=(y.y-p.y)*10,det=a*d-b*c;if(Math.abs(det)<1e-8)break;const dx=target.x-p.x,dy=target.y-p.y;width=Math.max(.1,width+(dx*d-dy*b)/det);height=Math.max(.1,height+(dy*a-dx*c)/det);}
 return {width:Math.round(width*10)/10,height:Math.round(height*10)/10};
}
