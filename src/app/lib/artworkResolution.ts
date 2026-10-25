/** Match displayed pixels with supersampling, bounded by actual memory/texture size rather than an arbitrary density cap. */
export function artworkPixelRatio(width:number,height:number,displayScale=1,dpr=1){
 const w=Number.isFinite(width)?Math.max(1,width):1,h=Number.isFinite(height)?Math.max(1,height):1;
 const scale=Number.isFinite(displayScale)&&displayScale>0?displayScale:1,density=Number.isFinite(dpr)&&dpr>0?dpr:1;
 return Math.min(Math.max(2,scale*density*1.25),8192/Math.max(w,h),Math.sqrt(16_000_000/w/h));
}
export function drawingPixelRatio(width:number,height:number,displayScale=1,dpr=1){return artworkPixelRatio(width,height,Math.max(displayScale,(displayScale<.65?2:4)/Math.max(1,dpr)),dpr)}
