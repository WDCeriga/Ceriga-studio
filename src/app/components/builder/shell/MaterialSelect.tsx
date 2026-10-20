import {Children,isValidElement,useEffect,useState,type ReactNode} from 'react';
import * as Select from '@radix-ui/react-select';
import {Check,ChevronDown} from 'lucide-react';
import {FABRIC_LIBRARY} from '../../../data/garmentFabrics';
import {preloadFabricScanSurfaces,fabricScanSurface} from '../../../lib/fabricTextureScans';
export function MaterialTexture({fabricId}:{fabricId:string}){
 const fabric=FABRIC_LIBRARY.find(f=>f.id===fabricId),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;if(fabric)preloadFabricScanSurfaces([{fabric}]).then(()=>{if(live)setRevision(n=>n+1)}).catch(()=>{});return()=>{live=false}},[fabricId]);
 const source=fabric?fabricScanSurface(fabric):undefined;
 return <span className="material-select-texture" data-revision={revision} style={{backgroundImage:source?`url(${source.image})`:undefined}}/>;
}
export function MaterialSelect({value,onChange,children,...props}:{value:string|number;onChange:(e:{target:{value:string}})=>void;children:ReactNode;'aria-label'?:string;disabled?:boolean;className?:string}){
 const options=Children.toArray(children).filter(isValidElement).map((element:any)=>({value:String(element.props.value??element.props.children),label:element.props.children,disabled:element.props.disabled,reason:element.props.title}));
 const chosen=options.find(o=>o.value===String(value)),fabric=FABRIC_LIBRARY.find(f=>f.id===String(value));
 return <Select.Root value={String(value)||'__inherit__'} onValueChange={v=>onChange({target:{value:v==='__inherit__'?'':v}})} disabled={props.disabled}><Select.Trigger className={'material-select-trigger '+(props.className??'')} aria-label={props['aria-label']}>{fabric&&<MaterialTexture fabricId={fabric.id}/>}<Select.Value>{chosen?.label??'Choose an option'}</Select.Value><Select.Icon><ChevronDown size={13}/></Select.Icon></Select.Trigger><Select.Portal><Select.Content position="popper" sideOffset={5} collisionPadding={10} className="material-select-menu"><Select.Viewport>{options.map(option=>{const f=FABRIC_LIBRARY.find(f=>f.id===option.value);return <Select.Item key={option.value} value={option.value||'__inherit__'} disabled={option.disabled} className="material-select-option">{f&&<MaterialTexture fabricId={f.id}/>}<span><Select.ItemText>{option.label}</Select.ItemText>{(option.reason||f)&&<small>{option.reason??`${f!.gsm} GSM · ${f!.stretch}`}</small>}</span><Select.ItemIndicator><Check size={13}/></Select.ItemIndicator></Select.Item>})}</Select.Viewport></Select.Content></Select.Portal></Select.Root>
}
