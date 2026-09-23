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

type Point = [number, number];
function projection(origin: Point, across: Point, down: Point, width: number, height: number) {
  return `matrix(${(across[0] - origin[0]) / width} ${(across[1] - origin[1]) / width} ${(down[0] - origin[0]) / height} ${(down[1] - origin[1]) / height} ${origin[0]} ${origin[1]})`;
}
export function packagingPreviewFrame(design: PackagingDesign, view = design.view) {
  const template = packagingTemplate(design.templateId);
  let bounds = { x: 140, y: 165, width: 395, height: 315 };
  if (view === 'panel' || (design.category !== 'box' && design.category !== 'none')) {
    const size = view === 'panel' ? panelSize(design, design.selectedPanel) : design.dimensions;
    const scale = view === 'panel' ? Math.min(470 / size.width, 450 / size.height) : Math.min(440 / size.width, 470 / size.height);
    const width = size.width * scale;
    const height = size.height * scale;
    bounds = { x: (640 - width) / 2, y: (600 - height) / 2, width, height };
  } else if (view === 'open' && design.category !== 'none') {
    bounds = template.closure === 'tape' ? { x: 85, y: 204, width: 499, height: 276 }
      : template.closure === 'drawer' ? { x: 140, y: 150, width: 380, height: 330 }
      : { x: 140, y: 70, width: 389, height: 410 };
  }
  const padding = Math.max(bounds.width, bounds.height) * .045;
  return `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;
}
export function PackagingArtwork(props: ArtworkProps) {
  const { design, guides = false, contents = false, garmentColor = '#737b7b' } = props;
  const template = packagingTemplate(design.templateId);
  const view = props.view ?? design.view;
  const unique = useId().replace(/:/g, '');
  const isBulk = design.category === 'none';
  const box = design.category === 'box' || isBulk;
  const size = panelSize(design, design.selectedPanel);
  const panel = (surface: PackagingPanel, origin: Point, across: Point, down: Point, interior = false, shade = 0) => {
    const dimensions = panelSize(design, surface);
    const width = dimensions.width;
    const height = dimensions.height;
    return <g key={surface} data-packaging-panel={surface} transform={projection(origin, across, down, width, height)}>
      <rect width={width} height={height} fill={interior ? design.interior : design.exterior} />
      {shade > 0 && <rect width={width} height={height} fill="#000" opacity={shade} />}
      {!isBulk && (!interior || surface.startsWith('interior')) && template.panels.includes(surface) && <PackagingSurface {...props} panel={surface} />}
      <rect width={width} height={height} fill="none" stroke="#53514b" strokeWidth="1.4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
    </g>;
  };
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={props.fit ? packagingPreviewFrame(design, view) : '0 0 640 600'} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${template.name}, ${view} view`} data-packaging-artwork={template.id} style={{ width: '100%', height: '100%', maxHeight: '100%', overflow: 'visible' }}>
    <defs>
      <filter id={`${unique}-frost`}><feGaussianBlur stdDeviation="5" /></filter>
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
          {template.transparency && contents && <g data-packaging-contents="true" opacity={template.transparency === 'frosted' ? 0.7 : 1} filter={template.transparency === 'frosted' ? `url(#${unique}-frost)` : undefined}>
            <rect x={width * 0.12} y={height * 0.22} width={width * 0.76} height={height * 0.69} rx="12" fill={garmentColor} />
            <path d={`M${width * .3} ${height * .25}Q${width * .5} ${height * .42} ${width * .7} ${height * .25}M${width * .2} ${height * .35}V${height * .83}M${width * .8} ${height * .35}V${height * .83}`} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2" />
          </g>}
          <path d={shape} fill={design.exterior} fillOpacity={template.transparency ? design.opacity : 1} data-material-opacity={template.transparency ? design.opacity : 1} />
          <path d={shape} fill={isPaper ? `url(#${unique}-paper)` : `url(#${unique}-film)`} opacity={template.transparency === 'frosted' ? .4 : 1} />
          {template.transparency === 'frosted' && <path d={shape} fill="#eef2f3" opacity=".12" />}
          {template.id === 'padded' && <path d={shape} fill={`url(#${unique}-padding)`} />}
          <PackagingSurface {...props} panel={activePanel} />
          <g fill="none" stroke={filmStroke} strokeWidth="1.2" pointerEvents="none">
            <path d={shape} /><path d={`M7 0V${height - 12}H${width - 7}V0`} opacity=".5" />
            {template.closure === 'heat' && <path d={`M5 10H${width - 5}M5 14H${width - 5}`} />}
            {template.closure === 'zip' && <><path d={`M4 18H${width - 4}M4 23H${width - 4}M4 27H${width - 4}`} /><rect x={width * .82} y="15" width="12" height="16" rx="2" fill="#e1e5e5" /></>}
            {template.closure === 'adhesive' && <><path d={`M4 34H${width - 4}`} strokeDasharray="4 3" /><path d={`M4 0 18 29H${width - 18}L${width - 4} 0`} fill={design.exterior} fillOpacity=".3" /><path d={`M12 16H${width - 12}`} stroke="#555" strokeWidth="7" opacity={front ? '.18' : '.7'} /></>}
            {template.closure === 'handle' && <><rect x={(width - handleWidth) / 2} y="17" width={handleWidth} height="19" rx="9.5" /><path d={`M4 49H${width - 4}M4 54H${width - 4}`} /><circle cx={width - 16} cy={height - 22} r="2" fill="#687277" /></>}
            {template.id === 'kraft-mailer' && !front && <path d={`M${width / 2 - 5} 36V${height - 10}M7 ${height - 24} ${width / 2} ${height - 8} ${width - 7} ${height - 24}`} />}
            {template.id === 'padded' && <path d={`M15 45V${height - 18}H${width - 15}V45`} strokeDasharray="2 2" strokeWidth="3" />}
          </g>
          {design.category === 'mailer' && design.shippingLabel && front && <rect data-shipping-label="reserved" x={width * .52} y={Math.max(60, height * .28)} width={width * .38} height={Math.min(height * .42, 150)} rx="2" fill="#f9fafb" stroke="#aeb4b7" strokeWidth="1" />}
        </g>
      </g>;
    })() : <g key={view} data-box-view={view} className="pkg-box-view">
      {view === 'open' && !isBulk ? <>
        {template.closure !== 'drawer' && template.closure !== 'tape' && panel('interior-lid', [205, 92], [500, 112], [225, 280], true)}
        {template.closure === 'fold' && <path d="M205 92 177 110 198 259 225 280M500 112 529 133 524 280 520 300" fill={design.interior} stroke="#6e6252" />}
        {template.closure === 'magnet' && <><path d="M205 92 205 70 500 90 500 112" fill={design.exterior} stroke="#6e6252" /><circle cx="295" cy="88" r="3" fill="#999" /><circle cx="410" cy="96" r="3" fill="#999" /></>}
        {template.closure === 'lift' && <path d="M205 92 195 72 490 92 500 112M195 72 184 254 225 280" fill={design.exterior} stroke="#6e6252" />}
        {template.closure === 'drawer' && <>{panel('top', [200, 150], [495, 170], [140, 280])}<path d="M140 280v75l295 20v-75" fill={design.exterior} stroke="#53514b" /></>}
        {template.closure === 'tape' && <><path d="M225 280 203 204 498 224 520 300M225 280 142 250 85 369 140 400M520 300 584 280 502 419 435 420" fill={design.exterior} stroke="#6e6252" /></>}
        {panel('back', [225, 280], [520, 300], [225, 340], true, .08)}
        {panel('interior-base', [225, 340], [520, 360], [140, 440], true)}
        {panel('left', [225, 280], [140, 400], [225, 340], true, .12)}
        {panel('right', [435, 420], [520, 300], [435, 480], false, .2)}
        {panel('front', [140, 400], [435, 420], [140, 460], false, .08)}
        {template.closure === 'drawer' && <path d="M267 409q20 23 40 3" fill="none" stroke="#53514b" strokeWidth="2" />}
      </> : <>
        {panel(view === 'reverse' ? 'back' : 'front', [140, 280], [435, 310], [140, 450], false, .06)}
        {panel(view === 'reverse' ? 'left' : 'right', [435, 310], [535, 195], [435, 480], false, .2)}
        {panel('top', [240, 165], [535, 195], [140, 280])}
        {['lift', 'magnet'].includes(template.closure) && <path d="M140 310 435 340 535 225" fill="none" stroke="#53514b" strokeWidth="2" />}
        {template.closure === 'fold' && <path d="M240 165 247 175 522 203 435 302 150 275M270 294v14h45v-10" fill="none" stroke="#53514b" strokeWidth="1.5" />}
        {template.closure === 'drawer' && <><path d="M151 292 426 320V466L151 438Z" fill="none" stroke="#53514b" /><path d="M264 294q18 26 37 4" fill="none" stroke="#53514b" strokeWidth="2" /></>}
        {template.closure === 'tape' && <><path d="M387 180 287 295" stroke="#98773e" strokeWidth="25" opacity=".7" /><path d="M287 295v38" stroke="#98773e" strokeWidth="25" opacity=".7" /><path d="M387 180 287 295" stroke="#705f47" strokeWidth="1" /></>}
      </>}
    </g>}
  </svg>;
}