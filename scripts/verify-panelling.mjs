import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('node_modules/.cache', { recursive: true });
await build({ entryPoints: ['src/app/features/panelling/panellingSelfTest.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'node_modules/.cache/panelling-tests.mjs' });
const { runPanellingSelfTests } = await import('../node_modules/.cache/panelling-tests.mjs');
const results = runPanellingSelfTests();
for (const result of results) console.log('PASS', result.name);
console.log(results.length + ' panelling regression checks passed.');
