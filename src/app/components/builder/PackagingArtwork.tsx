import { useId, useRef, type PointerEvent } from 'react';
import { packagingTemplate, panelSize, printRegion, constrainPackagingElement, type PackagingDesign, type PackagingElement, type PackagingPanel, type PackagingView } from '../../data/packaging';

interface ArtworkProps {
  design: PackagingDesign;
  fit?: boolean;
  surfaceTone?: 'light' | 'dark';
  view?: PackagingView;
  guides?: boolean;
  contents?: boolean;
  garmentColor?: string;
  garmentType?: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onElementChange?: (element: PackagingElement, limited: boolean) => void;
}
export function PackagingSurface({ design, panel, guides, selectedId, onSelect, onElementChange }: ArtworkProps & { panel: PackagingPanel }) {
  const unique = useId().replace(/:/g, '');
  const region = printRegion(design, panel);
  const drag = useRef<{ pointer: number; x: number; y: number; element: PackagingElement } | null>(null);
  const point = (event: PointerEvent<SVGGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : new DOMPoint();
  };
  return <g data-packaging-surface={panel} onPointerMove={event => {
    if (!drag.current || event.pointerId !== drag.current.pointer) return;
    const position = point(event);
    const proposed = { ...drag.current.element, x: drag.current.element.x + position.x - drag.current.x, y: drag.current.element.y + position.y - drag.current.y };
    const constrained = constrainPackagingElement(proposed, region);
    onElementChange?.(constrained, Math.abs(proposed.x - constrained.x) > 0.01 || Math.abs(proposed.y - constrained.y) > 0.01);
  }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    <defs><clipPath id={`${unique}-safe`}><rect {...region} /></clipPath></defs>
    <g clipPath={`url(#${unique}-safe)`}>
      {design.elements.filter(element => element.panel === panel).map(element => <g key={element.id} data-packaging-element={element.id}
        transform={`translate(${element.x} ${element.y}) rotate(${element.rotation})`}
        style={{ cursor: onElementChange ? 'move' : undefined, touchAction: 'none' }}
        onPointerDown={event => {
          if (!onElementChange || event.button !== 0) return;
          event.preventDefault(); event.stopPropagation(); onSelect?.(element.id);
          const surface = event.currentTarget.parentElement?.parentElement as unknown as SVGGElement;
          const matrix = surface.getScreenCTM();
          if (!matrix) return;
          const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
          drag.current = { pointer: event.pointerId, x: position.x, y: position.y, element };
          surface.setPointerCapture(event.pointerId);
        }}>
        {element.kind === 'text' ? <svg x={-element.width / 2} y={-element.height / 2} width={element.width} height={element.height} overflow="hidden">
          <text x={element.align === 'left' ? 0 : element.align === 'right' ? element.width : element.width / 2} y={element.height / 2} dominantBaseline="central" textAnchor={element.align === 'left' ? 'start' : element.align === 'right' ? 'end' : 'middle'} fontFamily={element.font} fontSize={element.fontSize} fill={element.color} letterSpacing="0">{element.content}</text>
        </svg> : <image href={element.content} x={-element.width / 2} y={-element.height / 2} width={element.width} height={element.height} preserveAspectRatio="xMidYMid meet" />}
        {guides && selectedId === element.id && <rect data-packaging-handle="selection" x={-element.width / 2} y={-element.height / 2} width={element.width} height={element.height} fill="none" stroke="#e75442" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </g>)}
    </g>
    {guides && <rect data-packaging-guide="safe" {...region} fill="none" stroke="#28a99d" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="5 4" pointerEvents="none" />}
  </g>;
}

function FoldedGarment({ color = '#737b7b', garmentType = 'tshirt', reverse = false, width, height }: {
  color?: string; garmentType?: string; reverse?: boolean; width: number; height: number;
}) {
  const unique = useId().replace(/:/g, '');
  const tshirt = garmentType === 'tshirt';
  const body = 'M35 33Q55 23 89 23Q120 29 151 23Q185 23 205 33L211 263Q212 280 196 282Q120 287 44 282Q28 280 29 263Z';
  return <svg data-folded-garment={tshirt ? 'tshirt' : 'garment'} data-garment-facing={reverse ? 'back' : 'front'} width={width} height={height} viewBox="0 0 240 300" preserveAspectRatio="xMidYMid meet" overflow="hidden" pointerEvents="none">
    <defs>
      <linearGradient id={`${unique}-fabric`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff" stopOpacity=".15" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".13" /></linearGradient>
      <linearGradient id={`${unique}-edge`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#000" stopOpacity=".06" /><stop offset="1" stopColor="#000" stopOpacity=".27" /></linearGradient>
    </defs>
    <ellipse cx="120" cy="286" rx="99" ry="9" fill="#000" opacity=".1" />
    {tshirt && <g data-garment-detail="tucked-sleeves" fill={color} stroke="#000" strokeOpacity=".18" strokeWidth="1.2" strokeLinejoin="round">
      <path d="M38 35Q23 42 20 65L16 136Q25 151 45 155L65 91Z" />
      <path d="M202 35Q217 42 220 65L224 136Q215 151 195 155L175 91Z" />
      <path d="M20 65 42 111 45 155Q25 151 16 136ZM220 65 198 111 195 155Q215 151 224 136Z" fill="#000" opacity=".09" stroke="none" />
      <path d="M17 132Q29 142 44 145M223 132Q211 142 196 145" fill="none" />
    </g>}
    <g data-garment-detail="folded-edge">
      <path d="M30 259Q120 267 210 259L211 279Q208 289 196 290H44Q32 289 29 279Z" fill={color} />
      <path d="M30 259Q120 267 210 259L211 279Q208 289 196 290H44Q32 289 29 279Z" fill={`url(#${unique}-edge)`} />
      <path d="M36 283Q120 289 204 283" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="1.2" />
    </g>
    <path data-garment-detail="folded-body" d={body} fill={color} />
    <path d={body} fill={`url(#${unique}-fabric)`} stroke="#000" strokeOpacity=".2" strokeWidth="1.2" />
    <path d="M40 38Q58 29 84 29M156 29Q183 29 200 38M34 268Q120 277 206 268" fill="none" stroke="#fff" strokeOpacity=".24" strokeWidth="1.6" />
    <path d="M42 57Q48 109 39 169M198 57Q192 109 201 169M43 255Q119 264 197 255" fill="none" stroke="#000" strokeOpacity=".09" strokeWidth="1.3" />
    {tshirt && !reverse && <g data-garment-detail="collar">
      <path d="M87 24Q120 32 153 24Q151 69 120 71Q89 69 87 24Z" fill={color} />
      <path d="M87 24Q120 32 153 24Q151 69 120 71Q89 69 87 24Z" fill="#000" opacity=".24" />
      <path d="M92 26Q96 60 120 62Q144 60 148 26" fill="none" stroke={color} strokeWidth="7" />
      <path d="M88 26Q92 67 120 68Q148 67 152 26" fill="none" stroke="#fff" strokeOpacity=".24" strokeWidth="1.3" />
      <path d="M94 28Q120 34 146 28" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="1.4" />
      <path d="M113 31H127V40Q120 42 113 40Z" fill="#eeeae2" opacity=".7" />
    </g>}
    {reverse && <path data-garment-detail="back-fold" d="M39 63Q120 70 201 63M55 73Q58 135 48 200M185 73Q182 135 192 200" fill="none" stroke="#000" strokeOpacity=".1" strokeWidth="1.3" />}
  </svg>;
}

function PackagingContents({ design, panel, garmentColor, garmentType, reverse = false }: ArtworkProps & { panel: PackagingPanel; reverse?: boolean }) {
  const region = printRegion({ ...design, shippingLabel: false }, panel);
  const inset = Math.min(region.width, region.height) * .025;
  return <g data-packaging-contents="true" transform={`translate(${region.x + inset} ${region.y + inset})`} pointerEvents="none">
    <FoldedGarment color={garmentColor} garmentType={garmentType} reverse={reverse} width={region.width - inset * 2} height={region.height - inset * 2} />
  </g>;
}

type Point = [number, number];
type Vertex = [number, number, number];
interface BoxFace { vertices: Vertex[]; panel?: PackagingPanel; interior?: boolean; shade?: number; tape?: boolean; notch?: boolean; magnets?: boolean; outline?: boolean }
export function packagingBoxGeometry(design: PackagingDesign, view: PackagingView) {
  const bulk = design.category === 'none';
  const { width, height: length, depth } = bulk ? { width: 420, height: 340, depth: 290 } : design.dimensions;
  const closure = packagingTemplate(design.templateId).closure;
  const opened = view === 'open' && !bulk;
  const reverse = view === 'reverse';
  const thickness = Math.min(4, depth * .06, width * .02, length * .02);
  const faces: BoxFace[] = [];
  const add = (vertices: Vertex[], panel?: PackagingPanel, interior = false, shade = 0, tape = false) => faces.push({ vertices, panel, interior, shade, tape });
  const front = (start: number, end: number, back: number, top: number, bottom: number, panel?: PackagingPanel, interior = false, shade = .08) => add([[start, back, top], [end, back, top], [end, back, bottom], [start, back, bottom]], panel, interior, shade);
  const topFace = (start: number, end: number, near: number, far: number, level: number, panel?: PackagingPanel, interior = false, shade = 0) => add([[start, far, level], [end, far, level], [end, near, level], [start, near, level]], panel, interior, shade);
  const side = (across: number, near: number, far: number, top: number, bottom: number, panel?: PackagingPanel, interior = false, shade = .16) => add([[across, near, top], [across, far, top], [across, far, bottom], [across, near, bottom]], panel, interior, shade);
  const tray = (offset: number, inset = 0) => {
    const near = offset + inset;
    const far = offset + length - inset;
    const low = inset;
    const high = width - inset;
    const level = depth - inset;
    front(low, high, far, level, thickness, undefined, true, .15);
    side(low, near, far, level, thickness, undefined, true, .1);
    topFace(low + thickness, high - thickness, near + thickness, far - thickness, thickness, 'interior-base', true, .04);
    front(low + thickness, high - thickness, near + thickness, level, thickness, undefined, true, .08);
    side(high - thickness, near, far, level, thickness, undefined, true, .12);
    side(high, near, far, level, 0, 'right');
    front(low, high, near, level, 0, 'front');
    if (closure === 'drawer') {
      faces[faces.length - 1].notch = true;
      const halfNotch = Math.min(12, width * .04);
      topFace(low, width / 2 - halfNotch, near, near + thickness, level, undefined, true);
      topFace(width / 2 + halfNotch, high, near, near + thickness, level, undefined, true);
    } else topFace(low, high, near, near + thickness, level, undefined, true);
    topFace(low, high, far - thickness, far, level, undefined, true);
    topFace(low, low + thickness, near, far, level, undefined, true);
    topFace(high - thickness, high, near, far, level, undefined, true);
  };
  if (opened) {
    if (closure === 'fold' || closure === 'magnet' || closure === 'lift') {
      const lidBack = length + length * .28;
      const lidTop = depth + length * .96;
      const lift = closure === 'lift' ? depth * .65 : 0;
      add([[0, lidBack, lidTop + lift], [width, lidBack, lidTop + lift], [width, length, depth + lift], [0, length, depth + lift]], 'interior-lid', true);
      const flap = Math.min(depth * .6, width * .16);
      if (closure === 'fold' || closure === 'lift') {
        add([[0, lidBack, lidTop + lift], [-flap, lidBack - flap * .2, lidTop - flap * .45 + lift], [-flap, length + flap * .5, depth + flap * .35 + lift], [0, length, depth + lift]], undefined, true, .08);
        add([[width, lidBack, lidTop + lift], [width + flap, lidBack - flap * .2, lidTop - flap * .45 + lift], [width + flap, length + flap * .5, depth + flap * .35 + lift], [width, length, depth + lift]], undefined, true, .08);
      }
      add([[0, lidBack, lidTop + lift], [width, lidBack, lidTop + lift], [width - thickness * 2, lidBack + flap * .55, lidTop + flap * .35 + lift], [thickness * 2, lidBack + flap * .55, lidTop + flap * .35 + lift]], undefined, true, .06);
      if (closure === 'magnet') faces[faces.length - 1].magnets = true;
    }
    if (closure === 'tape') {
      const flap = length / 2;
      add([[0, length, depth], [width, length, depth], [width, length + flap * .8, depth + flap * .6], [0, length + flap * .8, depth + flap * .6]], undefined, true, .04);
      add([[0, 0, depth], [0, length, depth], [-width * .46, length, depth + width * .196], [-width * .46, 0, depth + width * .196]], undefined, true, .1);
    }
    tray(closure === 'drawer' ? -length * .25 : 0, closure === 'drawer' ? thickness * .35 : 0);
    if (closure === 'drawer') {
      side(width, 0, length, depth, 0, 'right');
      topFace(0, width, 0, length, depth, 'top');
    }
    if (closure === 'tape') {
      add([[width, 0, depth], [width, length, depth], [width * 1.46, length, depth + width * .196], [width * 1.46, 0, depth + width * .196]], undefined, true, .1);
      const flap = length / 2;
      add([[0, 0, depth], [width, 0, depth], [width, -flap * .92, depth - flap * .39], [0, -flap * .92, depth - flap * .39]], undefined, true, .04);
    }
  } else {
    side(width, 0, length, depth, 0, reverse ? 'left' : 'right');
    if (closure === 'drawer' && !reverse) {
      front(0, width, 0, depth, 0, undefined, false, .16);
      faces[faces.length - 1].outline = false;
      front(thickness * .35, width - thickness * .35, 0, depth - thickness * .35, 0, 'front');
      faces[faces.length - 1].notch = true;
    } else front(0, width, 0, depth, 0, reverse ? 'back' : 'front');
    topFace(0, width, 0, length, depth, 'top');
    if (closure === 'fold' || closure === 'magnet' || closure === 'lift') {
      const lip = Math.min(depth * .28, 22);
      front(0, width, 0, depth, depth - lip, undefined, false, .03);
      side(width, 0, length, depth, depth - lip, undefined, false, .11);
      if (closure === 'fold' && !reverse) {
        const tabWidth = Math.min(width * .18, 55);
        add([[(width - tabWidth) / 2, -1, depth - lip], [(width + tabWidth) / 2, -1, depth - lip], [(width + tabWidth) / 2 - 4, -1, depth - lip * 1.7], [(width - tabWidth) / 2 + 4, -1, depth - lip * 1.7]], undefined, false, .04);
      }
    }
    if (closure === 'tape') {
      const tapeWidth = Math.min(48, width * .14);
      topFace((width - tapeWidth) / 2, (width + tapeWidth) / 2, 0, length, depth, undefined, false, 0);
      faces[faces.length - 1].tape = true;
      front((width - tapeWidth) / 2, (width + tapeWidth) / 2, 0, depth, depth - Math.min(depth * .3, 65), undefined, false, 0);
      faces[faces.length - 1].tape = true;
    }
  }
  return faces;
}
function boxProject([across, back, up]: Vertex): Point { return [across * .9 + back * .48, across * .18 - back * .42 - up * .95]; }
function boxBounds(faces: BoxFace[]) {
  const points = faces.flatMap(face => face.vertices.map(boxProject));
  const left = Math.min(...points.map(point => point[0]));
  const top = Math.min(...points.map(point => point[1]));
  return { left, top, width: Math.max(...points.map(point => point[0])) - left, height: Math.max(...points.map(point => point[1])) - top };
}
function PackagingBox(props: ArtworkProps & { view: PackagingView }) {
  const { design, view } = props;
  const faces = packagingBoxGeometry(design, view);
  const bounds = boxBounds(faces);
  const envelope = boxBounds([...packagingBoxGeometry(design, 'closed'), ...packagingBoxGeometry(design, 'open')]);
  const scale = Math.min(540 / envelope.width, 490 / envelope.height);
  const template = packagingTemplate(design.templateId);
  const bulk = design.category === 'none';
  return <g data-box-view={view} className="pkg-box-view" transform={`translate(${320 - (bounds.left + bounds.width / 2) * scale} ${300 - (bounds.top + bounds.height / 2) * scale}) scale(${scale})`}>
    {faces.map((face, index) => {
      const points = face.vertices.map(boxProject);
      const fill = face.tape ? '#ae8956' : bulk ? '#bd9561' : face.interior ? design.interior : design.exterior;
      const printable = face.panel && !bulk && template.panels.includes(face.panel);
      const dimensions = face.panel ? panelSize(design, face.panel) : null;
      const surfacePoints = face.panel === 'top' && view === 'reverse' ? [points[2], points[3], points[0], points[1]] : points;
      if (face.notch) {
        const faceWidth = face.vertices[1][0] - face.vertices[0][0];
        const faceHeight = face.vertices[0][2] - face.vertices[3][2];
        const notchWidth = Math.min(24, design.dimensions.width * .08);
        const notchDepth = Math.min(6, faceHeight * .1);
        const shape = `M0 0H${(faceWidth - notchWidth) / 2}Q${faceWidth / 2} ${notchDepth * 2} ${(faceWidth + notchWidth) / 2} 0H${faceWidth}V${faceHeight}H0Z`;
        return <g key={index} data-box-face={face.panel} data-box-material="exterior" transform={projection(points[0], points[1], points[3], faceWidth, faceHeight)}>
          <path d={shape} fill={fill} />
          <path d={shape} fill="#000" opacity={face.shade} />
          {printable && dimensions && <g data-packaging-panel={face.panel} transform={`scale(${faceWidth / dimensions.width} ${faceHeight / dimensions.height})`}><PackagingSurface {...props} guides={props.guides && design.selectedPanel === face.panel} panel={face.panel!} /></g>}
          <path d={shape} fill="none" stroke="#514d46" strokeWidth="1.15" vectorEffect="non-scaling-stroke" />
        </g>;
      }
      return <g key={index} data-box-face={face.panel ?? (face.tape ? 'tape' : 'construction')} data-box-material={face.interior ? 'interior' : 'exterior'}>
        <polygon points={points.map(point => point.join(',')).join(' ')} fill={fill} />
        {!!face.shade && <polygon points={points.map(point => point.join(',')).join(' ')} fill="#000" opacity={face.shade} />}
        {printable && dimensions && <g data-packaging-panel={face.panel} transform={projection(surfacePoints[0], surfacePoints[1], surfacePoints[3], dimensions.width, dimensions.height)}><PackagingSurface {...props} guides={props.guides && design.selectedPanel === face.panel} panel={face.panel!} /></g>}
        {props.contents && view === 'open' && face.panel === 'interior-base' && dimensions && <g transform={projection(points[0], points[1], points[3], dimensions.width, dimensions.height)}>
          <PackagingContents {...props} panel="interior-base" />
        </g>}
        {face.magnets && (() => {
          const flapWidth = face.vertices[1][0] - face.vertices[0][0];
          const flapHeight = Math.hypot(...face.vertices[3].map((coordinate, axis) => coordinate - face.vertices[0][axis]));
          const radius = Math.min(5, flapWidth * .02, flapHeight * .22);
          return <g transform={projection(points[0], points[1], points[3], flapWidth, flapHeight)} pointerEvents="none">
            {[.25, .75].map(position => <circle key={position} data-packaging-magnet cx={flapWidth * position} cy={flapHeight / 2} r={radius} fill="#c5c8cc" stroke="#71767b" strokeWidth=".8" vectorEffect="non-scaling-stroke" />)}
          </g>;
        })()}
        {face.outline !== false && <polygon points={points.map(point => point.join(',')).join(' ')} fill="none" stroke={face.tape ? '#947243' : '#514d46'} strokeWidth={face.tape ? .65 : 1.15} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      </g>;
    })}
  </g>;
}
function projection(origin: Point, across: Point, down: Point, width: number, height: number) {
  return `matrix(${(across[0] - origin[0]) / width} ${(across[1] - origin[1]) / width} ${(down[0] - origin[0]) / height} ${(down[1] - origin[1]) / height} ${origin[0]} ${origin[1]})`;
}
export function packagingPreviewFrame(design: PackagingDesign, view = design.view) {
  if ((design.category === 'box' || design.category === 'none') && view !== 'panel') {
    const bounds = boxBounds(packagingBoxGeometry(design, view));
    const envelope = boxBounds([...packagingBoxGeometry(design, 'closed'), ...packagingBoxGeometry(design, 'open')]);
    const scale = Math.min(540 / envelope.width, 490 / envelope.height);
    const width = Math.max(bounds.width * scale * 1.3, 180);
    const height = Math.max(bounds.height * scale * 1.3, 180);
    return `${320 - width / 2} ${300 - height / 2} ${width} ${height}`;
  }
  let bounds = { x: 140, y: 165, width: 395, height: 315 };
  if (view === 'panel' || (design.category !== 'box' && design.category !== 'none')) {
    const size = view === 'panel' ? panelSize(design, design.selectedPanel) : design.dimensions;
    const scale = view === 'panel' ? Math.min(470 / size.width, 450 / size.height) : Math.min(440 / size.width, 470 / size.height);
    const width = size.width * scale;
    const height = size.height * scale;
    bounds = { x: (640 - width) / 2, y: (600 - height) / 2, width, height };
  }
  const padding = Math.max(bounds.width, bounds.height) * .045;
  return `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;
}
export function PackagingArtwork(props: ArtworkProps) {
  const { design, guides = false, contents = false } = props;
  const template = packagingTemplate(design.templateId);
  const view = props.view ?? design.view;
  const unique = useId().replace(/:/g, '');
  const isBulk = design.category === 'none';
  const box = design.category === 'box' || isBulk;
  const size = panelSize(design, design.selectedPanel);
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={props.fit ? packagingPreviewFrame(design, view) : '0 0 640 600'} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${template.name}, ${view} view`} data-packaging-artwork={template.id} strokeLinejoin="round" strokeLinecap="round" style={{ width: '100%', height: '100%', maxHeight: '100%', overflow: 'visible' }}>
    <defs>
      <filter id={`${unique}-frost`}><feGaussianBlur stdDeviation="1.6" /></filter>
      <pattern id={`${unique}-paper`} width="9" height="9" patternUnits="userSpaceOnUse"><path d="M1 3h2M5 7h2" stroke="#644c30" strokeWidth="0.45" opacity=".2" /></pattern>
      <pattern id={`${unique}-padding`} width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 8 8 0 16 8 8 16Z" fill="none" stroke="#735d41" strokeWidth=".6" opacity=".2" /></pattern>
      <linearGradient id={`${unique}-film`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff" stopOpacity=".45" /><stop offset=".35" stopColor="#fff" stopOpacity=".04" /><stop offset="1" stopColor="#fff" stopOpacity=".25" /></linearGradient>
    </defs>
    {view === 'panel' && !isBulk ? <g transform={`translate(${(640 - size.width * Math.min(470 / size.width, 450 / size.height)) / 2} ${(600 - size.height * Math.min(470 / size.width, 450 / size.height)) / 2}) scale(${Math.min(470 / size.width, 450 / size.height)})`}>
      <rect width={size.width} height={size.height} fill={design.selectedPanel.startsWith('interior') ? design.interior : design.exterior} fillOpacity={template.transparency ? design.opacity : 1} stroke="#777" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <PackagingSurface {...props} panel={design.selectedPanel} />
    </g> : !box ? (() => {
      const { width, height } = design.dimensions;
      const scale = Math.min(440 / width, 470 / height);
      const front = view !== 'back';
      const activePanel = front ? 'front' : 'back';
      const isPaper = template.material.includes('paper');
      const filmStroke = props.surfaceTone === 'dark' && template.transparency ? '#c5d0d5' : '#59666d';
      const shape = `M4 0H${width - 4}L${width} ${height - 8}Q${width / 2} ${height + 3} 0 ${height - 8}Z`;
      const handleWidth = Math.min(90, width * 0.4);
      return <g transform={`translate(${(640 - width * scale) / 2} ${(600 - height * scale) / 2}) scale(${scale})`}>
        <defs><mask id={`${unique}-bag`}><path d={shape} fill="white" />{template.closure === 'handle' && <rect x={(width - handleWidth) / 2} y="17" width={handleWidth} height="19" rx="9.5" fill="black" />}</mask><clipPath id={`${unique}-bagclip`}><path d={shape} /></clipPath></defs>
        <g mask={`url(#${unique}-bag)`}>
          {template.transparency && contents && design.opacity < 1 && <g opacity={template.transparency === 'frosted' ? .82 : .96} filter={template.transparency === 'frosted' ? `url(#${unique}-frost)` : undefined}>
            <PackagingContents {...props} panel={activePanel} reverse={!front} />
          </g>}
          <path d={shape} fill={design.exterior} fillOpacity={template.transparency ? design.opacity : 1} data-material-opacity={template.transparency ? design.opacity : 1} />
          <path d={shape} fill={isPaper ? `url(#${unique}-paper)` : `url(#${unique}-film)`} opacity={template.transparency === 'frosted' ? .4 : 1} />
          {template.transparency === 'frosted' && <path d={shape} fill="#eef2f3" opacity=".12" />}
          {template.id === 'padded' && <path d={shape} fill={`url(#${unique}-padding)`} />}
          <PackagingSurface {...props} panel={activePanel} />
          <g data-packaging-construction="" fill="none" stroke={filmStroke} strokeWidth=".8" pointerEvents="none">
            <path d={`M7 0V${height - 12}H${width - 7}V0`} opacity=".5" />
            {template.closure === 'heat' && <path d={`M5 10H${width - 5}M5 14H${width - 5}`} />}
            {template.closure === 'zip' && <><path d={`M4 18H${width - 4}M4 23H${width - 4}M4 27H${width - 4}`} /><rect x={width * .82} y="15" width="12" height="16" rx="2" fill="#e1e5e5" /></>}
            {template.closure === 'adhesive' && <><path d={`M4 34H${width - 4}`} strokeDasharray="4 3" /><path d={`M4 0 18 29H${width - 18}L${width - 4} 0`} fill={design.exterior} fillOpacity=".3" /><path d={`M12 16H${width - 12}`} stroke="#555" strokeWidth="7" opacity={front ? '.18' : '.7'} /></>}
            {template.closure === 'handle' && <><path d={`M4 49H${width - 4}M4 54H${width - 4}`} /><circle cx={width - 16} cy={height - 22} r="2" fill="#687277" /></>}
            {template.id === 'kraft-mailer' && !front && <path d={`M${width / 2 - 5} 36V${height - 10}M7 ${height - 24} ${width / 2} ${height - 8} ${width - 7} ${height - 24}`} />}
            {template.id === 'padded' && <path d={`M15 45V${height - 18}H${width - 15}V45`} strokeDasharray="2 2" strokeWidth="3" />}
          </g>
          {design.category === 'mailer' && design.shippingLabel && front && <rect data-shipping-label="reserved" x={width * .52} y={Math.max(60, height * .28)} width={width * .38} height={Math.min(height * .42, 150)} rx="2" fill="#f9fafb" stroke="#aeb4b7" strokeWidth="1" />}
        </g>
        <g data-packaging-perimeter="" fill="none" stroke={filmStroke} strokeWidth="1.2" pointerEvents="none">
          <path d={shape} />
          {template.closure === 'handle' && <rect x={(width - handleWidth) / 2} y="17" width={handleWidth} height="19" rx="9.5" />}
        </g>
      </g>;
    })() : <PackagingBox {...props} view={view} />}
  </svg>;
}