import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const output = fileURLToPath(new URL('../../.label-test-output/', import.meta.url));
const bundle = `${output}optional-labels.cjs`;
await mkdir(output);
try {
  await build({
    entryPoints: [fileURLToPath(new URL('./test_optional_garment_labels.tsx', import.meta.url))],
    outfile: bundle, bundle: true, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'isolate-garment-renderer', setup(builder) {
      builder.onLoad({ filter: /[\\/]TshirtSvgPreview\.tsx$/ }, () => ({
        contents: 'export function TshirtSvgPreview() { return null; }', loader: 'tsx',
      }));
    } }],
  });
  execFileSync(process.execPath, [bundle], { stdio: 'inherit' });
  // Vite resolves real catalogue assets/import.meta.glob; no server port or browser is opened.
  const vite = await createServer({
    configFile: false, root: fileURLToPath(new URL('../../', import.meta.url)), cacheDir: `${output}vite`,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, watch: null, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    await vite.ssrLoadModule('/scripts/collar/test_imported_label_placement.tsx');
    globalThis.document = { createElement(name) {
      if (name !== 'canvas') throw new Error(`Unexpected test element: ${name}`);
      return { getContext: () => ({ font: '', measureText: value => ({ width: value.length }) }) };
    } };
    const existing = await vite.ssrLoadModule('/scripts/collar/test_garment_labels.ts');
    existing.verifyLabelContentBlocks();
    console.log('PASS existing label content and independent tag-face regressions');
  }
  finally { await vite.close(); }
} finally {
  await rm(output, { recursive: true, force: true });
}
