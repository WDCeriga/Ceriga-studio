import type {PrintStudioToolAPI} from '../PrintStudioEditor';
import {ArtworkFinishControls} from './ArtworkObjectControls';
import {WearTextureLibrary} from './WearTextureStudio';
import {StudioFold} from './StudioControls';
export function ArtworkFinishesPanel({api}:{api:PrintStudioToolAPI}){const selected=api.selectedElement;return <><StudioFold title="Print finish" rowHeight={40} value={selected?.artworkFinish?.type??'Standard ink'}>{selected?<ArtworkFinishControls element={selected} update={patch=>api.onUpdateSelected?.(patch)}/>:<p className="typography-help">Select artwork to set its print finish.</p>}</StudioFold><WearTextureLibrary api={api}/></>;}
