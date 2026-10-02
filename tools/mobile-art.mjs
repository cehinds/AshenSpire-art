#!/usr/bin/env node
// tools/mobile-art.mjs — hd/assets/ → light/assets/, and the proof the light
// tree is complete. Moved from cehinds/AshenSpire (where it made assets-mobile/
// from assets/; docs/EXTERNAL-ASSETS-PLAN.md step 9). The policy is
// tools/mobileart-policy.mjs, kept byte-identical to the game's copy.
//
//   node tools/mobile-art.mjs            bring light/assets/ up to date: encode a
//                                        twin for every high file that is new or
//                                        changed, keep the rest, drop strays
//                                        (needs `cwebp` from libwebp on PATH)
//   node tools/mobile-art.mjs --all      re-encode every twin
//   node tools/mobile-art.mjs --all --out <dir>
//                                        re-encode every twin into <dir> instead,
//                                        leaving light/assets/ alone (to compare)
//   node tools/mobile-art.mjs --check    every runtime asset has a twin of the
//                                        policy's size, nothing else is there,
//                                        and the tree fits the budget. Node
//                                        core only — CI runs it.
//   node tools/mobile-art.mjs --selftest the check catches its known-bads
//
// WHY A COMMITTED TREE AND NOT A BUILD STEP. Node cannot encode WebP, and two
// libwebp versions do not agree byte for byte, so the shrinking happens here,
// by whoever changes art, and the result is committed beside hd/assets/. CI
// proves what can be proven without an encoder: the light tree is a complete,
// correctly sized mirror of the runtime art.
//
// WHY IT KEEPS TWINS (not in the game's copy, which rewrote every twin). The
// committed art-manifest.json records, per id, the high file's sha256 and its
// twin's. A twin whose row still names the current high file was made from it,
// so it is kept as it is: an art change re-encodes only the twins it touches,
// and a different cwebp on the next machine never rewrites the other 5,000.
// That is also how the light tier arrived byte-identical from AshenSpire's
// assets-mobile/, including the 224 bow twins its bow importer wrote directly
// (Pillow, not this encoder): their sources are unchanged, so they are kept.
// --all is the clean slate. After any change: node tools/manifest.mjs --write.
//
// FONTS are `common` ids (common/assets/fonts/), not art with twins: they have
// no high or light file. They still count toward the light budget, because the
// light single file inlines them through its CSS.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, mkdtempSync } from 'node:fs';
import { spawnSync, execFile } from 'node:child_process';
import { resolve, relative, dirname, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  POLICY, MOBILE_ART_INLINED_BUDGET_BYTES,
  inlinedBytes, distinctInlinedBytes, webpDimensions, twinDimensions, policyFor,
} from './mobileart-policy.mjs';
import { COMMON_ASSET_PREFIX, COMMON_DIR, HIGH_DIR, LIGHT_DIR, MANIFEST_PATH, canonicalBytes, isArt, walk } from './manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2);
const has = (f) => ARGV.includes(f);
const flag = (f, d) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const TREE = resolve(flag('--root', ROOT));
const SOURCE_DIR = resolve(TREE, HIGH_DIR);
const TWIN_DIR = resolve(TREE, LIGHT_DIR);
const FONT_DIR = resolve(TREE, COMMON_DIR, 'assets', COMMON_ASSET_PREFIX);

const posix = (p) => p.split(/[\\/]/g).join('/');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Every high file that gets a twin: shippable art, fonts excluded (they are common ids). */
export function runtimeArt(srcDir) {
  return walk(srcDir)
    .map((abs) => ({ abs, rel: posix(relative(srcDir, abs)) }))
    .filter(({ rel }) => isArt(rel) && !rel.startsWith(COMMON_ASSET_PREFIX));
}

const canonicalText = (buf) => buf.toString('utf8').replace(/\r\n?/g, '\n');

/**
 * verify(srcDir, twinDir, { fontDir }) → { findings, checks, files, rawBytes, inlined }.
 * Pure over the directories; never throws on a bad tree, it names it.
 */
