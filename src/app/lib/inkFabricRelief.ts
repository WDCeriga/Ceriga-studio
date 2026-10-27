/** Modulate ink colour without adding coverage to antialiased or transparent edges. */
export function multiplyInkFabricPixels(ink:Uint8ClampedArray,relief:Uint8ClampedArray){
 for(let i=0;i<ink.length;i+=4){
  if(!ink[i+3])continue;
  const coverage=relief[i+3]/255;
  for(let channel=0;channel<3;channel++)ink[i+channel]=Math.round(ink[i+channel]*(1-coverage+coverage*relief[i+channel]/255));
 }
 return ink;
}
