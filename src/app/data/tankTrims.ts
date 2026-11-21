const ink='var(--detail-outline, black)',fill='var(--detail-fill, none)',thread='var(--detail-stitch, black)';
const option=(id:string,label:string,body:string,width:number,ratio:number,x:number,y:number)=>({
 id:'tank-'+id,label,svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,width,ratio,x,y,stitch:true,hardware:false,
});
export const TANK_TRIMS=[
 option('slit','Side slit',`<path d="M30 5V80H12M48 5V80H67" fill="none" stroke="${ink}" stroke-width="2"/><path d="M24 5V73H12M54 5V73H67" fill="none" stroke="${thread}" stroke-dasharray="3 3"/>`,.05,.65,.13,.91),
 option('dropped-slit','Dropped hem side slit',`<path d="M30 5V66H12M48 5V92H67" fill="none" stroke="${ink}" stroke-width="2"/><path d="M24 5V60H12M54 5V86H67" fill="none" stroke="${thread}" stroke-dasharray="3 3"/>`,.05,.65,.13,.89),
 option('side-tape','Side taping',`<path d="M30 2H70V98H30Z" fill="${fill}" stroke="${ink}" stroke-width="1.2"/><path d="M35 4V96M65 4V96" stroke="${thread}" stroke-dasharray="2 2"/>`,.035,.055,.14,.66),
 option('reflective','Reflective strip',`<rect x="9" y="36" width="82" height="28" rx="2" fill="${fill}" stroke="${ink}"/>`,.16,5,.50,.80),
 option('mesh','Mesh insert',`<defs><pattern id="tank-mesh" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.3" fill="${ink}"/></pattern></defs><path d="M20 4H80L93 96H7Z" fill="${fill}" stroke="${ink}"/><path d="M20 4H80L93 96H7Z" fill="url(#tank-mesh)"/>`,.15,.5,.20,.62),
 option('piping','Contrast piping',`<path d="M50 2V98" stroke="${fill}" stroke-width="6"/>`,.012,.022,.17,.62),
 option('back-mesh','Back mesh panel',`<defs><pattern id="tank-back-mesh" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.3" fill="${ink}"/></pattern></defs><path d="M15 5H85L95 95H5Z" fill="${fill}" stroke="${ink}"/><path d="M15 5H85L95 95H5Z" fill="url(#tank-back-mesh)"/>`,.46,1.3,.5,.52),
 option('bartack','Reinforcement bartack',`<path d="M8 40H92V60H8Z" fill="${fill}" stroke="${ink}"/><path d="M12 43L20 57L28 43L36 57L44 43L52 57L60 43L68 57L76 43L84 57L90 43" fill="none" stroke="${thread}" stroke-width="2"/>`,.045,4,.17,.88),
];
