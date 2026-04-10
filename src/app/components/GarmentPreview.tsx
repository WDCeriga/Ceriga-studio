import { useEffect, useRef } from 'react';

interface GarmentPreviewProps {
  garmentType: string;
  color: string;
  neckType?: string;
  sleeveType?: string;
  sleeveLength?: string;
  mode: 'builder' | 'techpack';
  showFront?: boolean;
}

export function GarmentPreview({
  garmentType,
  color,
  neckType,
  sleeveType,
  sleeveLength,
  mode = 'builder',
}: GarmentPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      svgRef.current.style.setProperty('--garment-fill', mode === 'techpack' ? '#FFFFFF' : color);
      svgRef.current.style.setProperty('--garment-stroke', mode === 'techpack' ? '#2C2C2A' : '#171717');
    }
  }, [color, mode]);

  const renderTShirt = () => (
    <g id="layer-body">
      <path
        d="M150 120 L150 80 L130 70 L110 80 L100 100 L100 280 L200 280 L200 100 L190 80 L170 70 L150 80 Z"
        fill="var(--garment-fill)"
        stroke="var(--garment-stroke)"
        strokeWidth="2"
      />
      {sleeveType !== 'sleeveless' && (
        <>
          <path
            d={
              sleeveLength === 'long'
                ? 'M100 100 L80 110 L70 200 L85 205 L95 120 Z'
                : 'M100 100 L85 110 L80 140 L90 145 L95 120 Z'
            }
            fill="var(--garment-fill)"
            stroke="var(--garment-stroke)"
            strokeWidth="2"
          />
          <path
            d={
              sleeveLength === 'long'
                ? 'M200 100 L220 110 L230 200 L215 205 L205 120 Z'
                : 'M200 100 L215 110 L220 140 L210 145 L205 120 Z'
            }
            fill="var(--garment-fill)"
            stroke="var(--garment-stroke)"
            strokeWidth="2"
          />
        </>
      )}
      <g id="layer-neck">
        {neckType === 'vneck' ? (
          <path
            d="M130 70 L150 95 L170 70"
            fill="none"
            stroke="var(--garment-stroke)"
            strokeWidth="2"
          />
        ) : (
          <ellipse
            cx="150"
            cy="75"
            rx="20"
            ry="10"
            fill="none"
            stroke="var(--garment-stroke)"
            strokeWidth="2"
          />
        )}
      </g>
    </g>
  );

  const renderHoodie = () => (
    <g id="layer-body">
      <path
        d="M150 120 L150 80 L130 70 L110 80 L100 100 L100 280 L200 280 L200 100 L190 80 L170 70 L150 80 Z"
        fill="var(--garment-fill)"
        stroke="var(--garment-stroke)"
        strokeWidth="2"
      />
      <path
        d="M130 70 Q150 40 170 70"
        fill="var(--garment-fill)"
        stroke="var(--garment-stroke)"
        strokeWidth="2"
      />
      <path
        d="M100 100 L80 110 L70 200 L85 205 L95 120 Z"
        fill="var(--garment-fill)"
        stroke="var(--garment-stroke)"
        strokeWidth="2"
      />
      <path
        d="M200 100 L220 110 L230 200 L215 205 L205 120 Z"
        fill="var(--garment-fill)"
        stroke="var(--garment-stroke)"
        strokeWidth="2"
      />
      <rect
        x="120"
        y="160"
        width="60"
        height="40"
        fill="none"
        stroke="var(--garment-stroke)"
        strokeWidth="1.5"
        rx="3"
      />
    </g>
  );

  const renderTrousers = () => (
    <g id="layer-body">
      <rect
        x="100"
        y="100"
        width="100"
        height="15"
        fill="var(--garment-fill)"
        stroke="var(--garment-stroke)"
        strokeWidth="2"
      />
      <path
        d="M100 115 L105 280 L135 280 L140 115 Z"
        fill="var(--garment-fill)"
        stroke="var(--garment-stroke)"
        strokeWidth="2"
      />
      <path
        d="M160 115 L165 280 L195 280 L200 115 Z"
        fill="var(--garment-fill)"
        stroke="var(--garment-stroke)"
        strokeWidth="2"
      />
      <path d="M105 120 L110 145" stroke="var(--garment-stroke)" strokeWidth="1.5" fill="none" />
      <path d="M195 120 L190 145" stroke="var(--garment-stroke)" strokeWidth="1.5" fill="none" />
    </g>
  );

  const renderGarment = () => {
    switch (garmentType) {
      case 'hoodie':
      case 'sweatshirt':
        return renderHoodie();
      case 'trousers':
      case 'shorts':
        return renderTrousers();
      case 'tshirt':
      default:
        return renderTShirt();
    }
  };

  const renderAnnotations = () => {
    if (mode !== 'techpack') return null;

    return (
      <g id="layer-labels">
        <line x1="150" y1="75" x2="250" y2="75" stroke="#2C2C2A" strokeWidth="0.5" />
        <text x="255" y="78" fontSize="9" fill="#2C2C2A">
          {neckType === 'vneck' ? 'V-Neck' : neckType === 'crew' ? 'Crew Neck' : 'Neck Detail'}
        </text>

        {sleeveType !== 'sleeveless' && (
          <>
            <line x1="85" y1="150" x2="40" y2="150" stroke="#2C2C2A" strokeWidth="0.5" />
            <text x="10" y="153" fontSize="9" fill="#2C2C2A">
              {sleeveType || 'Set-in'} {sleeveLength || 'Short'} Sleeve
            </text>
          </>
        )}

        <line x1="150" y1="280" x2="250" y2="280" stroke="#2C2C2A" strokeWidth="0.5" />
        <text x="255" y="283" fontSize="9" fill="#2C2C2A">
          Hem
        </text>
      </g>
    );
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-transparent">
      <svg
        ref={svgRef}
        viewBox="0 0 300 350"
        className={`max-h-full max-w-full ${mode === 'techpack' ? 'techpack-mode' : 'builder-mode'}`}
        style={{
          filter:
            mode === 'techpack'
              ? 'none'
              : 'drop-shadow(0 18px 40px rgba(0, 0, 0, 0.22))',
        }}
      >
        {mode === 'builder' && (
          <ellipse cx="150" cy="175" rx="70" ry="105" fill="rgba(255,255,255,0.08)" />
        )}
        {renderGarment()}
        {renderAnnotations()}
      </svg>
    </div>
  );
}
