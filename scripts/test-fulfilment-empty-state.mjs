import { localeMocks } from './support/localeMocks.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const path = 'src/app/pages/manufacturer/ManufacturerFulfilment.tsx';
const { code } = await transformWithEsbuild(await readFile(path, 'utf8'), path, { format: 'cjs' });
const module = { exports: {} };
const imports = {
  react: { ...React, useEffect: () => {}, useState: initial =>
    React.useState(initial === null ? { total: 0, counts: null, orders: [] } : initial) },
  'react-router': { useParams: () => ({}), useSearchParams: () => [new URLSearchParams()] },
  'lucide-react': await import('lucide-react'),
  '../../contexts/FactoryAccessContext': { useFactoryAccess: () => ({ ready: true }) },
};
new Function('React', 'require', 'module', 'exports', code)(
  React, ((original)=>specifier=>{if(/\/i18n\/i18n$/.test(specifier)){let actual;try{actual=original(specifier)}catch{}if(!actual)return localeMocks['../../i18n/i18n'];for(const [key,value]of Object.entries(localeMocks['../../i18n/i18n']))if(!(key in actual))actual[key]=value;return actual}return original(specifier)})(id => imports[id] ?? {}), module, module.exports,
);
const html = renderToStaticMarkup(React.createElement(module.exports.ManufacturerFulfilment));
assert.match(html, /Production<span>0<\/span>/);
assert.match(html, /No orders in this view/);
console.log('PASS: a factory with no paid orders sees zero counts and the empty state.');
