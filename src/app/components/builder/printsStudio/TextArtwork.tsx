import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { MouseEventHandler } from 'react';
import type { DesignElement } from '../PrintsDesignStep';
import { parsePaint, paintCss, paintDataUrl, solidPaint } from '../../../lib/studioPaint';
import { textCurveRadius } from '../../../lib/textCurveControls';
import { artworkFlipStyle } from '../../../lib/artworkFlip';
import { TextEffectsArtwork } from './TextEffectsArtwork';

function textRows(element: DesignElement) {
  let number = 0;
  let previousKind: string | undefined;
  return element.content.split(/\r?\n/).map((content, index) => {
    const kind = element.textListLineStyles?.[index] ?? element.textList ?? 'none';
    if (kind === 'numbered') number = previousKind === 'numbered' ? number + 1 : 1;
    else number = 0;
    previousKind = kind;
    return {
      content,
      kind,
      marker: kind === 'bulleted' ? '•' : kind === 'numbered' ? `${number}.` : '',
    };
  });
}

function wrapCurveRow(content: string, maxWidth: number, measure: (text: string) => number) {
  const characters = Array.from(content);
  const lines: string[] = [];
  let line = '';
  for (const character of characters) {
    if (line && measure(line + character) > maxWidth) {
      const breakAt = line.lastIndexOf(' ') + 1;
      if (breakAt > 0 && breakAt < line.length) {
        lines.push(line.slice(0, breakAt));
        line = line.slice(breakAt);
      } else {
        lines.push(line);
        line = '';
      }
    }
    line += character;
  }
  lines.push(line);
  return lines;
}

function curvePath(element: DesignElement, width: number, height: number, fontSize: number, baselineOffset = 0) {
  const margin = Math.min(width * 0.08, fontSize);
  const left = margin;
  const right = Math.max(left + 1, width - margin);
  const chord = right - left;
  const amount = Math.max(1, Math.min(100, element.textCurveAmount ?? 100));
  const requestedRadius = textCurveRadius({ ...element, textCurveShape: 'arc' });
  const angle = Math.PI * 0.9 * amount / 100 * Math.sqrt(80 / requestedRadius);
  const radius = chord / (2 * Math.sin(angle / 2));
  const halfChord = chord / 2;
  const sagitta = radius - Math.sqrt(Math.max(1, radius * radius - halfChord * halfChord));
  const baseline = element.textCurveDirection === 'down'
    ? (height - sagitta) / 2
    : (height + sagitta) / 2;
  const shiftedBaseline = baseline + baselineOffset;
  return {
    path: `M ${left} ${shiftedBaseline} A ${radius} ${radius} 0 0 ${element.textCurveDirection === 'down' ? 0 : 1} ${right} ${shiftedBaseline}`,
    baseline: shiftedBaseline,
    sagitta,
  };
}

function circlePath(size: number, radius: number, direction: 'up' | 'down', amount: number) {
  const center = size / 2;
  const r = Math.max(1, Math.min(radius, center - 1));
  const sweep = direction === 'down' ? 1 : 0;
  const halfAngle = Math.PI * Math.max(1, Math.min(100, amount)) / 100;
  const middle = direction === 'down' ? -Math.PI / 2 : Math.PI / 2;
  const sign = direction === 'down' ? 1 : -1;
  const point = (angle: number) => `${center + r * Math.cos(angle)} ${center + r * Math.sin(angle)}`;
  return `M ${point(middle - sign * halfAngle)} A ${r} ${r} 0 0 ${sweep} ${point(middle)} A ${r} ${r} 0 0 ${sweep} ${point(middle + sign * halfAngle)}`;
}

function SvgPaintDef({
  value,
  id,
  width,
  height,
}: {
  value: string;
  id: string;
  width: number;
  height: number;
}) {
  const paint = parsePaint(value);
  if (!paint) return null;
  const stops = [...paint.stops].sort((a, b) => a.offset - b.offset);
  if (paint.kind === 'linear') {
    const radians = paint.angle * Math.PI / 180;
    const extent = (Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))) / 2;
    const dx = Math.sin(radians) * extent;
    const dy = -Math.cos(radians) * extent;
    return (
      <linearGradient id={id} gradientUnits="userSpaceOnUse"
        x1={width / 2 - dx} y1={height / 2 - dy}
        x2={width / 2 + dx} y2={height / 2 + dy}>
        {stops.map(stop => <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />)}
      </linearGradient>
    );
  }
  if (paint.kind === 'radial') {
    const radius = Math.hypot(Math.max(paint.x, 1 - paint.x) * width, Math.max(paint.y, 1 - paint.y) * height);
    return (
      <radialGradient id={id} gradientUnits="userSpaceOnUse"
        cx={paint.x * width} cy={paint.y * height} r={radius}>
        {stops.map(stop => <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />)}
      </radialGradient>
    );
  }
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={width} height={height}>
      <image href={paintDataUrl(value, Math.max(1, Math.round(width)), Math.max(1, Math.round(height)))}
        width={width} height={height} preserveAspectRatio="none" />
    </pattern>
  );
}

