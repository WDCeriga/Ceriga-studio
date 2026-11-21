import type { DesignElement } from '../../PrintStudioEditor';
import { StudioNumber } from '../../shell/StudioControls';

type Style = NonNullable<DesignElement['shapeStrokeStyle']>;
const STYLES: { id: Style; label: string; dash?: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed', dash: '5 3' },
  { id: 'dotted', label: 'Dotted', dash: '.01 3.5' },
  { id: 'double', label: 'Double' },
];

/** Outline line style with real dash / gap sizes (plan F.1). Values are garment px, shown in mm. */
export function StrokeStyleControls({ element, update, unitsPerCm }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void; unitsPerCm: number }) {
  const style = element.shapeStrokeStyle ?? 'solid', sw = element.borderWidth ?? 2;
  const mm = (px: number) => px * 10 / Math.max(.0001, unitsPerCm), px = (value: number) => value * Math.max(.0001, unitsPerCm) / 10;
  return <div className="cx-stroke-style">
    <div className="cx-stroke-style__row" role="group" aria-label="Line style">
      {STYLES.map(item => <button key={item.id} type="button" aria-pressed={style === item.id} title={item.label} onClick={() => update({ shapeStrokeStyle: item.id })}>
        <svg viewBox="0 0 40 12" aria-hidden="true">
          {item.id === 'double' ? <><path d="M3 4h34" /><path d="M3 8h34" /></> : <path d="M3 6h34" strokeDasharray={item.dash} />}
        </svg>
        <span>{item.label}</span>
      </button>)}
    </div>
    {(style === 'dashed' || style === 'dotted') && <div className="cx-dash-row">
      {style === 'dashed' && <StudioNumber label="Dash" unit="mm" min={.1} max={100} step={.1} value={mm(element.shapeDashLength ?? sw * 3)} onChange={value => update({ shapeDashLength: px(value) })} />}
      <StudioNumber label="Gap" unit="mm" min={.1} max={100} step={.1} value={mm(element.shapeDashGap ?? sw * 2)} onChange={value => update({ shapeDashGap: px(value) })} />
    </div>}
  </div>;
}
