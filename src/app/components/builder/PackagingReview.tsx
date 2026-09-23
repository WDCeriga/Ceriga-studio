import { Fragment, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Download } from 'lucide-react';
import { PackagingArtwork, PackagingSurface } from './PackagingArtwork';
import { packagingSummary, packagingTemplate, packagingWarnings, panelSize, PANEL_NAMES, type PackagingDesign, type PackagingPanel } from '../../data/packaging';
import './packaging.css';

function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function packagingPanelSvg(design: PackagingDesign, panel: PackagingPanel) {
  const size = panelSize(design, panel);
  return renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={`${size.width}mm`} height={`${size.height}mm`} viewBox={`0 0 ${size.width} ${size.height}`}><PackagingSurface design={design} panel={panel} /></svg>);
}
export function packagingSpecification(design: PackagingDesign) {
  if (design.category === 'none') return { schemaVersion: 1, packaging: 'Standard unbranded bulk shipping carton.' };
  return { schemaVersion: 1, status: 'Concept only; manufacturer confirmation required', units: 'mm', category: design.category, variation: packagingTemplate(design.templateId).name, material: design.material, exterior: design.exterior, ...(design.category === 'box' ? { interior: design.interior } : {}), ...(packagingTemplate(design.templateId).transparency ? { visualOpacity: design.opacity } : {}), ...(design.dimensionsConfirmed ? { requestedDimensions: design.dimensions } : { dimensionStatus: 'Not selected' }), ...(design.category === 'mailer' ? { shippingLabelReserved: design.shippingLabel } : {}), elements: design.elements, manufacturingRequest: design.notes, advisories: packagingWarnings(design) };
}
export async function createPackagingPdf(design: PackagingDesign) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let cursor = 20;
  pdf.setFontSize(17); pdf.text('Packaging / Design Intent', 15, cursor); cursor += 12;
  pdf.setFontSize(9);
  for (const [label, value] of packagingSummary(design)) {
    const lines: string[] = pdf.splitTextToSize(`${label}: ${value}`, 177);
    for (const line of lines) {
      if (cursor > 276) { pdf.addPage(); cursor = 18; }
      pdf.text(line, 15, cursor); cursor += 4.5;
    }
    cursor += 3;
  }
  const raster = async (markup: string) => {
    const image = new Image(); image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 1200;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Could not create artwork image.');
    context.drawImage(image, 0, 0, 1280, 1200); return canvas.toDataURL('image/png');
  };
  const views = design.category === 'none' ? ['closed'] as const : design.category === 'box' ? ['closed', 'open'] as const : ['front', 'back'] as const;
  for (const view of views) {
    pdf.addPage(); pdf.setFontSize(13); pdf.text(`${packagingTemplate(design.templateId).name} / ${view}`, 15, 20);
    pdf.addImage(await raster(renderToStaticMarkup(<PackagingArtwork design={design} view={view} />)), 'PNG', 15, 35, 180, 169);
    pdf.setFontSize(9); pdf.text('Concept preview. Not a production dieline.', 15, 225);
  }
  for (const panel of [...new Set(design.category === 'none' ? [] : design.elements.map(element => element.panel))]) {
    pdf.addPage(); pdf.setFontSize(13); pdf.text(PANEL_NAMES[panel], 15, 20);
    pdf.addImage(await raster(renderToStaticMarkup(<PackagingArtwork design={{ ...design, selectedPanel: panel }} view="panel" />)), 'PNG', 15, 35, 180, 169);
    pdf.setFontSize(9); pdf.text('Artwork positioning reference. Separate panel SVG contains artwork only.', 15, 225);
  }
  return pdf;
}
export function PackagingReview({ design }: { design?: PackagingDesign }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (!design) return <p className="pkg-advisory">Packaging: not selected.</p>;
  return <section className="pkg-review" data-packaging-review>
    <h3 className="text-sm font-semibold mb-3">Packaging</h3>
    <dl>{packagingSummary(design).map(([label, value], index) => <Fragment key={`${label}-${index}`}><dt>{label}</dt><dd>{value}</dd></Fragment>)}</dl>
    <div className="pkg-review-preview"><PackagingArtwork design={design} view={design.category === 'box' || design.category === 'none' ? 'closed' : 'front'} /></div>
    {design.category !== 'none' && [...new Set(design.elements.map(element => element.panel))].map(panel => <div key={panel}><p className="text-xs">{PANEL_NAMES[panel]}</p><div className="pkg-review-preview"><PackagingArtwork design={{ ...design, selectedPanel: panel }} view="panel" /></div><button type="button" className="text-xs underline" onClick={() => downloadFile(packagingPanelSvg(design, panel), `ceriga-${design.templateId}-${panel}-artwork.svg`, 'image/svg+xml')}>Download {PANEL_NAMES[panel]} artwork SVG</button></div>)}
    <div className="pkg-actions mt-3">
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const pdf = await createPackagingPdf(design); pdf.save('ceriga-packaging-design.pdf'); } catch { setError('Packaging PDF failed. Try the SVG and JSON downloads.'); } finally { setBusy(false); } }}><Download size={14} />{busy ? 'Preparing PDF' : 'Packaging PDF'}</button>
      <button type="button" onClick={() => downloadFile(JSON.stringify(packagingSpecification(design), null, 2), 'ceriga-packaging-specification.json', 'application/json')}><Download size={14} />Specifications</button>
      <button type="button" onClick={() => downloadFile(renderToStaticMarkup(<PackagingArtwork design={design} view={design.category === 'box' || design.category === 'none' ? 'closed' : 'front'} />), 'ceriga-packaging-preview.svg', 'image/svg+xml')}><Download size={14} />Preview SVG</button>
    </div>
    {error && <p role="alert" className="pkg-error">{error}</p>}
  </section>;
}