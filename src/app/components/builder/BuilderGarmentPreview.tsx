import { useId } from 'react';
import type { GarmentType } from '../../data/builderSteps';
import { cn } from '../ui/utils';
import { constructionColor } from '../../lib/tshirtSvgUtils';

export interface BuilderGarmentPreviewProps {
  garmentType: GarmentType;
  color: string;
  neckType?: string;
  sleeveType?: string;
  sleeveLength?: string;
  hemType?: string;
  cuffType?: string;
  pocketType?: string;
  zipType?: string;
  fadingType?: string;
  stitchingType?: string;
  stitchingColor?: string;
  neckTrimColor?: string;
  sleeveTrimColor?: string;
  pocketTrimColor?: string;
  className?: string;
}

const VB_W = 520;
const VB_H = 560;

const TOP_TORSO =
  'M 110 200 L 110 510 L 410 510 L 410 200 L 330 120 L 260 120 L 190 120 Z';

const LEFT_SLEEVE_SHORT =
  'M 110 200 L 60 175 L 45 260 L 55 275 L 95 230 Z';
const LEFT_SLEEVE_LONG =
  'M 110 200 L 60 175 L 35 420 L 55 435 L 95 230 Z';
const RIGHT_SLEEVE_SHORT =
  'M 410 200 L 460 175 L 475 260 L 465 275 L 425 230 Z';
const RIGHT_SLEEVE_LONG =
  'M 410 200 L 460 175 L 485 420 L 465 435 L 425 230 Z';

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [92, 127, 182];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const f = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex(r + (f - r) * t, g + (f - g) * t, b + (f - b) * t);
}

function sleeveEndY(length?: string): number {
  if (length === 'long') return 435;
  if (length === 'three-quarter') return 360;
  return 275;
}

function stitchDash(type?: string): string {
  switch (type) {
    case 'double':
      return '3 2';
    case 'chain':
      return '1 3';
    case 'overlock':
      return '4 2 1 2';
    case 'flatlock':
      return '6 2';
    case 'cover':
      return '2 1';
    case 'raw':
      return '1 4';
    default:
      return 'none';
  }
}

function isTopGarment(type: GarmentType): boolean {
  return ['tshirt', 'hoodie', 'sweatshirt', 'jacket', 'dress'].includes(type);
}

