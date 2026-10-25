export interface GarmentDrawingBounds {left:number;right:number;top:number;bottom:number}
/** A single camera frame for both the garment builder and the artwork studio. */
export function garmentFrameStyle(bounds:GarmentDrawingBounds,phone=false,zoom=100) {
 const width=`min(calc(100cqw / ${(bounds.right-bounds.left+(phone?100:160))/900}),calc(100cqh / ${(bounds.bottom-bounds.top+100)/900}))`;
 return {zoom:zoom/100,width,height:width,transform:`translate(${-100*(bounds.left+bounds.right)/2000}%,${-100*(bounds.top+bounds.bottom)/2000}%)`};
}