type TextArtworkProps = {
  element: DesignElement;
  fontSize: number;
  defaultColor?: string;
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
};

export function TextArtwork(props: TextArtworkProps) {
  const { element, fontSize, defaultColor, onDoubleClick } = props;
  const effects = element.textEffects ?? [];
  if (!effects.some(effect => effect.enabled && effect.intensity > 0)) return <PlainTextArtwork {...props} />;
  const sourceElement = { ...element, textShadowEnabled: false, flipHorizontal: false, flipVertical: false };
  const sourceKey = JSON.stringify([fontSize, defaultColor, Object.fromEntries(Object.entries(sourceElement).filter(([key]) => !['textEffects', 'x', 'y', 'rotation', 'opacity', 'warp', 'perspective', 'cropTop', 'cropRight', 'cropBottom', 'cropLeft'].includes(key)))]);
  const shadow = element.textShadowEnabled ?? (element.shadowBlur ?? 0) > 0;
  return <TextEffectsArtwork effects={effects} sourceKey={sourceKey} width={element.width} text={element.content} onDoubleClick={onDoubleClick}
    style={{ ...artworkFlipStyle(element), filter: shadow ? `url(#fx-${element.id})` : undefined }}>
    <PlainTextArtwork element={sourceElement} fontSize={fontSize} defaultColor={defaultColor} />
  </TextEffectsArtwork>;
}

