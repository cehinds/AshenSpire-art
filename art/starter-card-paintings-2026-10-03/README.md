# Starter card paintings

Three original paintings generated on October 3, 2026 with OpenAI's built-in image generator for AshenSpire: Starstone Pebble (Starseer), Urgent Heal (Herald), and Ambush (Rogue).

Inventory at game commit `7618f354e`: 219 card identities, four individually illustrated card IDs and three illustrated equipment profiles. These three signature starter cards used shared outline motifs. Prioritize them for visibility early in a run and representation across classes.

The briefs follow each card's authored flavor in `src/content/cards/`: the Observatory's catalogued starstone, the Furnace Chapel bandage beneath an uncovered brand, and the frozen river docks. They retain weathered painterly materials, restrained light, readable focal subjects, and no baked text or UI. No third-party artwork was downloaded and no third-party license is claimed.

`prompts.json` preserves the exact prompts and source identities. The PNG masters are unchanged generator outputs. `exports.json` records their hashes and high-tier derivative hashes.

Run `node art/starter-card-paintings-2026-10-03/export.mjs` with libwebp 1.6.0 on PATH to export 512px and 1024px-wide WebPs, preserving the 3:2 composition. Then run `node tools/mobile-art.mjs` and `node tools/manifest.mjs --write` for the light twins and manifest. The game resolves these six IDs through its existing `playingCardArtwork` mapping and `assetUrl`.
