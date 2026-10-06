import { importedGarmentLayers, type ImportedGarment, type ImportedGarmentView } from './importedGarment';
import { tintPotraceSvg } from '../lib/tshirtSvgUtils';

export type ImportedDrawingStyle = 'technical' | 'outline' | 'construction';

export function importedGarmentSvg(garment: ImportedGarment, view: ImportedGarmentView, style: ImportedDrawingStyle, colors?: Partial<Record<string, string>>) {
  const layers = importedGarmentLayers(garment, view, colors).sort((a, b) => a.zIndex - b.zIndex);
  const monochrome = style === 'outline';
  const withoutTexture = (svg: string) => svg.replace(/<g\b[^>]*data-texture="rib"[^>]*>[\s\S]*?<\/g>/g, '');
  const content = layers.map(layer => {
    const fill = monochrome && layer.kind === 'solid' ? '#ffffff' : layer.tint ?? '#141414';
    const svg = tintPotraceSvg(monochrome ? withoutTexture(layer.svgRaw) : layer.svgRaw, fill);
    const panels = monochrome ? '' : (layer.colourPanels ?? []).map(panel => tintPotraceSvg(panel.svgRaw, panel.tint)).join('');
    const thread = layer.stitchColor ?? '#b09c72';
    const threadWidth = Math.max(0, (layer.stitchWeight ?? 1) - 1) * 20;
    const stitches = !monochrome && layer.stitchSvg ? tintPotraceSvg(layer.stitchSvg, thread).replace(/<path\b([^>]*)>/g, (_, attributes: string) => {
      const clean = attributes.replace(/\s+stroke(?:-width|-linejoin)?=(["']).*?\1/g, '');
      return `<path stroke="${thread}" stroke-width="${threadWidth}" stroke-linejoin="round"${clean}>`;
    }) : '';
    return `<g>${svg}${panels}${layer.constructionSvg ?? ''}${stitches}</g>`;
  }).join('');
  const boundaries = style === 'construction' ? garment.parts.filter(part => part.view === view && part.outline).map(part => {
    const path = part.outline!.map(([x, y], index) => `${index ? 'L' : 'M'}${(x*2048).toFixed(2)},${(y*2048).toFixed(2)}`).join('') + 'Z';
    return `<path d="${path}"/>`;
  }).join('') : '';
  const estimated = view === 'back' && garment.manifest.backView?.inference;
  const title = estimated ? 'Estimated back — inferred from front geometry' : `${view} ${style} garment drawing`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><title>${title}</title><desc>Source-proportioned construction; not a measured production pattern.${estimated ? ' Hidden construction remains uncertain.' : ''}</desc>${content}<g fill="none" stroke="#177b70" stroke-width="3">${boundaries}</g></svg>`;
}
