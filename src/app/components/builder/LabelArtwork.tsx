import { useEffect, useId, useState } from 'react';
import { CARE_OPTIONS, labelTextSections, type CareCategory, type GarmentLabel } from '../../data/garmentLabels';

const loadedFonts = new Map<string, Promise<FontFace>>();
export function loadLabelFont(label: GarmentLabel) {
  if (!label.fontData) return Promise.resolve();
  const key = label.font + label.fontData;
  if (!loadedFonts.has(key)) {
    const face = new FontFace(label.font, `url(${label.fontData})`);
    loadedFonts.set(key, face.load().then(font => { document.fonts.add(font); return font; }));
  }
  return loadedFonts.get(key)!;
}

let measureCanvas: HTMLCanvasElement | undefined;
export function labelLayout(label: GarmentLabel) {
  const curved = label.shape === 'circle' || label.shape === 'oval';
  const insetX = Math.max(label.marginMm, label.construction === 'physical' && label.fold === 'end' ? Math.min(label.foldMm, label.widthMm / 5) + .5 : 0) + (curved ? label.widthMm * .15 : 0);
  const insetY = label.marginMm + (curved ? label.heightMm * .15 : 0);
  const usableWidth = Math.max(1, label.widthMm - insetX * 2);
  const usableHeight = Math.max(1, label.heightMm - insetY * 2);
  const logoWidth = label.logo ? Math.min(usableWidth * label.logoWidth / 100, usableHeight * label.logo.aspect * .55) : 0;
  const logoHeight = label.logo ? logoWidth / label.logo.aspect : 0;
  const logoX = insetX + (usableWidth - logoWidth) * label.logoX / 100;
  const logoY = insetY + (usableHeight - logoHeight) * label.logoY / 100;
  measureCanvas ??= document.createElement('canvas');
  const context = measureCanvas.getContext('2d')!;
  const measure = (text: string) => context.measureText(text).width + Math.max(0, text.length - 1) * label.letterSpacingMm;
  const lines: string[] = [];
  const textLines: { text: string; section: string; size: number; weight: number; y: number }[] = [];
  const dividers: number[] = [];
  let cursor = label.logo ? logoY + logoHeight + label.marginMm : insetY;
  let oversizedWord = false;
  for (const [sectionIndex, section] of labelTextSections(label).entries()) {
    const size = label.fontSizeMm * (section.key === 'brand' ? 1.5 : section.key === 'size' ? 1.15 : 1);
    const weight = section.key === 'brand' ? Math.max(700, label.fontWeight) : label.fontWeight;
    context.font = `${weight} ${size}px "${label.font}"`;
    if (sectionIndex) {
      cursor += label.fontSizeMm * .65;
      if (label.category === 'care') dividers.push(cursor - label.fontSizeMm * .3);
    }
    const addLine = (text: string) => {
      cursor += size;
      lines.push(text); textLines.push({ text, section: section.key, size, weight, y: cursor });
      cursor += size * .3;
    };
    for (const paragraph of section.text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        if (measure(word) > usableWidth) oversizedWord = true;
        if (line && measure(`${line} ${word}`) > usableWidth) { addLine(line); line = word; }
        else line = line ? `${line} ${word}` : word;
      }
      if (line) addLine(line);
    }
  }
  const symbols = label.category === 'care' ? Object.entries(label.care).filter(([, value]) => Boolean(value)) : [];
  const symbolsY = cursor + (symbols.length ? label.marginMm : 0);
  const symbolSize = Math.min(5, usableWidth / Math.max(1, symbols.length));
  const requiredHeight = symbolsY + (symbols.length ? symbolSize : 0) + insetY;
  const verticalShift = label.category !== 'care' && !label.logo ? Math.max(0, (label.heightMm - requiredHeight) / 2) : 0;
  for (const line of textLines) line.y += verticalShift;
  return { insetX, insetY, usableWidth, usableHeight, logoWidth, logoHeight, logoX, logoY, lines, textLines, dividers, symbols, symbolsY, symbolSize,
    overflow: oversizedWord || requiredHeight > label.heightMm, requiredHeight: Math.ceil(requiredHeight), oversizedWord };
}

function CareSymbol({ category, value }: { category: CareCategory; value: string }) {
  const forbidden = value === 'no';
  const dots = value === 'low' ? 1 : value === 'medium' || value === 'normal' ? 2 : value === 'high' ? 3 : 0;
  return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
    {category === 'washing' && <><path d="M2 5 5 21H21L24 5M3 9Q6 6 9 9T15 9T23 9" />{!forbidden && <text x="13" y="17" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontFamily="Arial">{value}</text>}</>}
    {category === 'bleaching' && <><path d="M13 2 25 23H1Z" />{value === 'oxygen' && <path d="m6 22 11-13m-5 13 9-10" />}</>}
    {category === 'drying' && <><rect x="2" y="2" width="22" height="22" />{value === 'flat' ? <path d="M5 13H21" /> : value === 'line' ? <path d="M3 5Q13 17 23 5" /> : <circle cx="13" cy="13" r="9" />}</>}
    {category === 'ironing' && <path d="M8 4H19L24 21H2L4 12Q5 9 9 9H20" />}
    {category === 'cleaning' && <><circle cx="13" cy="13" r="11" />{!forbidden && <text x="13" y="18" textAnchor="middle" fill="currentColor" stroke="none" fontSize="14" fontFamily="Arial">{value}</text>}</>}
    {['ironing', 'drying'].includes(category) && Array.from({ length: dots }, (_, index) => <circle key={index} cx={13 + (index - (dots - 1) / 2) * 4} cy={category === 'ironing' ? 16 : 13} r="1" fill="currentColor" stroke="none" />)}
    {forbidden && <path d="M1 1 25 25M25 1 1 25" strokeWidth="1.8" />}
  </g>;
}

