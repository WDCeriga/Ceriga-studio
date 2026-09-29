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
      if (template.category !== 'box' && template.category !== 'none') {
        const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
        const perimeter = document.querySelector('[data-packaging-perimeter]');
        const construction = document.querySelector('[data-packaging-construction]');
        check(perimeter && !perimeter.closest('[mask]'), `${template.id}: perimeter clipped by material mask`);
        check(Number(perimeter.getAttribute('stroke-width')) > Number(construction?.getAttribute('stroke-width')), `${template.id}: seams compete with perimeter`);
        check(perimeter.querySelector('path')?.getAttribute('d') === document.querySelector('mask path')?.getAttribute('d'), `${template.id}: outline differs from material boundary`);
      }
      const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(markup)}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 600;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 640, 600);
      const pixels = context.getImageData(0, 0, 640, 600).data;
      let visible = 0; for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 10) visible++;
      check(visible > 10000, `Blank preview: ${template.id}/${view}`);
      const visibleContents = !!template.transparency || (template.category === 'box' && view === 'open');
      check(markup.includes('data-packaging-contents') === visibleContents, `${template.id}/${view}: incorrect contents visibility`);
      if (visibleContents) {
        check(markup.includes('data-folded-garment="tshirt"') && markup.includes('tucked-sleeves') && markup.includes('folded-edge'), 'Folded garment structure missing');
        check(markup.includes('data-garment-detail="collar"') === (view !== 'back'), 'Collar facing does not match view');
      }
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

export async function verifyBoxConstruction() {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PackagingArtwork, packagingBoxGeometry } = await import('../../src/app/components/builder/PackagingArtwork');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;width:640px;height:600px;visibility:hidden;pointer-events:none';
  document.body.append(host);
  let framedViews = 0;
  try {
    for (const template of PACKAGING_TEMPLATES.filter(item => item.category === 'box' || item.category === 'none')) {
      for (const dimensions of [{ width: 300, height: 380, depth: 80 }, { width: 100, height: 1000, depth: 20 }, { width: 1000, height: 100, depth: 500 }]) {
        const design = { ...createPackagingDesign(template.id), dimensions, exterior: '#d74b64', interior: '#57bbaa' };
        const closed = packagingBoxGeometry(design, 'closed');
        const opened = packagingBoxGeometry(design, 'open');
        if (template.category === 'box') {
          const closedFront = closed.find(face => face.panel === 'front')!;
          const openFront = opened.find(face => face.panel === 'front')!;
          check(closedFront.vertices[1][0] - closedFront.vertices[0][0] === openFront.vertices[1][0] - openFront.vertices[0][0], `${template.id}: tray width changes on opening`);
          if (template.closure !== 'drawer') check(JSON.stringify(closedFront.vertices) === JSON.stringify(openFront.vertices), `${template.id}: base moves on opening`);
          if (template.closure === 'drawer') {
            check(openFront.notch && closedFront.notch, 'Drawer lost its pull notch');
            const base = opened.find(face => face.panel === 'interior-base')!;
            const near = Math.min(...base.vertices.map(vertex => vertex[1]));
            const far = Math.max(...base.vertices.map(vertex => vertex[1]));
            check(-near / (far - near) >= .2 && -near / (far - near) <= .3, 'Drawer extends beyond the requested 20-30%');
            check(opened.findIndex(face => face.panel === 'top') > opened.indexOf(base), 'Sleeve does not cover the inserted drawer');
            check(Math.abs((closedFront.vertices[0][1] - openFront.vertices[0][1]) / dimensions.height - .25) < .01, 'Drawer is not aligned at quarter extension');
            check(closed.length === 4 && !closed.some(face => face.interior), 'Closed drawer has exposed interior or extra bottom geometry');
            check(closed.filter(face => face.outline === false).length === 1 && closedFront.vertices[3][2] === 0, 'Closed drawer has duplicated bottom outlines');
            check(openFront.vertices[0][2] === closedFront.vertices[0][2], 'Drawer wall height changes on opening');
          }
        }
        for (const view of ['closed', 'open', 'reverse'] as const) {
          host.innerHTML = renderToStaticMarkup(createElement(PackagingArtwork, { design, view, fit: true, guides: true }));
          const svg = host.querySelector('svg')!;
          const box = svg.querySelector<SVGGElement>('[data-box-view]')!;
          check(svg.querySelectorAll('[data-packaging-magnet]').length === (template.closure === 'magnet' && view === 'open' ? 2 : 0), `${template.id}/${view}: incorrect visible magnets`);
          const bounds = box.getBBox();
          const matrix = box.transform.baseVal.consolidate()!.matrix;
          const frame = svg.viewBox.baseVal;
          for (const point of [new DOMPoint(bounds.x, bounds.y), new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height)]) {
            const projected = point.matrixTransform(matrix);
            check(projected.x > frame.x && projected.y > frame.y && projected.x < frame.x + frame.width && projected.y < frame.y + frame.height, `${template.id}/${view}: fitted preview clips`);
          }
          if (template.category === 'none') {
            check(!svg.querySelector('[data-packaging-surface]'), 'Bulk carton exposes customization');
            check(!host.innerHTML.includes(design.exterior) && !host.innerHTML.includes(design.interior), 'Bulk carton uses custom colours');
          } else {
            for (const face of svg.querySelectorAll('[data-box-material]')) {
              const fill = face.querySelector('polygon, path')?.getAttribute('fill');
              if (face.getAttribute('data-box-face') !== 'tape') check(fill === (face.getAttribute('data-box-material') === 'interior' ? design.interior : design.exterior), `${template.id}/${view}: inside/outside colour crossed faces`);
            }
            check(svg.querySelectorAll('[data-packaging-guide]').length <= 1, 'Guides shown on unselected faces');
          }
          framedViews++;
        }
      }
    }
  } finally { host.remove(); }
  return { framedViews, consistentTray: true, materialIsolation: true, bulkLocked: true };
}

