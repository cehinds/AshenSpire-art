// tools/game.mjs — where an AshenSpire checkout is, for the authoring tools
// that still read the game's own content.
//
// Two authoring tools moved here from cehinds/AshenSpire read game data they
// do not own: the score (art/music/score/_motifs.mjs) keeps the game's tempo,
// key and walk by reading src/content/music.js, and tools/map-detail-build.mjs
// reads the tile policy in src/content/mapPresentation.js. That data stays in
// the game, so these tools read it from a checkout rather than from a copy that
// could drift (AshenSpire docs/ART-REPO-PLAN.md: "a path setting").
//
//   ASHENSPIRE_DIR=/path/to/AshenSpire   the checkout (default: ../AshenSpire,
//                                        beside this repository)
//
// Only these authoring tools need it. Packing, the light tier and CI do not.

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The AshenSpire checkout these tools read, or an error saying how to name it. */
export function gameDir() {
  const dir = resolve(process.env.ASHENSPIRE_DIR || resolve(ROOT, '..', 'AshenSpire'));
  if (!existsSync(resolve(dir, 'src/content/music.js'))) {
    throw new Error(`no AshenSpire checkout at ${dir}: set ASHENSPIRE_DIR to one (this tool reads the game's own content from it)`);
  }
  return dir;
}

/** A file: URL for a module in the checkout, for `await import(...)`. */
export function gameModule(rel) {
  return pathToFileURL(resolve(gameDir(), rel)).href;
}