export function LabelArtwork({ label, guide = false, layout: suppliedLayout }: { label: GarmentLabel; guide?: boolean; layout?: ReturnType<typeof labelLayout> }) {
  const [, refreshFont] = useState(0);
  const layout = suppliedLayout ?? labelLayout(label);
  const generatedId = useId().replace(/:/g, '');
  const clip = `label-clip-${generatedId}`;
  const safe = `label-safe-${generatedId}`;
  const weave = `label-weave-${generatedId}`;
  useEffect(() => {
    let active = true;
    void loadLabelFont(label).then(() => document.fonts.ready).then(() => { if (active) refreshFont(value => value + 1); }).catch(() => undefined);
    return () => { active = false; };
  }, [label.font, label.fontData]);
  const width = label.widthMm;
  const height = label.heightMm;
  const physical = label.construction === 'physical';
  const curved = label.shape === 'oval' || label.shape === 'circle';
  const edgeShape = curved ? <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} /> :
    label.fold === 'mitre' && physical ? <path d={`M0 0H${width}V${height - 4}L${width - 4} ${height}H4L0 ${height - 4}Z`} /> :
      <rect width={width} height={height} rx={label.shape === 'rounded' ? Math.min(3, height / 5) : .15} />;
  const textX = label.textAlign === 'left' ? layout.insetX : label.textAlign === 'right' ? width - layout.insetX : width / 2;
  return <g data-label-artwork={label.id} color={label.foreground}>
    <defs>
      <clipPath id={clip}>{edgeShape}</clipPath>
      <clipPath id={safe}><rect x={layout.insetX} y={layout.insetY} width={layout.usableWidth} height={layout.usableHeight} /></clipPath>
      <pattern id={weave} width=".65" height=".65" patternUnits="userSpaceOnUse"><path d="M0 .15H.65M.15 0V.65" fill="none" stroke="#777777" strokeWidth=".06" opacity=".3" /></pattern>
    </defs>
    {label.fontData && <style>{`@font-face{font-family:"${label.font.replace(/["\\<>]/g, '')}";src:url("${label.fontData}")}`}</style>}
    {physical && <g data-label-fabric="" fill={label.background} stroke={label.borderEnabled ? label.border : '#888888'} strokeWidth=".15">
      {['centre', 'manhattan'].includes(label.fold) && <path d={`M1 1H${width - 1}V${height - 1}L2 ${height - 2}Z`} transform="translate(.8 .7)" fill={label.background} />}
      {label.fold === 'loop' && <path d={`M0 0H${width}V${height - 3}Q${width / 2} ${height + 2} 0 ${height - 2}Z`} transform="translate(.5 .7)" />}
      {edgeShape}
      {label.method === 'woven' && <rect width={width} height={height} fill={`url(#${weave})`} clipPath={`url(#${clip})`} stroke="none" />}
      {label.fold === 'end' && <g opacity=".22" fill="#777777" stroke="none"><rect width={Math.min(label.foldMm, width / 5)} height={height} /><rect x={width - Math.min(label.foldMm, width / 5)} width={Math.min(label.foldMm, width / 5)} height={height} /></g>}
      {label.fold === 'mitre' && <path d={`M0 0 4 4M${width} 0 ${width - 4} 4`} />}
      {label.fold === 'manhattan' && <path d={`M0 ${Math.min(label.foldMm, height / 4)}H${width}`} strokeWidth=".4" opacity=".4" />}
      {['centre', 'loop'].includes(label.fold) && <path d={`M1 ${height - .8}Q${width / 2} ${height + .1} ${width - 1} ${height - .8}`} opacity=".5" />}
      <path data-label-attachment="" d={label.fold === 'end' ? `M1 1V${height - 1}M${width - 1} 1V${height - 1}` : `M1 1H${width - 1}`} fill="none" stroke={label.border} strokeWidth=".2" strokeDasharray=".6 .6" />
    </g>}
    <g clipPath={`url(#${clip})`}><g clipPath={`url(#${safe})`}>
      {label.logo && <image data-label-logo="" href={label.logo.data} x={layout.logoX} y={layout.logoY} width={layout.logoWidth} height={layout.logoHeight} preserveAspectRatio="xMidYMid meet" />}
      {layout.dividers.map((position, index) => <path key={index} d={`M${layout.insetX} ${position}H${width - layout.insetX}`} stroke={label.foreground} strokeWidth=".12" opacity=".25" />)}
      <g fill={label.foreground} fontFamily={label.font} fontSize={label.fontSizeMm} fontWeight={label.fontWeight} letterSpacing={label.letterSpacingMm} textAnchor={label.textAlign === 'left' ? 'start' : label.textAlign === 'right' ? 'end' : 'middle'}>
        {layout.textLines.map((line, index) => <text key={index} data-label-text-section={line.section} x={textX} y={line.y} fontSize={line.size} fontWeight={line.weight}>{line.text}</text>)}
      </g>
      {layout.symbols.map(([category, value], index) => <g key={category} aria-label={CARE_OPTIONS[category as CareCategory][value as never]} transform={`translate(${layout.insetX + index * layout.symbolSize} ${layout.symbolsY}) scale(${layout.symbolSize / 28})`}><CareSymbol category={category as CareCategory} value={value} /></g>)}
    </g></g>
    {guide && <rect data-label-guide="" x="0" y="0" width={width} height={height} fill="none" stroke="#db4d42" strokeWidth=".3" strokeDasharray="1 1" />}
  </g>;
}