import {fontStylePatch} from '../../../lib/fontStyleSupport';
import {FontUploadControls} from './FontUploadControls';
import {fontIdentity} from '../../../lib/workspaceFonts';
import {FontAdvancedControls} from './FontAdvancedControls';
import {TextVectorControls} from './TextVectorControls';
import {useArtworkDocument} from '../printsStudio/ArtworkDocumentContext';
import {fitPenPath,shapeWorldPath} from '../../../lib/artworkPathOperations';
import {richTextSpans,styleTextRange,remapTextStyles,remapTextKerning} from '../../../lib/richArtworkText';
import {useState} from 'react';
import {PrintWearControls} from './PrintWearControls';
import {CLOTHING_FONT_NAMES} from '../../../lib/displayFonts';
import {ClothingFontPicker,ClothingFontCollection} from './ClothingFontPicker';
import {LetteringPathControls} from './LetteringPathControls';
import '@fontsource/black-ops-one/latin-400.css';
import '@fontsource/graduate/latin-400.css';
import '@fontsource/stardos-stencil/latin-700.css';
import '@fontsource/pinyon-script/latin-400.css';
import {TextileInkControls} from './TextileInkControls';
import {ArtworkHistoryControls} from './ArtworkHistoryControls';
import {Plus,Upload,Bold,Italic,AlignLeft,AlignCenter,AlignRight,Underline,Strikethrough,Lock,Unlock,MousePointer2,Type,Undo2,Redo2} from 'lucide-react';
import {useMemo} from 'react';
import * as Popover from '@radix-ui/react-popover';
import {loadFontLibrary} from '../printsStudio/designLibrary';
import type {DesignElement,PrintStudioToolAPI} from '../PrintStudioEditor';
import {TextListInput} from '../printsStudio/TextListInput';
import {PaintInput} from '../PrintStudioColorPopover';
import {ArtworkPrintMethod} from './ArtworkPrintMethod';
import {MaterialSelect} from './MaterialSelect';
import {StudioFold,StudioNumber,StudioPaint,StudioRange} from './StudioControls';
import {textCurveRadius,updateTextCurve} from '../../../lib/textCurveControls';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import type {DrawHistory} from './DrawPaintStudio';
import './typography-studio.css';

const styles = [
 {name:'Collegiate',sample:'STUDIO ATHLETICS',font:'Graduate',size:34,weight:'normal'},
 {name:'Stencil',sample:'83',font:'Black Ops One',size:64,weight:'normal'},
 {name:'Script',sample:'Made with care',font:'Pinyon Script',size:46,weight:'normal'},
 {name:'Statement',sample:'YOUR BRAND',font:'Anton',size:48,weight:'normal'},
 {name:'Editorial',sample:'Made with care.',font:'Abril Fatface',size:32,weight:'normal'},
 {name:'Essential',sample:'Everyday essentials',font:'Inter',size:26,weight:'normal'},
 {name:'Athletic',sample:'STUDIO 01',font:'Oswald',size:40,weight:'bold'},
] as const;
export function TypographyLibrary({api}:{api:PrintStudioToolAPI}) {
 const [rights,setRights]=useState(false);
 return <div className="typography-library"><label className="studio-field">Your words<TextListInput value={api.textInput} onChange={api.onTextInput} onSubmit={api.onAddText}/></label><button className="studio-solid-action" disabled={!api.textInput.trim()} onClick={api.onAddText}><Plus size={15}/>Add text</button><p className="typography-help">Double-click text on the garment to type directly.</p><section className="typography-presets"><h3>Start with a style</h3><div>{styles.map(style=><button key={style.name} aria-label={`Add ${style.name} text`} onClick={()=>api.onAddTextPreset?.({content:api.textInput.trim()||style.sample,fontFamily:style.font,fontSize:style.size,fontWeight:style.weight})}><span style={{fontFamily:style.font,fontWeight:style.weight}}>{style.sample}</span><small>{style.name}<Plus size={13}/></small></button>)}</div></section><FontUploadControls/></div>;
}
export {TextInspector as TypographyEditor} from './TextInspector';
export function TypographyCanvasTools({elements,selectedId,onChange,onSelect,history,side='front'}:{elements:DesignElement[];selectedId:string|null;onChange:(elements:DesignElement[])=>void;onSelect:(id:string|null)=>void;history?:DrawHistory;side?:'front'|'back'}) {
 const studio=usePrintsStudio(),text=elements.find(el=>el.id===selectedId&&el.type==='text');
 const fonts=useMemo(()=>[...new Set([...CLOTHING_FONT_NAMES,'Inter','Arial','Helvetica','Georgia','Times New Roman','Impact','Montserrat','Poppins','Courier New',...loadFontLibrary().map(font=>font.family),...(text?.fontFamily?[text.fontFamily]:[])])],[text?.fontFamily]);
 const addText=()=>{onSelect(null);studio.setTool('textPlace')};
 const patch=(p:Partial<DesignElement>)=>{if(text&&!text.locked)onChange(elements.map(el=>el.id===text.id?{...el,...p}:el))};
 return <div className="shape-canvas-tools typography-canvas-tools" role="toolbar" aria-label="Typography tools"><button aria-label="Select text" aria-pressed={studio.tool==='select'} onClick={()=>studio.setTool('select')}><MousePointer2 size={18}/><span>Select</span></button><button aria-label="New text" onClick={addText}><Type size={18}/><span>Text</span></button>{text&&<><i/><fieldset disabled={text.locked}><Popover.Root><Popover.Trigger className="typography-font-trigger" aria-label="Font options" title={`Font: ${text.fontFamily??'Inter'}`} disabled={text.locked}><span>Aa</span><small>Font</small></Popover.Trigger><Popover.Portal><Popover.Content className="typography-canvas-font-panel" side="right" align="center" sideOffset={10} collisionPadding={12} onOpenAutoFocus={event=>event.preventDefault()}><header><strong>Font</strong><Popover.Close aria-label="Close font options">×</Popover.Close></header><ClothingFontCollection value={text.fontFamily??'Inter'} fonts={fonts} sample={text.content} onChange={fontFamily=>patch({fontFamily,...fontIdentity(fontFamily)})}/><StudioNumber label="Font size" value={text.fontSize??30} min={6} max={500} step={1} onChange={size=>{const ratio=size/(text.fontSize||30);patch({fontSize:size,width:text.width*ratio,height:text.height*ratio,...(text.textCurveShape==='circle'?{textCurveRadius:textCurveRadius(text)*ratio}:{})})}}/></Popover.Content></Popover.Portal></Popover.Root><div className="typography-canvas-style" role="group" aria-label="Text style"><div><button aria-label="Bold on canvas" title="Bold" aria-pressed={text.fontWeight==='bold'} disabled={!fontStylePatch(text,'fontWeight')} onClick={()=>patch(fontStylePatch(text,'fontWeight')!)}><Bold size={14}/></button><button aria-label="Italic on canvas" title="Italic" aria-pressed={text.fontStyle==='italic'} disabled={!fontStylePatch(text,'fontStyle')} onClick={()=>patch(fontStylePatch(text,'fontStyle')!)}><Italic size={14}/></button></div><span>Style</span></div><div className="shape-tool-paint" role="group" aria-label="Text ink"><PaintInput value={text.color??'#171717'} onChange={e=>patch({color:e.target.value})}/><span>Colour</span></div></fieldset></>}<ArtworkHistoryControls history={history}/></div>;
}
