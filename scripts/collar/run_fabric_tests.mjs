import { createServer } from 'vite';
import { mkdir, rm, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../../.fabric-test-output/', import.meta.url));
await mkdir(output);
try {
  const vite = await createServer({
    configFile: false, root: fileURLToPath(new URL('../../', import.meta.url)), cacheDir: `${output}vite`,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, watch: null, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const tests = await vite.ssrLoadModule('/scripts/collar/test_garment_fabrics.ts');
    console.log('PASS fabric model', tests.verifyFabricModel());
    const inheritance = await vite.ssrLoadModule('/scripts/collar/test_fabric_inheritance.ts');
    console.log('PASS material inheritance and interiors', inheritance.verifyFabricInheritance());
    const construction = await vite.ssrLoadModule('/scripts/collar/test_construction_material_editing.tsx');
    console.log('PASS sparse colour inheritance and drag payloads', construction.verifyMaterialColourModel());
    const sources = await vite.ssrLoadModule('/scripts/collar/test_fabric_sources.ts');
    console.log('PASS dedicated source policy', sources.verifyFabricSources());
    const controls = await vite.ssrLoadModule('/scripts/collar/test_fabric_controls.tsx');
    console.log('PASS fabric controls and visible source warnings', controls.runFabricControlTests());
    const assetRoot = new URL('../../src/assets/fabrics/', import.meta.url);
    const json = async name => JSON.parse((await readFile(new URL(name, assetRoot), 'utf8')).replace(/^\uFEFF/, ''));
    const manifest = await json('sources.json'), checksums = await json('checksums.json');
    const expectedFiles = ['sources.json', 'checksums.json'];
    const available = manifest.presets.filter(record => record.sourceStatus !== 'unresolved');
    if (available.length !== 14) throw new Error('Initial hybrid library must render all 14 presets');
    if (checksums.length !== available.length) throw new Error('Stale checksum entries');
    for (const { fabricPresetId, source, reverse } of available) {
      const checksum = checksums.find(record => record.fabricPresetId === fabricPresetId);
      const files = [[source.originalFile, source.sourceSha256], [source.normalizedFile, source.normalizedSha256]];
      if (reverse) files.push([reverse.normalizedFile, reverse.normalizedSha256]);
      for (const [file, expected] of files) {
        expectedFiles.push(file);
        const actual = createHash('sha256').update(await readFile(new URL(file, assetRoot))).digest('hex');
        if (actual !== expected) throw new Error(`Texture checksum mismatch: ${fabricPresetId} ${file}`);
      }
      if (checksum?.sourceSha256 !== source.sourceSha256 || checksum?.outputSha256 !== source.normalizedSha256) throw new Error('Manifest/checksum disagreement');
    }
    const allFiles = async (url, prefix = '') => {
      const result = [];
      for (const entry of await readdir(url, { withFileTypes: true })) {
        const name = `${prefix}${entry.name}`;
        if (entry.isDirectory()) result.push(...await allFiles(new URL(`${entry.name}/`, url), `${name}/`));
        else result.push(name);
      }
      return result;
    };
    if (JSON.stringify((await allFiles(assetRoot)).sort()) !== JSON.stringify(expectedFiles.sort())) throw new Error('Unregistered/placeholder texture files remain');
    console.log('PASS bundled source/output checksums and no orphan textures');
  } finally { await vite.close(); }
} finally { await rm(output, { recursive: true, force: true }); }
