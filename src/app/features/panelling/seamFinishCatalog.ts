export const SEAM_FINISHES=[
 {id:'plain',label:'Plain join',description:'Clean panel boundary'},
 {id:'topstitch',label:'Topstitch',description:'Single visible stitch row'},
 {id:'double',label:'Twin needle',description:'Two parallel stitch rows'},
 {id:'flatlock',label:'Flatlock',description:'Flat join with crossing threads'},
 {id:'overlock',label:'Overlock',description:'Loops around an exposed edge'},
 {id:'exposed',label:'Reverse seam',description:'Raised allowance and stitches'},
 {id:'raw',label:'Raw edge',description:'Unfinished edge with fine fibres'},
 {id:'piping',label:'Piping',description:'Narrow cord inside the join'},
 {id:'binding',label:'Bound seam',description:'Folded strip with edge stitching'},
 {id:'taped',label:'Seam tape',description:'Smooth reinforcing strip'},
 {id:'zigzag',label:'Zigzag',description:'Alternating needle stitches'},
 {id:'chain',label:'Chainstitch',description:'Linked thread loops'},
 {id:'lapped',label:'Lapped seam',description:'Overlapping edge with two stitch rows'},
 {id:'coverstitch',label:'Coverstitch',description:'Parallel needles and covering thread'},
 {id:'mesh',label:'Mesh insert',description:'Narrow mesh strip between panels'},
 {id:'hidden',label:'No visible line',description:'Keep the fabric split only'},
] as const;

export const SEAM_FINISH_CATEGORIES=[
 {id:'essentials',label:'Essentials',finishes:['plain','topstitch','double','hidden']},
 {id:'stretch',label:'Stretch stitching',finishes:['flatlock','overlock','coverstitch','zigzag','chain']},
 {id:'edges',label:'Edges & binding',finishes:['exposed','raw','piping','binding','lapped']},
 {id:'inserts',label:'Inserts',finishes:['mesh','taped']},
] as const;
export function seamFinishCategory(finish:string){return SEAM_FINISH_CATEGORIES.find(category=>(category.finishes as readonly string[]).includes(finish))?.id??'essentials'}
