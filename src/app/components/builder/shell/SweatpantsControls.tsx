import type { CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { SWEATPANTS_OPTIONS, SWEATPANTS_SHORT_LEGS, sweatpantsBlock, sweatpantsLength, sweatpantsLengthAdjustment, sweatpantsLegThumbnail } from '../../../data/sweatpants';
import type { GarmentAssetSelection } from '../../../data/garmentSvgCatalog';
import './sweatpants-controls.css';
import { VisualOptionGrid, CroppedImage, harmonisePreviewArt } from '../design-system';

function WaistbandPreview({ construction }: { construction: string }) {
  const gathered = construction === 'elastic' || construction === 'drawstring';
  return (
    <svg className="sweatpants-waistband-art" viewBox="0 0 200 76" fill="none" aria-hidden="true">
      <g stroke="#51565c" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 41Q8 50 4 69M188 41Q192 50 196 69" stroke="#a1a5aa" />
        <path d="M12 41Q100 51 188 41L186 22Q100 14 14 22Z" fill="#f1f2f3" />
        <path d="M14 22Q100 30 186 22" />
        <path d="M15 36Q100 45 185 36" stroke="#8b9096" strokeDasharray="2 2.5" />
        {gathered && Array.from({ length: 18 }, (_, i) => {
          const x = 20 + i * 9.4;
          const curve = 1 - ((x - 100) / 88) ** 2;
          if (construction === 'drawstring' && Math.abs(x - 100) < 18) return null;
          return <path key={i} d={`M${x} ${25 + 3 * curve}q-3 5 0 10`} stroke="#94999e" strokeWidth=".85" />;
        })}
        {construction === 'rib' && Array.from({ length: 39 }, (_, i) => {
          const x = 17 + i * 4.35;
          const curve = 1 - ((x - 100) / 88) ** 2;
          return <path key={i} d={`M${x} ${26 + 3 * curve}v${8 + 2 * curve}`} stroke="#858b91" strokeWidth={i % 2 ? '.65' : '1'} />;
        })}
        {construction === 'folded' && <path d="M14 29Q100 37 186 29" stroke="#8b9096" />}
        {construction === 'drawstring' && <>
          <circle cx="92" cy="34" r="2" fill="white" />
          <circle cx="108" cy="34" r="2" fill="white" />
          <path d="M92 34Q91 48 89 60M108 34Q109 48 111 60" strokeWidth="1.8" />
        </>}
      </g>
    </svg>
  );
}

const legThumbnails = Object.fromEntries(SWEATPANTS_OPTIONS.pantsLeg.options.map(([shape]) => [shape, sweatpantsLegThumbnail(shape)]));
const shortLegThumbnails = Object.fromEntries(SWEATPANTS_SHORT_LEGS.map(([shape]) => [shape, sweatpantsLegThumbnail(shape,true)]));

function LegShapePreview({ shape, short }: { shape: string; short: boolean }) {
  return <img className="sweatpants-leg-art" src={(short?shortLegThumbnails:legThumbnails)[shape]} alt="" />;
}

function RisePreview({ rise }: { rise: string }) {
  const waist = rise === 'low' ? 29 : rise === 'high' ? 9 : 19;

  return (
    <svg className="sweatpants-rise-art" viewBox="0 0 100 72" fill="none" aria-hidden="true">
      <path d="M16 19H25M75 19H84" stroke="#a6abb1" strokeDasharray="2 3" />
      <path d={`M26 ${waist}Q50 ${waist - 4} 74 ${waist}Q80 39 79 66H56L50 53L44 66H21Q20 39 26 ${waist}Z`}
        fill="#f1f2f3" stroke="#51565c" strokeWidth="1.4" strokeLinejoin="round" />
      <path d={`M25 ${waist + 7}Q50 ${waist + 3} 75 ${waist + 7}M50 ${waist + 7}V53`} stroke="#858b91" />
      <path d={`M18 ${waist}H12V53H18`} stroke="#51565c" strokeWidth="1.4" />
    </svg>
  );
}

/** Rise on the real trouser render: the dashed line is the natural waist; the garment sits lower (low), at (mid) or above (high) it. */
function RiseTechPreview({ rise, leg }: { rise: string; leg: string }) {
  const shift = rise === 'low' ? 9 : rise === 'high' ? -3 : 3; // % of tile height
  return (
    <span className="cx-rise" aria-hidden="true">
      <img src={harmonisePreviewArt(sweatpantsLegThumbnail(leg))} alt="" draggable={false} style={{ transform: `translateY(${shift}%)` }} />
      <i className="cx-rise-waist" />
    </span>
  );
}
function HemPreview({ finish }: { finish: string }) {
  return (
    <svg viewBox="0 0 100 90" fill="none" aria-hidden="true">
      <path d="M20 8L15 65Q50 73 85 65L80 8" fill="#f3f4f5" stroke="#555" strokeWidth="1.4" />
      <path d={finish === 'rib' || finish === 'elastic' ? 'M16 52Q50 59 84 52' : 'M16 60Q50 68 84 60'}
        stroke="#888" strokeDasharray={finish === 'open' || finish === 'raw' ? '1 3' : '3 2'} />
      {finish === 'rib' && Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M${20 + i * 5} 55v11`} stroke="#999" strokeWidth=".7" />
      ))}
      {finish === 'adjustable' && <g stroke="#555" strokeWidth="1.2">
        <path d="M17 49Q50 57 83 49" strokeDasharray="3 2"/>
        <circle cx="21" cy="62" r="1.8"/>
        <path d="M21 61Q9 60 9 68Q8 75 13 73L22 64"/>
        <rect x="9" y="64" width="8" height="5" rx="1.5" fill="#aaa" transform="rotate(18 13 66)"/>
      </g>}
    </svg>
  );
}

const defaults: Record<string, string> = {
  pantsRise: 'mid', pantsLength: 'full', pantsLeg: 'straight', pantsWaist: 'elastic',
};
const sectionOptions = { fit: ['pantsRise', 'pantsLength'], waist: ['pantsWaist'], leg: ['pantsLeg'], hem: ['pantsHem'] };

export function SweatpantsControls({ selection, onChange, section = 'fit' }: {
  section?: keyof typeof sectionOptions;
  selection: GarmentAssetSelection;
  onChange: (patch: GarmentAssetSelection) => void;
}) {
  const length = sweatpantsLength(selection.pantsLength);
  const adjustment = sweatpantsLengthAdjustment(selection);
  const adjustmentKey = length === 'shorts' ? 'pantsShortLengthAdjust' : 'pantsFullLengthAdjust';
  const setAdjustment = (value: string) => {
    const number = Number(value);
    if (Number.isFinite(number)) onChange({ [adjustmentKey]: String(Math.max(-10, Math.min(15, number))) });
  };

  return (
    <div className={section === 'fit' ? 'sweatpants-fit-controls' : 'sweatpants-fit-controls sweatpants-illustrated-controls'}>
      {Object.entries(SWEATPANTS_OPTIONS).filter(([key]) => sectionOptions[section].includes(key)).map(([key, group]) => {
        const isLength = key === 'pantsLength';
        const isRise = key === 'pantsRise';
        const isLeg = key === 'pantsLeg';
        const shortLeg = isLeg && length === 'shorts';
        const options = shortLeg ? SWEATPANTS_SHORT_LEGS : group.options;
        const selected = isLength ? length : key === 'pantsHem' ? sweatpantsBlock(selection).hem
          : isLeg ? sweatpantsBlock(selection).leg : selection[key] ?? defaults[key];
        return (
          <details className="sweatpants-choice" key={key} open>
            <summary><span>{group.label}<small>{options.find(([value]) => value === selected)?.[1]}</small></span><ChevronDown size={16} /></summary>
            {section === 'fit' ? (
              // Phase 1: fit choices use the shared VisualOptionGrid with feature-specific previews.
              <div className="sweatpants-fit-grid cx"><VisualOptionGrid label={group.label} columns={isLength ? 2 : 3} value={selected}
                options={options.map(([value, label]) => ({ id: value, label,
                  preview: isRise ? <RiseTechPreview rise={value} leg={sweatpantsBlock(selection).leg} />
                    : <CroppedImage region="full" src={sweatpantsLegThumbnail(sweatpantsBlock(selection).leg, value === 'shorts')} /> }))}
                onChange={value => onChange({ [key]: value })} /></div>
            ) : <div className={`sweatpants-option-grid${isLength ? ' sweatpants-length-options' : ''}${isRise ? ' sweatpants-rise-options' : ''}`}
              role="group" aria-label={group.label}>
              {options.map(([value, label]) => (
                <button type="button" key={value} aria-pressed={selected === value}
                  className={selected === value ? 'is-selected' : ''} onClick={() => onChange({
                    [shortLeg?'pantsShortLeg':key]: value,
                    ...(key==='pantsWaist'&&value==='drawstring'&&selection.pantsDrawstring==='none'?{pantsDrawstring:'auto'}:{}),
                  })}>
                  {isRise && <RisePreview rise={value} />}
                  {section === 'waist' && <WaistbandPreview construction={value} />}
                  {section === 'leg' && <LegShapePreview shape={value} short={shortLeg} />}
                  {section === 'hem' && <HemPreview finish={value} />}
                  <span>{label}</span>
                </button>
              ))}
            </div>}
            {isLength && (
              <div className="sweatpants-length-adjuster" style={{ '--length-position': `${(adjustment + 10) * 4}%` } as CSSProperties}>
                <div className="sweatpants-length-value">
                  <label htmlFor="trouser-length-adjustment">Length adjustment</label>
                  <span><input id="trouser-length-adjustment" type="number" aria-label="Length adjustment in centimetres"
                    min="-10" max="15" step="0.5" value={adjustment} onChange={event => setAdjustment(event.target.value)} /> cm</span>
                </div>
                <div className="sweatpants-length-slider">
                  <div className="sweatpants-length-track" aria-hidden="true" />
                  <input type="range" aria-label="Adjust leg length" min="-10" max="15" step="0.5"
                    value={adjustment} onChange={event => setAdjustment(event.target.value)} />
                </div>
                <div className="sweatpants-length-scale" aria-hidden="true"><span>-10 cm</span><span>+15 cm</span></div>
                <button className="sweatpants-length-reset" type="button" disabled={adjustment === 0} onClick={() => setAdjustment('0')}>Reset length</button>
              </div>
            )}
            {isLength && section === 'fit' && <p className="cx-section-helper">Adjusts the leg and hem only.</p>}
          </details>
        );
      })}
    </div>
  );
}
