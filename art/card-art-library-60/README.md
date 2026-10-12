# Card art authoring library

60 unassigned illustrations: Physical and Magical categories, each with Attack,
Smash, Counter, Evade, Sweep and Defend, with five color variants per type.
These are source artwork for future assignment, not new playable cards. No
card definitions, mechanics, runtime mappings or release files are changed.

The 2026-10-12 revision replaces all ten Counter images with a shield and sword
and all five Physical Sweep images with one curved sword leading its trailing arc. The other 45 illustrations
remain unchanged. Original generation records are preserved as `previousRevision`
in the fifteen revised records.

- `masters/`: 60 individual 1024 × 1536 PNG sources.
- `exports/`: 120 WebP previews, 512 × 768 and 1024 × 1536.
- `shards/`: current generation records with prompts and previous provenance.
- `manifest.json`: full roster, category counts, source and export hashes,
  encoder versions and source repository references.

All artwork was generated with OpenAI image generation under human direction.
The existing AshenSpire shield guided the simple subjects, worn materials and
restrained auras. No third-party licence is claimed or inferred. Absolute
generation paths in the records identify the generation session; the included
`masters/` paths provide the portable source files.

This library belongs under `art/` in `cehinds/AshenSpire-art`, which the repository
excludes from runtime packs. It is not placed in `hd/` or `light/`, and neither
the art manifest nor any release pin is changed. The earlier three-card pilot
is separate and is not included.

Verification checks all 60 unique source hashes, all 120 export hashes and
dimensions, all twelve groups of five, gallery filters, image enlargement,
keyboard dismissal and the mobile layout. Local commit only; no publication
or game assignment is implied.
