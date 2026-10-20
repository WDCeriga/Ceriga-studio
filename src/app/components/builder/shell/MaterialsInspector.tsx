import {FabricBlendEditor} from './FabricBlendEditor';
import {MaterialColourBrowser} from './MaterialColourBrowser';

import {useEffect,useState} from 'react';

import {Search,Check,Plus,Trash2,ArrowRight,RotateCcw,Link2,Unlink,Shuffle,Palette,Layers} from 'lucide-react';

import {FABRIC_LIBRARY,FABRIC_PRESETS,applyFabricPreset,setCategoryFabric,fabricCategoryForPart,assignFabric,resolvePartFabric,setGarmentFabric,initializeFabricDefaults,resetPartFabric,setFabricGroupLinked,fabricTargets,type FabricAssignments,type FabricPart} from '../../../data/garmentFabrics';

import {preloadFabricScanSurfaces,fabricScanSurface} from '../../../lib/fabricTextureScans';

import {type FabricTextureIntensity} from '../../../data/fabricTextureIntensity';

import {type GarmentColourDefaults} from '../../../data/garmentMaterialColours';

import {type TshirtHemStyles} from '../../../data/tshirtHemStyles';

import {beginMaterialDrag,MATERIAL_DRAG_TYPE,type MaterialDrop} from '../materialDrop';

import './materials.css';

export type MaterialTool='Fabric & colour'|'Part materials'|'Colourways'|'Fabric library'|'Fabric blend';

export const MATERIAL_TOOLS:MaterialTool[]=['Fabric & colour','Part materials','Colourways','Fabric library','Fabric blend'];

type ColourState={colors:{hex:string;pantone:string}[];partColors?:Partial<Record<string,string>>;colourDefaults?:GarmentColourDefaults;tshirtHemStyles?:TshirtHemStyles;neckTrimColor?:string;sleeveTrimColor?:string;cuffTrimColor?:string;pocketTrimColor?:string;stitchingColor?:string};

export type SavedColourway={id:string;name:string;design:ColourState};

export type MaterialsState=ColourState&{fabricAssignments?:FabricAssignments;fabricTextureIntensity?:FabricTextureIntensity;fabricType?:string;gsm?:string;materialSpecs?:Record<string,string>;savedColourways?:SavedColourway[];activeColourwayId?:string};

export const captureColourway=(s:ColourState):ColourState=>JSON.parse(JSON.stringify({colors:s.colors,partColors:s.partColors??{},colourDefaults:s.colourDefaults,tshirtHemStyles:s.tshirtHemStyles,neckTrimColor:s.neckTrimColor,sleeveTrimColor:s.sleeveTrimColor,cuffTrimColor:s.cuffTrimColor,pocketTrimColor:s.pocketTrimColor,stitchingColor:s.stitchingColor}));

const palettes=[

 {name:'Ink & oat',family:'Neutrals',colours:['#242B32','#E9E2D5','#9B9B91','#F7F4ED']},

 {name:'Graphite study',family:'Greys',colours:['#34363B','#787C82','#C5C7CA','#EFEFEC']},

 {name:'Coastal blue',family:'Tonal',colours:['#304C65','#6F92AA','#B7CED7','#E5EDF0']},

 {name:'Forest floor',family:'Tonal',colours:['#344B3D','#6F8264','#A9B59A','#E7E5D7']},

 {name:'Clay & cream',family:'Earth',colours:['#A55742','#E8D7BE','#6E715B','#353A33']},

 {name:'Indigo & rust',family:'Contrast',colours:['#303F63','#C56A42','#E8DFCF','#738594']},

 {name:'Burgundy club',family:'Contrast',colours:['#622F40','#E9DCC5','#8E9E86','#313C39']},

 {name:'Lilac haze',family:'Tonal',colours:['#736482','#A99AB6','#D1C7DC','#F0EBEF']},

 {name:'Sport archive',family:'Contrast',colours:['#173F40','#E8C86C','#EDE8DA','#B65B47']},

 {name:'Sandstone',family:'Earth',colours:['#B6A085','#E7DDCC','#70624F','#EEECE4']},

 {name:'Soft pistachio',family:'Tonal',colours:['#727A52','#BAC39A','#E3E5C9','#F2F0E3']},

 {name:'Black & white',family:'Greys',colours:['#202124','#F4F2ED','#8D9095','#D5D6D6']},

];

