import {canAttachLabelToCollar, type GarmentLabel} from '../../../data/garmentLabels';
import {AdvancedColorPopover} from '../PrintStudioColorPopover';

const stitchChoices = [
  { id: 'none', label: 'None', path: '' },
  { id: 'top', label: 'Top edge', path: 'M10 9H54' },
  { id: 'bottom', label: 'Bottom edge', path: 'M10 27H54' },
  { id: 'top-bottom', label: 'Top & bottom', path: 'M10 9H54M10 27H54' },
  { id: 'sides', label: 'Both sides', path: 'M11 8V28M53 8V28' },
] as const;

export function LabelEdgeControls({label,onChange}:{label:GarmentLabel;onChange:(patch:Partial<GarmentLabel>)=>void}) {
  if (label.construction === 'printed') return null;
  const stitching = label.stitchingPlacement ?? 'none';
  const thread = label.stitchingColour ?? '#555555';
  return <section className="label-edge-controls">
    <h3>Outline & stitching</h3>
    <label className="label-edge-toggle">
      <span>Outline<small>A solid line around the cut edge</small></span>
      <input type="checkbox" checked={label.borderEnabled}
        onChange={event=>onChange({borderEnabled:event.target.checked,borderStyle:'solid',borderVersion:2})}/>
    </label>
    {label.borderEnabled && <AdvancedColorPopover value={label.border} onChange={border=>onChange({border})}>
      <button type="button" className="label-edge-colour"><i style={{background:label.border}}/>Outline colour<span>{label.border.toUpperCase()}</span></button>
    </AdvancedColorPopover>}
    <p className="label-edge-caption">Stitching position</p>
    <div className="label-stitch-choices" role="group" aria-label="Stitching position">
      {stitchChoices.map(({id,label:name,path})=><button type="button" key={id} aria-pressed={stitching===id}
        onClick={()=>onChange({stitchingPlacement:id})}>
        <svg viewBox="0 0 64 36" aria-hidden="true">
          <rect x="6" y="4" width="52" height="28" rx="2" fill="#fafafa" stroke="#d4d4d4"/>
          {path && <path d={path} fill="none" stroke="#262626" strokeWidth="1.5" strokeDasharray="3 2"/>}
        </svg>
        <span>{name}</span>
      </button>)}
    </div>
    {stitching !== 'none' && <AdvancedColorPopover value={thread} onChange={stitchingColour=>onChange({stitchingColour})}>
      <button type="button" className="label-edge-colour"><i style={{background:thread}}/>Thread colour<span>{thread.toUpperCase()}</span></button>
    </AdvancedColorPopover>}
    {canAttachLabelToCollar(label) && <label className="label-edge-toggle label-collar-attachment">
      <span>Sew into collar seam<small>Attach the top of the label to the inside back collar.</small></span>
      <input type="checkbox" checked={Boolean(label.attachToCollarSeam)}
        onChange={event=>onChange({attachToCollarSeam:event.target.checked,...(event.target.checked && stitching === 'none' ? {stitchingPlacement:'top'} : {})})}/>
    </label>}
  </section>;
}
