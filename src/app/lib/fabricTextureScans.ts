import manifest from '../../assets/fabrics/sources.json';
import { FABRIC_LIBRARY, resolvePartMaterial, type FabricAssignments, type FabricPart, type FabricTextureType, type GarmentFabric } from '../data/garmentFabrics';

export type FabricSourceType = 'scan-cc0' | 'scan-ccby' | 'ceriga-owned' | 'procedural';
export type FabricSourceStatus = 'verified' | 'review-required' | 'unresolved';

export interface FabricSourceRecord {
  fabricPresetId: string;
  sourceType: FabricSourceType;
  sourceStatus: FabricSourceStatus;
  /** Retained for existing review consumers; validated against sourceStatus. */
  status: FabricSourceStatus;
  reason: string;
  source?: {
    assetId: string; provider: string; page: string; evidenceUrl: string; constructionEvidence: string;
    license: string; licenseUrl: string; licensePage: string; download: string;
    originalFilename: string; originalFile: string; normalizedFile: string;
    sourceSha256: string; normalizedSha256: string;
    attribution?: { creator: string; assetName: string; sourceUrl: string; license: string; text: string };
    ownership?: { owner: string; redistributionPermission: string };
  };
  procedural?: { generator: string; version: number; recipe: string; seed: number };
  reverse?: {
    normalizedFile: string; normalizedSha256: string; description: string;
    sourceType?: FabricSourceType;
    sourceStatus?: FabricSourceStatus;
    license?: string;
    procedural?: { generator: string; version: number; recipe: string; seed: number };
  };
}
interface MaterialRule {
  family: string;
  /** Whole swatch repeat in the garment's 2048-unit reference canvas, not a stitch size. */
  textureScale: number;
  textureOpacity: number;
  contrast: number;
  brightnessCorrection: number;
  tilingDensity: number;
  rotation: number;
  direction: string;
  recommendedUses: string[];
}

// Each recipe owns its construction map; fibre composition does not select texture.
const rules: Record<FabricTextureType, MaterialRule> = {
  jersey: { family: 'single knit', textureScale: 660, textureOpacity: .18, contrast: .8, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'vertical knit wales', recommendedUses: ['body', 'sleeve'] },
  interlock: { family: 'double knit', textureScale: 720, textureOpacity: .15, contrast: .7, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'vertical knit wales', recommendedUses: ['body', 'sleeve'] },
  terry: { family: 'sweatshirt knit', textureScale: 540, textureOpacity: .22, contrast: .8, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'vertical face wales; separate loop reverse required', recommendedUses: ['body', 'sleeve', 'hood'] },
  loopback: { family: 'loopback knit', textureScale: 495, textureOpacity: .2, contrast: .8, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'vertical face wales; separate loop reverse required', recommendedUses: ['body', 'sleeve'] },
  fleece: { family: 'heavy sweatshirt knit', textureScale: 350, textureOpacity: .2, contrast: .75, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'face wales; separate lofted reverse required', recommendedUses: ['body', 'sleeve', 'hood'] },
  'brushed-fleece': { family: 'brushed sweatshirt knit', textureScale: 380, textureOpacity: .18, contrast: .7, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'face wales; separate brushed reverse required', recommendedUses: ['body', 'sleeve', 'hood'] },
  'rib-1x1': { family: 'single rib knit', textureScale: 360, textureOpacity: .32, contrast: .85, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'narrow vertical knit/purl channels', recommendedUses: ['neck', 'cuff', 'waistband'] },
  'rib-2x2': { family: 'double rib knit', textureScale: 400, textureOpacity: .34, contrast: .85, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'paired vertical knit/purl channels', recommendedUses: ['neck', 'cuff', 'waistband'] },
  waffle: { family: 'cellular knit', textureScale: 320, textureOpacity: .28, contrast: .8, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'aligned square knit cells', recommendedUses: ['body', 'sleeve'] },
  pique: { family: 'tuck knit', textureScale: 645, textureOpacity: .2, contrast: .75, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'fine raised tuck structure', recommendedUses: ['body', 'sleeve'] },
  twill: { family: 'cotton twill weave', textureScale: 430, textureOpacity: .24, contrast: .8, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'diagonal weave; vertical warp', recommendedUses: ['body', 'pocket'] },
  denim: { family: 'denim twill weave', textureScale: 1150, textureOpacity: .58, contrast: 1, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'preserve photographed diagonal twill', recommendedUses: ['body', 'pocket', 'waistband'] },
  taslan: { family: 'air-textured nylon weave', textureScale: 390, textureOpacity: .16, contrast: .7, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'fine woven grain; no imposed crosshatch', recommendedUses: ['body', 'sleeve', 'hood'] },
  mesh: { family: 'performance open knit', textureScale: 645, textureOpacity: .2, contrast: .7, brightnessCorrection: 0, tilingDensity: 1, rotation: 0, direction: 'fine knit openings; no transparency cut-outs', recommendedUses: ['body', 'sleeve', 'panel'] },
};

