/** Keep the inside recognisably the same colour while lifting it away from the shell. */
export function lighterInteriorColour(colour:string):string{
 const hex=colour.replace(/^#([a-f0-9])([a-f0-9])([a-f0-9])$/i,'#$1$1$2$2$3$3');
 if(!/^#[a-f0-9]{6}$/i.test(hex))return colour;
 return '#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*.82+255*.18).toString(16).padStart(2,'0')).join('').toUpperCase();
}
