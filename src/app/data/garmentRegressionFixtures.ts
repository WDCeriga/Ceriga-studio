import { normalizeImportedGarment, type ImportedConstructionDetail, type ImportedGarment, type ImportedGarmentView, type ImportedPart, type ImportedPoint } from './importedGarment';

export type GarmentRegressionType = 'shorts' | 'tee' | 'hoodie' | 'trousers' | 'jeans' | 'jacket' | 'skirt' | 'dress';
const syntheticEvidence = 'Synthetic geometry fixture for UI/domain regression; not reconstructed from a photograph or production validated.';
const svg = (points: ImportedPoint[], fill = '#64748b') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><polygon points="${points.map(([x, y]) => `${x * 2048},${y * 2048}`).join(' ')}" fill="${fill}" stroke="#172033" stroke-width="2"/></svg>`;
const mirror = (points: ImportedPoint[]): ImportedPoint[] => points.map(([x, y]) => [1 - x, y]);

/** Deliberately synthetic, independently transformed front/back geometry for review pages and pure tests. */
export function createGarmentRegressionFixture(type: GarmentRegressionType, bothViews = false): ImportedGarment {
  const parts: ImportedPart[] = [];
  const detailLayers: ImportedConstructionDetail[] = [];
  const material = ['shorts', 'jeans', 'jacket'].includes(type) ? 'denim' : ['tee', 'hoodie'].includes(type) ? 'cotton jersey' : 'woven cotton';
  const views: ImportedGarmentView[] = bothViews ? ['front', 'back'] : ['front'];
  for (const view of views) {
    const transform = (points: ImportedPoint[]): ImportedPoint[] => points.map(([x, y]) => view === 'back' ? [.08 + .8 * x, .05 + .9 * y] : [x, y]);
    const add = (name: string, semanticType: ImportedPart['semanticType'], structuralRole: string, outline: ImportedPoint[], partner?: string, attachment?: string) => {
      const points = transform(outline), xs = points.map(point => point[0]), ys = points.map(point => point[1]);
      const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const id = `${view}:${name}`;
      const part: ImportedPart = { id, name: name.replace(/-/g, ' '), semanticType, structuralRole, measurementRole: `${structuralRole}-outline`,
        material, evidence: syntheticEvidence, colorable: true, structural: true, layerKind: 'structural', bounds, geometryBounds: bounds,
        seed: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2], attachmentTo: attachment ? `${view}:${attachment}` : null,
        symmetryPartner: partner ? `${view}:${partner}` : null, outline: points,
        boundary: { boundaryType: 'panel-edge', confidence: .95, evidence: syntheticEvidence },
        svg: svg(points), constructionSvg: '', stitchSvg: '', area: (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]),
        color: material === 'denim' ? '#617c98' : '#86a9a2', parentGarment: `synthetic-${type}`, layerOrder: parts.length,
        view, measurement: { unit: 'relative', width: bounds[2] - bounds[0], height: bounds[3] - bounds[1] },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }, editableIndependently: false,
      };
      parts.push(part);
      return part;
    };
    const detail = (part: ImportedPart, boundaryType: 'hem-edge' | 'pocket-edge', points: ImportedPoint[]) => {
      const id = `${part.id}:${boundaryType}`, transformed = transform(points);
      detailLayers.push({ id, partId: part.id, name: boundaryType === 'hem-edge' ? 'Finished hem' : 'Pocket opening',
        builderCategory: boundaryType === 'hem-edge' ? 'hem-cuffs' : 'pockets-zips',
        userFacingName: boundaryType === 'hem-edge' ? 'Hem finish' : 'Pockets', view,
        constructionSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><polyline points="${transformed.map(([x, y]) => `${x * 2048},${y * 2048}`).join(' ')}" fill="none" stroke="#172033" stroke-width="2"/></svg>`,
        stitchSvg: '', visibleEdges: [{ id: `${id}:edge`, boundaryType, confidence: .95, evidence: syntheticEvidence, style: 'solid', points: transformed }],
      });
    };
    if (['shorts', 'trousers', 'jeans'].includes(type)) {
      const hemY = type === 'shorts' ? .72 : .94;
      const left: ImportedPoint[] = [[.25, .2], [.5, .2], [.5, .43], [.45, hemY], [.15, hemY - .03]];
      const leftPart = add('left-leg', 'panel', 'leg', left, 'right-leg');
      add('right-leg', 'panel', 'leg', mirror(left), 'left-leg');
      add('waistband', 'waistband', 'waistband', [[.25, .1], [.75, .1], [.75, .2], [.25, .2]]);
      detail(leftPart, 'hem-edge', [[.15, hemY - .03], [.45, hemY]]);
      detail(leftPart, 'pocket-edge', [[.28, .23], [.26, .31], [.2, .36]]);
    } else if (type === 'skirt') {
      const body = add('skirt', 'skirt', 'skirt', [[.35, .2], [.65, .2], [.83, .85], [.17, .85]]);
      add('waistband', 'waistband', 'waistband', [[.35, .14], [.65, .14], [.65, .2], [.35, .2]]);
      detail(body, 'hem-edge', [[.17, .85], [.83, .85]]);
    } else {
      const dress = type === 'dress', longSleeve = ['hoodie', 'jacket'].includes(type);
      const body = add('body', 'body', 'body', [[.35, .2], [.44, .17], [.46, .22], [.54, .22], [.56, .17], [.65, .2], [.68, .4],
        ...(dress ? [[.6, .48], [.79, .93], [.21, .93], [.4, .48]] as ImportedPoint[] : [[.65, .8], [.35, .8]] as ImportedPoint[]), [.32, .4]]);
      const sleeve: ImportedPoint[] = longSleeve ? [[.35, .2], [.32, .4], [.23, .72], [.14, .68], [.22, .22]] : [[.35, .2], [.32, .4], [.16, .35], [.22, .18]];
      const left = add('left-sleeve', 'sleeve', 'sleeve', sleeve, 'right-sleeve', 'body');
      add('right-sleeve', 'sleeve', 'sleeve', mirror(sleeve), 'left-sleeve', 'body');
      detail(left, 'hem-edge', longSleeve ? [[.14, .68], [.23, .72]] : [[.16, .35], [.22, .18]]);
      detail(body, 'hem-edge', dress ? [[.21, .93], [.79, .93]] : [[.35, .8], [.65, .8]]);
      add('neckband', 'neckband', 'neckband', [[.44, .17], [.46, .22], [.54, .22], [.56, .17], [.56, .19], [.54, .24], [.46, .24], [.44, .19]]);
      if (type === 'hoodie') add('hood', 'hood', 'hood', [[.4, .23], [.38, .13], [.43, .035], [.57, .035], [.62, .13], [.6, .23]]);
      if (longSleeve) detail(body, 'pocket-edge', [[.4, .52], [.38, .64], [.45, .65]]);
    }
  }
  const manifest: ImportedGarment['manifest'] = { garmentType: type, material, subtype: `Synthetic ${type}`, fit: 'Synthetic regular fit',
    construction: syntheticEvidence, materialEvidence: 'Fixture metadata only; not inferred from an image.', confidence: .95,
    view: 'front', uncertainties: [syntheticEvidence], regions: parts,
    frontView: { view: 'front', partIds: [], detailLayerIds: [], sourceImageHash: `synthetic-${type}-front` },
    ...(bothViews ? { backView: { view: 'back' as const, partIds: [], detailLayerIds: [], sourceImageHash: `synthetic-${type}-back` } } : {}),
  };
  return normalizeImportedGarment({ source: 'azure-garment-reconstruction-v1', parts, detailLayers, lineArtSvg: '', stitchSvg: '', partCount: parts.length,
    manifest, sourceManifest: manifest, sourceImage: '', cleanDrawing: '', reviewNotes: [syntheticEvidence],
    provenance: { sourceImageHash: `synthetic-${type}`, analysisId: 'synthetic-not-azure', drawingId: 'synthetic-polygons', segmentationId: 'synthetic-parts', garmentVersion: `synthetic-${type}-${bothViews ? 'both' : 'front'}` },
    accepted: false, reviewed: false, constructionVersion: 2, fixtureProvenance: { synthetic: true, description: syntheticEvidence },
  });
}

/** Parent review-page contract; tshirt is the public alias for the tee fixture. */
export function garmentRegressionFixture(type: 'shorts' | 'tshirt' | 'hoodie', withBack: boolean): ImportedGarment {
  const garment = createGarmentRegressionFixture(type === 'tshirt' ? 'tee' : type, withBack);
  if (type !== 'tshirt') return garment;
  return normalizeImportedGarment({ ...garment, manifest: { ...garment.manifest, garmentType: 'tshirt' },
    sourceManifest: { ...garment.sourceManifest, garmentType: 'tshirt' } });
}

export const garmentRegressionFixtures = (['shorts', 'tee', 'hoodie'] as const).flatMap(type => [false, true].map(bothViews => ({
  id: `${type}-${bothViews ? 'both' : 'front'}`,
  label: `Synthetic ${type} — ${bothViews ? 'front and back' : 'front only'}`,
  synthetic: true as const,
  garment: createGarmentRegressionFixture(type, bothViews),
})));
