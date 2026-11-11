import {useEffect} from 'react';
import {PackagingPanelIllustration} from '../PackagingPanelIllustration';
import {usePackagingPanelPreview} from '../PackagingPanelPreviewContext';
import {PANEL_NAMES,type PackagingPanel} from '../../../data/packaging';
export function PackagingPanelPicker({panels,value,box,onChange}:{panels:PackagingPanel[];value:PackagingPanel;box:boolean;onChange:(panel:PackagingPanel)=>void}) {
  const {setPanel}=usePackagingPanelPreview();
  useEffect(()=>()=>setPanel(null),[setPanel]);
  return <div className="packaging-panel-picker" role="group" aria-label="Packaging artwork panel">{panels.map(panel=><button key={panel} type="button" aria-pressed={value===panel}
    onClick={()=>{setPanel(null);onChange(panel)}}><PackagingPanelIllustration panel={panel} box={box}/><span>{PANEL_NAMES[panel]}</span></button>)}</div>;
}
