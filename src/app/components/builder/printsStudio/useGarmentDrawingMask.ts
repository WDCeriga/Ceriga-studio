import { useEffect, useState } from 'react';

export interface GarmentDrawingMask {
  canvas: HTMLCanvasElement;
  url: string;
  width: number;
  height: number;
  axis: number;
}

export function useGarmentDrawingMask(zone: HTMLDivElement | null, side: 'front' | 'back', artboard = false) {
  const [mask, setMask] = useState<GarmentDrawingMask | null>(null);
  useEffect(() => {
    setMask(null);
    if (zone && artboard) {
      const rebuild = () => {
        const width = zone.clientWidth, height = zone.clientHeight;
        if (!width || !height) return;
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, width, height);
        setMask({ canvas, url: canvas.toDataURL('image/png'), width, height, axis: width / 2 });
      };
      rebuild();
      const resize = new ResizeObserver(rebuild);
      resize.observe(zone);
      return () => resize.disconnect();
    }
    const preview = zone?.parentElement?.querySelector<HTMLElement>('[data-print-garment-preview]');
    if (!zone || !preview) return;
    let generation = 0;
    let frame = 0;
    const rebuild = async () => {
      const current = ++generation;
      const bounds = zone.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const canvas = document.createElement('canvas');
      const resolution = Math.min(2, window.devicePixelRatio || 1);
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
        const matrix = svg.getScreenCTM();
        if (!matrix || !svg.getBoundingClientRect().width) continue;
        const group = document.createElementNS(root.namespaceURI, 'g');
        group.setAttribute('transform', `matrix(${matrix.a * scaleX} ${matrix.b * scaleY} ${matrix.c * scaleX} ${matrix.d * scaleY} ${(matrix.e - bounds.left) * scaleX} ${(matrix.f - bounds.top) * scaleY})`);
        for (const child of svg.childNodes) group.appendChild(child.cloneNode(true));
        root.appendChild(group);
      }
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
      } catch {
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
  }, [zone, side, artboard]);
  return mask;
}

export function drawingMaskCss(mask: GarmentDrawingMask, width: number, height: number, x: number, y: number, rotation: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image href="${mask.url}" width="${mask.width}" height="${mask.height}" transform="translate(${width / 2} ${height / 2}) rotate(${-rotation}) translate(${-x} ${-y})"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}