function PlainTextArtwork({
  element,
  fontSize,
  defaultColor = '#FFFFFF',
  onDoubleClick,
}: {
  element: DesignElement;
  fontSize: number;
  defaultColor?: string;
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
}) {
  const color = element.color ?? defaultColor;
  const fillMode = element.textFillMode ?? ((element.borderWidth ?? 0) > 0 ? 'fill-outline' : 'filled');
  const outlineWidth = fillMode === 'filled' ? 0 : Math.max(0, element.borderWidth ?? 0.25);
  const outlineColor = element.borderColor ?? color;
  const decorations = [
    element.textUnderline ? 'underline' : '',
    element.textStrikethrough ? 'line-through' : '',
  ].filter(Boolean).join(' ');
  const fontWeight = element.fontWeight === 'bold' ? 700 : element.fontWeight === 'normal' ? 400 : 600;
  const lineHeight = `${element.lineSpacing ?? 115}%`;
  const curved = (element.textCurveAmount ?? 0) > 0 && !element.verticalText;
  const curveSpacing = curved ? Math.max(-0.5, Math.min(8, element.textCurveSpacing ?? 0)) : 0;
  const letterSpacing = curved
    ? Math.max(-0.5, (element.letterSpacing ?? 0) + curveSpacing)
    : element.letterSpacing ?? 0;
  const font = `${element.fontStyle ?? 'normal'} ${fontWeight} ${fontSize}px ${element.fontFamily ?? 'Inter'}`;
  const [fontRevision, setFontRevision] = useState(0);
  useEffect(() => {
    if (!curved) return;
    let active = true;
    const refresh = () => { if (active) setFontRevision(value => value + 1); };
    void document.fonts.load(font, element.content).then(refresh, () => {});
    document.fonts.addEventListener('loadingdone', refresh);
    return () => { active = false; document.fonts.removeEventListener('loadingdone', refresh); };
  }, [curved, font, element.content]);
  const measureText = useMemo(() => {
    const context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    if (context) context.font = font;
    return (text: string) => {
      const displayed = element.textTransform === 'uppercase' ? text.toUpperCase()
        : element.textTransform === 'lowercase' ? text.toLowerCase() : text;
      return (context?.measureText(displayed).width ?? Array.from(displayed).length * fontSize * 0.6)
        + Array.from(displayed).length * letterSpacing;
    };
  }, [font, fontSize, letterSpacing, element.textTransform, fontRevision]);
  const filter = (element.textShadowEnabled ?? (element.shadowBlur ?? 0) > 0)
    ? `url(#fx-${element.id})`
    : undefined;
  const fill = fillMode === 'outline' ? 'transparent' : color;
  const textStyle: CSSProperties = {
    color: fill,
    fontFamily: element.fontFamily ?? 'Inter',
    fontSize,
    fontWeight,
    fontStyle: element.fontStyle ?? 'normal',
    lineHeight,
    letterSpacing: `${letterSpacing}px`,
    textAlign: element.textAlign ?? 'center',
    textTransform: element.textTransform ?? 'none',
    textDecorationLine: decorations as CSSProperties['textDecorationLine'],
    textDecorationColor: solidPaint(color),
    textDecorationThickness: `${element.textLineThickness ?? 0.5}px`,
    textUnderlineOffset: `${element.textLineOffset ?? 0}px`,
    WebkitTextStroke: outlineWidth > 0 ? `${outlineWidth}px ${outlineColor}` : undefined,
    WebkitTextFillColor: fillMode === 'outline' ? 'transparent' : undefined,
    paintOrder: outlineWidth > 0 ? 'stroke fill' : undefined,
    filter,
    width: '100%',
    maxWidth: '100%',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
    writingMode: element.verticalText ? 'vertical-rl' : undefined,
    textOrientation: element.verticalText ? 'upright' : undefined,
  };
  if (fillMode !== 'outline' && parsePaint(color)) {
    textStyle.color = 'transparent';
    textStyle.backgroundImage = paintCss(color);
    textStyle.backgroundClip = 'text';
    textStyle.WebkitBackgroundClip = 'text';
  }

  const circular = curved && element.textCurveShape === 'circle';
  const width = Math.max(1, element.width);
  const sourceRows = textRows(element);
  const rowSpacing = fontSize * (element.lineSpacing ?? 115) / 100;
  const baseRadius = textCurveRadius(element);
  const minimumCircleRadius = baseRadius;
  const widestCharacter = circular
    ? Array.from(element.content).reduce((widest, character) => Math.max(widest, measureText(character)), fontSize)
    : fontSize;
  const minimumCircleAmount = Math.min(100, 100 * (widestCharacter + fontSize * 2) / (2 * Math.PI * minimumCircleRadius));
  const circleAmount = minimumCircleAmount + (100 - minimumCircleAmount) * Math.max(1, Math.min(100, element.textCurveAmount ?? 100)) / 100;
  const availableLength = circular
    ? Math.max(widestCharacter, 2 * Math.PI * minimumCircleRadius * circleAmount / 100 - fontSize * 2)
    : Math.max(fontSize, width - Math.min(width * 0.08, fontSize) * 2 - fontSize * 0.5);
  const rows = curved ? sourceRows.flatMap(row =>
    wrapCurveRow(row.marker ? `${row.marker} ${row.content}` : row.content, availableLength, measureText)
      .map(content => ({ ...row, marker: '', content })),
  ) : sourceRows;
  const arcDepth = curved && !circular ? curvePath(element, width, 0, fontSize).sagitta : 0;
  const height = fontSize * 2.8 + arcDepth + rowSpacing * (rows.length - 1);
  const circleRadius = minimumCircleRadius + rowSpacing * (rows.length - 1);
  const circleSize = (circleRadius + fontSize) * 2;
  const id = `text-curve-${element.id}`;
  const lineOffset = element.textLineOffset ?? 0;
  const lineDelta = element.textLinePosition === 'top'
    ? -fontSize * 0.8 + lineOffset
    : element.textLinePosition === 'middle'
      ? -fontSize * 0.4 + lineOffset
      : -lineOffset;
  const lineY = element.textLinePosition === 'top'
    ? `${lineOffset}px`
    : element.textLinePosition === 'middle'
      ? `calc(50% + ${lineOffset}px)`
      : `calc(100% - ${lineOffset}px)`;
  const fillId = `${id}-fill`;
  const strokeId = `${id}-stroke`;
  const svgFill = fillMode === 'outline'
    ? 'transparent'
    : parsePaint(color) ? `url(#${fillId})` : solidPaint(color);
  const svgStroke = parsePaint(outlineColor) ? `url(#${strokeId})` : solidPaint(outlineColor);
  const textAnchor = element.textAlign === 'left'
    ? 'start'
    : element.textAlign === 'right'
      ? 'end'
      : 'middle';
  const startOffset = element.textAlign === 'left'
    ? '0%'
    : element.textAlign === 'right'
      ? '100%'
      : '50%';
  const getRowPath = (index: number, offset = 0) => circular
    ? circlePath(
        circleSize,
        Math.max(1, circleRadius - index * rowSpacing + offset),
        element.textCurveDirection ?? 'up',
        circleAmount,
    )
    : curvePath(
        element,
        width,
        height,
        fontSize,
        (index - (rows.length - 1) / 2) * rowSpacing + offset,
    ).path;

  const circleTextLength = (content: string, index: number) => {
    const length = 2 * Math.PI * (circleRadius - index * rowSpacing) * circleAmount / 100;
    const naturalLength = measureText(content);
    // Include the closing seam when distributing the spacing around a circle.
    const gap = Math.max(fontSize * 0.5, (length - naturalLength) / Array.from(content).length - letterSpacing);
    return Math.max(naturalLength, length - gap);
  };

  return (
    <div
      data-text-body
      onDoubleClick={onDoubleClick}
      className="w-full min-w-0 max-w-full font-semibold"
      style={{
        minHeight: element.autoHeight === false ? element.height : undefined,
        ...artworkFlipStyle(element),
      }}
    >
      {curved ? (
        <svg
          className="block w-full overflow-visible"
          viewBox={`0 0 ${circular ? circleSize : width} ${circular ? circleSize : height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: circular ? width : height, overflow: 'visible', filter }}
          aria-label={element.content}
        >
          <defs>
            {rows.map((_, index) => (
              <path key={index} id={`${id}-${index}`} d={getRowPath(index)} />
            ))}
            <SvgPaintDef value={color} id={fillId} width={circular ? circleSize : width} height={circular ? circleSize : height} />
            <SvgPaintDef value={outlineColor} id={strokeId} width={circular ? circleSize : width} height={circular ? circleSize : height} />
          </defs>
          {rows.map((row, index) => (
            <text
              key={index}
              fontFamily={element.fontFamily ?? 'Inter'}
              fontSize={fontSize}
              fontWeight={fontWeight}
              fontStyle={element.fontStyle ?? 'normal'}
              textAnchor={textAnchor}
              dy={element.textCurveSide === 'inside'
                ? element.textCurveDirection === 'down' ? -fontSize * 0.1 : fontSize * 0.65
                : element.textCurveDirection === 'down' ? fontSize * 0.65 : -fontSize * 0.1}
              textDecoration={decorations || undefined}
              fill={solidPaint(color)}
              stroke="none"
              strokeLinejoin="round"
              paintOrder="stroke fill"
              letterSpacing={letterSpacing}
              style={{
                color: solidPaint(color),
                textTransform: element.textTransform ?? 'none',
                textDecorationColor: solidPaint(color),
                textDecorationThickness: `${element.textLineThickness ?? 0.5}px`,
              }}
            >
              <textPath
                href={`#${id}-${index}`}
                startOffset={startOffset}
                textLength={circular && Array.from(row.content).length > 1 ? circleTextLength(row.content, index) : undefined}
                lengthAdjust={circular ? 'spacing' : undefined}
                fill={svgFill}
                stroke={outlineWidth > 0 ? svgStroke : 'none'}
                strokeWidth={outlineWidth}
              >
                {row.marker ? `${row.marker} ${row.content}` : row.content}
              </textPath>
            </text>
          ))}
          {element.textLinePosition && element.textLinePosition !== 'none' ? (
            rows.map((_, index) => {
              const lineRadiusOffset = element.textLinePosition === 'top'
                ? fontSize * 0.8 - lineOffset
                : element.textLinePosition === 'middle'
                  ? fontSize * 0.4 - lineOffset
                  : -lineOffset;
              return (
                <path
                  key={`line-${index}`}
                  d={getRowPath(index, circular ? lineRadiusOffset : lineDelta)}
                  fill="none"
                  stroke={element.textLineColor ?? outlineColor}
                  strokeWidth={element.textLineThickness ?? 0.5}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })
          ) : null}
        </svg>
      ) : (
        <div className="relative">
          <div style={textStyle}>
            {rows.map((row, index) => (
              <div
                key={index}
                style={{
                  boxSizing: 'border-box',
                  minHeight: `${rowSpacing}px`,
                  textAlign: element.textAlign ?? 'center',
                  paddingInlineStart: row.kind !== 'none'
                    ? `${Math.max(14, element.textListIndent ?? 18)}px`
                    : undefined,
                  position: 'relative',
                }}
              >
                {row.marker ? (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: `${Math.max(14, element.textListIndent ?? 18)}px`,
                      textAlign: 'right',
                      paddingRight: '4px',
                    }}
                  >
                    {row.marker}
                  </span>
                ) : null}
                {row.content || '\u00a0'}
              </div>
            ))}
          </div>
          {element.textLinePosition && element.textLinePosition !== 'none' ? (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: lineY,
                height: element.textLineThickness ?? 0.5,
                background: element.textLineColor ?? outlineColor,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
