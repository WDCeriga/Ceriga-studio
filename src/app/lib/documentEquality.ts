/** Compare immutable document branches without serialising embedded images or vectors. */
export function documentEqual(a:unknown,b:unknown):boolean{
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)!==Array.isArray(b))return false;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((value,i)=>documentEqual(value,b[i]));
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>;
 const keys=Object.keys(left).filter(key=>left[key]!==undefined),other=Object.keys(right).filter(key=>right[key]!==undefined);
 return keys.length===other.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(right,key)&&documentEqual(left[key],right[key]));
}
