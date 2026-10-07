import assert from 'node:assert/strict';
import { decodeRegionUpload } from './garment-vite-plugin';

export function runConstructionRegionEndpointTests() {
  const tracePreview = { tracedSvg: '<svg/>', cleanedRaster: 'data:image/png;base64,AAAA' };
  const garment = { source: 'azure-garment-reconstruction-v1', parts: [{ id: 'front-source-ink', view: 'front' }], manifest: { view: 'front' }, tracePreview };
  const decode = (value: unknown) => decodeRegionUpload(Buffer.from(JSON.stringify(value)));
  const front = decode({ garment, requestedView: 'front' });
  assert.equal(front.view, 'front');
  assert.deepEqual(JSON.parse(front.bytes.toString()), garment);
  assert.equal(decode({ garment }).view, 'front');
  assert.throws(() => decode({ garment, requestedView: 'side' }), /requestedView/);
  assert.throws(() => decode({ garment, requestedView: 'back' }), /real reference/);
  assert.throws(() => decode({ garment: { ...garment, tracePreview: undefined } }), /trace preview/);
  assert.throws(() => decode({ garment: { ...garment, source: 'unknown' } }), /completed garment trace/);
  assert.throws(() => decode({ garment: { ...garment, parts: [] } }), /completed garment trace/);
  const paired = { ...garment, parts: [...garment.parts, { id: 'back-source-ink', view: 'back' }], manifest: { ...garment.manifest, backView: { tracePreview } } };
  assert.equal(decode({ garment: paired, requestedView: 'back' }).view, 'back');
  assert.throws(() => decode({ garment: { ...paired, manifest: { ...paired.manifest, backView: { tracePreview, inference: true } } }, requestedView: 'back' }), /real reference/);
  assert.throws(() => decode({ garment: { ...paired, manifest: { view: 'front' } }, requestedView: 'back' }), /trace preview/);
  return '11 construction endpoint validation checks passed';
}
