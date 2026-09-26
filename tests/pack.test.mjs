// tests/pack.test.mjs — the zip format and the release pack, with known-bads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, readZip, writeZip, extractZip } from '../tools/zip.mjs';
import { pack, verifyZip } from '../tools/pack.mjs';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const tmp = () => mkdtempSync(join(tmpdir(), 'art-pack-'));

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

// The known-good vector both repos pin (AshenSpire's tests/zip.test.mjs has the same one).
test('a two-entry zip has the pinned bytes, and reads back', () => {
  const dir = tmp();
  try {
    const out = join(dir, 'v.zip');
    writeZip(out, [{ name: 'b/two.txt', data: Buffer.from('two\n') }, { name: 'a.txt', data: Buffer.from('one\n') }]);
    const buf = readFileSync(out);
    assert.equal(sha(buf), 'dbe718937523d5bf1e635265ef5521109f596ec2e6762d8f01977032ea52c67c');
    assert.deepEqual(readZip(buf).map((e) => [e.name, e.data.toString()]), [['a.txt', 'one\n'], ['b/two.txt', 'two\n']]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('known-bad: a flipped byte fails its CRC; a path that escapes is refused', () => {
  const dir = tmp();
  try {
    const out = join(dir, 'v.zip');
    writeZip(out, [{ name: 'a.txt', data: Buffer.from('one\n') }]);
    const buf = readFileSync(out);
    buf[30 + 'a.txt'.length] ^= 0xff;
    assert.throws(() => readZip(buf), /fails its CRC/);
    assert.throws(() => writeZip(join(dir, 'w.zip'), [{ name: '../x', data: Buffer.alloc(1) }]), /refusing entry name/);
    const evil = join(dir, 'e.zip');
    writeZip(evil, [{ name: 'ok.txt', data: Buffer.from('x') }]);
    const e = readFileSync(evil);
    // Rewrite the name in both headers to escape the target, and require extract to refuse.
    const i = e.indexOf('ok.txt'); const j = e.indexOf('ok.txt', i + 1);
    e.write('../bad', i, 'latin1'); e.write('../bad', j, 'latin1');
    writeFileSync(evil, e);
    assert.throws(() => extractZip(evil, join(dir, 'out')), /refusing entry name|escapes/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

function tree() {
  const root = tmp();
  writeFileSync(join(root, 'release.json'), '{ "version": 3 }\n');
  mkdirSync(join(root, 'hd/assets/bg'), { recursive: true });
  writeFileSync(join(root, 'hd/assets/bg/a.webp'), Buffer.from('RIFF-fake-webp'));
  writeFileSync(join(root, 'hd/assets/bg/i.svg'), '<svg viewBox="0 0 2 2">\r\n</svg>\r\n');
  return root;
}

test('pack writes a reproducible zip whose every entry matches its manifest; SVGs are LF', () => {
  const root = tree();
  try {
    const a = pack(root, join(root, 'out-a'));
    const b = pack(root, join(root, 'out-b'));
    assert.equal(a.sha256, b.sha256);
    assert.match(a.zipPath, /hd-assets-v3\.zip$/);
    const zip = readFileSync(a.zipPath);
    assert.deepEqual(verifyZip(zip), []);
    const svg = readZip(zip).find((e) => e.name === 'assets/bg/i.svg').data.toString();
    assert.ok(!svg.includes('\r'), 'SVG packed with LF');
    const manifest = JSON.parse(readFileSync(a.manifestPath, 'utf8'));
    assert.equal(manifest.release, 'hd-assets-v3');
    assert.equal(manifest.count, 2);
    assert.equal(readFileSync(`${a.zipPath}.sha256`, 'utf8'), `${a.sha256}  hd-assets-v3.zip\n`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: a zip whose file disagrees with its manifest is caught', () => {
  const root = tree();
  try {
    const { zipPath } = pack(root, join(root, 'out'));
    const entries = readZip(readFileSync(zipPath));
    const swapped = entries.map((e) => (e.name === 'assets/bg/a.webp' ? { name: e.name, data: Buffer.from('other') } : e));
    const bad = join(root, 'bad.zip');
    writeZip(bad, swapped);
    assert.match(verifyZip(readFileSync(bad)).join('\n'), /assets\/bg\/a\.webp: bytes differ/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
