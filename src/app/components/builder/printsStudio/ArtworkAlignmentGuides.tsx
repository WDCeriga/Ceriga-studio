/** Neutral alignment rails without a layout box or badges. */
export function ArtworkAlignmentGuides({vertical,horizontal,inverseScale=1}:{vertical:number[];horizontal:number[];inverseScale?:number}) {
  const colour='#8a8a8a';
  return <div data-artwork-alignment-guides className="pointer-events-none absolute inset-0 z-20" aria-hidden>
    {vertical.map(x=><div key={`v-${x}`} className="absolute inset-y-0" style={{left:x,width:inverseScale,background:`linear-gradient(transparent,${colour} 12%,${colour} 88%,transparent)`}}>
    </div>)}
    {horizontal.map(y=><div key={`h-${y}`} className="absolute inset-x-0" style={{top:y,height:inverseScale,background:`linear-gradient(90deg,transparent,${colour} 12%,${colour} 88%,transparent)`}}>
    </div>)}
  </div>;
}
