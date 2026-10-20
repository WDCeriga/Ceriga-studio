import {useState} from 'react';

import {Search,Check,Pipette} from 'lucide-react';

import {fabricColors} from '../../../data/builderSteps';

import {beginMaterialDrag} from '../materialDrop';

export function MaterialColourBrowser({value,onChange,onReference}:{value:string;onChange:(hex:string)=>void;onReference:(reference:string,hex?:string)=>void}){

 const [tab,setTab]=useState('Library'),[query,setQuery]=useState(''),[family,setFamily]=useState('All'),[hue,setHue]=useState(210),[reference,setReference]=useState('');

 const hueHex=(h:number,s:number,l:number)=>{const a=s*Math.min(l,1-l),f=(n:number)=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))};return '#'+[f(0),f(8),f(4)].map(n=>Math.round(n*255).toString(16).padStart(2,'0')).join('')};

 const colours=family==='All'?fabricColors:fabricColors.filter(c=>({Neutrals:/white|gray|grey|silver|charcoal|black/i,Blues:/blue|navy|cyan|teal|indigo/i,Greens:/green|olive|mint|emerald/i,Warm:/red|pink|rose|orange|yellow|gold|cream|brown|rust|amber|coral|peach|bronze|ochre/i,Purples:/purple|lavender|violet|magenta|plum/i} as any)[family].test(c.name));

 const filtered=colours.filter(c=>(c.name+' '+c.hex+' '+c.pantone).toLowerCase().includes(query.toLowerCase()));

 const swatch=(hex:string,name:string)=><button key={hex+name} aria-label={`Choose ${name}`} title={name+' · '+hex} style={{background:hex}} onClick={()=>onChange(hex)} onPointerDown={e=>beginMaterialDrag(e,{kind:'colour',colour:hex})}>{value.toUpperCase()===hex.toUpperCase()&&<Check size={12}/>}</button>;

 return <section className="material-colour-browser"><nav aria-label="Colour picker mode">{['Library','Pantone','Pick'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</nav>{tab==='Library'?<><div className="material-search"><Search size={13}/><input aria-label="Search colours" placeholder="Search a colour, shade or hex" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="material-filter">{['All','Neutrals','Blues','Greens','Warm','Purples'].map(f=><button key={f} aria-pressed={family===f} onClick={()=>setFamily(f)}>{f}</button>)}</div><div className="material-browser-swatches">{filtered.map(c=>swatch(c.hex,c.name))}</div>{!filtered.length&&<p>No matching colours. Try another search.</p>}</>:tab==='Pantone'?<><div className="material-search"><Search size={13}/><input aria-label="Search Pantone references" placeholder="Search an existing reference" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="material-reference-list">{fabricColors.filter(c=>c.pantone&&(c.name+' '+c.pantone).toLowerCase().includes(query.toLowerCase())).slice(0,12).map(c=><button key={c.hex} onClick={()=>{onChange(c.hex);onReference(c.pantone,c.hex)}}><i style={{background:c.hex}}/><span>{c.name}<small>{c.pantone}</small></span></button>)}</div></>:<><div className="material-spectrum" style={{background:`linear-gradient(to top,#0000,white),linear-gradient(to right,#000, hsl(${hue} 100% 50%))`}}><div className="material-browser-swatches">{[.85,.7,.55,.4,.25].flatMap(l=>[.15,.35,.55,.75,1].map(s=>swatch(hueHex(hue,s,l),`Shade ${hue} ${s} ${l}`)))}</div></div><label>Hue<input aria-label="Colour hue" type="range" min="0" max="360" value={hue} onChange={e=>setHue(Number(e.target.value))}/></label><label className="material-native-picker"><Pipette size={15}/>Choose any colour<input type="color" aria-label="Custom colour picker" value={value} onChange={e=>onChange(e.target.value)}/></label></>}</section>

}