export function verify(srcDir, twinDir, { fontDir = null, budget = MOBILE_ART_INLINED_BUDGET_BYTES, policy = POLICY, listAtMost = 5 } = {}) {
  const findings = [];
  const missing = [];
  let checks = 0;
  let rawBytes = 0;
  let inlined = 0;
  const inlinedFiles = [];
  const wanted = runtimeArt(srcDir);
  const name = (rel) => `${LIGHT_DIR}/${rel}`;
  if (!wanted.length) findings.push(`no runtime art found under ${posix(relative(TREE, srcDir) || srcDir)} — nothing to twin`);
  const twins = new Set(walk(twinDir).map((abs) => posix(relative(twinDir, abs))));
  for (const { rel, abs } of wanted) {
    checks += 1;
    if (!twins.has(rel)) { missing.push(name(rel)); continue; }
    twins.delete(rel);
    const src = readFileSync(abs);
    const out = readFileSync(resolve(twinDir, rel));
    rawBytes += out.length;
    inlinedFiles.push({ buf: out, ext: extname(rel) });
    if (extname(rel).toLowerCase() === '.webp') {
      const s = webpDimensions(src);
      const t = webpDimensions(out);
      if (!s) findings.push(`source is not a WebP the policy can size: ${HIGH_DIR}/${rel}`);
      else if (!t) findings.push(`twin is not a WebP: ${name(rel)}`);
      else {
        const want = twinDimensions(s, policyFor(rel, policy));
        if (t.width !== want.width || t.height !== want.height) {
          findings.push(`twin is ${t.width}×${t.height}, the policy wants ${want.width}×${want.height} of a ${s.width}×${s.height} source: ${name(rel)}`);
        }
      }
      // Only an UNRESIZED twin is held to its source's byte count (the encoder
      // keeps the source bytes when a same-size re-encode grows).
      const resized = s && t && (t.width !== s.width || t.height !== s.height);
      if (!resized && out.length > src.length) findings.push(`twin is larger than its source (${out.length} > ${src.length} bytes): ${name(rel)}`);
    } else {
      const same = extname(rel).toLowerCase() === '.svg' ? canonicalText(src) === canonicalText(out) : src.equals(out);
      if (!same) findings.push(`twin differs from a source the policy copies verbatim: ${name(rel)}`);
    }
  }
  if (missing.length) {
    findings.push(...missing.slice(0, listAtMost).map((m) => `missing twin: ${m}`));
    if (missing.length > listAtMost) findings.push(`… and ${missing.length - listAtMost} more missing twins`);
  }
  const stray = [...twins].sort();
  findings.push(...stray.slice(0, listAtMost).map((s) => `stray file with no source under ${HIGH_DIR}/: ${name(s)}`));
  if (stray.length > listAtMost) findings.push(`… and ${stray.length - listAtMost} more stray files`);
  checks += 1;
  // The light single file inlines each distinct image once, and every font face.
  inlined += distinctInlinedBytes(inlinedFiles);
  if (fontDir) for (const abs of walk(fontDir)) inlined += inlinedBytes(statSync(abs).size);
  if (inlined > budget) findings.push(`the light tree inlines to ${inlined} bytes, over the ${budget}-byte budget — tighten tools/mobileart-policy.mjs or cut art`);
  return { findings, checks, files: wanted.length, rawBytes, inlined };
}

// ---------------------------------------------------------------------------
// Generation — the only part that needs an encoder.
// ---------------------------------------------------------------------------
const run = promisify(execFile);

async function encodeOne(srcAbs, destAbs, rel, basePolicy) {
  const policy = policyFor(rel, basePolicy);
  const src = readFileSync(srcAbs);
  mkdirSync(dirname(destAbs), { recursive: true });
  if (extname(srcAbs).toLowerCase() !== '.webp') { writeFileSync(destAbs, src); return; }
  const dims = webpDimensions(src);
  if (!dims) throw new Error(`not a WebP: ${srcAbs}`);
  const want = twinDimensions(dims, policy);
  const resized = want.width !== dims.width || want.height !== dims.height;
  // No -mt: multithreaded encoding is what could make two runs disagree, and
  // the parallelism lives across files instead (WORKERS below).
  const args = ['-quiet', '-m', '6', '-q', String(policy.quality), '-alpha_q', String(policy.alphaQuality), '-alpha_filter', 'best'];
  if (resized) args.push('-resize', String(want.width), String(want.height));
  args.push(srcAbs, '-o', destAbs);
  await run('cwebp', args);
  // A re-encode at the same size that grew is worse than the source; keep the
  // source bytes. A resized one is always taken.
  if (!resized && statSync(destAbs).size >= src.length) writeFileSync(destAbs, src);
}

/**
 * keepable(root, twinDir) → Set of rels whose committed twin was made from the
 * current high file: the manifest row names this high sha256 and this twin's.
 */