const swatches=['#F4F1EA','#D8C8AE','#B8B5AE','#777C82','#252A30','#1F3B50','#5E80B2','#8DA8B0','#3D5747','#9CA57E','#C79357','#AD5947','#743C4E','#AA91AE','#D9B3B3','#E8C65F'];

const cleanColour=(v:string)=>/^#[a-f0-9]{6}$/i.test(v);

function FabricSwatch({fabricId}:{fabricId:string}){const fabric=FABRIC_LIBRARY.find(f=>f.id===fabricId);const [ready,setReady]=useState(0);useEffect(()=>{if(!fabric)return;let live=true;preloadFabricScanSurfaces([{fabric}]).then(()=>{if(live)setReady(n=>n+1)}).catch(()=>{});return()=>{live=false}},[fabricId]);const source=fabric?fabricScanSurface(fabric):undefined;return <span className="material-fabric-swatch" data-ready={ready} style={{backgroundImage:source?`url(${source.image})`:undefined}}/>}

export function MaterialsInspector({state,parts,partMap,tool,onTool,onChange,selectedId,onSelect,onApply,onBrush,garmentType,notes,onNotes,technical,onTechnical}:{state:MaterialsState;parts:FabricPart[];partMap:React.ReactNode;tool:MaterialTool;onTool:(tool:MaterialTool)=>void;onChange:(patch:Partial<MaterialsState>)=>void;selectedId:string|null;onSelect:(id:string|null)=>void;onApply:(partId:string,material:MaterialDrop,both:boolean)=>void;onBrush:(material:MaterialDrop|null)=>void;garmentType:string;notes:string;onNotes:(v:string)=>void;technical:boolean;onTechnical:(v:boolean)=>void}){

 const [mapExpanded,setMapExpanded]=useState(false);

 const [query,setQuery]=useState(''),[category,setCategory]=useState('All'),[family,setFamily]=useState('All'),[placement,setPlacement]=useState('Sleeves & neck'),[count,setCount]=useState(3),[hex,setHex]=useState(state.colors[0]?.hex??'#5E80B2'),[weightUnit,setWeightUnit]=useState('GSM'),[notice,setNotice]=useState(''),[target,setTarget]=useState('garment');

 const assignments=initializeFabricDefaults(garmentType,state.fabricAssignments),main=FABRIC_LIBRARY.find(f=>f.id===assignments.garmentDefault)??FABRIC_LIBRARY[0],selected=parts.find(p=>p.id===selectedId),body=state.colors[0]?.hex??'#FFFFFF',saved=state.savedColourways??[],specs=state.materialSpecs??{};

 const targets=fabricTargets(parts,assignments).filter(t=>!parts.find(p=>p.id===t.id)?.interior);
 const pairParts=(part:FabricPart,linked:boolean)=>{if(!part.group)return;const group=part.group,unlinked=new Set(state.colourDefaults?.unlinkedGroups??[]);if(linked)unlinked.delete(group);else unlinked.add(group);let fabrics=setFabricGroupLinked(assignments,parts,group,linked);const colours={...state.partColors};if(linked){const fabric=resolvePartFabric(assignments,part,parts);if(fabric)fabrics=assignFabric(fabrics,parts,part.id,fabric.id);for(const p of parts.filter(p=>p.group===group))colours[p.id]=state.partColors?.[part.id]??body}onChange({fabricAssignments:fabrics,partColors:colours,colourDefaults:{...state.colourDefaults,unlinkedGroups:[...unlinked]}});setTarget(linked?'group:'+group:part.id)};


 useEffect(()=>{const part=parts.find(p=>p.id===selectedId),group=part?.group&&!assignments.unlinkedGroups.includes(part.group)?targets.find(t=>t.id==='group:'+part.group):undefined;setTarget(group?.id??selectedId??'garment')},[selectedId]);

 useEffect(()=>{setHex(selectedId?state.partColors?.[selectedId]??body:body)},[selectedId,body,state.partColors]);

 const colourKey=JSON.stringify(captureColourway(state));



 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),2500);return()=>clearTimeout(t)},[notice]);

 const changeSpec=(key:string,value:string)=>onChange({materialSpecs:{...specs,[key]:value}});

 const applyColour=(colour:string)=>{setHex(colour);if(!cleanColour(colour))return;onBrush({kind:'colour',colour});if(target==='garment')onChange({colors:[{hex:colour,pantone:state.colors[0]?.pantone??''}]});else{const t=targets.find(t=>t.id===target);if(t)onApply(t.partIds[0],{kind:'colour',colour},t.partIds.length>1)};setNotice('Colour applied')};

 const applyFabric=(id:string)=>{onBrush({kind:'fabric',fabricId:id});if(target==='garment'){const f=FABRIC_LIBRARY.find(f=>f.id===id)!;onChange({fabricAssignments:setGarmentFabric(assignments,id),fabricType:f.name,gsm:String(f.gsm),materialSpecs:{...specs,composition:f.composition}})}else{const t=targets.find(t=>t.id===target);if(t)onApply(t.partIds[0],{kind:'fabric',fabricId:id},t.partIds.length>1)}setNotice('Fabric applied')};

 const drag=(e:React.DragEvent,material:MaterialDrop)=>{e.dataTransfer.setData(MATERIAL_DRAG_TYPE,JSON.stringify(material));e.dataTransfer.effectAllowed='copy'};

 const applyPalette=(colours:string[])=>{const chosen=colours.slice(0,count),pc:Partial<Record<string,string>>={};for(const p of parts){let index=0;if(placement==='Sleeves & neck'){if(p.role==='sleeve')index=1;if(p.role==='neck')index=2;if(p.role==='cuff'||p.role==='hem')index=3}else if(placement==='Hems & neck'){if(p.role==='cuff'||p.role==='hem'||p.role==='waistband')index=1;if(p.role==='neck')index=2;if(p.role==='pocket')index=3}else if(placement==='Asymmetric'){if(/left/i.test(p.id))index=1;if(/right/i.test(p.id))index=2;if(p.role==='neck')index=3}if(index)pc[p.id]=chosen[index%chosen.length]}

 const hems=state.tshirtHemStyles?JSON.parse(JSON.stringify(state.tshirtHemStyles)):undefined;

 // Explicit trim colours must follow the new colourway as well as the main fabric parts.

 if(hems)for(const value of Object.values(hems))if(value&&typeof value==='object')delete (value as any).color;

 onChange({activeColourwayId:undefined,colors:[{hex:chosen[0],pantone:''}],partColors:pc,colourDefaults:undefined,tshirtHemStyles:hems,neckTrimColor:undefined,sleeveTrimColor:undefined,cuffTrimColor:undefined,pocketTrimColor:undefined});setNotice('Palette applied to garment')};

 const save=()=>{if(saved.length>=3)return;const id=crypto.randomUUID();onChange({savedColourways:[...saved,{id,name:`Colourway ${saved.length+1}`,design:captureColourway(state)}],activeColourwayId:id});setNotice('Colourway saved')};

 const pickPart=(id:string)=>{setTarget(id);const t=targets.find(t=>t.id===id);onSelect(id==='garment'?null:t?.partIds[0]??id)};

 const fabricGrid=<><div className="material-search"><Search size={15}/><input aria-label="Search fabrics" placeholder="Search fabrics" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="material-filter" aria-label="Fabric categories">{['All','Jersey','Sweatshirt','Rib','Woven','Technical','Textured knit'].map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="material-fabric-grid">{FABRIC_LIBRARY.filter(f=>(category==='All'||f.category===category)&&`${f.name} ${f.composition}`.toLowerCase().includes(query.toLowerCase())).map(f=><button key={f.id} className="material-fabric-card" draggable={false} onPointerDown={e=>beginMaterialDrag(e,{kind:'fabric',fabricId:f.id})} aria-pressed={main.id===f.id} onClick={()=>applyFabric(f.id)}><FabricSwatch fabricId={f.id}/><span><strong>{f.name}</strong><small>{f.gsm} GSM</small></span>{main.id===f.id&&<Check className="material-card-check" size={14}/>}</button>)}</div>{!FABRIC_LIBRARY.some(f=>(category==='All'||f.category===category)&&`${f.name} ${f.composition}`.toLowerCase().includes(query.toLowerCase()))&&<p>No fabrics match. Try another name or category.</p>}</>;

 return <div className="materials-editor"><header className="materials-heading"><span className="builder-eyebrow">MATERIAL STUDIO</span><h2>{tool}</h2><p>Build the feel. Find your colours.</p></header><nav className="material-mobile-tabs" aria-label="Material tools">{MATERIAL_TOOLS.map(t=><button key={t} aria-current={tool===t?'page':undefined} onClick={()=>onTool(t)}>{t}</button>)}</nav><div role="status" className="material-notice" aria-live="polite">{notice||(tool==='Fabric blend'?'Two fabrics. One balanced recipe.':'Drag a swatch onto the shirt, or choose a part below.')}</div>

 {tool!=='Fabric blend'&&tool!=='Fabric & colour'&&tool!=='Part materials'&&<button className="material-target-summary" aria-expanded={mapExpanded} onClick={()=>setMapExpanded(v=>!v)}><span>Apply to <strong>{target==='garment'?'Main fabric / body':targets.find(t=>t.id===target)?.label??selected?.label}</strong></span><span>{mapExpanded?'Done':'Change'}</span></button>}

 {(tool!=='Fabric blend'&&(tool==='Fabric & colour'||tool==='Part materials'||mapExpanded))&&<> <section className="material-part-map" aria-label="Choose garment section"><div className="material-map-header"><span>Apply to</span><button aria-pressed={target==='garment'} onClick={()=>pickPart('garment')}>Whole garment</button></div><div className="material-map-drawing">{partMap}</div><div className="material-map-selection"><span className="material-map-dot"/><strong>{target==='garment'?'Main fabric / body colour':targets.find(t=>t.id===target)?.label??selected?.label??'Choose a section'}</strong></div><div className="material-map-parts">{targets.filter(t=>t.partIds.length>1||['body','neck','hem','waistband','hood','pocket'].includes(parts.find(p=>p.id===t.id)?.role??'')).map(t=><button key={t.id} aria-pressed={target===t.id} onClick={()=>pickPart(t.id)}>{t.label}</button>)}</div>{selected?.group&&<button className="material-map-link" aria-pressed={!assignments.unlinkedGroups.includes(selected.group)} onClick={()=>pairParts(selected,assignments.unlinkedGroups.includes(selected.group!))}>{assignments.unlinkedGroups.includes(selected.group)?<Unlink size={14}/>:<Link2 size={14}/>} {assignments.unlinkedGroups.includes(selected.group)?'Link paired parts':'Paired parts linked'}</button>}</section>

</>}



 {tool==='Fabric blend'&&<FabricBlendEditor specs={specs} assignments={assignments} onChange={onChange}/>}
 {tool==='Fabric & colour'&&<><section className="material-main-card"><FabricSwatch fabricId={main.id}/><div><span className="builder-eyebrow">MAIN FABRIC</span><h3>{main.name}</h3><p>{specs.composition||main.composition}</p><small>{state.gsm||main.gsm} GSM · {main.drape}</small></div><button aria-label="Browse fabric library" onClick={()=>onTool('Fabric library')}><ArrowRight size={18}/></button></section><div className="material-spec-row"><label>Composition<input aria-label="Fabric composition" value={specs.composition??main.composition} onChange={e=>changeSpec('composition',e.target.value)}/></label><label>Weight<div className="material-weight"><input aria-label="Fabric weight" inputMode="decimal" value={weightUnit==='GSM'?state.gsm??String(main.gsm):String(Math.round(Number(state.gsm||main.gsm)/33.906*100)/100)} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0)onChange({gsm:weightUnit==='GSM'?e.target.value:String(Math.round(n*33.906))})}}/><select aria-label="Weight unit" value={weightUnit} onChange={e=>setWeightUnit(e.target.value)}><option>GSM</option><option>oz/yd²</option></select></div></label></div><section className="material-colour-section"><div className="material-section-title"><h3>Colour</h3><button onClick={()=>onTool('Colourways')}>Explore palettes <ArrowRight size={13}/></button></div><div className="material-colour-entry"><input type="color" aria-label="Pick material colour" value={cleanColour(hex)?hex:body} onChange={e=>applyColour(e.target.value)}/><input aria-label="Colour hex" value={hex} onChange={e=>setHex(e.target.value)} onBlur={()=>applyColour(hex)} onKeyDown={e=>{if(e.key==='Enter')applyColour(hex)}}/>{!cleanColour(hex)&&<small>Use #RRGGBB</small>}</div><MaterialColourBrowser value={cleanColour(hex)?hex:body} onChange={applyColour} onReference={(reference,colour)=>target==='garment'?onChange({colors:[{hex:colour??(cleanColour(hex)?hex:body),pantone:reference}]}):changeSpec('colour:'+target,reference)}/><button className="material-wide-button" onClick={()=>onBrush(null)}>Finish painting parts</button><label>Colour reference<input aria-label="Pantone or lab-dip reference" placeholder="Pantone / lab-dip reference" value={target==='garment'?state.colors[0]?.pantone??'':specs['colour:'+target]??''} onChange={e=>target==='garment'?onChange({colors:[{hex:body,pantone:e.target.value}]}):changeSpec('colour:'+target,e.target.value)}/></label><p className="material-caption">Screen colours are previews. Add a production colour reference for the factory.</p><button className="material-wide-button" onClick={()=>onChange({partColors:{},colourDefaults:undefined,neckTrimColor:undefined,sleeveTrimColor:undefined,cuffTrimColor:undefined,pocketTrimColor:undefined})}><Link2 size={14}/>Match all parts to body</button></section><details className="material-disclosure"><summary>Preview settings</summary><label>Texture strength <output>{state.fabricTextureIntensity?.garment??40}%</output><input type="range" min="0" max="100" value={state.fabricTextureIntensity?.garment??40} onChange={e=>onChange({fabricTextureIntensity:{...state.fabricTextureIntensity,garment:Number(e.target.value)}})}/></label>{selectedId&&<><label className="material-checkbox"><input type="checkbox" checked={state.fabricTextureIntensity?.parts?.[selectedId]===undefined} onChange={e=>{const next={...state.fabricTextureIntensity?.parts};if(e.target.checked)delete next[selectedId];else next[selectedId]=state.fabricTextureIntensity?.garment??40;onChange({fabricTextureIntensity:{...state.fabricTextureIntensity,parts:next}})}}/>Selected part follows garment texture</label>{state.fabricTextureIntensity?.parts?.[selectedId]!==undefined&&<label>Selected part texture<input type="range" min="0" max="100" value={state.fabricTextureIntensity.parts[selectedId]} onChange={e=>onChange({fabricTextureIntensity:{...state.fabricTextureIntensity,parts:{...state.fabricTextureIntensity?.parts,[selectedId]:Number(e.target.value)}}})}/></label>}</>}<label className="material-checkbox"><input type="checkbox" checked={technical} onChange={e=>onTechnical(e.target.checked)}/>Clean technical view</label></details></>}

 {tool==='Fabric library'&&<><section className="material-recommendations"><strong>Recommended for {garmentType==='tshirt'?'T-shirts':garmentType}</strong><div>{FABRIC_LIBRARY.filter(f=>(garmentType==='tshirt'?['single-jersey','interlock-jersey','pique']:garmentType==='hoodie'?['french-terry','heavyweight-fleece','brushed-fleece']:['cotton-twill','denim-twill','nylon-taslan']).includes(f.id)).map(f=><button key={f.id} onClick={()=>applyFabric(f.id)}>{f.name}</button>)}</div><p>Start with a body fabric, then add compatible trims.</p></section><p className="material-caption">Construction swatches · select to apply, drag for a specific part.</p>{fabricGrid}<details className="material-disclosure"><summary>Selected fabric details</summary><p>{main.structure}</p><p>{main.composition} · {main.stretch} stretch · {main.thickness} weight</p></details></>}

 {tool==='Part materials'&&<><section className="material-mix-guide"><strong>Build a balanced fabric mix</strong><p>{main.category==='Woven'||main.category==='Technical'?'Use woven or technical panels with similar weight. Add stretch trims only where the construction allows.':'Jersey, terry and fleece can pair with rib for a stretchy neck or cuff. Keep adjoining body panels similar in weight and stretch.'}</p><small>Check stretch, shrinkage and care compatibility with your supplier before production.</small></section><p className="material-caption">Keep the body soft, add rib to a neck or cuff, or choose a different lining. Linked pairs change together.</p><div className="material-part-list">{targets.filter(t=>t.partIds.length>1||!parts.find(p=>p.id===t.id)?.group).map(t=>{const p=parts.find(p=>p.id===t.partIds[0])!,f=resolvePartFabric(assignments,p,parts)??main,linked=Boolean(p.group&&!assignments.unlinkedGroups.includes(p.group));return <details className="material-part-card" key={t.id} open={t.partIds.includes(selectedId??'')}><summary onClick={()=>{onSelect(p.id);setTarget(t.id)}}><FabricSwatch fabricId={f.id}/><span>{t.label}<small>{f.name}{linked?' · Linked':''}</small></span><i style={{background:state.partColors?.[p.id]??body}}/></summary><div className="material-group-editor">{(linked?[p]:parts.filter(p=>t.partIds.includes(p.id))).map(member=><div key={member.id}><label>{linked?'Paired fabric':member.label}<select aria-label={`Fabric for ${member.label}`} value={resolvePartFabric(assignments,member,parts)?.id??main.id} onChange={e=>onApply(member.id,{kind:'fabric',fabricId:e.target.value},linked)}>{FABRIC_LIBRARY.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><input type="color" aria-label={`Colour for ${member.label}`} value={state.partColors?.[member.id]??body} onChange={e=>onApply(member.id,{kind:'colour',colour:e.target.value},linked)}/><button aria-label={`Reset ${member.label} fabric`} onClick={()=>onChange({fabricAssignments:resetPartFabric(assignments,parts,member.id)})}><RotateCcw size={13}/></button></div>)}{p.group&&<button className="material-wide-button" onClick={()=>pairParts(p,!linked)}>{linked?<Link2 size={13}/>:<Unlink size={13}/>} {linked?'Unlink left & right':'Pair left & right'}</button>}</div></details>})}</div><button className="material-wide-button" onClick={()=>{const rib=parts.filter(p=>['neck','cuff','waistband'].includes(p.role));let next=assignments;for(const p of rib)next=assignFabric(next,parts,p.id,'rib-1x1');onChange({fabricAssignments:next});setNotice('Rib added to neck and compatible trims')}}>Use rib on neck & cuffs</button></>}

 {tool==='Colourways'&&<><section className="material-saved"><div className="material-section-title"><h3>Your colourways</h3><span>{saved.length} / 3</span></div><div className="material-saved-grid">{saved.map(c=><div key={c.id} data-active={state.activeColourwayId===c.id}><button aria-label={`Load ${c.name}`} onClick={()=>onChange({colourDefaults:undefined,tshirtHemStyles:undefined,neckTrimColor:undefined,sleeveTrimColor:undefined,cuffTrimColor:undefined,pocketTrimColor:undefined,stitchingColor:undefined,...c.design,activeColourwayId:c.id})}><span className="material-palette-strip">{[...new Set([c.design.colors[0]?.hex,...Object.values(c.design.partColors??{})])].filter(Boolean).slice(0,4).map((colour,i)=><i key={i} style={{background:colour}}/>)}</span></button><input aria-label={`Name ${c.name}`} value={c.name} onChange={e=>onChange({savedColourways:saved.map(s=>s.id===c.id?{...s,name:e.target.value}:s)})}/><button aria-label={`Delete ${c.name}`} onClick={()=>onChange({savedColourways:saved.filter(s=>s.id!==c.id),activeColourwayId:state.activeColourwayId===c.id?undefined:state.activeColourwayId})}><Trash2 size={13}/></button></div>)}{saved.length<3&&<button className="material-save-new" onClick={save}><Plus size={19}/><span>Save current</span></button>}</div>{state.activeColourwayId&&saved.some(c=>c.id===state.activeColourwayId&&JSON.stringify(c.design)!==colourKey)&&<button className="material-wide-button" onClick={()=>{onChange({savedColourways:saved.map(c=>c.id===state.activeColourwayId?{...c,design:captureColourway(state)}:c)});setNotice('Saved colourway updated')}}>Update selected colourway</button>}<p className="material-caption">Each slot saves one complete combination. Load a slot to compare, or save the current preview.</p></section><div className="material-section-title"><h3>Palette library</h3><span>Curated for clothing</span></div><div className="material-filter">{['All','Neutrals','Tonal','Greys','Earth','Contrast'].map(f=><button key={f} aria-pressed={family===f} onClick={()=>setFamily(f)}>{f}</button>)}</div><div className="material-palette-settings"><label>Colours<select aria-label="Number of palette colours" value={count} onChange={e=>setCount(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label><label>Placement<select aria-label="Palette placement" value={placement} onChange={e=>setPlacement(e.target.value)}>{['Sleeves & neck','Hems & neck','Asymmetric'].map(p=><option key={p}>{p}</option>)}</select></label></div><div className="material-palette-list">{palettes.filter(p=>family==='All'||p.family===family).map(p=><article key={p.name}><button aria-label={`Apply ${p.name} palette`} onClick={()=>applyPalette(p.colours)}><span className="material-palette-strip">{p.colours.slice(0,count).map(c=><i key={c} style={{background:c}}/>)}</span><span><strong>{p.name}</strong><small>{p.family}</small><ArrowRight size={14}/></span></button><div className="material-palette-drag">{p.colours.slice(0,count).map(c=><button key={c} aria-label={`Drag or apply ${c}`} title={c} style={{background:c}} draggable={false} onPointerDown={e=>beginMaterialDrag(e,{kind:'colour',colour:c})} onClick={()=>applyColour(c)}/>)}</div></article>)}</div></>}

 {tool==='Part materials'&&<section className="material-disclosure"><div className="material-section-title"><h3>Interior</h3></div><label className="material-checkbox"><input type="checkbox" checked={assignments.interior?.matchExteriorFabric===false||assignments.interior?.matchExteriorColour===false} onChange={e=>onChange({fabricAssignments:{...assignments,interior:{...assignments.interior,matchExteriorFabric:!e.target.checked,matchExteriorColour:!e.target.checked,fabricId:assignments.interior?.fabricId??main.id,colour:assignments.interior?.colour??body}}})}/>Use a separate fabric & colour</label>{(assignments.interior?.matchExteriorFabric===false||assignments.interior?.matchExteriorColour===false)&&<div className="material-spec-row"><label>Interior fabric<select aria-label="Interior fabric" value={assignments.interior?.matchExteriorFabric?'':assignments.interior?.fabricId??main.id} onChange={e=>onChange({fabricAssignments:{...assignments,interior:{matchExteriorColour:true,...assignments.interior,matchExteriorFabric:!e.target.value,fabricId:e.target.value||undefined}}})}><option value="">Same as exterior</option>{FABRIC_LIBRARY.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Interior colour<input type="color" aria-label="Interior colour" value={assignments.interior?.colour??body} onChange={e=>onChange({fabricAssignments:{...assignments,interior:{matchExteriorFabric:true,...assignments.interior,matchExteriorColour:false,colour:e.target.value}}})}/></label></div>}</section>}



 </div>

}



export function ColourwayCanvasBar({state,onChange,onOpen}:{state:MaterialsState;onChange:(patch:Partial<MaterialsState>)=>void;onOpen:()=>void}){const saved=state.savedColourways??[];return <div className="material-canvas-colourways" aria-label="Saved colourways">{saved.map(c=><button key={c.id} aria-label={`Preview ${c.name}`} aria-pressed={state.activeColourwayId===c.id} onClick={()=>onChange({colourDefaults:undefined,tshirtHemStyles:undefined,neckTrimColor:undefined,sleeveTrimColor:undefined,cuffTrimColor:undefined,pocketTrimColor:undefined,stitchingColor:undefined,...c.design,activeColourwayId:c.id})}><span>{[...new Set([c.design.colors[0]?.hex,...Object.values(c.design.partColors??{})])].filter(Boolean).slice(0,4).map((v,i)=><i key={i} style={{background:v}}/>)}</span><small>{c.name}</small></button>)}{saved.length<3&&<button className="material-canvas-save" aria-label="Save current colourway" onClick={()=>{const id=crypto.randomUUID();onChange({savedColourways:[...saved,{id,name:`Colourway ${saved.length+1}`,design:captureColourway(state)}],activeColourwayId:id});onOpen()}}><Plus size={17}/><small>Save colourway</small></button>}</div>}
