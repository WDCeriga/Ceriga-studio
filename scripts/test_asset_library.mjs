import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  entryPoints: ['src/app/lib/assetLibrary.ts'], bundle: true, write: false,
  platform: 'browser', format: 'iife', globalName: 'assetLibrary', logLevel: 'silent',
  plugins: [{ name: 'mock-supabase', setup(builder) {
    builder.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'mock-client', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const getSupabase = () => globalThis.mockSupabase;' }));
  } }],
});
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end('<!doctype html><title>Asset persistence tests</title>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const errors = [];
  const install = async page => {
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(() => {
      window.check = (value, message) => { if (!value) throw new Error(message); };
      window.equal = (actual, expected, message) => check(JSON.stringify(actual) === JSON.stringify(expected), message);
      window.rejects = async (action, pattern) => {
        try { await action(); } catch (error) {
          check(pattern.test(error.message), `Unexpected rejection: ${error.message}`);
          return error;
        }
        throw new Error(`Expected rejection: ${pattern}`);
      };
      window.fixture = (id = 'asset') => ({
        id, name: 'Editable asset', width: 512, height: 256,
        elements: [{ id: 'group', type: 'group', children: [{ id: 'nested', type: 'drawing', content: 'editable-path', points: [{ x: 2, y: 4, pressure: .5 }], unknownField: { color: '#abc' } }], future: ['keep', 123] }],
        preview: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-05T12:00:00.000Z',
      });
      window.cloud = { user: 'user-a', rows: new Map(), failure: false, authFailure: false, switchOnWrite: false, reads: 0, writes: 0, ranges: [] };
      window.mockSupabase = {
        auth: {
          getSession: async () => ({ data: { session: cloud.user ? { user: { id: cloud.user } } : null }, error: null }),
          getUser: async () => ({ data: { user: { id: cloud.user } }, error: cloud.authFailure ? new Error('Offline auth') : null }),
        },
        from: table => {
          check(table === 'asset_projects', 'Dedicated table');
          const query = {
            select() { return this; },
            eq(column, value) { check(column === 'user_id', 'Owner filter'); this.owner = value; return this; },
            order(column) { check(column === 'id', 'Stable pagination'); return this; },
            async range(start, end) {
              cloud.reads++; cloud.ranges.push([start, end]);
              if (cloud.failure) return { error: new Error('Offline cloud') };
              check(query.owner === cloud.user, 'Queries restricted to active owner');
              return { data: [...cloud.rows.values()].filter(row => row.user_id === query.owner).sort((a, b) => a.id.localeCompare(b.id)).slice(start, end + 1), error: null };
            },
            upsert(row, options) { check(options.onConflict === 'user_id,id', 'Composite owner key'); this.row = row; return this; },
            async single() {
              cloud.writes++;
              if (cloud.failure) return { error: new Error('Offline cloud') };
              const row = query.row;
              check(row.user_id === cloud.user, 'Writes restricted to active owner');
              const previous = cloud.rows.get(`${row.user_id}:${row.id}`);
              const confirmed = { ...row, created_at: previous?.created_at ?? row.created_at, updated_at: '2026-10-05T23:00:00.000Z' };
              cloud.rows.set(`${row.user_id}:${row.id}`, structuredClone(confirmed));
              if (cloud.switchOnWrite) cloud.user = 'user-b';
              return { data: confirmed, error: null };
            },
          };
          return query;
        },
      };
    });
  };
  const page = await context.newPage();
  await install(page);
  await page.evaluate(async () => {
    const { saveAssetProject: save, listAssetProjects: list } = assetLibrary;
    check(/^[0-9a-f-]{36}$/.test(assetLibrary.createAssetProjectId()), 'UUID ID helper');
    equal(await list(null), [], 'Empty guest library');
    const input = fixture();
    const saving = save(input, null);
    input.elements[0].children[0].content = 'caller mutation';
    equal(await saving, fixture(), 'Snapshot before caller mutation');
    equal(await list(null), [fixture()], 'Guest nested data round trip');
    const blob = URL.createObjectURL(new Blob(['embedded-image'], { type: 'image/png' }));
    const embedded = fixture('blob');
    embedded.preview = blob;
    embedded.elements[0].children[0].content = blob;
    const saved = await save(embedded, null);
    URL.revokeObjectURL(blob);
    check(saved.preview === 'data:image/png;base64,ZW1iZWRkZWQtaW1hZ2U=', 'Blob preview persisted');
    check(saved.elements[0].children[0].content === saved.preview, 'Nested Blob URL persisted');
    await Promise.all(Array.from({ length: 8 }, (_, i) => save(fixture(`parallel-${i}`), null)));
    check((await list(null)).length === 10, 'Concurrent guest writes retain all records');
    const large = fixture('large');
    large.elements[0].largeData = 'x'.repeat(6 * 1024 * 1024);
    await save(large, null);
    check((await list(null)).find(asset => asset.id === 'large').elements[0].largeData.length === 6 * 1024 * 1024, 'Beyond typical localStorage size');
    for (const patch of [{ width: 0 }, { height: Infinity }, { preview: 'blob:missing' }, { preview: 'https://example.invalid/image.png' }, { createdAt: 'bad-date' }, { elements: null }, { id: '' }]) {
      await rejects(() => save({ ...fixture('invalid'), ...patch }, null), /Invalid asset|fetch/i);
    }
    const circular = fixture('circular'); circular.elements.push(circular);
    await rejects(() => save(circular, null), /circular/i);
    check(cloud.writes === 0 && cloud.reads === 0, 'Guest never uses cloud');
  });
  await page.reload();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const persisted = await page.evaluate(() => assetLibrary.listAssetProjects(null));
  assert.equal(persisted.length, 11, 'IndexedDB survives page reload');
  assert.equal(persisted.find(asset => asset.id === 'asset').elements[0].children[0].content, 'editable-path');
  await install(page);
  await page.evaluate(async () => {
    const { saveAssetProject: save, listAssetProjects: list, listLocalAssetProjects: local, listPendingAssetProjects: pending } = assetLibrary;
    const confirmed = await save(fixture(), 'user-a');
    check(confirmed.updatedAt === '2026-10-05T23:00:00.000Z', 'Cloud canonical dates returned');
    equal(confirmed.elements, fixture().elements, 'Cloud groups untouched');
    check((await pending('user-a')).length === 0, 'Acknowledged save is clean');
    check((await list('user-a')).length === 1, 'Guest assets never imported');
    const changed = { ...fixture(), name: 'Recovered draft' };
    cloud.failure = true;
    const failure = await rejects(() => save(changed, 'user-a'), /recoverable local draft/);
    check(failure instanceof assetLibrary.AssetSyncError && failure.cause.message === 'Offline cloud', 'Sync error exposes cause');
    equal(failure.asset, changed, 'Sync error exposes recoverable snapshot');
    equal(await pending('user-a'), [changed], 'Failed write stays pending');
    await rejects(() => list('user-a'), /Offline cloud/);
    equal(await local('user-a'), [changed], 'Offline list fallback is explicit');
    cloud.failure = false;
    equal(await list('user-a'), [changed], 'Refresh does not overwrite pending edit with old cloud version');
    const retried = await save(changed, 'user-a');
    equal(await pending('user-a'), [], 'Retry clears pending draft');
    equal(await list('user-a'), [retried], 'Successful retry appears in cloud');
    cloud.authFailure = true;
    await rejects(() => save(fixture('auth-failed'), 'user-a'), /recoverable local draft/);
    check((await pending('user-a')).some(asset => asset.id === 'auth-failed'), 'Auth refresh failure retains draft');
    cloud.authFailure = false;
    await rejects(() => list('user-b'), /does not match/);
    await rejects(() => local('user-b'), /does not match/);
    await rejects(() => save(fixture('forbidden'), 'user-b'), /does not match/);
    cloud.user = 'user-b';
    equal(await list('user-b'), [], 'Second account cannot read first account');
    await save({ ...fixture(), name: 'Account B' }, 'user-b');
    check((await list('user-b'))[0].name === 'Account B', 'Same ID is isolated by owner');
    cloud.user = null;
    await rejects(() => local('user-a'), /does not match/);
    check((await list(null)).length === 11, 'Signout only sees guest namespace');
    cloud.user = 'user-a';
    cloud.switchOnWrite = true;
    await rejects(() => save(fixture('switching'), 'user-a'), /recoverable local draft/);
    check(!(await local('user-b')).some(asset => asset.id === 'switching'), 'Account switch cannot contaminate cache');
    cloud.user = 'user-a'; cloud.switchOnWrite = false;
    check((await pending('user-a')).some(asset => asset.id === 'switching'), 'Account switch retains original draft');
    const seed = cloud.rows.get('user-a:asset');
    for (let i = 0; i < 105; i++) cloud.rows.set(`user-a:remote-${i}`, { ...seed, id: `remote-${i}` });
    cloud.ranges = [];
    const paged = await list('user-a');
    check(paged.some(asset => asset.id === 'remote-104') && cloud.ranges.length === 2, 'Cloud list paginates beyond page limit');
    cloud.rows.delete('user-a:remote-104');
    check(!(await list('user-a')).some(asset => asset.id === 'remote-104'), 'Remote removal evicts clean cache entry');
    const originalPut = IDBObjectStore.prototype.put;
    const writes = cloud.writes;
    IDBObjectStore.prototype.put = function () { throw new DOMException('Quota exhausted', 'QuotaExceededError'); };
    try { await rejects(() => save(fixture('quota'), 'user-a'), /Quota exhausted/); }
    finally { IDBObjectStore.prototype.put = originalPut; }
    check(cloud.writes === writes, 'Local failure prevents cloud write');
    IDBObjectStore.prototype.put = function (...args) { const result = originalPut.apply(this, args); this.transaction.abort(); return result; };
    try { await rejects(() => save(fixture('aborted'), null), /abort/i); }
    finally { IDBObjectStore.prototype.put = originalPut; }
    check(!(await list(null)).some(asset => asset.id === 'aborted'), 'Abort never reports durable success');
    const indexedDBDescriptor = Object.getOwnPropertyDescriptor(window, 'indexedDB');
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
    try { await rejects(() => save(fixture('unavailable'), null), /requires IndexedDB/); }
    finally { Object.defineProperty(window, 'indexedDB', indexedDBDescriptor); }
    await Promise.all([save({ ...fixture('ordered'), name: 'First' }, 'user-a'), save({ ...fixture('ordered'), name: 'Second' }, 'user-a')]);
    check((await list('user-a')).find(asset => asset.id === 'ordered').name === 'Second', 'Concurrent saves retain latest submission');
  });
  const secondPage = await context.newPage();
  await install(secondPage);
  await Promise.all([
    page.evaluate(() => assetLibrary.saveAssetProject(fixture('tab-a'), null)),
    secondPage.evaluate(() => assetLibrary.saveAssetProject(fixture('tab-b'), null)),
  ]);
  const tabs = await secondPage.evaluate(() => assetLibrary.listAssetProjects(null));
  assert(tabs.some(asset => asset.id === 'tab-a') && tabs.some(asset => asset.id === 'tab-b'), 'Cross-tab storage survives concurrent writes');
  const otherDevice = await browser.newContext();
  const devicePage = await otherDevice.newPage();
  await install(devicePage);
  const remoteRows = await page.evaluate(() => [...cloud.rows.entries()]);
  await devicePage.evaluate(rows => { cloud.rows = new Map(rows); }, remoteRows);
  const deviceAssets = await devicePage.evaluate(() => assetLibrary.listAssetProjects('user-a'));
  assert(deviceAssets.some(asset => asset.id === 'ordered' && asset.name === 'Second'), 'Clean device restores cloud source and preview');
  assert.equal((await devicePage.evaluate(() => assetLibrary.listAssetProjects(null))).length, 0, 'Guest data stays device-local');
  assert.deepEqual(errors, [], 'No unhandled browser errors');

  const sql = await readFile('supabase/migrations/20261005230000_asset_projects.sql', 'utf8');
  assert.match(sql, /primary key \(user_id, id\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.asset_projects from anon/);
  for (const operation of ['select', 'insert', 'update', 'delete']) assert.match(sql, new RegExp(`for ${operation} to authenticated`));
  assert.equal((sql.match(/auth\.uid\(\)\) = user_id/g) ?? []).length, 5, 'All read/write policy checks enforce ownership');
  assert.match(sql, /new\.created_at = old\.created_at/);
  assert.match(sql, /jsonb_typeof\(elements\) = 'array'/);
  assert(!/storage\.buckets|storage\.objects/.test(sql), 'Inline atomic rows need no bucket');
  console.log('Asset persistence checks passed: durable IndexedDB, nested/blob data, account isolation, mocked cloud sync/recovery/pagination, quota/abort failures, concurrent tabs, SQL policy structure.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