function NeckLayer({
  garmentType,
  neckType,
  trimColor,
  fill,
  stroke,
}: {
  garmentType: GarmentType;
  neckType?: string;
  trimColor?: string;
  fill: string;
  stroke: string;
}) {
  const trim = trimColor ?? shade(fill, -0.25);
  const cx = 260;

  if (garmentType === 'hoodie') {
    const resolvedNeck = neckType ?? 'hood-single';
    if (resolvedNeck === 'fullzip' || resolvedNeck === 'halfzip') {
      return (
        <g>
          <path
            d="M 190 120 Q 260 55 330 120 L 330 95 Q 260 35 190 95 Z"
            fill={shade(fill, -0.08)}
            stroke={stroke}
            strokeWidth={1.5}
          />
          <line
            x1={cx}
            y1={95}
            x2={cx}
            y2={resolvedNeck === 'fullzip' ? 510 : 280}
            stroke={trimColor ?? '#888'}
            strokeWidth={3}
          />
        </g>
      );
    }
    const hoodDepth = resolvedNeck === 'hood-double' ? 48 : 38;
    return (
      <g>
        <path
          d={`M 175 115 Q 260 ${115 - hoodDepth} 345 115 L 335 130 Q 260 ${130 - hoodDepth + 12} 185 130 Z`}
          fill={shade(fill, -0.12)}
          stroke={stroke}
          strokeWidth={1.5}
        />
        {resolvedNeck === 'hood-double' ? (
          <path
            d={`M 185 130 Q 260 ${142 - hoodDepth + 12} 335 130`}
            fill="none"
            stroke={trim}
            strokeWidth={4}
          />
        ) : null}
        <ellipse cx={cx} cy={118} rx={42} ry={14} fill={shade(fill, -0.2)} stroke={stroke} strokeWidth={1} />
      </g>
    );
  }

  if (garmentType === 'jacket') {
    if (neckType === 'shirt') {
      return (
        <g>
          <path d="M 190 120 L 210 155 L 230 120" fill={trim} stroke={stroke} strokeWidth={1} />
          <path d="M 330 120 L 310 155 L 290 120" fill={trim} stroke={stroke} strokeWidth={1} />
          <path d="M 230 120 L 260 135 L 290 120" fill="none" stroke={stroke} strokeWidth={1.5} />
        </g>
      );
    }
    if (neckType === 'zip') {
      return (
        <g>
          <rect x={240} y={95} width={40} height={35} rx={4} fill={trim} stroke={stroke} strokeWidth={1} />
          <line x1={cx} y1={130} x2={cx} y2={510} stroke={trimColor ?? '#666'} strokeWidth={3} />
        </g>
      );
    }
    if (neckType === 'mock') {
      return (
        <rect x={215} y={95} width={90} height={45} rx={6} fill={trim} stroke={stroke} strokeWidth={1.5} />
      );
    }
  }

  if (neckType === 'vneck') {
    return (
      <g>
        <path d="M 190 120 L 260 195 L 330 120" fill="none" stroke={stroke} strokeWidth={2.5} />
        <path d="M 198 120 L 260 188 L 322 120 Z" fill={shade(fill, -0.15)} stroke={trim} strokeWidth={3} />
      </g>
    );
  }

  if (neckType === 'mock') {
    return (
      <rect x={215} y={95} width={90} height={50} rx={8} fill={trim} stroke={stroke} strokeWidth={1.5} />
    );
  }

  if (neckType === 'scoop' || neckType === 'square') {
    const d =
      neckType === 'square'
        ? 'M 200 120 L 200 175 L 320 175 L 320 120'
        : 'M 200 120 Q 260 210 320 120';
    return (
      <g>
        <path d={d} fill="none" stroke={stroke} strokeWidth={2.5} />
        <path
          d={neckType === 'square' ? 'M 208 120 L 208 168 L 312 168 L 312 120 Z' : 'M 208 120 Q 260 198 312 120 Z'}
          fill={shade(fill, -0.15)}
          stroke={trim}
          strokeWidth={3}
        />
      </g>
    );
  }

  // crew (default)
  return (
    <g>
      <ellipse cx={cx} cy={128} rx={48} ry={18} fill={shade(fill, -0.15)} stroke={stroke} strokeWidth={1.5} />
      <ellipse cx={cx} cy={128} rx={48} ry={18} fill="none" stroke={trim} strokeWidth={4} />
    </g>
  );
}

function SleeveLayer({
  sleeveType,
  sleeveLength,
  fill,
  stroke,
  trimColor,
  cuffType,
}: {
  sleeveType?: string;
  sleeveLength?: string;
  fill: string;
  stroke: string;
  trimColor?: string;
  cuffType?: string;
}) {
  if (sleeveType === 'sleeveless') {
    return (
      <g>
        <path d="M 110 200 Q 130 175 190 120" fill="none" stroke={stroke} strokeWidth={2} />
        <path d="M 410 200 Q 390 175 330 120" fill="none" stroke={stroke} strokeWidth={2} />
      </g>
    );
  }

  const endY = sleeveEndY(sleeveLength);
  const leftPath =
    sleeveLength === 'long'
      ? LEFT_SLEEVE_LONG
      : sleeveLength === 'three-quarter'
        ? 'M 110 200 L 60 175 L 40 360 L 55 375 L 95 230 Z'
        : LEFT_SLEEVE_SHORT;
  const rightPath =
    sleeveLength === 'long'
      ? RIGHT_SLEEVE_LONG
      : sleeveLength === 'three-quarter'
        ? 'M 410 200 L 460 175 L 480 360 L 465 375 L 425 230 Z'
        : RIGHT_SLEEVE_SHORT;

  const raglanOffset = sleeveType === 'raglan' ? 30 : sleeveType === 'dropped' ? 55 : 0;

  return (
    <g>
      <path d={leftPath} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <path d={rightPath} fill={fill} stroke={stroke} strokeWidth={1.5} />
      {sleeveType === 'raglan' ? (
        <>
          <line x1={190 + raglanOffset} y1={120} x2={60} y2={175} stroke={stroke} strokeWidth={1.5} strokeDasharray="4 3" />
          <line x1={330 - raglanOffset} y1={120} x2={460} y2={175} stroke={stroke} strokeWidth={1.5} strokeDasharray="4 3" />
        </>
      ) : null}
      {sleeveType === 'dropped' ? (
        <>
          <line x1={110} y1={200 + raglanOffset} x2={60} y2={175} stroke={stroke} strokeWidth={1.5} />
          <line x1={410} y1={200 + raglanOffset} x2={460} y2={175} stroke={stroke} strokeWidth={1.5} />
        </>
      ) : null}
      <CuffBand y={endY} trimColor={trimColor} fill={fill} stroke={stroke} side="left" cuffType={cuffType} />
      <CuffBand y={endY} trimColor={trimColor} fill={fill} stroke={stroke} side="right" cuffType={cuffType} />
    </g>
  );
}

