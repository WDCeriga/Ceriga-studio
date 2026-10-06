import { createServer } from 'vite';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../../.schematic-fabric-test-output/', import.meta.url));
await mkdir(output);
try {
  const vite = await createServer({
    configFile: false, root: fileURLToPath(new URL('../../', import.meta.url)), cacheDir: `${output}vite`,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, watch: null, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const tests = await vite.ssrLoadModule('/scripts/collar/test_schematic_fabrics.tsx');
    console.log('PASS schematic fabrics', tests.verifySchematicFabrics());
  } finally { await vite.close(); }
} finally { await rm(output, { recursive: true, force: true }); }
