import { PACKAGING_TEMPLATES, createPackagingDesign, createPackagingState, switchPackaging, printRegion, constrainPackagingElement, rotatedExtents, packagingDimensionError, packagingSummary, type PackagingElement } from '../../src/app/data/packaging.ts';

function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export function verifyPackagingGeometry() {
  let placements = 0;
  for (const template of PACKAGING_TEMPLATES) {
    const design = createPackagingDesign(template.id);
    for (const panel of template.panels) {
      const region = printRegion(design, panel);
      for (const rotation of [0, 25, 45, 90, 180, 270, 359]) {
        for (const offset of [-999, 999]) {
          const element: PackagingElement = { id: 'test', kind: 'logo', panel, content: '', name: 'Test', x: offset, y: offset, width: 900, height: 130, rotation, fontSize: 12, font: 'Arial', color: '#000000', align: 'center' };
          const result = constrainPackagingElement(element, region);
          const bounds = rotatedExtents(result);
          check(result.x - bounds.width / 2 >= region.x - 0.00001 && result.y - bounds.height / 2 >= region.y - 0.00001 && result.x + bounds.width / 2 <= region.x + region.width + 0.00001 && result.y + bounds.height / 2 <= region.y + region.height + 0.00001, `${template.id}/${panel}: escaped safe area`);
          check(Math.abs(result.width / result.height - element.width / element.height) < 0.00001, 'Aspect ratio changed');
          placements++;
        }
      }
    }
  }
  const mailer = createPackagingDesign('kraft-mailer');
  check(printRegion(mailer, 'front').width < printRegion({ ...mailer, shippingLabel: false }, 'front').width, 'Label reservation ignored');
  check(printRegion(createPackagingDesign('handle'), 'front').y >= 65, 'Handle area not excluded');
  let state = createPackagingState('zip');
  state.designs.zip.notes = 'Retain my design';
  state = switchPackaging(switchPackaging(state, 'bulk'), 'zip');
  check(state.designs.zip.notes === 'Retain my design', 'Switch destroyed design');
  check(!!packagingDimensionError({ width: -1, height: 200, depth: 80 }, 'box'), 'Negative dimensions accepted');
  check(!!packagingDimensionError({ width: NaN, height: 200, depth: 80 }, 'box'), 'Invalid dimensions accepted');
  check(packagingSummary(createPackagingDesign('bulk')).length === 1, 'Bulk leaked customization');
  check(packagingSummary(createPackagingDesign('zip')).find(row => row[0] === 'Dimensions')?.[1].startsWith('Not selected'), 'Unconfirmed dimensions exported');
  return { templates: PACKAGING_TEMPLATES.length, placements, preservedDesigns: true };
}
console.log(verifyPackagingGeometry());

export async function verifyPackagingUploads() {
  const { readPackagingUpload } = await import('../../src/app/components/builder/PackagingDesigner');
  const source = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" fill="#126b61"/></svg>';
  const uploaded = await readPackagingUpload(new File([source], 'logo.svg', { type: 'image/svg+xml' }));
  check(uploaded.width / uploaded.height === 3 && uploaded.vector, 'Vector proportions changed');
  check(await (await fetch(uploaded.content)).text() === source, 'Original logo changed');
  const rejected = [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/image.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://example.com/image.svg)"/></svg>',
    '<svg broken',
  ];
  for (const invalid of rejected) {
    let failed = false;
    try { await readPackagingUpload(new File([invalid], 'invalid.svg', { type: 'image/svg+xml' })); } catch { failed = true; }
    check(failed, 'Unsafe or invalid SVG accepted');
  }
  return { originalPreserved: true, aspectRatio: 3, rejected: rejected.length };
}

export async function verifyPackagingRendering() {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PackagingArtwork } = await import('../../src/app/components/builder/PackagingArtwork');
  const { packagingPanelSvg, packagingSpecification, createPackagingPdf } = await import('../../src/app/components/builder/PackagingReview');
  let previews = 0;
  for (const template of PACKAGING_TEMPLATES) {
    const design = createPackagingDesign(template.id);
    const views = template.category === 'box' ? ['closed', 'open', 'reverse', 'panel'] as const : template.category === 'none' ? ['closed'] as const : ['front', 'back'] as const;
    for (const view of views) {
      const markup = renderToStaticMarkup(createElement(PackagingArtwork, { design, view, contents: true }));
      check(!markup.includes('data-packaging-guide') && !markup.includes('data-packaging-handle'), 'Guides leaked into export');
      check(!new DOMParser().parseFromString(markup, 'image/svg+xml').querySelector('parsererror'), `Invalid SVG: ${template.id}/${view}`);
      const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(markup)}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 600;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 640, 600);
      const pixels = context.getImageData(0, 0, 640, 600).data;
      let visible = 0; for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 10) visible++;
      check(visible > 10000, `Blank preview: ${template.id}/${view}`);
      if (!template.transparency) check(!markup.includes('data-packaging-contents'), 'Opaque package shows contents');
      previews++;
    }
  }
  const design = createPackagingDesign('folding');
  design.elements = ['top', 'front', 'interior-lid'].map((panel, index) => ({ id: `panel-${index}`, kind: 'text', panel, content: `Surface ${index}`, name: 'Brand', x: 150, y: 40, width: 100, height: 20, rotation: 0, color: '#000000', font: 'Arial', fontSize: 10, align: 'center' } as PackagingElement));
  const closed = renderToStaticMarkup(createElement(PackagingArtwork, { design, view: 'closed' }));
  const opened = renderToStaticMarkup(createElement(PackagingArtwork, { design, view: 'open' }));
  check(closed.includes('Surface 0') && !closed.includes('Surface 2') && opened.includes('Surface 2') && !opened.includes('Surface 0'), 'Inside/outside artwork changed panel');
  check(closed.includes('Surface 1') && opened.includes('Surface 1'), 'Front artwork lost on open');
  check(!packagingPanelSvg(design, 'top').includes('data-packaging-guide'), 'Panel export contains guides');
  check(!JSON.stringify(packagingSpecification(design)).includes('requestedDimensions'), 'Unselected size leaked into export');
  const pdf = await createPackagingPdf(design);
  check(pdf.getNumberOfPages() >= 6 && pdf.output('arraybuffer').byteLength > 5000, 'PDF did not include packaging panels');
  return { previews, guidesAbsent: true, opacity: true, panelAttachment: true, pdfPages: pdf.getNumberOfPages() };
}