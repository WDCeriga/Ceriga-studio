import { SHOULDER_CONSTRUCTIONS, type ShoulderConstruction } from '../../../data/shoulderConstruction';

const outline = 'M31 8Q45 17 59 8L75 15L86 37L65 44L65 54L25 54L25 44L4 37L15 15Z';
const sleevePanels: Record<ShoulderConstruction, string> = {
  'set-in': 'M15 15L4 37L25 44Q25 29 15 15Z',
  raglan: 'M31 8L15 15L4 37L25 44C25 34 29 23 33 17L31 8Z',
  saddle: 'M31 8L15 15L4 37L25 44C25 35 21 29 21 24C21 20 28 17 33 14L31 8Z',
  drop: 'M10 25L4 37L25 44Q17 35 10 25Z',
};

export function ShoulderConstructionPicker({
  value = 'set-in',
  onChange,
  onPreview,
}: {
  value?: ShoulderConstruction;
  onChange: (value: ShoulderConstruction) => void;
  onPreview?: (value: ShoulderConstruction | null) => void;
}) {
  return (
    <section className="shoulder-construction-picker">
      <h3>Shoulder construction</h3>
      <div role="group" aria-label="Shoulder construction">
        {SHOULDER_CONSTRUCTIONS.map(option => (
          <button key={option.id} type="button" aria-pressed={value === option.id}
            onClick={() => { onPreview?.(null); onChange(option.id); }}>
            <svg width={68} height={68} viewBox="0 -8 90 74" aria-hidden="true" strokeLinejoin="round">
              <path d={outline} fill="#f1f3f6" />
              <path d={sleevePanels[option.id]} fill="#a0abb9" stroke="#202020" strokeWidth="1.25" />
              <path d={sleevePanels[option.id]} transform="translate(90 0) scale(-1 1)" fill="#a0abb9" stroke="#202020" strokeWidth="1.25" />
              <path d={outline} fill="none" stroke="#202020" strokeWidth="1.35" />
              <path d="M31 8C31 24 59 24 59 8" fill="#f1f3f6" stroke="#202020" strokeWidth="1.2" />
            </svg>
            <strong>{option.name}</strong>
            <small>{option.hint}</small>
          </button>
        ))}
      </div>
      <p>Changes the body and sleeve boundaries. Sleeve colours, fabrics and patterns follow the new cut.</p>
    </section>
  );
}
