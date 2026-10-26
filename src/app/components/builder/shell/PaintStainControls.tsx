import type {DesignElement} from '../PrintStudioEditor';
import {paintStainPath} from '../../../lib/paintStains';
import {StudioFold,StudioNumber} from './StudioControls';
export function PaintStainControls({element:el,update}:{element:DesignElement;update:(p:Partial<DesignElement>)=>void}){
 if(!el.paintStain)return null;const settings=el.paintStain;
 const apply=(patch:Partial<typeof settings>)=>{const next={...settings,...patch};update({paintStain:next,shapePath:paintStainPath(next.style,next.seed,next.spread)})};
 return <StudioFold title="Paint stain" hint="Editable vector ink" open><div className="advanced-tool-pair">{['splash','smear','drips'].map(style=><button key={style} disabled={el.locked} aria-pressed={settings.style===style} onClick={()=>apply({style})}>{style}</button>)}</div><StudioNumber label="Scattered droplets" min={0} max={100} unit="%" value={settings.spread} onChange={spread=>apply({spread})}/><button className="studio-outline-action" disabled={el.locked} onClick={()=>apply({seed:settings.seed+1})}>New variation</button><p className="typography-help">Change colour and opacity below. Edit the vector points for a custom splash. This is deposited paint, not damage to the fabric.</p></StudioFold>;
}