export async function verifyPackagingContents() {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PackagingArtwork } = await import('../../src/app/components/builder/PackagingArtwork');
  const parse = (markup: string) => new DOMParser().parseFromString(markup, 'image/svg+xml');
  let views = 0;
  for (const template of PACKAGING_TEMPLATES) {
    const design = createPackagingDesign(template.id);
    const view = template.category === 'box' ? 'open' : design.view;
    const hidden = renderToStaticMarkup(createElement(PackagingArtwork, { design, view, contents: false }));
    check(!hidden.includes('data-packaging-contents'), `${template.id}: toggle off shows contents`);
    const markup = renderToStaticMarkup(createElement(PackagingArtwork, { design, view, contents: true, guides: true, garmentColor: '#358b79' }));
    const document = parse(markup);
    const contents = document.querySelector('[data-packaging-contents]');
    if (contents) {
      check(contents.getAttribute('pointer-events') === 'none', 'Contents intercept artwork interaction');
      const garment = contents.querySelector('svg')!;
      check(garment.getAttribute('preserveAspectRatio') === 'xMidYMid meet', 'Folded garment stretches');
      check(garment.querySelector('[data-garment-detail="folded-body"]')?.getAttribute('fill') === '#358b79', 'Garment colour lost');
      const panel = template.category === 'box' ? 'interior-base' : 'front';
      const region = printRegion({ ...design, shippingLabel: false }, panel);
      check(Number(garment.getAttribute('width')) < region.width && Number(garment.getAttribute('height')) < region.height, 'Contents have no safe margin');
      if (template.category === 'box') {
        check(contents.closest('[data-box-face]')?.getAttribute('data-box-face') === 'interior-base', 'Contents not attached to tray');
        check(markup.indexOf('data-packaging-contents') < markup.indexOf('data-box-face="front"'), 'Front wall does not occlude contents');
        if (template.closure === 'drawer') check(markup.indexOf('data-packaging-contents') < markup.indexOf('data-box-face="top"'), 'Drawer sleeve does not occlude contents');
      } else check(markup.indexOf('data-packaging-contents') < markup.indexOf('data-material-opacity'), 'Contents drawn over bag film');
    }
    if (template.transparency) {
      const opaque = renderToStaticMarkup(createElement(PackagingArtwork, { design: { ...design, opacity: 1 }, contents: true }));
      check(!opaque.includes('data-packaging-contents'), 'Fully opaque film exposes contents');
    }
    views++;
  }
  const fallback = renderToStaticMarkup(createElement(PackagingArtwork, { design: createPackagingDesign('clear'), contents: true, garmentType: 'future-product' }));
  check(fallback.includes('data-folded-garment="garment"') && !fallback.includes('data-garment-detail="collar"'), 'Unknown product incorrectly uses T-shirt details');
  return { views, toggle: true, proportions: true, materialOcclusion: true, boxLayering: true, productFallback: true };
}