import { useEffect, useId, useState } from 'react';
import { CARE_OPTIONS, DEFAULT_REGION_TRANSFORM, labelTextSections, type CareCategory, type GarmentLabel, type LabelRegion } from '../../data/garmentLabels';

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
  const insetY = label.marginMm + (curved ? label.heightMm * .15 : label.category === 'hand' ? 5 : 0);
  const usableWidth = Math.max(1, label.widthMm - insetX * 2);
  const usableHeight = Math.max(1, label.heightMm - insetY * 2);
  const structured = label.category === 'care' || label.category === 'hand' || label.construction === 'printed';
  const sections = labelTextSections(label);
  const ranges: [LabelRegion, number, number][] = structured
    ? [['top', 0, .2], ['upper', .2, .32], ['middle', .32, .48], ['lower', .48, .82], ['bottom', .82, 1]]
    : [['top', 0, .57], ['upper', .57, .79], ['bottom', .79, 1]];
  const sectionRegions: Record<string, LabelRegion> = { brand: 'top', size: 'upper', composition: 'middle', careText: 'lower', origin: 'bottom', business: 'bottom', additional: 'bottom' };
  const symbols = label.category === 'care' || label.construction === 'printed' ? Object.entries(label.care).filter(([, value]) => Boolean(value)) : [];
  const symbolSize = Math.min(4.5, usableWidth / Math.max(1, symbols.length));
  const topHeight = usableHeight * ranges[0][2] * .9;
  const logoWidth = label.logo ? Math.min(usableWidth * label.logoWidth / 100, topHeight * label.logo.aspect) : 0;
  const logoHeight = label.logo ? logoWidth / label.logo.aspect : 0;
  measureCanvas ??= document.createElement('canvas');
  const context = measureCanvas.getContext('2d')!;
  const measure = (text: string) => context.measureText(text).width + Math.max(0, text.length - 1) * label.letterSpacingMm;
  let oversizedWord = false;
  const zones = ranges.map(([key, start, end]) => {
    const height = usableHeight * (end - start);
    const y = insetY + usableHeight * start;
    const textLines: { text: string; section: string; size: number; weight: number; y: number }[] = [];
    const hasSymbols = key === 'lower' && symbols.length > 0;
    let cursor = hasSymbols ? symbolSize + 1.5 : 0;
    let contentWidth = hasSymbols ? symbols.length * symbolSize : 0;
    for (const section of sections.filter(section => sectionRegions[section.key] === key)) {
      const size = label.fontSizeMm * (section.key === 'brand' ? 1.5 : section.key === 'size' ? 1.15 : .85);
      const weight = section.key === 'brand' ? Math.max(700, label.fontWeight) : label.fontWeight;
      context.font = `${weight} ${size}px "${label.font}"`;
      const addLine = (text: string) => {
        contentWidth = Math.max(contentWidth, measure(text));
        cursor += size;
        textLines.push({ text, section: section.key, size, weight, y: cursor });
        cursor += size * .3;
      };
      for (const paragraph of section.text.split('\n')) {
        let line = '';
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
          if (measure(word) > usableWidth * 3) oversizedWord = true;
          if (line && measure(`${line} ${word}`) > usableWidth) { addLine(line); line = word; }
          else line = line ? `${line} ${word}` : word;
        }
        if (line) addLine(line);
      }
    }
    const hasLogo = key === 'top' && Boolean(label.logo);
    contentWidth = Math.max(.01, hasLogo ? logoWidth : contentWidth);
    const contentHeight = Math.max(.01, hasLogo ? logoHeight : cursor);
    for (const line of textLines) line.y -= contentHeight / 2;
    const settings = { ...DEFAULT_REGION_TRANSFORM, ...label.regions?.[key] };
    const radians = settings.rotation * Math.PI / 180;
    const rotatedWidth = Math.abs(Math.cos(radians)) * contentWidth + Math.abs(Math.sin(radians)) * contentHeight;
    const rotatedHeight = Math.abs(Math.sin(radians)) * contentWidth + Math.abs(Math.cos(radians)) * contentHeight;
    const scale = Math.min(settings.scale / 100, usableWidth * .96 / rotatedWidth, height * .9 / rotatedHeight);
    const roomX = Math.max(0, (usableWidth - rotatedWidth * scale) / 2);
    const roomY = Math.max(0, (height - rotatedHeight * scale) / 2);
    const alignment = key === 'upper' ? label.sizePosition ?? 'center' : label.textAlign;
    const xPosition = hasLogo ? (label.logoX - 50) * 2 : alignment === 'left' ? -100 : alignment === 'right' ? 100 : 0;
    const yPosition = hasLogo ? (label.logoY - 50) * 2 : 0;
    const centerX = label.widthMm / 2 + roomX * Math.max(-100, Math.min(100, settings.x + xPosition)) / 100;
    const centerY = y + height / 2 + roomY * Math.max(-100, Math.min(100, settings.y + yPosition)) / 100;
    return { key, x: insetX, y, width: usableWidth, height, textLines, hasLogo, hasSymbols, contentWidth, contentHeight, scale,
      symbolsY: -contentHeight / 2,
      transform: `translate(${centerX} ${centerY}) rotate(${settings.rotation}) scale(${scale * (settings.flipX ? -1 : 1)} ${scale * (settings.flipY ? -1 : 1)})` };
  });
  const textLines = zones.flatMap(zone => zone.textLines);
  return { insetX, insetY, usableWidth, usableHeight, logoWidth, logoHeight, zones, lines: textLines.map(line => line.text), textLines, symbols, symbolSize,
    overflow: oversizedWord, requiredHeight: Math.ceil(label.heightMm), oversizedWord };
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
    label.fold === 'die' ? <path d={`M3 0H${width - 3}L${width} 3V${height - 3}L${width - 3} ${height}H3L0 ${height - 3}V3Z`} /> :
    label.fold === 'mitre' && physical ? <path d={`M0 0H${width}V${height - 4}L${width - 4} ${height}H4L0 ${height - 4}Z`} /> :
      <rect width={width} height={height} rx={label.shape === 'rounded' ? Math.min(3, height / 5) : .15} />;
  return <g data-label-artwork={label.id} color={label.foreground}>
    <defs>
      <clipPath id={clip}>{edgeShape}</clipPath>
      <clipPath id={safe}><rect x={layout.insetX} y={layout.insetY} width={layout.usableWidth} height={layout.usableHeight} /></clipPath>
      <pattern id={weave} width=".65" height=".65" patternUnits="userSpaceOnUse"><path d="M0 .15H.65M.15 0V.65" fill="none" stroke="#777777" strokeWidth=".06" opacity=".3" /></pattern>
    </defs>
    {label.fontData && <style>{`@font-face{font-family:"${label.font.replace(/["\\<>]/g, '')}";src:url("${label.fontData}")}`}</style>}
    {!physical && guide && <rect data-label-guide="" width={width} height={height} rx=".5" fill="#f2f3f4" fillOpacity=".94" />}
    {physical && <g data-label-fabric="" fill={label.background} stroke={label.borderEnabled ? label.border : '#888888'} strokeWidth=".15">
      {['centre', 'manhattan'].includes(label.fold) && <path d={`M1 1H${width - 1}V${height - 1}L2 ${height - 2}Z`} transform="translate(.8 .7)" fill={label.background} />}
      {label.fold === 'loop' && <path d={`M0 0H${width}V${height - 3}Q${width / 2} ${height + 2} 0 ${height - 2}Z`} transform="translate(.5 .7)" />}
      {edgeShape}
      {label.method === 'woven' && <rect width={width} height={height} fill={`url(#${weave})`} clipPath={`url(#${clip})`} stroke="none" />}
      {label.fold === 'end' && <g opacity=".22" fill="#777777" stroke="none"><rect width={Math.min(label.foldMm, width / 5)} height={height} /><rect x={width - Math.min(label.foldMm, width / 5)} width={Math.min(label.foldMm, width / 5)} height={height} /></g>}
      {label.fold === 'mitre' && <path d={`M0 0 4 4M${width} 0 ${width - 4} 4`} />}
      {label.fold === 'manhattan' && <path d={`M0 ${Math.min(label.foldMm, height / 4)}H${width}`} strokeWidth=".4" opacity=".4" />}
      {['centre', 'loop'].includes(label.fold) && <path d={`M1 ${height - .8}Q${width / 2} ${height + .1} ${width - 1} ${height - .8}`} opacity=".5" />}
      {label.category === 'hand' ? <circle cx={width / 2} cy="3.5" r="1.2" fill="#e7e9ec" stroke={label.border} strokeWidth=".3" /> : <path data-label-attachment="" d={label.fold === 'end' ? `M1 1V${height - 1}M${width - 1} 1V${height - 1}` : `M1 1H${width - 1}`} fill="none" stroke={label.border} strokeWidth=".2" strokeDasharray=".6 .6" />}
    </g>}
    <g clipPath={`url(#${clip})`}><g clipPath={`url(#${safe})`}>
      {label.preset === 'framed' && layout.zones.slice(1).map(zone => <path key={zone.key} d={`M${layout.insetX} ${zone.y}H${width - layout.insetX}`} stroke={label.foreground} strokeWidth=".2" opacity=".45" />)}
      {layout.zones.map(zone => <g key={zone.key} data-label-region={zone.key} transform={zone.transform}>
        {zone.hasLogo && label.logo && <image data-label-logo="" href={label.logo.data} x={-layout.logoWidth / 2} y={-layout.logoHeight / 2} width={layout.logoWidth} height={layout.logoHeight} preserveAspectRatio="xMidYMid meet" />}
        <g fill={label.foreground} fontFamily={label.font} fontSize={label.fontSizeMm} fontWeight={label.fontWeight} letterSpacing={label.letterSpacingMm} textAnchor="middle">
          {zone.textLines.map((line, index) => <text key={index} data-label-text-section={line.section} x="0" y={line.y} fontSize={line.size} fontWeight={line.weight}>{line.text}</text>)}
        </g>
        {zone.hasSymbols && layout.symbols.map(([category, value], index) => <g key={category} aria-label={CARE_OPTIONS[category as CareCategory][value as never]} transform={`translate(${(index - layout.symbols.length / 2) * layout.symbolSize} ${zone.symbolsY}) scale(${layout.symbolSize / 28})`}><CareSymbol category={category as CareCategory} value={value} /></g>)}
      </g>)}
    </g></g>
    {guide && <rect data-label-guide="" x="0" y="0" width={width} height={height} fill="none" stroke="#db4d42" strokeWidth=".3" strokeDasharray="1 1" />}
  </g>;
}