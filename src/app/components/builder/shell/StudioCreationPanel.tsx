import {WearTextureLibrary} from './WearTextureStudio';
import {AppliedGarmentPatterns} from './AppliedGarmentPatterns';
import {MaterialSelect} from './MaterialSelect';
import './patterns-studio.css';
import {ArtworkLibrary} from './ArtworkLibrary';
import {TypographyLibrary} from './TypographyStudio';
import { ShapesLibrary } from './ShapesStudio';
import { DrawPaintPanel } from './DrawPaintStudio';
import { TextListInput } from '../printsStudio/TextListInput';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Brush, PenTool, Eraser, FlipHorizontal2, Upload, Plus, Type, Shapes, Grid3X3, Sparkles, SlidersHorizontal, ChevronLeft } from 'lucide-react';
import type { PrintStudioToolAPI, DesignElement } from '../PrintStudioEditor';
import { usePrintsStudio } from '../printsStudio/PrintsStudioContext';
import { StudioGraphic } from '../printsStudio/StudioGraphic';
import { AssetLibraryPanel } from '../printsStudio/AssetWorkspace';
import { SHAPE_ASSETS, DISTRESS_ASSETS, STUDIO_DRAG_MIME, encodeStudioDrag, beginPatternDrag } from '../printsStudio/studioAssets';
import { PatternLibraryPanel } from '../printsStudio/PatternLibraryPanel';
import { PATTERN_CATALOG } from '../../../lib/patternCatalog';
import { initialPatternSettings } from '../../../lib/patternEditing';
import { StudioRange, StudioFold } from './StudioControls';
export function StudioCreationPanel({api}:{api:PrintStudioToolAPI}) {
 const studio=usePrintsStudio();const [patternCategory,setPatternCategory]=useState('All');
 const featured=['plaid','gingham','camo-woodland','topographic','leopard','tartan','houndstooth','stripes','argyle','camo-tiger','dots','zebra'];
 const matchingPatterns=[...PATTERN_CATALOG].sort((a,b)=>(featured.includes(a.id)?featured.indexOf(a.id):99)-(featured.includes(b.id)?featured.indexOf(b.id):99)).filter(p=>p.id!=='custom'&&(patternCategory==='All'||patternCategory===p.category));
 if(studio.panel==='brush')return <DrawPaintPanel onPick={()=>api.onClearSelection?.()}/>;
 if(studio.panel==='text')return <TypographyLibrary api={api}/>;
 if(studio.panel==='shapes')return <ShapesLibrary api={api}/>;
 if(studio.panel==='upload')return <ArtworkLibrary api={api}/>;
 if(studio.panel==='patterns')return <div className="studio-pattern-library"><AppliedGarmentPatterns elements={api.garmentPatterns??[]} onSelect={id=>api.onSelectArtwork?.(id)}/><div className="pattern-collection-toolbar"><div><h3>Pattern collection</h3><span>{matchingPatterns.length} styles</span></div><MaterialSelect aria-label="Pattern category" value={patternCategory} onChange={e=>setPatternCategory(e.target.value)}>{['All',...new Set(PATTERN_CATALOG.filter(p=>p.id!=='custom').map(p=>p.category))].map(category=><option key={category}>{category}</option>)}</MaterialSelect></div><p className="pattern-collection-hint">Drop a repeat onto a garment part. Fabric texture and stitching stay visible.</p><div className="studio-pattern-gallery pattern-swatch-collection" role="region" aria-label="Pattern collection" tabIndex={0}>{matchingPatterns.map(pattern=>{const settings={...initialPatternSettings(pattern.id,studio.color),patternSeed:1729};const preview={id:'preview-'+pattern.id,type:'pattern',content:pattern.id,x:0,y:0,width:140,height:95,rotation:0,...settings,patternSeed:1729} as DesignElement;return <button key={pattern.id} aria-label={`Add ${pattern.label} pattern`} draggable onDragStart={e=>{beginPatternDrag(e.dataTransfer,pattern.id,settings)}} onClick={()=>api.onPlaceAsset('pattern',pattern.id,settings)}><div><StudioGraphic element={preview}/></div><span>{pattern.label}</span></button>})}</div>{matchingPatterns.length===0&&<p className="studio-no-results">No patterns in this category.</p>}<StudioFold title="Create a custom repeat" hint="Use artwork, an image or an existing layer"><PatternLibraryPanel customOnly color={studio.color} selected={api.selectedElement??null} onChange={patch=>api.onUpdateSelected?.(patch)} onPlace={(id,patch)=>api.onPlaceAsset('pattern',id,patch)} uploads={api.previousUploads} layers={api.patternLayers??[]} onCaptureLayer={api.onCapturePatternLayer}/></StudioFold></div>;

 return <WearTextureLibrary api={api}/>;
}
