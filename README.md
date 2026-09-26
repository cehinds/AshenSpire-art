# AshenSpire-art

The art for [cehinds/AshenSpire](https://github.com/cehinds/AshenSpire), kept out
of that repository so its clones and its Git LFS budget do not grow with art
(AshenSpire `docs/ART-REPO-PLAN.md`).

| path | what it is |
|---|---|
| `hd/assets/` | the full-resolution runtime art: one file per asset id, at the path the game asks for (`assets/…`) |
| `art/` | the authoring sources: reference sheets, pose studies, outfit and weapon sets, map sources, inspection pages |
| `art/equipment-components/` | the equipment reference strips (never shipped; formerly `assets/equipment/components/`) |
| `IMPORTED.json` | the AshenSpire commit the first import came from |
| `release.json` | the version the next release is packed as |
| `CREDITS.md` | AshenSpire's credits and AI disclosure at the import commit |

## Releases

Each release `hd-assets-v<N>` carries:

- `hd-assets-v<N>.zip` — `art-manifest.json` plus `assets/…`, stored uncompressed, packed deterministically;
- `hd-assets-v<N>.zip.sha256`;
- `art-manifest.json` — path, bytes and sha256 of every file.

AshenSpire pins one release (tag and zip sha256) in its own `art-manifest.json`,
and its `tools/fetch-art.mjs` downloads that zip and checks the zip's hash and
every file's hash before anything uses it. For players, unpack the zip as `hd/`
next to `AshenSpire.html`, or choose the unpacked folder in
Settings → Display → Art quality → Local high-res.

## Changing art

1. A PR here changes `hd/assets/` (and `art/` or a ship tool).
2. `pack` CI checks the pack is reproducible and every entry verifies.
3. After it merges, bump `release.json` in a PR, then the owner runs the
   **release** workflow, which publishes `hd-assets-v<N>`.
4. A PR in AshenSpire pins the new tag and hash, fetches it, and regenerates
   `assets-mobile/` from it.

```
node --test tests/*.test.mjs     # zip format and pack known-bads
node tools/pack.mjs --check      # reproducible, and every entry verifies
node tools/pack.mjs              # writes dist/hd-assets-v<N>.zip
```
