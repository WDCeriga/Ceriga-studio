import {fabricColors} from './builderSteps';
/** Suggestions use the existing screen library, not a licensed Pantone conversion table. */
export function suggestedColourReference(hex:string):string{
 if(!/^#[0-9a-f]{6}$/i.test(hex))return '';
 const exact=fabricColors.find(c=>c.hex.toLowerCase()===hex.toLowerCase()&&c.pantone);
 if(exact)return `PANTONE ${exact.pantone}`;
 const rgb=(v:string)=>[1,3,5].map(i=>parseInt(v.slice(i,i+2),16));const channels=rgb(hex);
 const nearest=fabricColors.filter(c=>c.pantone).reduce((best,c)=>{const n=rgb(c.hex),distance=n.reduce((total,v,i)=>total+[2,4,3][i]*(v-channels[i])**2,0);return distance<best.distance?{reference:c.pantone,distance}:best},{reference:'',distance:Infinity});
 return nearest.reference?`PANTONE ${nearest.reference} (approx.)`:'';
}
