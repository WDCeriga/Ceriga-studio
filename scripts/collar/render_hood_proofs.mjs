import { proofs } from './hood_render.mjs';
await proofs(process.argv[2] || '.tmp-scuba-proof', process.argv[3] || 'Scuba hood');
