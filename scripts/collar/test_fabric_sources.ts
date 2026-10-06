import { FABRIC_LIBRARY } from '../../src/app/data/garmentFabrics';
import { FABRIC_SOURCES, fabricAssignmentIssues, fabricMaterial, fabricScanSurface, validateFabricSources, type FabricSourceRecord } from '../../src/app/lib/fabricTextureScans';
import { check } from './test_garment_fabrics';

export function verifyFabricSources() {
  const ids = FABRIC_LIBRARY.map(fabric => fabric.id);
  validateFabricSources(FABRIC_SOURCES, ids);
  const snapshot = JSON.stringify(FABRIC_SOURCES);
  for (const fabric of FABRIC_LIBRARY) {
    const record = FABRIC_SOURCES.find(record => record.fabricPresetId === fabric.id)!;
    const material = fabricMaterial(fabric);
    check(material.family && material.direction && material.recommendedUses.length && material.structure && material.thickness, `Incomplete construction rules: ${fabric.id}`);
    check(material.textureScale > 0 && material.textureOpacity > 0 && material.textureOpacity <= 1 && material.contrast > 0 && material.contrast <= 1 && Number.isFinite(material.rotation), 'Invalid scale/contrast rules');
    check(Number.isFinite(material.brightnessCorrection) && Math.abs(material.brightnessCorrection) <= .03 && Number.isFinite(material.tilingDensity) && material.tilingDensity > 0, `Invalid brightness/density rules: ${fabric.id}`);
    const surface = fabricScanSurface(fabric);
    check(!surface || surface.repeat === material.textureScale / material.tilingDensity && surface.brightnessCorrection === material.brightnessCorrection, `Render tuning not applied: ${fabric.id}`);
    check(!!surface === (record.sourceStatus !== 'unresolved'), `Substituted or missing material: ${fabric.id}`);
    check(surface?.sourceType === record.sourceType && surface?.sourceStatus === record.sourceStatus, `Material provenance lost: ${fabric.id}`);
    const reverse = fabricScanSurface(fabric, true);
    check(!!reverse === !!record.reverse, `Missing or substituted reverse: ${fabric.id}`);
    if (reverse) check(reverse.image !== surface?.image, `Reverse reused face: ${fabric.id}`);
  }
  const reject = (records: FabricSourceRecord[], label: string) => {
    let rejected = false;
    try { validateFabricSources(records, ids); } catch { rejected = true; }
    check(rejected, `Source validation accepted ${label}`);
  };
  reject(FABRIC_SOURCES.slice(1), 'missing major preset');
  reject([...FABRIC_SOURCES.slice(1), FABRIC_SOURCES[1]], 'duplicate ID');
  const verified = FABRIC_SOURCES.find(record => record.status === 'verified')!;
  const target = FABRIC_SOURCES.find(record => record.sourceType === 'procedural')!;
  const replace = (record: FabricSourceRecord) => FABRIC_SOURCES.map(value => value.fabricPresetId === target.fabricPresetId ? record : value);
  reject(replace({ ...target, sourceStatus: 'unresolved', status: 'unresolved', source: verified.source }), 'hidden unresolved substitute');
  reject(replace({ ...target, status: 'verified' }), 'mismatched compatibility status');
  reject(replace({ ...target, procedural: undefined }), 'procedural map without construction recipe');
  reject(replace({ ...target, sourceType: 'scan-ccby', procedural: undefined, source: { ...target.source!, license: 'CC-BY-4.0' } }), 'CC-BY without attribution');
  reject(replace({ ...target, sourceType: 'ceriga-owned', procedural: undefined }), 'unsubstantiated ownership');
  const ccby: FabricSourceRecord = { ...target, sourceType: 'scan-ccby', procedural: undefined, source: { ...target.source!, license: 'CC-BY-4.0', attribution: { creator: 'Test creator', assetName: 'Test exact construction', sourceUrl: 'https://example.com/swatch', license: 'CC-BY-4.0', text: 'Test exact construction by Test creator, CC-BY-4.0; normalized and cropped.' } } };
  validateFabricSources(replace(ccby), ids);
  reject(replace({ ...ccby, source: { ...ccby.source!, license: 'CC-BY-NC-4.0' } }), 'noncommercial source');
  reject(replace({ ...ccby, source: { ...ccby.source!, license: 'CC-BY-SA-4.0' } }), 'unapproved share-alike source');
  const owned: FabricSourceRecord = { ...target, sourceType: 'ceriga-owned', procedural: undefined, source: { ...target.source!, license: 'Ceriga-owned', ownership: { owner: 'Ceriga', redistributionPermission: 'Approved for redistribution by owner' } } };
  validateFabricSources(replace(owned), ids);
  reject(replace({ ...verified, fabricPresetId: target.fabricPresetId, source: { ...verified.source!, license: 'custom CC0 - no redistribution' } }), 'restricted license');
  for (const field of ['assetId', 'originalFile', 'normalizedFile', 'sourceSha256', 'normalizedSha256'] as const) {
    const source = { ...verified.source!, assetId: 'different-asset', originalFile: 'originals/different.jpg', normalizedFile: 'different.png', sourceSha256: 'a'.repeat(64), normalizedSha256: 'b'.repeat(64) };
    source[field] = verified.source![field];
    reject(replace({ ...verified, fabricPresetId: target.fabricPresetId, source }), `shared ${field}`);
  }
  const parts = [
    { id: 'body', label: 'Body', role: 'body' },
    { id: 'panel', label: 'Body panel', role: 'body', parentId: 'body' },
    { id: 'neck', label: 'Neck', role: 'neck' },
    { id: 'sleeve', label: 'Sleeve', role: 'sleeve' },
    { id: 'inside', label: 'Inside', role: 'interior', interior: true },
  ];
  const assignments = { assignments: { body: target.fabricPresetId, neck: verified.fabricPresetId, sleeve: 'unknown-saved-fabric', inside: verified.fabricPresetId }, unlinkedGroups: [] };
  const saved = JSON.stringify(assignments);
  const issues = fabricAssignmentIssues(parts, assignments);
  check(issues.length === 2, 'Only unknown ID and missing denim reverse must be reported');
  check(!issues.some(issue => issue.partId === 'panel' || issue.partId === 'body'), 'Reviewable procedural source incorrectly treated as unresolved');
  check(issues.some(issue => issue.partId === 'sleeve' && issue.reason.includes('Unknown')), 'Unknown saved ID silently ignored');
  check(issues.some(issue => issue.partId === 'inside' && issue.reason.includes('reverse')), 'Missing reverse source silently ignored');
  check(!issues.some(issue => issue.partId === 'neck'), 'Verified face source incorrectly reported missing');
  check(!fabricAssignmentIssues(parts).length, 'Unassigned garments must retain their plain baseline without errors');
  check(!fabricAssignmentIssues([{ id: 'body', label: 'Body', role: 'body' }], { assignments: { body: verified.fabricPresetId }, unlinkedGroups: [] }).length, 'Verified assignment incorrectly unresolved');
  check(JSON.stringify(assignments) === saved, 'Availability reporting mutated saved assignments');
  check(JSON.stringify(FABRIC_SOURCES) === snapshot, 'Source validation mutated the registry');
  return {
    verified: FABRIC_SOURCES.filter(record => record.sourceStatus === 'verified').map(record => record.fabricPresetId),
    procedural: FABRIC_SOURCES.filter(record => record.sourceType === 'procedural' && record.sourceStatus !== 'unresolved').map(record => record.fabricPresetId),
    reviewRequired: FABRIC_SOURCES.filter(record => record.sourceStatus === 'review-required').map(record => record.fabricPresetId),
    unresolved: FABRIC_SOURCES.filter(record => record.sourceStatus === 'unresolved').map(record => record.fabricPresetId),
  };
}
