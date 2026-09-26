#!/usr/bin/env node
// tools/import.mjs — the one-time import from a cehinds/AshenSpire checkout
// (docs/ART-REPO-PLAN.md in that repo, step 2).
//
//   node tools/import.mjs <path-to-AshenSpire-checkout>
//
// Copies, from the checkout's committed tree:
//   · every asset id its art-manifest.json lists   → hd/assets/<…>   (5,201 files on 0.7.1)
//   · art/                                         → art/
//   · assets/equipment/components/                 → art/equipment-components/
//     (authoring-only reference strips: tools/assetmime.mjs there never ships them)
// and writes IMPORTED.json naming the source commit, so the import can be
// repeated from the same commit and compared byte for byte.
//
// It refuses a checkout with uncommitted changes under art/ or assets/, and
// refuses when a file the manifest lists is missing or differs from its
// recorded sha256: what lands here is exactly what that commit carried.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packedBytes } from './pack.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] && resolve(process.argv[2]);
if (!src || !existsSync(join(src, 'art-manifest.json'))) {
  console.error('usage: node tools/import.mjs <path-to-AshenSpire-checkout>  (it must carry art-manifest.json)');
  process.exit(2);
}
const git = (...args) => execFileSync('git', ['-C', src, ...args], { encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--', 'art', 'assets', 'art-manifest.json')) {
  console.error('import: REFUSED — the checkout has uncommitted changes under art/, assets/ or art-manifest.json');
  process.exit(1);
}
const commit = git('rev-parse', 'HEAD');
const manifest = JSON.parse(readFileSync(join(src, 'art-manifest.json'), 'utf8'));
const ids = Object.keys(manifest.assets);
const bad = [];
for (const id of ids) {
  const rec = manifest.assets[id].high;
  const from = join(src, rec.path);
  if (!existsSync(from)) { bad.push(`${id}: missing`); continue; }
  const buf = packedBytes(from);
  if (buf.length !== rec.bytes || createHash('sha256').update(buf).digest('hex') !== rec.sha256) { bad.push(`${id}: differs from art-manifest.json`); continue; }
  const to = join(ROOT, 'hd', rec.path);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, buf);
}
if (bad.length) {
  console.error(`import: REFUSED — ${bad.length} manifest entr${bad.length === 1 ? 'y' : 'ies'} did not match:`);
  for (const b of bad.slice(0, 20)) console.error(`  · ${b}`);
  process.exit(1);
}
cpSync(join(src, 'art'), join(ROOT, 'art'), { recursive: true });
const components = join(src, 'assets/equipment/components');
if (existsSync(components)) cpSync(components, join(ROOT, 'art/equipment-components'), { recursive: true });
writeFileSync(join(ROOT, 'IMPORTED.json'), `${JSON.stringify({
  from: 'cehinds/AshenSpire',
  commit,
  assets: ids.length,
  note: 'hd/assets/ holds the ids art-manifest.json listed at that commit; art/ and art/equipment-components/ are that commit\'s art/ and assets/equipment/components/.',
}, null, 2)}\n`);
console.log(`import: OK — ${ids.length} assets, art/ and the component strips from ${commit}`);
