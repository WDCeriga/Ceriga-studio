import {useEffect,useRef} from 'react';
import * as Select from '@radix-ui/react-select';
import {Check,ChevronDown} from 'lucide-react';
import {BRUSH_TEXTURES,createBrushTextureMask,loadBrushTexture,type BrushTexture} from '../../../lib/brushTextures';

/** Swatches show the real ink-removal mask, not unrelated fabric photographs. */
function TextureSwatch({texture,source}:{texture:BrushTexture;source?:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let active=true;const render=async()=>{if(texture==='custom'&&source)await loadBrushTexture(source);if(!active)return;const canvas=ref.current,context=canvas?.getContext('2d');if(!canvas||!context)return;const mask=createBrushTextureMask({texture,customTextureSource:source});const tile=document.createElement('canvas');tile.width=mask.width;tile.height=mask.height;const ctx=tile.getContext('2d');if(!ctx)return;const pixels=ctx.createImageData(mask.width,mask.height);for(let i=0;i<mask.data.length;i++){pixels.data[i*4]=82;pixels.data[i*4+1]=109;pixels.data[i*4+2]=129;pixels.data[i*4+3]=255-mask.data[i]}ctx.putImageData(pixels,0,0);context.fillStyle='#f3f6f8';context.fillRect(0,0,64,48);const pattern=context.createPattern(tile,'repeat');if(pattern){context.fillStyle=pattern;context.fillRect(0,0,64,48)}};void render().catch(()=>{});return()=>{active=false}},[texture,source]);
 return <canvas ref={ref} width={64} height={48} className="brush-texture-swatch" aria-hidden="true"/>;
}
export function BrushTextureSelect({value,source,onChange}:{value:BrushTexture;source?:string;onChange:(texture:BrushTexture)=>void}){
 const selected=BRUSH_TEXTURES.find(texture=>texture.id===value)??BRUSH_TEXTURES[0];
 return <Select.Root value={value} onValueChange={texture=>onChange(texture as BrushTexture)}><Select.Trigger aria-label="Texture" className="brush-texture-trigger"><TextureSwatch texture={value} source={source}/><Select.Value>{selected.label}</Select.Value><Select.Icon><ChevronDown size={13}/></Select.Icon></Select.Trigger><Select.Portal><Select.Content position="popper" sideOffset={5} collisionPadding={12} className="material-select-menu brush-texture-menu"><Select.Viewport>{[...new Set(BRUSH_TEXTURES.map(texture=>texture.category))].map(category=><Select.Group key={category}><Select.Label className="brush-texture-category">{category}</Select.Label>{BRUSH_TEXTURES.filter(texture=>texture.category===category).map(texture=><Select.Item key={texture.id} value={texture.id} className="brush-texture-option"><TextureSwatch texture={texture.id} source={source}/><Select.ItemText>{texture.label}</Select.ItemText><Select.ItemIndicator className="brush-texture-check"><Check size={13}/></Select.ItemIndicator></Select.Item>)}</Select.Group>)}</Select.Viewport></Select.Content></Select.Portal></Select.Root>;
}
