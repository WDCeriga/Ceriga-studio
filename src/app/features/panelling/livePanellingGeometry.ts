import type { ResolvedGarmentLayer } from '../../data/garmentSvgCatalog';

interface LiveLayer { id: string; source: ResolvedGarmentLayer; side?: 'left'|'right'; matrix: string }
/** Geometry only: appearance is always rendered by TshirtSvgPreview itself. */
export function livePanellingMarkup(layers: LiveLayer[]): string {
  const serialize = (raw: string) => {
    const svg = new DOMParser().parseFromString(raw,'image/svg+xml').documentElement;
    svg.setAttribute('width','2048'); svg.setAttribute('height','2048');
    // Existing long-sleeve alpha masks embed vector SVGs as data images. Expand
    // those vectors only in this invisible geometry document so the sampler can
    // honour the exact same keep mask without rasterising or redrawing it.
    for (const image of [...svg.querySelectorAll('mask image')]) {
      const href=image.getAttribute('href') ?? image.getAttributeNS('http://www.w3.org/1999/xlink','href') ?? '';
      if (!href.startsWith('data:image/svg+xml;base64,')) continue;
      const raw=atob(href.slice(href.indexOf(',')+1));
      const embedded=new DOMParser().parseFromString(raw,'image/svg+xml').documentElement;
      for(const name of ['x','y','width','height','transform']) if(image.hasAttribute(name)) embedded.setAttribute(name,image.getAttribute(name)!);
      image.replaceWith(svg.ownerDocument.importNode(embedded,true));
    }
    return new XMLSerializer().serializeToString(svg);
  };
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">'+[...layers].sort((a,b)=>a.source.zIndex-b.source.zIndex).map(({id,source,side,matrix})=>{
    if (id==='stitching') return '';
    const ink=id==='outline'||source.kind==='detail';
    const raw=ink?source.svgRaw:(source.panellingClipSvgRaw??source.svgRaw);
    return '<g data-panelling-parent="'+id+'" data-technical-ink="'+ink+'"'+(!ink?' data-fabric-only="true"':'')+(side?' data-panelling-side="'+side+'"':'')+' transform="'+matrix+'">'+serialize(raw)+'</g>';
  }).join('')+'</svg>';
}
