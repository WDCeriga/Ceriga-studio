import type { ImportedGarment, ImportedGarmentView } from './importedGarment';
import { constructionRegionsForView } from './importedConstructionRegions';
import { createGarmentDetail, type GarmentDetail } from './garmentDetails';

export interface ImportedZipClosure {
  id: string;
  label: string;
  view: ImportedGarmentView;
  semanticType: 'zip';
  maskPath: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  width: number;
  status: 'needs-review' | 'reviewed';
}

export function importedZipClosures(garment: ImportedGarment, view: ImportedGarmentView): ImportedZipClosure[] {
  return (constructionRegionsForView(garment, view)?.closures ?? []).filter((value): value is ImportedZipClosure => {
    const item = value as Partial<ImportedZipClosure> | null;
    return Boolean(item && item.semanticType === 'zip' && item.view === view && item.id && item.label && item.maskPath
      && /[Mm]/.test(item.maskPath) && !/[^\d\s.,+eEMmLlHhVvCcSsQqTtAaZz-]/.test(item.maskPath)
      && [item.start?.x, item.start?.y, item.end?.x, item.end?.y, item.width].every(n => typeof n === 'number' && Number.isFinite(n))
      && [item.start?.x, item.start?.y, item.end?.x, item.end?.y].every(n => n! >= 0 && n! <= 2048)
      && item.width! > 0 && item.width! <= 200 && ['needs-review', 'reviewed'].includes(item.status ?? ''));
  });
}

export function reviewImportedZip(garment: ImportedGarment, view: ImportedGarmentView, id: string, reviewed: boolean): ImportedGarment {
  const data = constructionRegionsForView(garment, view);
  if (!data || !importedZipClosures(garment, view).some(zip => zip.id === id)) return garment;
  const next = { ...data, closures: data.closures.map(value => {
    const zip = value as ImportedZipClosure;
    return zip.id === id ? { ...zip, status: reviewed ? 'reviewed' : 'needs-review' } : value;
  }) };
  return { ...garment, revision: (garment.revision ?? 0) + 1,
    ...(garment.manifest.view === view ? { constructionRegions: next } : {}),
    manifest: { ...garment.manifest, [view === 'front' ? 'frontView' : 'backView']: {
      ...garment.manifest[view === 'front' ? 'frontView' : 'backView'], constructionRegions: next,
    } } };
}

export function convertImportedZip(zip: ImportedZipClosure, details: GarmentDetail[], color = '#141414'): GarmentDetail[] {
  if (zip.status !== 'reviewed') throw new Error('Review the isolated source zip before converting it.');
  const existing = details.find(detail => detail.importedClosureId === zip.id && (detail.view ?? 'front') === zip.view);
  if (existing) return details.map(detail => ({ ...detail, selected: detail.id === existing.id }));
  const defaults = { start: { ...zip.start }, end: { ...zip.end }, width: zip.width, attachment: 'free' as const, facingColor: '#D4D4D4' };
  const detail: GarmentDetail = { ...createGarmentDetail('zip', details, color, 'zip-01'),
    name: zip.label, view: zip.view, importedClosureId: zip.id, zipSliderPosition: 0,
    zipTeethColor: color, zipPullColor: color, zipSliderColor: color,
    opening: { ...defaults, version: 1, closure: 'zip', defaults: structuredClone(defaults) } };
  return [...details.map(item => ({ ...item, selected: false })), detail];
}

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export function isolatedZipSvg(ink: string, zip: ImportedZipClosure): string {
  const id = `zip-clip-${zip.view}-${zip.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${escape(zip.maskPath)}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#${id})">${ink}</g></svg>`;
}
export function maskImportedZipInk(ink: string, zips: ImportedZipClosure[]): string {
  if (!zips.length) return ink;
  const id = `zip-source-mask-${zips.map(zip => `${zip.view}-${zip.id}`).join('-').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:luminance"><rect width="2048" height="2048" fill="white"/>${zips.map(zip => `<path d="${escape(zip.maskPath)}" fill="black" fill-rule="evenodd"/>`).join('')}</mask></defs><g mask="url(#${id})">${ink}</g></svg>`;
}
