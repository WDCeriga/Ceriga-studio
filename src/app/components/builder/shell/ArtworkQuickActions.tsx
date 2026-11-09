import {useContext} from 'react';
import {ArtworkSurfaceContext} from '../printsStudio/ArtworkSurfaceContext';
import * as Menu from '@radix-ui/react-dropdown-menu';
import {Copy,FlipHorizontal2,Layers,Trash2,ArrowUp,ArrowDown} from 'lucide-react';
import type {DesignElement} from '../PrintStudioEditor';
import {useArtworkDocument} from '../printsStudio/ArtworkDocumentContext';
import {duplicateStudioArtwork} from '../../../lib/studioArtwork';
export function ArtworkQuickActions({element,update}:{element:DesignElement;update:(patch:Partial<DesignElement>)=>void}) {
  const document=useArtworkDocument(),surface=useContext(ArtworkSurfaceContext);
  if(!document)return null;
  const arrange=(front:boolean)=>{
    const rest=document.elements.filter(item=>item.id!==element.id);
    const same=rest.map((item,index)=>({item,index})).filter(({item})=>(item.side??'front')===(element.side??'front'));
    const index=front?(same.at(-1)?.index??rest.length-1)+1:same[0]?.index??0;
    rest.splice(index,0,element);document.onChange(rest,element.id);
  };
  return <div className="artwork-quick-actions" role="toolbar" aria-label="Selected artwork actions">
    <button type="button" title="Duplicate artwork" onClick={()=>{const copy=duplicateStudioArtwork(element);document.onChange([...document.elements,copy],copy.id);document.onSelect(copy.id)}}><Copy size={14}/><span>Duplicate</span></button>
    <button type="button" title="Flip horizontally" disabled={element.locked} onClick={()=>update({flipHorizontal:!element.flipHorizontal})}><FlipHorizontal2 size={14}/><span>Flip</span></button>
    <Menu.Root><Menu.Trigger asChild><button type="button" disabled={element.locked} title="Arrange artwork layers"><Layers size={14}/><span>Arrange</span></button></Menu.Trigger><Menu.Portal><Menu.Content className="layer-actions-menu" align="end" sideOffset={6} collisionPadding={12}>
      <Menu.Item onSelect={()=>arrange(true)}><ArrowUp size={14}/>Bring to front</Menu.Item><Menu.Item onSelect={()=>arrange(false)}><ArrowDown size={14}/>Send to back</Menu.Item>
      {!surface&&<Menu.Separator/>}
      {!surface&&<Menu.Item onSelect={()=>update({behindTrims:!element.behindTrims})}><Layers size={14}/>{element.behindTrims?'Above details & trims':'Behind details & trims'}</Menu.Item>}
    </Menu.Content></Menu.Portal></Menu.Root>
    <button type="button" title="Delete artwork" aria-label="Delete selected artwork" disabled={element.locked} onClick={()=>{document.onChange(document.elements.filter(item=>item.id!==element.id));document.onSelect(null)}}><Trash2 size={14}/></button>
  </div>;
}
