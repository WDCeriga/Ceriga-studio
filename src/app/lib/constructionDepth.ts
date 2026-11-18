export function constructionDepth(value:string|number|undefined, fallback:number, max:number) {
 const cm=Number(value);
 return value!==undefined&&value!==''&&Number.isFinite(cm)?Math.max(1,Math.min(max,cm)):fallback;
}
