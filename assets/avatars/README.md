# Pundit avatar library

This static library contains 32 football-symbol avatars and 26 uppercase letter avatars.

## Deliverables

- `masters/symbols/`: 1024×1024 transparent PNG symbol masters.
- `masters/letters/`: editable SVG and 1024×1024 transparent PNG letter masters.
- `app/`: normalized 256×256 transparent PNG exports.
- `previews/avatar-library-contact-sheet.png`: labelled review sheet for the complete collection.
- `previews/symbol-size-check.png`: native 24px, 36px, 64px and 100px legibility check.
- `manifest.json`: stable asset IDs, labels, dimensions and paths.
- `PROMPTS.md`: source art direction and per-symbol generation briefs.

Runtime identity uses the stable IDs in `shared/avatarCatalog.ts`; Expo bundles
the 256px files through the explicit static map in `app/constants/avatarAssets.ts`.
Keep those two files aligned with `manifest.json` whenever the library changes.

All avatars use a 940px circular artwork area on a 1024px master canvas. Pixels outside the circle are transparent. The letter backgrounds rotate through eight fixed pastel tints derived from Pundit's green, terracotta, orange, brown, tan and cream palette, and use the project's Gotham Black font.

The football illustrations are generic. They intentionally exclude club badges, sponsor marks, manufacturer marks, competition branding, recognisable replica kits and real-player likenesses.

## Rebuild

The symbol-generation outputs first need their flat magenta outer background removed using the installed image-generation chroma-key helper. Pass the resulting directory to:

```sh
python3 scripts/build-avatar-library.py --symbol-source-dir /path/to/transparent-symbol-sources
```

The script normalizes the symbol circles, rebuilds the letter collection, writes both PNG sizes, refreshes the manifest and recreates both review sheets.