export const FABRIC_SOURCES = manifest.presets as FabricSourceRecord[];
export const FABRIC_SOURCE_RESEARCH = manifest.research;

export function validateFabricSources(records: readonly FabricSourceRecord[], ids: readonly string[]): void {
  if (records.length !== ids.length || new Set(records.map(record => record.fabricPresetId)).size !== ids.length) throw new Error('Missing or duplicate fabric source records');
  const seen = new Set<string>();
  for (const record of records) {
    if (!ids.includes(record.fabricPresetId) || !record.reason) throw new Error('Unknown fabric or missing source explanation');
    if (!['scan-cc0', 'scan-ccby', 'ceriga-owned', 'procedural'].includes(record.sourceType)
      || !['verified', 'review-required', 'unresolved'].includes(record.sourceStatus)
      || record.status !== record.sourceStatus) throw new Error(`Invalid source type/status: ${record.fabricPresetId}`);
    if (record.sourceStatus === 'unresolved') {
      if (record.source || record.reverse || record.procedural) throw new Error(`Unresolved fabric must not have a substitute: ${record.fabricPresetId}`);
      continue;
    }
    const source = record.source;
    if (!source) throw new Error(`Missing material provenance: ${record.fabricPresetId}`);
    if (record.sourceType === 'scan-cc0' && source.license !== 'CC0-1.0') throw new Error('Restricted CC0 license');
    if (record.sourceType === 'scan-ccby') {
      const attribution = source.attribution;
      if (!['CC-BY-4.0', 'CC-BY-3.0'].includes(source.license) || !attribution
        || ![attribution.creator, attribution.assetName, attribution.sourceUrl, attribution.license, attribution.text].every(value => typeof value === 'string' && value.trim())
        || attribution.license !== source.license) throw new Error('Incomplete commercial CC-BY attribution');
    }
    if (record.sourceType === 'ceriga-owned' && (!source.ownership?.owner.trim() || !source.ownership.redistributionPermission.trim())) throw new Error('Missing ownership/redistribution permission');
    if (record.sourceType === 'procedural') {
      const recipe = record.procedural;
      if (!recipe?.generator.trim() || !recipe.recipe.trim() || !Number.isInteger(recipe.version) || recipe.version < 1
        || !Number.isInteger(recipe.seed) || source.license !== 'LicenseRef-Ceriga-Authored') throw new Error('Missing authored construction recipe');
    } else if (record.procedural) throw new Error('Photograph cannot use procedural provenance');
    for (const key of ['assetId', 'provider', 'page', 'evidenceUrl', 'constructionEvidence', 'licenseUrl', 'licensePage', 'download', 'originalFilename', 'originalFile', 'normalizedFile', 'sourceSha256', 'normalizedSha256'] as const) {
      if (typeof source[key] !== 'string' || !source[key].trim()) throw new Error(`Missing ${key}: ${record.fabricPresetId}`);
    }
    if (![source.sourceSha256, source.normalizedSha256].every(hash => /^[a-f0-9]{64}$/.test(hash))) throw new Error('Invalid texture checksum');
    // All major IDs are distinct constructions. Copies/renames/crops cannot disguise shared provenance.
    const keys = [`asset:${source.provider}:${source.assetId}`, `path:${source.originalFile}`, `path:${source.normalizedFile}`, `hash:${source.sourceSha256}`, `hash:${source.normalizedSha256}`];
    if (record.reverse) {
      if (!record.reverse.description.trim() || !record.reverse.normalizedFile.trim() || !/^[a-f0-9]{64}$/.test(record.reverse.normalizedSha256)) throw new Error('Incomplete reverse material provenance');
      const reverse = record.reverse;
      if (reverse.sourceType !== undefined || reverse.sourceStatus !== undefined || reverse.procedural !== undefined || reverse.license !== undefined) {
        const recipe = reverse.procedural;
        if (reverse.sourceType !== 'procedural' || !['review-required', 'verified'].includes(reverse.sourceStatus ?? '')
          || reverse.license !== 'LicenseRef-Ceriga-Authored' || !recipe?.generator.trim() || !recipe.recipe.trim()
          || !Number.isInteger(recipe.version) || recipe.version < 1 || !Number.isInteger(recipe.seed)) {
          throw new Error('Incomplete independently authored reverse provenance');
        }
      }
      keys.push(`path:${record.reverse.normalizedFile}`, `hash:${record.reverse.normalizedSha256}`);
    }
    for (const key of keys) {
      if (seen.has(key)) throw new Error(`Shared construction texture: ${key}`);
      seen.add(key);
    }
  }
}
validateFabricSources(FABRIC_SOURCES, FABRIC_LIBRARY.map(fabric => fabric.id));

