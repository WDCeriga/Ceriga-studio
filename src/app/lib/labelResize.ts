/** Solve dimensions against the rendered handle, including centre/hem attachment offsets. */
export function resizeLabelDimensions(start:{width:number;height:number},delta:{x:number;y:number},handleAt:(width:number,height:number)=>{x:number;y:number}, equalSides = false){
 const origin=handleAt(start.width,start.height),target={x:origin.x+delta.x,y:origin.y+delta.y};let width=start.width,height=start.height;
 if (equalSides) {
  for (let i = 0; i < 3; i++) {
   const point = handleAt(width, width);
   const larger = handleAt(width + .5, width + .5);
   const sample = larger.x === point.x && larger.y === point.y ? -.5 : .5;
   const next = sample > 0 ? larger : handleAt(width + sample, width + sample);
   const x = (next.x - point.x) / sample, y = (next.y - point.y) / sample;
   const length = x * x + y * y;
   if (length < 1e-8) break;
   width = Math.max(8, Math.min(150, width + ((target.x - point.x) * x + (target.y - point.y) * y) / length));
  }
  const size = Math.round(width * 10) / 10;
  return { width: size, height: size };
 }
 for(let i=0;i<3;i++){const p=handleAt(width,height),x=handleAt(width+.1,height),y=handleAt(width,height+.1),a=(x.x-p.x)*10,b=(y.x-p.x)*10,c=(x.y-p.y)*10,d=(y.y-p.y)*10,det=a*d-b*c;if(Math.abs(det)<1e-8)break;const dx=target.x-p.x,dy=target.y-p.y;width=Math.max(.1,width+(dx*d-dy*b)/det);height=Math.max(.1,height+(dy*a-dx*c)/det);}
 return {width:Math.round(width*10)/10,height:Math.round(height*10)/10};
}
