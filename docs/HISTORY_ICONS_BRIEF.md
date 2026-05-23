# History item icons — brief for Icons repo

Placeholders live in `src/assets/history-icons/` until final SVGs are added under `Icons/icons/<slug>/default/<slug>.svg` (see `CONVENTIONS.md` in Icons repo).

## Required assets

| Slug | Usage | Visual spec |
|------|--------|-------------|
| `source-cursor` | Cursor generations | **Official Cursor mark** (brand cube). 16×16, 1.25px stroke or solid fill, `currentColor`, no background. |
| `source-cursor-skill` | Cursor skill | Same cube + small sparkle or wand accent bottom-right. |
| `source-manual` | Manual TTS | Document / pencil, rounded rect. |
| `source-http` | HTTP API | Globe or network node. |
| `source-quick-hotkey` | Hotkey | Keyboard cap, 3 keys hint. |
| `trash` | Delete row | Bin with lid, stroke 1.25px. |
| `archive` | Archive action | Box with lid + horizontal line. |
| `info` | Token/cost tooltip | Circle + i dot. |
| `status-temp` | Session temp file | Dashed circle or clock + dot. |
| `status-archived` | Archived | Check in rounded square. |

## Style

- Viewport: `0 0 16 16`
- Stroke: `currentColor`, width `1.25`, round caps/joins
- Match existing Icons repo (`default` variant, monochrome)
- After export: import in `src/lib/icons.ts` via `@vibelife/icons/...` and remove placeholder from `src/assets/history-icons/`

## Checklist

- [ ] `source-cursor` — official asset from Cursor brand kit
- [ ] Remaining slugs copied or redrawn in Icons repo
- [ ] Update `src/lib/icons.ts` imports
- [ ] Delete replaced files from `src/assets/history-icons/`
