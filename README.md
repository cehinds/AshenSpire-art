# AshenSpire-art

The assets for [cehinds/AshenSpire](https://github.com/cehinds/AshenSpire), kept out
of that repository so its clones and its Git LFS budget do not grow with art
(AshenSpire `docs/ART-REPO-PLAN.md` and `docs/EXTERNAL-ASSETS-PLAN.md`).

| path | what it is | pack |
|---|---|---|
| `hd/assets/` | the full-resolution runtime art: one file per asset id, at the path the game asks for (`assets/…`) | `high` |
| `light/assets/` | the light tier: one smaller twin per high file, **generated** from `hd/assets/` by `tools/mobile-art.mjs` (AshenSpire's former `assets-mobile/`) | `light` |
| `light/.twin-sources.json` | the light tier's provenance: per twin, the high file and policy it was made from. Written only by `tools/mobile-art.mjs`; `--check` fails on a twin made from another high file or policy | — |
| `common/assets/fonts/` | the 15 interface fonts (SIL OFL) | `common` |
| `common/licenses/OFL.txt` | the fonts' licence | `common` |
| `common/music/` | the rendered score: `manifest.json` and one MP3 per track | `common` |
| `common/map-detail/` | the map detail tiles, built by `tools/map-detail-build.mjs` | `common` |
| `art-manifest.json` | every id and every pack: path, bytes, sha256 (and pixel size for art). Derived by `tools/manifest.mjs`, never by hand | — |
| `art/` | the authoring sources: reference sheets, pose studies, outfit and weapon sets, map sources, inspection pages | none |
| `art/music/` | the score's source (`score/<id>.mjs`), its brief and how to render it | none |
| `art/equipment-components/` | the equipment reference strips (never shipped; formerly `assets/equipment/components/`) | none |
| `IMPORTED.json` | the AshenSpire commit the last import came from | — |
| `release.json` | the lowest version the next release may take (the release workflow uses the next unused one) | — |
| `CREDITS.md` | AshenSpire's credits and AI disclosure at the import commit | — |

## Releases

Each release `hd-assets-v<N>` carries three zips, each with its `.sha256`, the manifest and
`CREDITS.md`; its notes list the three sha256s:

```
hd-assets-v<N>.zip        high tier     art-manifest.json (its rows) + assets/…
light-assets-v<N>.zip     light tier    art-manifest.json (its rows) + assets-mobile/…
common-assets-v<N>.zip    common pack   art-manifest.json (its rows) + assets/fonts/…,
                                        licenses/OFL.txt, music/…, map-detail/…
art-manifest.json         every id, every pack (the committed file, byte for byte)
```

Every zip is stored uncompressed and packed deterministically, and holds each
file at its record's `path`. A zip's own `art-manifest.json` carries the
release manifest's header, `"pack": "<pack>"`, and that pack's rows only. The
light records keep AshenSpire's path for the light tree (`assets-mobile/…`), so
the manifest's rows are the same as AshenSpire's own `art-manifest.json` for
the same trees.

AshenSpire pins a release (tag and each zip's sha256) in its `art-release.json`,
and its `tools/fetch-art.mjs` downloads a zip and checks the zip's hash and
every file's hash before anything uses it. For players, unpack the high zip as
`hd/` next to `AshenSpire.html`, or choose the unpacked folder in
Settings → Display → Art quality → Local high-res.

## Changing art

1. A PR here changes `hd/assets/` (or `art/`, `common/` or a tool).
2. If `hd/assets/` or `tools/mobileart-policy.mjs` changed: `node tools/mobile-art.mjs`
   (needs `cwebp` from libwebp) encodes a light twin for each new or changed high
   file, and for each twin a policy change governs, keeps the rest, and updates
   `light/.twin-sources.json`. Then `node tools/manifest.mjs --write`, and commit
   them together. (Running `--write` first is harmless: `mobile-art --check`
   still fails until the twins are re-encoded.)
3. `pack` CI checks the manifest, the light tier, and that the three packs are
   reproducible and every entry verifies.
4. When it merges, the **release** workflow runs by itself and publishes
   `hd-assets-v<N>` at the next unused N. There is no bump or button to press;
   it can still be run by hand from Actions.
5. A PR in AshenSpire pins the new tag and hashes in `art-release.json`.

The score (`art/music/`, `tools/score/`) and the map tiles
(`tools/map-detail-build.mjs`) still read a little of the game's own content (its
music beds, its tile policy) from an AshenSpire checkout: set `ASHENSPIRE_DIR`, or
keep the checkout at `../AshenSpire` (`tools/game.mjs`).

The light sprite policy applies the same 5/16 raster scale and quality 35 /
alpha quality 40 to characters, enemies, poses, weapon frames and effects,
including small cropped sprites and bow frames. The game keeps animation
sequences, timing, display size and registration when it selects these twins;
reduced motion remains a separate setting. Backdrops retain their existing
policy. Keep the sprite family list in `tools/mobileart-policy.mjs` aligned
with AshenSpire's `src/ui/spriteAssets.js`.

```
node --test tests/*.test.mjs        # zip format, manifest and pack known-bads
node tools/mobile-art.mjs --selftest
node tools/manifest.mjs --check     # art-manifest.json matches the trees
node tools/mobile-art.mjs --check   # light/assets/ mirrors hd/assets/: sizes, provenance, budget
node tools/pack.mjs --check         # three reproducible zips, every entry verifies
node tools/pack.mjs                 # writes dist/{hd,light,common}-assets-v<N>.zip + art-manifest.json
node tools/import.mjs <AshenSpire>  # re-import every pack's files from a checkout
```
