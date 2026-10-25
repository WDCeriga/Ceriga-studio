import {Undo2,Redo2} from 'lucide-react';
import type {DrawHistory} from './DrawPaintStudio';
export function ArtworkHistoryControls({history}:{history?:DrawHistory}) {
 if(!history)return null;
 return <><i/><div className="artwork-rail-history" role="group" aria-label="Artwork history"><button aria-label="Undo artwork" title="Undo (Ctrl+Z)" disabled={!history.canUndo} onClick={history.onUndo}><Undo2 size={16}/></button><button aria-label="Redo artwork" title="Redo (Ctrl+Shift+Z)" disabled={!history.canRedo} onClick={history.onRedo}><Redo2 size={16}/></button></div></>;
}