function keepable(root, wanted, twinDir) {
  const keep = new Set();
  let rows = {};
  try { rows = JSON.parse(readFileSync(resolve(root, MANIFEST_PATH), 'utf8')).assets || {}; } catch { return keep; }
  for (const { rel, abs } of wanted) {
    const row = rows[`assets/${rel}`];
    const twin = resolve(twinDir, rel);
    if (!row || !row.high || !row.light || !existsSync(twin)) continue;
    if (row.high.sha256 !== sha256(canonicalBytes(abs))) continue;
    if (row.light.sha256 !== sha256(canonicalBytes(twin))) continue;
    keep.add(rel);
  }
  return keep;
}

async function generate(srcDir, twinDir, { all = false, policy = POLICY } = {}) {
  const probe = spawnSync('cwebp', ['-version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.error('mobile-art: cwebp is not on PATH — install libwebp (apt: webp; brew: webp; https://developers.google.com/speed/webp/download) and retry.');
    console.error('mobile-art: nothing was written. --check needs no encoder and still runs.');
    process.exit(2);
  }
  console.log(`mobile-art: cwebp ${probe.stdout.trim().split('\n')[0]} — policy q${policy.quality} alpha_q${policy.alphaQuality}, ×${policy.scale} from ${policy.scaleFrom}px`);
  const wanted = runtimeArt(srcDir);
  const keep = all ? new Set() : keepable(TREE, wanted, twinDir);
  if (all) rmSync(twinDir, { recursive: true, force: true });
  else {
    // Strays: a twin with no source is removed, so the tree mirrors hd/assets/.
    const want = new Set(wanted.map((w) => w.rel));
    for (const abs of walk(twinDir)) if (!want.has(posix(relative(twinDir, abs)))) rmSync(abs);
  }
  const todo = wanted.filter((w) => !keep.has(w.rel));
  let next = 0;
  let done = 0;
  const WORKERS = 4;
  const worker = async () => {
    while (next < todo.length) {
      const item = todo[next++];
      await encodeOne(item.abs, resolve(twinDir, item.rel), item.rel, policy);
      done += 1;
      if (done % 500 === 0) console.log(`  ${done}/${todo.length}`);
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  console.log(`mobile-art: encoded ${done} twin(s), kept ${keep.size} → ${posix(relative(TREE, twinDir))}`);
}

// ---------------------------------------------------------------------------
// Selftest — the check against a fixture whose right answer is typed here.
// ---------------------------------------------------------------------------
/** A syntactically valid VP8L WebP header of the given size, padded to `bytes`. */
function fakeWebp(width, height, bytes = 64) {
  const buf = Buffer.alloc(Math.max(bytes, 30));
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8L', 12, 'ascii');
  buf.writeUInt32LE(buf.length - 20, 16);
  buf[20] = 0x2f;
  buf.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 21);
  return buf;
}

function selftest() {
  const dir = mkdtempSync(join(tmpdir(), 'mobile-art-selftest-'));
  const src = resolve(dir, 'hd');
  const twin = resolve(dir, 'light');
  const fonts = resolve(dir, 'fonts');
  const put = (base, rel, bytes) => { const p = resolve(base, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, bytes); };
  const big = twinDimensions({ width: 512, height: 512 }, POLICY);
  const backdrop = twinDimensions({ width: 1536, height: 1024 }, policyFor('environments/', POLICY));
  const good = () => {
    for (const d of [src, twin, fonts]) rmSync(d, { recursive: true, force: true });
    put(src, 'animations/x/ATK-01.webp', fakeWebp(512, 512, 4000));
    put(src, 'poses/small.webp', fakeWebp(200, 100, 900));
    put(src, 'bg/mask.svg', Buffer.from('<svg/>\r\n'));
    put(src, 'environments/wide.webp', fakeWebp(1536, 1024, 9000));
    put(src, 'equipment/components/experiment.webp', fakeWebp(512, 512, 4000)); // authoring-only: no twin wanted
    put(src, 'animations/README.md', Buffer.from('not art\n'));                 // no MIME: no twin wanted
    put(twin, 'animations/x/ATK-01.webp', fakeWebp(big.width, big.height, 800));
    put(twin, 'environments/wide.webp', fakeWebp(backdrop.width, backdrop.height, 2000));
    put(twin, 'poses/small.webp', fakeWebp(200, 100, 700));
    put(twin, 'bg/mask.svg', Buffer.from('<svg/>\n'));
    put(fonts, 'a.woff2', Buffer.alloc(300));
  };
  const plants = [
    ['control: a complete twin tree passes', () => {}, null],
    ['a twin is missing', () => rmSync(resolve(twin, 'poses/small.webp')), /missing twin: light\/assets\/poses\/small\.webp/],
    ['a twin nothing sources', () => put(twin, 'poses/ghost.webp', fakeWebp(10, 10)), /stray file .*light\/assets\/poses\/ghost\.webp/],
    ['a big source was not shrunk', () => put(twin, 'animations/x/ATK-01.webp', fakeWebp(512, 512, 800)), new RegExp(`twin is 512×512, the policy wants ${big.width}×${big.height}`)],
    ['a backdrop held to the general rule, not its override', () => put(twin, 'environments/wide.webp', fakeWebp(480, 320, 2000)), new RegExp(`twin is 480×320, the policy wants ${backdrop.width}×${backdrop.height}`)],
    ['a small source was shrunk anyway', () => put(twin, 'poses/small.webp', fakeWebp(100, 50, 700)), /twin is 100×50, the policy wants 200×100/],
    ['a twin grew past its source', () => put(twin, 'poses/small.webp', fakeWebp(200, 100, 901)), /larger than its source \(901 > 900 bytes\)/],
    ['a verbatim copy that is not verbatim', () => put(twin, 'bg/mask.svg', Buffer.from('<svg id="x"/>\n')), /differs from a source the policy copies verbatim/],
    ['a twin that is not a WebP', () => put(twin, 'poses/small.webp', Buffer.from('not a webp at all, but long enough to read')), /twin is not a WebP/],
    ['the tree is over budget', () => {}, /over the 1000-byte budget/, { budget: 1000 }],
    ['the fonts count toward the budget', () => put(fonts, 'b.woff2', Buffer.alloc(20000)), /over the 20000-byte budget/, { budget: 20000 }],
    ['an empty source tree', () => rmSync(src, { recursive: true, force: true }), /no runtime art found/],
  ];
  let bad = 0;
  let caught = 0;
  for (const [label, plant, want, opts] of plants) {
    good();
    plant();
    const r = verify(src, twin, { fontDir: fonts, ...opts });
    const ok = want ? r.findings.some((f) => want.test(f)) : r.findings.length === 0;
    if (ok && want) caught += 1;
    console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${ok ? '' : `\n         findings: ${r.findings.join(' | ') || '(none)'}`}`);
    if (!ok) bad += 1;
  }
  rmSync(dir, { recursive: true, force: true });
  if (bad) {
    console.error(`mobile-art --selftest: ${bad} case(s) landed on the wrong verdict`);
    process.exit(1);
  }
  console.log('  (plus 1 control: a complete twin tree passes)');
  console.log(`mobile-art --selftest: OK — ${caught} known-bads, ${caught} caught`);
}

function boundary() {
  console.log('BOUNDARY: this proves the light tree MIRRORS the runtime art at the policy\'s');
  console.log('          sizes and fits the art budget. It does not look at a pixel, so a');
  console.log('          twin that is the right size and the wrong picture passes.');
}

if (has('--selftest')) {
  selftest();
} else if (has('--check')) {
  const r = verify(SOURCE_DIR, TWIN_DIR, { fontDir: FONT_DIR });
  for (const f of r.findings) console.log(`  FAIL  ${f}`);
  if (r.findings.length) {
    console.error(`mobile-art --check: FAILED — ${r.findings.length} finding(s) across ${r.files} runtime assets.`);
    console.error('  Fix: node tools/mobile-art.mjs   (brings light/assets/ up to date with cwebp on PATH)');
    boundary();
    process.exit(1);
  }
  console.log(`  ${r.files} twins, ${r.rawBytes} bytes raw, inlining (with the fonts) to ${r.inlined} of the ${MOBILE_ART_INLINED_BUDGET_BYTES}-byte budget`);
  console.log(`mobile-art --check: OK — ${r.checks} checks passed.`);
  boundary();
} else {
  const out = flag('--out', null);
  if (out && !has('--all')) { console.error('mobile-art: --out needs --all (it writes a whole tree elsewhere)'); process.exit(2); }
  const twinDir = out ? resolve(out) : TWIN_DIR;
  await generate(SOURCE_DIR, twinDir, { all: has('--all') });
  const r = verify(SOURCE_DIR, twinDir, { fontDir: FONT_DIR });
  for (const f of r.findings) console.log(`  FAIL  ${f}`);
  if (r.findings.length) {
    console.error(`mobile-art: generated, but the tree does not pass its own check — ${r.findings.length} finding(s).`);
    process.exit(1);
  }
  console.log(`mobile-art: OK — ${r.files} twins, ${r.rawBytes} bytes raw, inlines to ${r.inlined} of ${MOBILE_ART_INLINED_BUDGET_BYTES}`);
  if (!out) console.log('mobile-art: next, node tools/manifest.mjs --write');
  boundary();
}
