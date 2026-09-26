#!/usr/bin/env node
// tools/pack.mjs — build the high-res release from hd/assets/.
//
//   node tools/pack.mjs           write dist/hd-assets-v<N>.zip, dist/art-manifest.json
//                                 and dist/hd-assets-v<N>.zip.sha256 (N from release.json)
//   node tools/pack.mjs --check   pack twice into a temp dir, require identical bytes,
//                                 then read the zip back and verify every entry
//                                 against the manifest; exit 1 on any mismatch
//
// THE RELEASE LAYOUT (what cehinds/AshenSpire's tools/fetch-art.mjs and the
// game's Art quality setting expect):
//
//   art-manifest.json      one record per asset id: { high: { path, bytes, sha256 } }
//   assets/<…>             the files, at the runtime path the game asks for
//
// Unpacked as `hd/` next to AshenSpire.html, the game finds `hd/art-manifest.json`
// and loads `hd/assets/…`; picked as a folder in Settings it matches files by
// their `assets/…` path. An asset id is that runtime path.
//
// SVGs are packed with LF line endings, as AshenSpire's bundler ships them and
// as its art-manifest.json hashes them, so a Windows checkout packs the same
// bytes. Everything else is packed byte for byte.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readZip, writeZip } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_DIR = 'hd/assets';
export const SCHEMA = 1;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  const entries = readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (e.isFile()) out.push(abs);
    else throw new Error(`pack: ${abs} is neither a file nor a directory (a symlink?) — commit the file itself`);
  }
  return out;
}

/** The bytes packed for one file: SVG line endings canonical, the rest untouched. */
export function packedBytes(abs) {
  const buf = readFileSync(abs);
  if (extname(abs).toLowerCase() !== '.svg') return buf;
  return Buffer.from(buf.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
}

export function releaseVersion(root = ROOT) {
  const v = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8')).version;
  if (!Number.isInteger(v) || v < 1) throw new Error('release.json: "version" must be a positive integer');
  return v;
}

/** buildManifest(root) → { manifest, files: [{ id, abs }] } for everything under hd/assets/. */
export function buildManifest(root = ROOT, version = releaseVersion(root)) {
  const src = join(root, SOURCE_DIR);
  const files = walk(src).map((abs) => ({ abs, id: `assets/${relative(src, abs).split(/[\\/]/).join('/')}` }));
  const assets = {};
  for (const { abs, id } of files) {
    const buf = packedBytes(abs);
    assets[id] = { high: { path: id, bytes: buf.length, sha256: sha256(buf) } };
  }
  return {
    manifest: {
      _: 'DERIVED — written by tools/pack.mjs. One record per asset id (the runtime `assets/…` path).',
      schema: SCHEMA,
      release: `hd-assets-v${version}`,
      count: files.length,
      assets,
    },
    files,
  };
}

export const serialize = (manifest) => `${JSON.stringify(manifest, null, 1)}\n`;

/** pack(root, outDir) → { zipPath, manifestPath, sha256, bytes, count }. */
export function pack(root = ROOT, outDir = join(root, 'dist'), version = releaseVersion(root)) {
  const { manifest, files } = buildManifest(root, version);
  if (!files.length) throw new Error(`pack: ${SOURCE_DIR}/ is empty`);
  mkdirSync(outDir, { recursive: true });
  const text = Buffer.from(serialize(manifest), 'utf8');
  const name = `hd-assets-v${version}.zip`;
  const zipPath = join(outDir, name);
  const entries = [{ name: 'art-manifest.json', data: text },
    ...files.map(({ abs, id }) => ({ name: id, data: () => packedBytes(abs) }))];
  const { bytes, count } = writeZip(zipPath, entries);
  const digest = sha256(readFileSync(zipPath));
  const manifestPath = join(outDir, 'art-manifest.json');
  writeFileSync(manifestPath, text);
  writeFileSync(`${zipPath}.sha256`, `${digest}  ${name}\n`);
  return { zipPath, manifestPath, sha256: digest, bytes, count };
}

/** verifyZip(zipBuf) → problems; empty means every entry matches the manifest it carries. */
export function verifyZip(zipBuf) {
  const problems = [];
  const entries = readZip(zipBuf);
  const byName = new Map(entries.map((e) => [e.name, e.data]));
  const text = byName.get('art-manifest.json');
  if (!text) return ['the zip has no art-manifest.json'];
  const manifest = JSON.parse(text.toString('utf8'));
  const ids = Object.keys(manifest.assets || {});
  if (manifest.count !== ids.length) problems.push(`manifest says count ${manifest.count} but lists ${ids.length}`);
  for (const id of ids) {
    const rec = manifest.assets[id] && manifest.assets[id].high;
    if (!rec) { problems.push(`${id}: no high record in the manifest`); continue; }
    const data = byName.get(rec.path);
    if (!data) { problems.push(`${id}: listed, not in the zip`); continue; }
    if (data.length !== rec.bytes || sha256(data) !== rec.sha256) problems.push(`${id}: bytes differ from the manifest`);
  }
  const listed = new Set(ids.map((id) => manifest.assets[id]?.high?.path).filter(Boolean));
  for (const name of byName.keys()) if (name !== 'art-manifest.json' && !listed.has(name)) problems.push(`${name}: in the zip, not in the manifest`);
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const a = mkdtempSync(join(tmpdir(), 'pack-a-'));
    const b = mkdtempSync(join(tmpdir(), 'pack-b-'));
    try {
      const first = pack(ROOT, a);
      const second = pack(ROOT, b);
      const problems = [];
      if (first.sha256 !== second.sha256) problems.push(`two packs of the same tree differ: ${first.sha256} vs ${second.sha256}`);
      problems.push(...verifyZip(readFileSync(first.zipPath)));
      if (problems.length) {
        console.error(`pack: FAIL — ${problems.length} problem(s):`);
        for (const p of problems.slice(0, 20)) console.error(`  · ${p}`);
        process.exit(1);
      }
      console.log(`pack: OK — ${first.count - 1} checks passed (${first.bytes} bytes, sha256 ${first.sha256}, reproducible)`);
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  } else {
    const r = pack();
    console.log(`pack: wrote ${relative(ROOT, r.zipPath)} — ${r.count - 1} assets, ${r.bytes} bytes, sha256 ${r.sha256}`);
  }
}
