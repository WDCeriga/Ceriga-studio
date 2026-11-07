import {artworkPixelRatio} from '../../../lib/artworkResolution';
import { useEffect, useState,useRef } from 'react';
import type { GarmentDrawingMask } from './useGarmentDrawingMask';

export interface GarmentPatternTarget extends GarmentDrawingMask {
  id: string;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  alpha: Uint8ClampedArray;
}

const names: Record<string, string> = {
  body: 'Body', base: 'Body', bodyHem: 'Hem', sleeveLeft: 'Left sleeve', sleeveRight: 'Right sleeve',
  sleeveHemLeft: 'Left cuff', sleeveHemRight: 'Right cuff', neck: 'Hood / collar',
  hood: 'Hood', pocket: 'Pocket', hem: 'Hem', sleeves: 'Sleeves', sleeveHem: 'Cuffs',
};

export function targetContains(target: GarmentPatternTarget, x: number, y: number) {
  const px = Math.floor(x / target.width * target.canvas.width);
  const py = Math.floor(y / target.height * target.canvas.height);
  return px >= 0 && py >= 0 && px < target.canvas.width && py < target.canvas.height
    && target.alpha[(py * target.canvas.width + px) * 4 + 3] > 32;
}

export function useGarmentPatternTargets(zone: HTMLDivElement | null, side: 'front' | 'back',qualityScale=1,disabled=false) {
  const [targets, setTargets] = useState<GarmentPatternTarget[]>([]);
  const source=useRef<{zone:HTMLElement|null;side:string}|undefined>(undefined);
  useEffect(() => {
    if(source.current?.zone!==zone||source.current?.side!==side)setTargets([]);
    source.current={zone,side};
    const preview = zone?.closest('[data-design-canvas]')?.querySelector<HTMLElement>('[data-print-garment-preview]');
    if (disabled || !zone || !preview) {setTargets([]);return;}
    let generation = 0;
    let frame = 0;
    let cameraTimer=0;
    const rebuild = async (version: number) => {
      const rect = zone.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const width = zone.clientWidth;
      const height = zone.clientHeight;
      const resolution=artworkPixelRatio(width,height,rect.width/Math.max(1,width),window.devicePixelRatio||1);
      const pixelWidth = Math.max(1, Math.round(width * resolution));
      const pixelHeight = Math.max(1, Math.round(height * resolution));
      const sx = pixelWidth / rect.width;
      const sy = pixelHeight / rect.height;
      const layers = Array.from(preview.querySelectorAll<HTMLElement>('[data-layer-id], [data-pattern-trim-id]'))
        .filter(layer => !['outline','stitching','construction','stitch'].includes(layer.dataset.layerId??''))
        .filter(layer => getComputedStyle(layer).visibility !== 'hidden' && getComputedStyle(layer).display !== 'none')
        .sort((a, b) => (a.dataset.patternTrimId?1000:Number(getComputedStyle(a).zIndex)||0) - (b.dataset.patternTrimId?1000:Number(getComputedStyle(b).zIndex)||0));
      const rasters = await Promise.all(layers.map(async layer => {
        const svg = layer.querySelector<SVGSVGElement>('svg');
        const matrix = svg?.getScreenCTM();
        if (!svg || !matrix) return null;
        const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        root.setAttribute('width', String(pixelWidth));
        root.setAttribute('height', String(pixelHeight));
        const group = document.createElementNS(root.namespaceURI, 'g');
        group.setAttribute('transform', `matrix(${matrix.a * sx} ${matrix.b * sy} ${matrix.c * sx} ${matrix.d * sy} ${(matrix.e - rect.left) * sx} ${(matrix.f - rect.top) * sy})`);
        for (const child of svg.childNodes) group.appendChild(child.cloneNode(true));
        let coverageRoot:SVGSVGElement|undefined;
        if(layer.dataset.patternTrimKind==='zip'&&group.querySelector('[data-opening-tape]')){
          // Only the textile tapes can be printed. Cut hardware out of the mask,
          // including a slider or pull that overlaps the fabric.
          coverageRoot=root.cloneNode(false) as SVGSVGElement;coverageRoot.appendChild(group.cloneNode(true));
          const hardware=group.cloneNode(true) as SVGGElement;
          hardware.removeAttribute('transform');
          const hardwareSelector='[data-zip-teeth],[data-zip-slider],[data-zip-pull],[data-zip-stops],[data-zip-joined]';
          for(const shape of hardware.querySelectorAll<SVGElement>('path,rect,circle,ellipse,polygon,polyline,line,text,image,use')){
            if(shape.closest('defs'))continue;
            if(!shape.closest(hardwareSelector)){shape.remove();continue}
            shape.setAttribute('fill','#000');shape.setAttribute('stroke','#000');shape.style.fill='#000';shape.style.stroke='#000';
          }
          const mask=document.createElementNS(root.namespaceURI,'mask'),maskId='trim-tape-'+layer.dataset.patternTrimId;
          mask.setAttribute('id',maskId);mask.setAttribute('maskUnits','userSpaceOnUse');mask.setAttribute('x','-4096');mask.setAttribute('y','-4096');mask.setAttribute('width','8192');mask.setAttribute('height','8192');mask.setAttribute('style','mask-type:luminance');
          const backdrop=document.createElementNS(root.namespaceURI,'rect');for(const [key,value] of Object.entries({x:'-4096',y:'-4096',width:'8192',height:'8192',fill:'white'}))backdrop.setAttribute(key,value);mask.append(backdrop,hardware);
          for(const shape of group.querySelectorAll<SVGElement>('path,rect,circle,ellipse,polygon,polyline,line,text,image,use')){
            if(shape.closest('defs'))continue;
            if(!shape.hasAttribute('data-opening-tape')){shape.remove();continue}
            shape.setAttribute('stroke','none');shape.style.stroke='none';
          }
          const tape=document.createElementNS(root.namespaceURI,'g');tape.setAttribute('mask','url(#'+maskId+')');while(group.firstChild)tape.appendChild(group.firstChild);
          const defs=document.createElementNS(root.namespaceURI,'defs');defs.appendChild(mask);group.append(defs,tape);
        }
        // Part targeting uses the closed fabric geometry, not the alpha of a
        // fabric scan/texture tile. Preserve construction masks and their images.
        for(const pattern of group.querySelectorAll('pattern'))pattern.remove();
        for(const shape of group.querySelectorAll<SVGElement>('path,rect,circle,ellipse,polygon,polyline')){
          if(!shape.closest('defs,mask,clipPath')&&shape.getAttribute('fill')!=='none'){shape.setAttribute('fill','#fff');shape.style.fill='#fff'}
        }
        let clip = 'none';
        for (let parent = svg.parentElement; parent && parent !== layer; parent = parent.parentElement) {
          const value = getComputedStyle(parent).clipPath;
          if (value && value !== 'none') { clip = value; break; }
        }
        if (clip && clip !== 'none') {
          const box = svg.viewBox.baseVal;
          const inset = clip.match(/^inset\(([^)]+)\)$/)?.[1].trim().split(/\s+/);
          const left = Number.parseFloat(inset?.[1] ?? '0') === 50;
          const defs = document.createElementNS(root.namespaceURI, 'defs');
          const clipPath = document.createElementNS(root.namespaceURI, 'clipPath');
          clipPath.id = 'pattern-side-clip';
          const clipRect = document.createElementNS(root.namespaceURI, 'rect');
          clipRect.setAttribute('x', String(box.x + (left ? 0 : box.width / 2)));
          clipRect.setAttribute('y', String(box.y));
          clipRect.setAttribute('width', String(box.width / 2));
          clipRect.setAttribute('height', String(box.height));
          clipPath.appendChild(clipRect); defs.appendChild(clipPath); group.prepend(defs);
          const content = document.createElementNS(root.namespaceURI, 'g');
          content.setAttribute('clip-path', 'url(#pattern-side-clip)');
          while (group.childNodes.length > 1) content.appendChild(group.childNodes[1]);
          group.appendChild(content);
        }
        root.appendChild(group);
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' }));
        try {
          const image = new Image(); image.src = url; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = pixelWidth; canvas.height = pixelHeight;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) return null;
          context.drawImage(image, 0, 0);
          let coverage:HTMLCanvasElement|undefined;
          if(coverageRoot){
            const coverageUrl=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(coverageRoot)],{type:'image/svg+xml'}));
            try{const full=new Image();full.src=coverageUrl;await full.decode();coverage=document.createElement('canvas');coverage.width=pixelWidth;coverage.height=pixelHeight;coverage.getContext('2d')?.drawImage(full,0,0)}finally{URL.revokeObjectURL(coverageUrl)}
          }
          return { id: layer.dataset.patternTrimId?'trim:'+layer.dataset.patternTrimId:layer.dataset.layerId!, label: layer.dataset.patternTrimName ?? names[layer.dataset.layerId!] ?? layer.dataset.asset ?? layer.dataset.layerId!, canvas, coverage };
        } finally { URL.revokeObjectURL(url); }
      }));
      if (version !== generation) return;
      const occlusion = document.createElement('canvas'); occlusion.width = pixelWidth; occlusion.height = pixelHeight;
      const cover = occlusion.getContext('2d')!;
      const next: GarmentPatternTarget[] = [];
      for (const layer of rasters.reverse()) {
        if (!layer) continue;
        const canvas = document.createElement('canvas'); canvas.width = pixelWidth; canvas.height = pixelHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(layer.canvas, 0, 0);
        context.globalCompositeOperation = 'destination-out'; context.drawImage(occlusion, 0, 0);
        cover.drawImage(layer.coverage??layer.canvas, 0, 0);
        const alpha = context.getImageData(0, 0, pixelWidth, pixelHeight).data;
        let minX = pixelWidth, minY = pixelHeight, maxX = -1, maxY = -1;
        for (let y = 0; y < pixelHeight; y++) for (let x = 0; x < pixelWidth; x++) {
          if (alpha[(y * pixelWidth + x) * 4 + 3] > 32) {
            minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
        }
        if (maxX < minX) continue;
        next.push({ ...layer, canvas, alpha, url: canvas.toDataURL('image/png'), width, height, axis: width / 2,
          bounds: { x: (minX + maxX + 1) / 2 / pixelWidth * width, y: (minY + maxY + 1) / 2 / pixelHeight * height,
            width: (maxX - minX + 1) / pixelWidth * width, height: (maxY - minY + 1) / pixelHeight * height } });
      }
      if (version === generation) setTargets(next);
    };
    const schedule = () => {
      const version = ++generation;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { void rebuild(version).catch(() => { if (version === generation) setTargets([]); }); });
    };
    const observer = new MutationObserver(records=>{
      records=records.filter(record=>record.target===zone||!(record.target instanceof Element)||!record.target.closest('[data-artwork-camera-layer]'));
      if(!records.length)return;
      // Geometry stays in garment coordinates during zoom. Refresh its raster once
      // the camera settles instead of encoding a new full-size mask every frame.
      if(records.every(record=>record.target===zone)){window.clearTimeout(cameraTimer);cameraTimer=window.setTimeout(schedule,120);}
      else schedule();
    });
    observer.observe(preview, { subtree: true, childList: true, attributes: true });
    // The read-only camera transforms the artwork zone as well as the garment.
    observer.observe(zone, {attributes:true,attributeFilter:['style']});
    const resize = new ResizeObserver(schedule); resize.observe(zone); resize.observe(preview);
    schedule();
    return () => { window.clearTimeout(cameraTimer); generation++; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect(); };
  }, [zone, side,qualityScale,disabled]);
  return targets;
}
