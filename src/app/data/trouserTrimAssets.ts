const fill='var(--detail-fill, none)',ink='var(--detail-outline, black)',thread='var(--detail-stitch, black)',metal='var(--detail-hardware, none)';
const svg=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const path=(d:string,solid=true)=>`<path d="${d}" fill="${solid?fill:'none'}" stroke="${ink}" stroke-width="1.3"/>`;
const stitch=(d:string)=>`<path d="${d}" fill="none" stroke="${thread}" stroke-width="1" stroke-dasharray="2 2"/>`;
const ring=(x:number,y:number,r=5)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${metal}" stroke="${ink}" stroke-width="1.2"/>`;
const tab=path('M25 5H75V88Q50 96 25 88Z')+stitch('M30 10H70V83H30Z');
const option=(id:string,label:string,body:string,width:number,ratio:number,x:number,y:number)=>({id:'trouser-'+id,label,svg:svg(body),width,ratio,x,y,stitch:true,hardware:true});
export const TROUSER_UTILITIES=[
 option('d-ring','D-ring',path('M35 3H65V32H35Z')+`<path d="M30 27H70V60Q70 88 50 88T30 60Z" fill="none" stroke="${metal}" stroke-width="9"/>`+path('M30 27H70V60Q70 88 50 88T30 60Z',false)+stitch('M40 8L60 25M60 8L40 25'),.075,.65,.88,.08),
 option('key-loop','Key loop',path('M30 4H70V65Q70 95 50 95T30 65Z M42 20V65Q42 80 50 80T58 65V20Z')+stitch('M35 8H65V20H35Z'),.065,.45,.86,.10),
 option('utility-loop','Utility loop',path('M20 5H35V67Q50 80 65 67V5H80V70Q50 99 20 70Z')+stitch('M24 8L31 18M31 8L24 18M69 8L76 18M76 8L69 18'),.10,.65,.14,.12),
 option('webbing-strap','Webbing strap',tab+stitch('M40 24V76M50 24V76M60 24V76')+ring(50,84),.075,.3,.85,.32),
 option('side-strap','Side strap',path('M4 28H94V72H4Z')+stitch('M9 33H89V67H9Z')+path('M70 23H90V77H70Z M75 31H85V69H75Z'),.20,2.7,.84,.36),
 option('buckle-tab','Buckle tab',path('M3 30H97V70H3Z')+`<rect x="35" y="18" width="36" height="64" rx="5" fill="${metal}" stroke="${ink}" stroke-width="2"/>`+path('M42 25H64V75H42Z',false)+stitch('M9 35H28V65H9Z M78 35H91V65H78Z'),.18,2.3,.85,.10),
 option('knee-tab','Knee tab',path('M3 28H86L98 50L86 72H3Z')+stitch('M9 34H82L91 50L82 66H9Z')+ring(80,50),.18,2.5,.25,.58),
 option('ankle-tab','Adjustable ankle tab',path('M3 30H84L98 50L84 70H3Z')+stitch('M8 35H80L90 50L80 65H8Z')+ring(24,50)+ring(47,50),.17,2.5,.25,.93),
 option('snap-tab','Snap tab',tab+ring(50,78,9),.09,1.6,.86,.25),
 option('shock-cord','Elastic shock-cord hem adjuster',path('M8 14H92V30H8Z')+`<path d="M25 24V75Q50 97 75 75V24" fill="none" stroke="${ink}" stroke-width="3"/>`+path('M32 47H68V68H32Z')+ring(43,57,3)+ring(57,57,3)+stitch('M12 19H88'),.17,1,.25,.92),
 option('reflective-strip','Reflective strip',`<path d="M25 3H75V97H25Z" fill="${metal}" stroke="${ink}" stroke-width="1.1"/>`+stitch('M29 6V94M71 6V94'),.045,.2,.12,.40),
 option('side-tape','Side tape / stripe',path('M25 1H75V99H25Z')+stitch('M30 2V98M70 2V98'),.04,.045,.04,.51),
 {...option('bartack','Bartack',`<path d="M5 35V65M15 35V65M25 35V65M35 35V65M45 35V65M55 35V65M65 35V65M75 35V65M85 35V65M95 35V65" stroke="${thread}" stroke-width="4"/>`,.024,4,.12,.18),hardware:false},
];
export const TROUSER_TABS=[
 {...option('waistband-tab','Folded waistband tab',
  path('M8 12H92V76Q92 92 76 92H24Q8 92 8 76Z')+stitch('M11 18H89')
  +path('M11 76Q11 87 24 87H76Q89 87 89 76M37 53H63',false),.065,1.65,.76,.05),hardware:false},
 {...option('seam-tab','Folded side-seam tab',
  path('M8 15H77Q92 15 92 32V68Q92 85 77 85H8Z')+stitch('M18 18V82')
  +path('M76 20Q86 20 86 33V67Q86 80 76 80',false),.055,1.65,.92,.22),hardware:false},
];
export const TROUSER_POCKETS=[
 option('cargo','Cargo pocket',
  path('M12 24H88V79L81 90Q79 93 74 93H26Q21 93 19 90L12 79Z')
  +path('M37 31L39 87H61L63 31',false)
  +stitch('M17 36V77L24 87H76L83 77V36')
  +path('M8 11H92V29Q92 33 88 34L52 42Q50 43 48 42L12 34Q8 33 8 29Z')
  +stitch('M13 15H87V29L50 37L13 29Z')+ring(50,26,3.5),.31,.9,.23,.42),
 option('coin','Coin / key pocket',
  path('M12 18H88V73L76 86H24L12 73Z')
  +path('M12 30H88',false)
  +stitch('M17 24H83M18 34V71L27 81H73L82 71V34'),.14,.95,.78,.15),
 option('hidden','Hidden pocket',
  path('M7 39H93V61H7Z')+path('M11 50H89',false)
  +stitch('M11 57H89')+path('M11 42V58M89 42V58',false),.20,5.5,.22,.20),
];
export const TROUSER_POCKET_CHOICES=[['side-seam','Side seam pockets'],['slant','Slant pockets'],['welt','Welt pockets'],['zip','Zip pockets'],['patch-back','Patch back pocket'],['welt-back','Welt back pocket'],['cargo','Cargo pocket'],['hidden','Hidden pocket'],['coin','Coin / key pocket'],['none','No pocket']] as const;
export const TROUSER_ZIP_PLACEMENTS=[['pocket','Pocket zip'],['ankle','Ankle zip'],['side-leg','Side-leg zip'],['cargo','Cargo-pocket zip'],['decorative','Decorative zip']] as const;
export const TROUSER_PATCH_PRESETS=[
 {label:'Woven patch',material:'woven',x:.76,y:.25,width:.18},
 {label:'Rubber patch',material:'silicone',x:.75,y:.25,width:.18},
 {label:'Leather-style patch',material:'fauxLeather',x:.5,y:.06,width:.20},
 {label:'Back waistband patch',material:'fauxLeather',x:.5,y:.025,width:.20,back:true},
 {label:'Reflective patch',material:'reflective',x:.75,y:.40,width:.18},
] as const;