export function fabricSourceRecord(fabric: GarmentFabric): FabricSourceRecord {
  return FABRIC_SOURCES.find(record => record.fabricPresetId === fabric.id)
    ?? { fabricPresetId: fabric.id, sourceType: 'procedural', sourceStatus: 'unresolved', status: 'unresolved', reason: 'No dedicated source registered.' };
}

export function fabricAssignmentIssues(parts: readonly FabricPart[], value?: FabricAssignments) {
  return parts.flatMap(part => {
    const { fabric, fabricId: id, interior } = resolvePartMaterial(value, part, parts);
    if (!id) return [];
    const record = fabric && fabricSourceRecord(fabric);
    const reason = !fabric ? 'Unknown saved fabric ID.'
      : record?.sourceStatus === 'unresolved' ? record.reason
      : interior && !record?.reverse ? 'No dedicated reverse-side texture source.'
      : !fabricScanSurface(fabric, interior) ? 'Registered texture map unavailable.' : undefined;
    if (!reason) return [];
    return [{ partId: part.id, partLabel: part.label, fabricId: id, fabricName: fabric?.name ?? id, reason }];
  });
}

export function fabricMaterial(fabric: GarmentFabric) {
  return { ...rules[fabric.textureType], roughness: fabric.roughness, sheen: fabric.sheen,
    structure: fabric.structure, thickness: fabric.thickness, calibrated: fabricSourceRecord(fabric).status === 'verified' };
}

const images = import.meta.glob<string>(['../../assets/fabrics/*.png', '../../assets/fabrics/procedural/*.png', '!../../assets/fabrics/procedural/*-source.png'], { eager: true, query: '?inline', import: 'default' });
export function fabricScanSurface(fabric: GarmentFabric, interior = false) {
  const record = fabricSourceRecord(fabric);
  if (record.sourceStatus === 'unresolved' || !record.source) return undefined;
  const filename = interior ? record.reverse?.normalizedFile : record.source.normalizedFile;
  if (!filename) return undefined;
  const image = images[`../../assets/fabrics/${filename}`];
  if (!image) throw new Error(`Registered source has no bundled map: ${fabric.id} ${filename}`);
  const material = fabricMaterial(fabric);
  const reverse = interior ? record.reverse : undefined;
  return { image, source: reverse?.sourceType ? `ceriga-${fabric.id}-reverse-v${reverse.procedural?.version}` : `${record.source.assetId}${interior ? '-reverse' : ''}`, sourceType: reverse?.sourceType ?? record.sourceType,
    sourceStatus: reverse?.sourceStatus ?? record.sourceStatus, repeat: material.textureScale / material.tilingDensity,
    opacity: material.textureOpacity * material.contrast, brightnessCorrection: material.brightnessCorrection, rotation: material.rotation };
}
