#!/usr/bin/env node
// Project type check with a recorded baseline of historical errors.
//   npm run typecheck            → fails only if errors appear that are not in the baseline
//   npm run typecheck:baseline   → re-records the baseline (only when intentionally accepting the current set)
// Errors are matched by file + code + first message line (not line/column), so edits that shift
// lines don't register as new errors. Counts are compared per key.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const BASELINE = 'typecheck-baseline.json';
const update = process.argv.includes('--update');
mkdirSync('node_modules/.cache/tsc', { recursive: true });
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const run = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--pretty', 'false',
  '--incremental', '--tsBuildInfoFile', 'node_modules/.cache/tsc/app.tsbuildinfo'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const output = `${run.stdout}${run.stderr}`;
const errors = [];
for (const line of output.split(/\r?\n/)) {
  const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
  if (m) errors.push({ file: m[1].replace(/\\/g, '/'), line: +m[2], code: m[4], message: m[5] });
  else if (/error TS\d+/.test(line)) errors.push({ file: '(global)', line: 0, code: line.match(/TS\d+/)[0], message: line });
}
// TypeScript prints union members in type-creation order, which shifts when unrelated modules are added
// ('"group" | "drawing"' vs '"drawing" | "group"'). Sort quoted unions so the same error keeps the same key.
const sortRun = run => run.split(' | ').sort().join(' | ');
const normalise = message => message
  .replace(/"[^"]*"(?: \| "[^"]*")+/g, sortRun)                              // string-literal unions
  .replace(/\b[A-Za-z_$][\w$.]*(?: \| [A-Za-z_$][\w$.]*)+\b/g, sortRun)      // named-type unions
  .replace(/\.\.\. \d+ more \.\.\./g, '... N more ...');                    // truncated member counts shift as types grow
const keyOf = e => `${e.file} | ${e.code} | ${normalise(e.message)}`;
const counts = {};
for (const e of errors) counts[keyOf(e)] = (counts[keyOf(e)] ?? 0) + 1;

if (update) {
  writeFileSync(BASELINE, JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), total: errors.length,
    note: 'Historical type errors accepted as the baseline. Do not add to this list; fix or avoid new errors instead.', errors: counts }, null, 2) + '\n');
  console.log(`Baseline recorded: ${errors.length} errors in ${new Set(errors.map(e => e.file)).size} files → ${BASELINE}`);
  process.exit(0);
}
if (!existsSync(BASELINE)) { console.error(`No ${BASELINE}. Run: npm run typecheck:baseline`); process.exit(2); }
const baseline = {};
for (const [key, count] of Object.entries(JSON.parse(readFileSync(BASELINE, 'utf8')).errors)) {
  const [file, code, ...rest] = key.split(' | ');
  const k = `${file} | ${code} | ${normalise(rest.join(' | '))}`;
  baseline[k] = (baseline[k] ?? 0) + count;
}
const added = [];
for (const e of errors) { const k = keyOf(e); if ((baseline[k] ?? 0) > 0) baseline[k]--; else added.push(e); }
const fixed = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(`Type check: ${errors.length} errors (baseline ${JSON.parse(readFileSync(BASELINE, 'utf8')).total}); ${added.length} new; ${fixed} baseline errors no longer present.`);
if (added.length) {
  console.error('\nNEW type errors (not in baseline):');
  for (const e of added) console.error(`  ${e.file}(${e.line}): ${e.code} ${e.message}`);
  process.exit(1);
}
