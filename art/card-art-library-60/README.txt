ASHENSPIRE CARD ART LIBRARY - 60 ILLUSTRATIONS

Branch: Feature/NewCardArt
Status: Unassigned authoring library in cehinds/AshenSpire-art. Local only.

2 categories x 6 types x 5 variants = 60 distinct generated illustrations.
Categories: physical, magical.
Types: attack, smash, counter, evade, sweep, defend.

Physical variants:
01 Steel / blue
02 Bronze / amber
03 Iron / crimson
04 Copper / teal
05 Blackened steel / violet

Magical variants:
01 Frost / cyan
02 Ember / orange
03 Lightning / gold
04 Arcane / violet
05 Verdant / green

masters/ contains 60 original 1024 x 1536 PNG images.
exports/<category>/<type>/ contains two WebP sizes per illustration:
512 x 768 and 1024 x 1536. These are sizes of the same 60 designs,
not additional illustrations.

manifest.json records the exact prompt, generation source, category, type,
variant, dimensions and SHA-256 hashes for every image and export.
shards/ contains current generation records with previous provenance preserved.

Revision 2 replaces all ten Counter images with shield-and-sword subjects
and all five Physical Sweep images with one curved sword leading its trailing arc. The other 45 images
are unchanged. The revised records retain their previousRevision metadata.

The earlier sword/starstone/healing pilot remains in a separate folder and
is not counted in this collection.

These images use the existing shield artwork as their style reference.
Generated with OpenAI's built-in image-generation tool under human direction.
No third-party licence is claimed.

The game's published art pin, tracked light art and runtime card mappings
have not changed. Publishing or assigning these assets to cards is a
separate step. The gallery is an art-library preview, not a gameplay build.

Reproduce and verify exports with Node.js and Sharp 0.35.5 / WebP 1.6.0:
node export.mjs --sharp /path/to/node_modules/sharp

This library belongs in the art/ authoring directory, outside runtime packs.
No hd/, light/, runtime manifest or release files are changed.
