import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {patternDefinition} from './patternCatalog';
import {patternGeometry,patternKind} from './patternGeometry';
import {generatedPatternGeometry} from './generatedPatterns';
export function repeatTileGeometry(element:DesignElement){const definition=patternDefinition(patternKind(element));if(definition&&definition.category!=='Classic'){const geometry=generatedPatternGeometry(element);return{width:geometry.tileWidth,height:geometry.tileHeight};}const geometry=patternGeometry(element);return{width:geometry.tileSize,height:geometry.tileSize};}
export function physicalRepeatScale(element:DesignElement,tile:{width:number;height:number}){const units=element.artworkUnitsPerCm??element.textUnitsPerCm??10,physical=element.patternTileCm;return physical?{x:physical.width*units/tile.width,y:physical.height*units/tile.height}:{x:1,y:1};}
export const repeatCheckKey=(element:DesignElement)=>JSON.stringify([element.patternSource,element.patternRepeat,element.patternSpacing,element.patternSpacingX,element.patternSpacingY]);
export async function checkRepeatSeam(element:DesignElement){
 if(element.content!=='custom'||element.patternRepeat==='mirror')return{status:'pass' as const,message:'The repeat wraps at each tile edge.',sourceKey:repeatCheckKey(element),checkedAt:new Date().toISOString()};
 if(!element.patternSource)throw new Error('Choose source artwork for this repeat.');
 const image=new Image();image.crossOrigin='anonymous';image.src=element.patternSource;await image.decode();const size=128,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const context=canvas.getContext('2d')!;context.drawImage(image,0,0,size,size);const pixels=context.getImageData(0,0,size,size).data;let error=0;
 const difference=(a:number,b:number)=>{let amount=0;for(let channel=0;channel<3;channel++)amount+=Math.abs(pixels[a+channel]*pixels[a+3]/255-pixels[b+channel]*pixels[b+3]/255);return(amount/3+Math.abs(pixels[a+3]-pixels[b+3]))/2;};
 for(let index=0;index<size;index++){error+=difference(index*size*4,(index*size+size-1)*4);error+=difference(index*4,((size-1)*size+index)*4);}error/=size*2;
 const spaced=(element.patternSpacing??0)>0||(element.patternSpacingX??0)>0||(element.patternSpacingY??0)>0,pass=error<12||spaced;
 return{status:pass?'pass' as const:'risk' as const,message:pass?'Tile edges match or have intentional space.':'Source edges differ. Use Mirror, add space, or prepare a seamless source tile.',sourceKey:repeatCheckKey(element),checkedAt:new Date().toISOString()};
}
