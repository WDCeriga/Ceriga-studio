/** Print sharpness at the size placed on the garment. Crop does not change it: the image keeps its pixels per cm. */
export type PrintGrade = 'sharp' | 'good' | 'soft' | 'low';
export const TARGET_PPI = 150;

export function printQuality(naturalWidth: number, naturalHeight: number, width: number, height: number, unitsPerCm: number) {
  const widthCm = width / unitsPerCm, heightCm = height / unitsPerCm;
  const exact = Math.min(naturalWidth / (widthCm / 2.54), naturalHeight / (heightCm / 2.54)), ppi = Math.round(exact);
  const grade: PrintGrade = ppi >= 250 ? 'sharp' : ppi >= TARGET_PPI ? 'good' : ppi >= 100 ? 'soft' : 'low';
  return { ppi, grade, widthCm, heightCm, fitScale: ppi < TARGET_PPI ? exact / TARGET_PPI : 1 };
}

export const isVectorImage = (source: string) => /^data:image\/svg\+xml/i.test(source) || /\.svg(?:[?#]|$)/i.test(source);