function CuffBand({
  y,
  trimColor,
  fill,
  stroke,
  side,
  cuffType,
}: {
  y: number;
  trimColor?: string;
  fill: string;
  stroke: string;
  side: 'left' | 'right';
  cuffType?: string;
}) {
  const trim = trimColor ?? shade(fill, -0.2);
  const x = side === 'left' ? 45 : 435;
  const w = 50;

  if (cuffType === 'raw') {
    return (
      <path
        d={`M ${x} ${y - 8} l 4 -3 l 4 3 l 4 -3 l 4 3 l 4 -3 l 4 3 l 4 -3 l 4 3 l 4 -3 l 4 3`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
    );
  }

  if (cuffType === 'elasticated') {
    return (
      <path
        d={`M ${x} ${y - 6} Q ${x + w / 2} ${y + 4} ${x + w} ${y - 6}`}
        fill="none"
        stroke={trim}
        strokeWidth={3}
      />
    );
  }

  const bandH = cuffType === 'banded' ? 10 : 14;
  return (
    <rect
      x={x}
      y={y - bandH}
      width={w}
      height={bandH}
      fill={trim}
      stroke={stroke}
      strokeWidth={1}
      rx={cuffType === 'ribbed' ? 2 : 0}
    />
  );
}

function HemLayer({
  hemType,
  fill,
  stroke,
  y = 510,
}: {
  hemType?: string;
  fill: string;
  stroke: string;
  y?: number;
}) {
  if (hemType === 'curved') {
    return (
      <path
        d={`M 110 ${y} Q 260 ${y + 18} 410 ${y}`}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
      />
    );
  }

  if (hemType === 'split') {
    return (
      <g>
        <line x1={110} y1={y} x2={140} y2={y} stroke={stroke} strokeWidth={2} />
        <line x1={380} y1={y} x2={410} y2={y} stroke={stroke} strokeWidth={2} />
        <line x1={140} y1={y} x2={140} y2={y + 22} stroke={stroke} strokeWidth={1.5} />
        <line x1={380} y1={y} x2={380} y2={y + 22} stroke={stroke} strokeWidth={1.5} />
      </g>
    );
  }

  if (hemType === 'ribbed') {
    return (
      <rect x={110} y={y - 16} width={300} height={16} fill={shade(fill, -0.22)} stroke={stroke} strokeWidth={1} />
    );
  }

  if (hemType === 'raw') {
    return (
      <path
        d={`M 110 ${y} l 5 -4 l 5 4 l 5 -4 l 5 4 l 5 -4 l 5 4 l 5 -4 l 5 4 l 5 -4 l 5 4 l 5 -4 l 5 4`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
    );
  }

  return <line x1={110} y1={y} x2={410} y2={y} stroke={stroke} strokeWidth={2} />;
}

function PocketLayer({
  pocketType,
  trimColor,
  stroke,
}: {
  pocketType?: string;
  trimColor?: string;
  stroke: string;
}) {
  if (!pocketType || pocketType === 'none') return null;
  const trim = trimColor ?? '#888';

  if (pocketType === 'kangaroo') {
    return (
      <path
        d="M 175 320 Q 260 380 345 320 L 345 400 Q 260 420 175 400 Z"
        fill="none"
        stroke={trim}
        strokeWidth={2.5}
      />
    );
  }

  if (pocketType === 'welt') {
    return (
      <g>
        <line x1={200} y1={280} x2={320} y2={280} stroke={trim} strokeWidth={4} />
        <line x1={200} y1={284} x2={320} y2={284} stroke={stroke} strokeWidth={1} />
      </g>
    );
  }

  if (pocketType === 'side-seam') {
    return (
      <g>
        <rect x={112} y={340} width={28} height={32} rx={2} fill="none" stroke={trim} strokeWidth={2} />
        <rect x={380} y={340} width={28} height={32} rx={2} fill="none" stroke={trim} strokeWidth={2} />
      </g>
    );
  }

  // patch
  return (
    <rect x={215} y={240} width={90} height={70} rx={4} fill="none" stroke={trim} strokeWidth={2.5} />
  );
}

function ZipLayer({ zipType, trimColor }: { zipType?: string; trimColor?: string }) {
  if (!zipType || zipType === 'none') return null;
  const color = trimColor ?? '#777';

  if (zipType === 'chest') {
    return (
      <g>
        <line x1={200} y1={250} x2={320} y2={250} stroke={color} strokeWidth={4} />
        <rect x={255} y={246} width={10} height={8} rx={1} fill={color} />
      </g>
    );
  }

  const y2 = zipType === 'half' ? 320 : zipType === 'concealed' ? 510 : 510;
  return (
    <g opacity={zipType === 'concealed' ? 0.35 : 1}>
      <line x1={260} y1={130} x2={260} y2={y2} stroke={color} strokeWidth={zipType === 'concealed' ? 2 : 4} />
      <rect x={256} y={130} width={8} height={12} rx={1} fill={color} />
    </g>
  );
}

function FadingLayer({ fadingType, uid }: { fadingType?: string; uid: string }) {
  if (!fadingType || fadingType === 'none') return null;

  const opacity =
    fadingType === 'light'
      ? 0.18
      : fadingType === 'medium'
        ? 0.28
        : fadingType === 'heavy'
          ? 0.4
          : fadingType === 'acid'
            ? 0.35
            : 0.25;

  const id = `fade-${uid}`;

  return (
    <g opacity={opacity} style={{ mixBlendMode: 'multiply' }}>
      <defs>
        <radialGradient id={id} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="55%" stopColor="#fff" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#333" stopOpacity={0.85} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={VB_W} height={VB_H} fill={`url(#${id})`} />
      {fadingType === 'ombré' ? (
        <rect x={0} y={280} width={VB_W} height={280} fill="#111" opacity={0.25} />
      ) : null}
      {fadingType === 'localised' ? (
        <>
          <ellipse cx={180} cy={380} rx={80} ry={60} fill="#222" opacity={0.35} />
          <ellipse cx={340} cy={400} rx={70} ry={50} fill="#222" opacity={0.3} />
        </>
      ) : null}
      {fadingType === 'snow' ? (
        <>
          {Array.from({ length: 18 }).map((_, i) => (
            <circle
              key={i}
              cx={60 + (i * 27) % 400}
              cy={120 + (i * 31) % 380}
              r={2 + (i % 3)}
              fill="#fff"
              opacity={0.5}
            />
          ))}
        </>
      ) : null}
    </g>
  );
}

function StitchingLayer({
  stitchingType,
  stitchingColor,
  stroke,
}: {
  stitchingType?: string;
  stitchingColor?: string;
  stroke: string;
}) {
  const color = stitchingColor ?? stroke;
  const dash = stitchDash(stitchingType);
  const props = {
    fill: 'none' as const,
    stroke: color,
    strokeWidth: stitchingType === 'double' ? 2 : 1.5,
    strokeDasharray: dash === 'none' ? undefined : dash,
  };

  return (
    <g>
      <path d="M 110 200 L 110 510" {...props} />
      <path d="M 410 200 L 410 510" {...props} />
      <path d="M 110 200 L 410 200" {...props} />
      {stitchingType === 'bartack' ? (
        <>
          <line x1={108} y1={200} x2={112} y2={210} stroke={color} strokeWidth={3} />
          <line x1={408} y1={200} x2={412} y2={210} stroke={color} strokeWidth={3} />
        </>
      ) : null}
    </g>
  );
}

function renderBottoms(
  garmentType: GarmentType,
  fill: string,
  stroke: string,
  hemType?: string,
  pocketType?: string,
  pocketTrim?: string,
) {
  const hemY = garmentType === 'shorts' ? 340 : garmentType === 'skirt' ? 480 : 510;
  const legH = garmentType === 'shorts' ? 340 : 510;

  if (garmentType === 'skirt') {
    return (
      <g>
        <rect x={170} y={120} width={180} height={24} rx={4} fill={shade(fill, -0.1)} stroke={stroke} strokeWidth={1.5} />
        <path
          d={`M 160 144 L 180 ${hemY} L 340 ${hemY} L 360 144 Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <HemLayer hemType={hemType} fill={fill} stroke={stroke} y={hemY} />
      </g>
    );
  }

  return (
    <g>
      <rect x={150} y={120} width={220} height={28} rx={6} fill={shade(fill, -0.1)} stroke={stroke} strokeWidth={1.5} />
      <path d={`M 165 148 L 175 ${legH} L 245 ${legH} L 255 148 Z`} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <path d={`M 275 148 L 285 ${legH} L 355 ${legH} L 365 148 Z`} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <HemLayer hemType={hemType} fill={fill} stroke={stroke} y={legH} />
      {pocketType && pocketType !== 'none' ? (
        <PocketLayer pocketType={pocketType === 'kangaroo' ? 'patch' : pocketType} trimColor={pocketTrim} stroke={stroke} />
      ) : null}
    </g>
  );
}

function renderTop(
  props: BuilderGarmentPreviewProps,
  fill: string,
  stroke: string,
  uid: string,
) {
  const {
    garmentType,
    neckType,
    sleeveType,
    sleeveLength,
    hemType,
    cuffType,
    pocketType,
    zipType,
    fadingType,
    stitchingType,
    stitchingColor,
    neckTrimColor,
    sleeveTrimColor,
    pocketTrimColor,
  } = props;

  return (
    <g>
      <path d={TOP_TORSO} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <SleeveLayer
        sleeveType={sleeveType}
        sleeveLength={sleeveLength}
        fill={fill}
        stroke={stroke}
        trimColor={sleeveTrimColor}
        cuffType={cuffType}
      />
      <NeckLayer
        garmentType={garmentType}
        neckType={neckType}
        trimColor={neckTrimColor}
        fill={fill}
        stroke={stroke}
      />
      <HemLayer hemType={hemType} fill={fill} stroke={stroke} />
      <PocketLayer pocketType={pocketType} trimColor={pocketTrimColor} stroke={stroke} />
      <ZipLayer zipType={zipType} trimColor={pocketTrimColor} />
      <StitchingLayer stitchingType={stitchingType} stitchingColor={stitchingColor} stroke={stroke} />
      <FadingLayer fadingType={fadingType} uid={uid} />
    </g>
  );
}

export function BuilderGarmentPreview({
  garmentType,
  color,
  neckType,
  sleeveType,
  sleeveLength,
  hemType,
  cuffType,
  pocketType,
  zipType,
  fadingType,
  stitchingType,
  stitchingColor,
  neckTrimColor,
  sleeveTrimColor,
  pocketTrimColor,
  className,
}: BuilderGarmentPreviewProps) {
  const uid = useId().replace(/:/g, '');
  const fill = color || '#5C7FB6';
  const stroke = constructionColor(fill, shade(fill, -0.35));
  const gradientId = `garment-light-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn('relative z-[1] drop-shadow-[0_18px_40px_rgba(0,0,0,0.22)]', className)}
      aria-label="Garment preview"
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.18} />
        </linearGradient>
      </defs>

      {isTopGarment(garmentType)
        ? renderTop(
            {
              garmentType,
              color: fill,
              neckType,
              sleeveType,
              sleeveLength,
              hemType,
              cuffType,
              pocketType,
              zipType,
              fadingType,
              stitchingType,
              stitchingColor: constructionColor(fill, stitchingColor ?? stroke),
              neckTrimColor,
              sleeveTrimColor,
              pocketTrimColor,
            },
            fill,
            stroke,
            uid,
          )
        : renderBottoms(garmentType, fill, stroke, hemType, pocketType, pocketTrimColor)}

      <rect
        x={0}
        y={0}
        width={VB_W}
        height={VB_H}
        fill={`url(#${gradientId})`}
        pointerEvents="none"
        opacity={0.65}
      />
    </svg>
  );
}
