export const VECTOR_LOOKS = [
 {id:'none',label:'Original'}, {id:'bw',label:'B&W'}, {id:'grayscale',label:'Grayscale'},
 {id:'vintage',label:'Vintage'}, {id:'washed',label:'Washed'}, {id:'muted',label:'Muted'},
 {id:'vibrant',label:'Vibrant'}, {id:'sepia',label:'Sepia'}, {id:'invert',label:'Invert'},
 {id:'warm',label:'Warm'}, {id:'cold',label:'Cold'},
] as const;
export type VectorEffects={preset:typeof VECTOR_LOOKS[number]['id'];strength?:number;brightness?:number;contrast?:number;saturation?:number;hue?:number};
const finite=(value:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value!)):fallback;
/** Browser-native colour filters preserve paths, alpha, clipping and editable sources. */
export function vectorEffectFilter(settings?:VectorEffects):string|undefined {
 if(!settings)return undefined;
 const t=finite(settings.strength,100,0,100)/100;
 const looks:Record<VectorEffects['preset'],string>={
  none:'',bw:`grayscale(${t}) contrast(${1+3*t})`,grayscale:`grayscale(${t})`,
  vintage:`sepia(${.45*t}) saturate(${1-.2*t}) contrast(${1-.1*t})`,
  washed:`saturate(${1-.45*t}) contrast(${1-.2*t}) brightness(${1+.1*t})`,
  muted:`saturate(${1-.5*t})`,vibrant:`saturate(${1+.6*t}) contrast(${1+.1*t})`,
  sepia:`sepia(${t})`,invert:`invert(${t})`,warm:`sepia(${.35*t}) saturate(${1+.15*t})`,
  cold:`sepia(${.2*t}) hue-rotate(${165*t}deg) saturate(${1-.1*t})`,
 };
 const result=[looks[settings.preset]??''];
 const brightness=finite(settings.brightness,100,0,200),contrast=finite(settings.contrast,100,0,200),saturation=finite(settings.saturation,100,0,200),hue=finite(settings.hue,0,-180,180);
 if(brightness!==100)result.push(`brightness(${brightness/100})`);
 if(contrast!==100)result.push(`contrast(${contrast/100})`);
 if(saturation!==100)result.push(`saturate(${saturation/100})`);
 if(hue!==0)result.push(`hue-rotate(${hue}deg)`);
 return result.filter(Boolean).join(' ')||undefined;
}
