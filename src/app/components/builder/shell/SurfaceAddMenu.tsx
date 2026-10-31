import * as Menu from '@radix-ui/react-dropdown-menu';
import {Plus} from 'lucide-react';
import {useRef,useState} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import type {SurfaceArtwork} from '../../../lib/artworkSurface';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';

/** One insertion menu for every physical surface. */
export function SurfaceAddMenu({value,onCommit,onSelect}:{value:SurfaceArtwork;onCommit:(value:SurfaceArtwork)=>void;onSelect:(id:string)=>void}){
 const studio=usePrintsStudio(),upload=useRef<HTMLInputElement>(null),[error,setError]=useState('');
 const add=(kind:'section'|'image'|'data',image?:{source:string;aspect:number;name:string})=>{
  const id=crypto.randomUUID(),w=value.surface.width*.7,h=kind==='image'?Math.min(value.surface.height*.7,w/(image?.aspect??1)):value.surface.height*.3;
  const element:DesignElement={id,type:kind==='section'?'shape':kind==='image'?'image':'text',content:kind==='section'?'rect':kind==='image'?image!.source:'[SIZE]',x:value.surface.width/2,y:value.surface.height/2,width:w,height:h,rotation:0,layerName:kind==='section'?'Section':kind==='image'?image!.name:'Size',shapeGeometry:'bounds',shapeFilled:kind==='section',shapeFillColor:'#e5e5e5',borderWidth:0,fontSize:Math.min(3,value.surface.height*.15),fontFamily:'Inter',color:'#171717',side:'front',...(kind==='section'?{frameId:id,surfaceRole:'frame' as const,surfaceColourLinks:value.surface.colours?.label?{fill:'label'}:undefined}:{})};
  const document={...value.document,revision:value.document.revision+1,elements:[...value.document.elements.filter(e=>e.surfaceRole!=='border'),element,...value.document.elements.filter(e=>e.surfaceRole==='border')],frames:kind==='section'?[...value.document.frames,{id,name:'Section',x:element.x-w/2,y:element.y-h/2,width:w,height:h,padding:0,fill:'#e5e5e5',clip:true,layout:'free' as const,artworks:[id],leaderId:id}]:value.document.frames};
  onCommit({...value,document});onSelect(id);studio.setTool('select');
 };
 return <><Menu.Root><Menu.Trigger className="studio-outline-action"><Plus size={14}/>Add</Menu.Trigger><Menu.Portal><Menu.Content className="layer-actions-menu" sideOffset={6}>{['Section','Text','Logo','Shape','Data field'].map(label=><Menu.Item key={label} onSelect={()=>{if(label==='Section')add('section');else if(label==='Logo')upload.current?.click();else if(label==='Data field')add('data');else{studio.setPanel(label==='Text'?'text':'shapes');if(label==='Shape')studio.setLiveShape('rect');studio.setTool(label==='Text'?'textPlace':'shapeLive');}}}>{label}</Menu.Item>)}</Menu.Content></Menu.Portal></Menu.Root><input hidden ref={upload} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{if(file.size>20e6)throw new Error('Choose an image under 20 MB.');const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)}),image=new Image();image.src=source;await image.decode();add('image',{source,name:file.name,aspect:image.naturalWidth/image.naturalHeight});setError('')}catch(error){setError(error instanceof Error?error.message:'Could not open this image.')}}}/>{error&&<p role="alert" className="typography-help">{error}</p>}</>;
}
