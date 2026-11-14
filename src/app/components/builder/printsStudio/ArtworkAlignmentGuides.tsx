/** Neutral alignment rails without a layout box or badges. */
export function ArtworkAlignmentGuides({vertical,horizontal,inverseScale=1,hairline=false}:{vertical:number[];horizontal:number[];inverseScale?:number;hairline?:boolean}) {
  if (hairline) return <svg data-artwork-alignment-guides className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true"
    stroke="#737373" strokeOpacity=".65" strokeWidth="1">
    {vertical.map(x => <line key={`v-${x}`} x1={x} x2={x} y1="0" y2="100%" vectorEffect="non-scaling-stroke"/>)}
    {horizontal.map(y => <line key={`h-${y}`} x1="0" x2="100%" y1={y} y2={y} vectorEffect="non-scaling-stroke"/>)}
  </svg>;
  const colour='#8a8a8a';
  return <div data-artwork-alignment-guides className="pointer-events-none absolute inset-0 z-20" aria-hidden>
    {vertical.map(x=><div key={`v-${x}`} className="absolute inset-y-0" style={{left:x,width:inverseScale,background:`linear-gradient(transparent,${colour} 12%,${colour} 88%,transparent)`}}>
    </div>)}
    {horizontal.map(y=><div key={`h-${y}`} className="absolute inset-x-0" style={{top:y,height:inverseScale,background:`linear-gradient(90deg,transparent,${colour} 12%,${colour} 88%,transparent)`}}>
    </div>)}
  </div>;
}
