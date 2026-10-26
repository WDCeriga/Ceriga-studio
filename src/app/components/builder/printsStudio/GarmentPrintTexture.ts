import {artworkPixelRatio} from '../../../lib/artworkResolution';
import {createContext,useEffect,useState,useRef} from 'react';
import type {GarmentDrawingMask} from './useGarmentDrawingMask';
export const GarmentPrintTextureContext=createContext<GarmentDrawingMask|null>(null);
export const GarmentPatternReliefContext=createContext<GarmentDrawingMask|null>(null);
export function useGarmentPrintTexture(zone: HTMLDivElement | null, side: 'front' | 'back', artboard = false,qualityScale=1,mode:'artwork'|'pattern'='artwork',enabled=true) {
  const [mask, setMask] = useState<GarmentDrawingMask | null>(null);
  const source=useRef<{zone:HTMLElement|null;side:string;artboard:boolean}|undefined>(undefined);
  useEffect(() => {
    if(source.current?.zone!==zone||source.current?.side!==side||source.current?.artboard!==artboard)setMask(null);
    source.current={zone,side,artboard};
    if(artboard||!enabled)return;
    const preview = zone?.parentElement?.querySelector<HTMLElement>('[data-print-garment-preview]');
    if (!zone || !preview) return;
    let generation = 0;
    let frame = 0;
    const rebuild = async () => {
      const current = ++generation;
      const bounds = zone.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const canvas = document.createElement('canvas');
      const resolution = artworkPixelRatio(zone.clientWidth,zone.clientHeight,bounds.width/Math.max(1,zone.clientWidth),window.devicePixelRatio||1);
      canvas.width = Math.max(1, Math.round(zone.clientWidth * resolution));
      canvas.height = Math.max(1, Math.round(zone.clientHeight * resolution));
      const scaleX = canvas.width / bounds.width;
      const scaleY = canvas.height / bounds.height;
      const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      root.setAttribute('width', String(canvas.width));
      root.setAttribute('height', String(canvas.height));
      root.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);
      for (const svg of preview.querySelectorAll<SVGSVGElement>('svg')) {
        if (svg.parentElement?.closest('svg') || getComputedStyle(svg).visibility === 'hidden') continue;
        if(mode==='artwork'&&!svg.querySelector('[data-fabric-base]'))continue;
        if(mode==='pattern'&&!svg.closest('[data-layer-id]')&&!svg.hasAttribute('data-technical-linework'))continue;
        const textureSvg=svg.cloneNode(true) as SVGSVGElement;
        if(mode==='artwork') textureSvg.querySelectorAll('path,polygon,rect,circle,ellipse,line,polyline,text,image,use').forEach(shape=>{
          if(!shape.closest('defs')&&!shape.hasAttribute('data-fabric-base'))shape.remove();
        });
        else {
          textureSvg.querySelectorAll('[data-garment-label-overlay],[data-measurement-guide],[data-editor-chrome]').forEach(node=>node.remove());
          const layer=svg.closest('[data-layer-id]')?.getAttribute('data-layer-id')??'';
          const linework=layer==='outline'||layer.toLowerCase().includes('stitch')||svg.hasAttribute('data-technical-linework');
          if(!linework) textureSvg.querySelectorAll<SVGElement>('path,polygon,rect,circle,ellipse').forEach(shape=>{
            if(shape.closest('defs'))return;
            const fill=shape.style.fill||shape.getAttribute('fill')||'';
            if(fill==='none')return;
            if(!fill.startsWith('url(')){shape.setAttribute('fill','#ffffff');shape.style.fill='#ffffff';}
          });
        }
        textureSvg.querySelectorAll('[data-fabric-texture]').forEach(pattern=>{
          const base=pattern.querySelector('rect');if(base)base.setAttribute('fill','#ffffff');
          pattern.querySelectorAll('image').forEach(image=>image.setAttribute('filter','url(#print-fabric-relief-filter)'));
        });
        const matrix = svg.getScreenCTM();
        if (!matrix || !svg.getBoundingClientRect().width) continue;
        const group = document.createElementNS(root.namespaceURI, 'g');
        // Child paths inherit paint from the source SVG root (technical paths use fill=none).
        for(const name of ['fill','fill-rule','stroke','stroke-width','stroke-linejoin','stroke-linecap','stroke-dasharray','opacity','color']){
          const value=textureSvg.getAttribute(name);if(value!=null)group.setAttribute(name,value);
        }
        if(textureSvg.style.fill)group.setAttribute('fill',textureSvg.style.fill);
        if(textureSvg.style.stroke)group.setAttribute('stroke',textureSvg.style.stroke);

        group.setAttribute('transform', `matrix(${matrix.a * scaleX} ${matrix.b * scaleY} ${matrix.c * scaleX} ${matrix.d * scaleY} ${(matrix.e - bounds.left) * scaleX} ${(matrix.f - bounds.top) * scaleY})`);
        for (const child of textureSvg.childNodes) group.appendChild(child.cloneNode(true));
        root.appendChild(group);
      }
      if(!root.children.length){if(generation===current)setMask(null);return;}
      const filterDefs=document.createElementNS(root.namespaceURI,'defs');
      filterDefs.innerHTML='<filter id="print-fabric-relief-filter" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".11693 .39336 .03971 0 .45 .11693 .39336 .03971 0 .45 .11693 .39336 .03971 0 .45 0 0 0 1 0"/></filter>';
      root.prepend(filterDefs);
      const body = preview.querySelector<SVGSVGElement>('[data-layer-id="body"] svg') ?? preview.querySelector<SVGSVGElement>('svg');
      const matrix = body?.getScreenCTM();
      const viewBox = body?.viewBox.baseVal;
      const axis = matrix && viewBox
        ? (matrix.a * (viewBox.x + viewBox.width / 2) + matrix.c * (viewBox.y + viewBox.height / 2) + matrix.e - bounds.left) / bounds.width * zone.clientWidth
        : zone.clientWidth / 2;
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' }));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(image, 0, 0);
        if (generation === current) setMask({ canvas, url: canvas.toDataURL('image/png'), width: zone.clientWidth, height: zone.clientHeight, axis });
      } catch (error) {
        console.warn('Could not prepare fabric relief for artwork.',error);
        if (generation === current) setMask(null);
      } finally { URL.revokeObjectURL(url); }
    };
    const schedule = () => {
      generation++;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { void rebuild(); });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(preview, { subtree: true, childList: true, attributes: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(zone);
    resize.observe(preview);
    schedule();
    return () => { generation++; observer.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); };
  }, [zone, side, artboard,qualityScale,mode,enabled]);
  return mask;
}

