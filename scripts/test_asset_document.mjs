import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { useAssetWorkspace } from './src/app/components/builder/printsStudio/useAssetWorkspace';
    import { readStoredAssets } from './src/app/lib/assetLibraryStorage';
    window.readDrafts = readStoredAssets;
    window.placements = [];
    function Fixture() {
      window.workspace = useAssetWorkspace({ onPlaceOnGarment: asset => window.placements.push(asset) });
      return null;
    }
    createRoot(document.getElementById('root')).render(<Fixture />);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'document-dependencies', setup(build) {
    build.onResolve({ filter: /\/(AuthContext|assetLibrary|exportAssetArtboard)$/ }, args => ({ path: args.path.split('/').pop(), namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', resolveDir: process.cwd(), contents: {
      AuthContext: `import {useState} from 'react'; export function useAuth(){const [user,setUser]=useState(null);window.setAccount=setUser;return {user,authReady:true};}`,
      assetLibrary: `export const listAssetProjects=async()=>[];export const listLocalAssetProjects=async()=>[];export const saveAssetProject=async asset=>asset;`,
      exportAssetArtboard: `export async function exportAssetArtboard(){await new Promise(resolve=>window.finishExport=resolve);return 'data:image/png;base64,AA==';}`,
    }[args.path] }));
  } }],
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__asset_document_test', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5189'}/__asset_document_test`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForFunction(() => window.workspace?.authReady);
  await page.evaluate(() => window.workspace.enter());
  await page.waitForFunction(() => window.workspace.project);
  await page.evaluate(() => window.workspace.changeProject({ name: 'Guest draft' }));
  await page.waitForFunction(async () => (await window.readDrafts('asset-draft:guest'))[0]?.asset.name === 'Guest draft');
  await page.evaluate(() => window.setAccount({ id: 'account-a' }));
  await page.waitForFunction(() => !window.workspace.project);
  assert.equal(await page.evaluate(async () => (await window.readDrafts('asset-draft:account-a')).length), 0, 'Account switch cannot copy guest artwork');
  await page.evaluate(() => window.workspace.enter());
  await page.waitForFunction(() => window.workspace.project);
  await page.evaluate(() => window.workspace.changeProject({ name: 'Account A draft' }));
  await page.waitForFunction(async () => (await window.readDrafts('asset-draft:account-a'))[0]?.asset.name === 'Account A draft');
  await page.evaluate(() => { void window.workspace.save(); });
  await page.waitForFunction(() => window.workspace.busy && window.finishExport);
  await page.evaluate(() => window.setAccount({ id: 'account-b' }));
  await page.waitForFunction(() => !window.workspace.project);
  await page.evaluate(() => window.finishExport());
  await page.waitForFunction(() => !window.workspace.busy);
  assert.equal(await page.evaluate(() => window.placements.length), 0, 'Account switch during save cannot place previous account artwork');
  assert.equal(await page.evaluate(async () => (await window.readDrafts('asset-draft:account-b')).length), 0);
  assert.equal(await page.evaluate(async () => (await window.readDrafts('asset-draft:account-a'))[0].asset.name), 'Account A draft');
  await page.evaluate(() => window.setAccount(null));
  await page.waitForFunction(() => window.workspace.recovery?.name === 'Guest draft');
  await page.evaluate(() => window.workspace.resume());
  await page.waitForFunction(() => window.workspace.project?.name === 'Guest draft' && window.workspace.dirty);
  await page.evaluate(() => window.workspace.back());
  await page.waitForFunction(() => window.workspace.confirmBack);
  await page.evaluate(() => window.workspace.discard());
  await page.waitForFunction(() => !window.workspace.project);
  assert.equal(await page.evaluate(async () => (await window.readDrafts('asset-draft:guest')).length), 0);
  assert.deepEqual(errors, []);
  console.log('Asset document passed: isolated account/guest drafts, interrupted account save, recovery and explicit discard.');
} finally { await browser.close(); }
