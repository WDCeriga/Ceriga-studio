import {StudioFold,StudioRange} from './StudioControls';
import './torso-crop.css';

const presets = [[0, 'Original'], [14, 'Cropped'], [24, 'Extra cropped']] as const;

export function TorsoCropControl({value=0,onChange}:{value?:number;onChange:(value:number)=>void}){
  return <div className="torso-crop-control studio-clean">
    <StudioFold title="Body length" hint={value ? `${value}% shorter` : 'Original length'}>
      <div className="studio-segmented torso-crop-presets" role="group" aria-label="Body length presets">
        {presets.map(([amount, label]) => <button key={amount} type="button"
          aria-pressed={value === amount} onClick={() => onChange(amount)}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
            <path d={`M9 4 Q12 7 15 4 L20 6.5 L22 11 L17.5 13 V${21 - amount / 4} H6.5 V13 L2 11 L4 6.5 Z`} />
          </svg>
          <span>{label}</span>
        </button>)}
      </div>
      <StudioRange label="Shorten body" value={value} min={0} max={30} onChange={onChange}/>
      <p>Adjusts the torso and hem only.</p>
    </StudioFold>
  </div>;
}
