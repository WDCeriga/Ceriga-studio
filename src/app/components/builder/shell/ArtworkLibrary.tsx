import {ArtworkReuseLibrary} from './ArtworkReuseLibrary';
import {Link} from 'react-router';
import {FilteredImage} from '../printsStudio/FilteredImage';
import {useState} from 'react';
import {ImagePlus,Plus,Search,Upload,ArrowUpRight} from 'lucide-react';
import type {PrintStudioToolAPI} from '../PrintStudioEditor';
import {AssetLibraryPanel,useAssetWorkspaceContext} from '../printsStudio/AssetWorkspace';
import {MaterialSelect} from './MaterialSelect';
import './artwork-library.css';

export function ArtworkLibrary({api,libraryMode=false}:{api:PrintStudioToolAPI;libraryMode?:boolean}) {
 const workspace=useAssetWorkspaceContext();
 const [collection,setCollection]=useState('Uploads'),[query,setQuery]=useState(''),[search,setSearch]=useState(false);
 const uploads=api.previousUploads.filter(item=>item.name.toLowerCase().includes(query.trim().toLowerCase()));
 const count=collection==='Uploads'?api.previousUploads.length:workspace?.library.length??0;
 const currentImages=(api.garmentImages??[]).filter(image=>!image.hidden&&(!query||image.layerName?.toLowerCase().includes(query.toLowerCase())));
 if(libraryMode)return <ArtworkReuseLibrary api={api}/>;
 return <div className="artwork-library">
  <button className="artwork-upload-action" onClick={api.onUpload}><Upload size={15}/><span>Upload artwork</span><small>PNG · JPG · WebP · SVG</small></button>
  {currentImages.length>0&&<section className="artwork-current-collection"><div className="artwork-section-heading"><h3>{workspace?.project?'On this asset':'On this garment'}</h3><span>{currentImages.length}</span></div><div className="artwork-upload-grid artwork-current-grid">{currentImages.map(image=><button key={image.id} aria-label={`Edit ${image.layerName??'garment image'}`} onClick={()=>api.onSelectArtwork?.(image.id)}><div className="artwork-library-preview"><FilteredImage source={image.content} settings={image.imageFilter} alt="" thumbnail/></div><span>{image.layerName??'Placed artwork'}<small>Edit</small></span></button>)}</div></section>}
  <section className="artwork-collection"><div className="artwork-section-heading"><h3>Your artwork</h3><span>{count}</span></div>
   <div className="artwork-library-controls"><MaterialSelect aria-label="Artwork collection" value={collection} onChange={event=>setCollection(event.target.value)}>{['Uploads','Saved assets'].map(name=><option key={name}>{name}</option>)}</MaterialSelect><button aria-label="Search artwork" aria-expanded={search} onClick={()=>{setSearch(!search);setQuery('')}}><Search size={16}/></button></div>
   {search&&<label className="artwork-search"><Search size={14}/><input autoFocus aria-label="Find artwork" placeholder="Find artwork…" value={query} onChange={event=>setQuery(event.target.value)}/></label>}
   {collection==='Saved assets'?<AssetLibraryPanel query={query} showCreate={false} showHeading={false}/>:uploads.length?<div className="artwork-upload-grid" role="region" aria-label="Uploaded artwork" tabIndex={0}>{uploads.map(item=><button key={item.id??item.name} onClick={()=>api.onReuseUpload(item)} title={`Place ${item.name}`}><div className="artwork-library-preview"><img src={item.dataUrl} alt=""/></div><span>{item.name}<Plus size={12}/></span></button>)}</div>:<div className="artwork-library-empty"><ImagePlus size={23}/><p>{query?'No artwork matches your search.':'Upload a logo, illustration or graphic to start your collection.'}</p></div>}
  </section>
  {collection==='Uploads'&&workspace?.recovery&&!workspace.project&&<div className="artwork-recovery"><p>An unfinished asset is saved on this device.</p><button onClick={workspace.resume}>Resume asset draft<ArrowUpRight size={13}/></button></div>}
  {collection==='Uploads'&&workspace?.error&&!workspace.project&&<p role="alert" className="artwork-library-hint">{workspace.error}</p>}
 <Link className="studio-outline-action" to="/artwork-studies" target="_blank">Open editable print studies<ArrowUpRight size={14}/></Link>
 </div>;
}
