# Runs scene art

- **Office**: `office-eight-desks.png` includes eight desks and a two-seat sofa in one background.
- **Robot**: `bot-actions.png` is an RGBA atlas; `bot-actions.json` supplies registered source rectangles for `type`, `walk-left`, `walk-right`, and `sit`, four frames each.
- **Display**: render the 300 px frames at 85.5 px inside a 96 px cell with nearest-neighbor sampling; their ground line is source y=285. The mockups offset the texture by (5.25, 8.775) px. Do not slice the sheet as an equal grid.
- **Identity**: overlay role names and harness logos in dark ink. All roles share the rear-facing work sheet; `public/agent-art/` remains the canonical role family. Green belongs only to the eyes inside the cream face, never to ear lights.
- **Proportions**: derive poses from the actual `agent-art/base.png` and `builder.png` images: solid black arms, shaped hands, small feet and the original softer raster shading. Preserve the original body proportions; hands are not lines.
- **Playback**: loop typing/walking independently; hold one seated frame after completion. Freeze motion for reduced-motion settings.
- **Reuse**: these are the textures embedded in task 399's mockups. Carry this directory into the implementation checkout; no regeneration is required for these four actions.

Generated with the built-in imagegen tool from this project's existing workshop and robot references.

## Layered office

- **Assets**: `layers/office-base.png`, `clock-face.png`, `window-{dawn,day,dusk,night}.png`, `desk-sleep.png`, and `desk-work.png` with `desk-work.json` are ready for task 678. Keep the existing office until the layered renderer replaces it.
- **Time**: device-local dawn 05:00–08:00, day 08:00–17:00, dusk 17:00–20:00, night 20:00–05:00. Start inclusive, end exclusive; no location, weather, or seasonal inputs. All four textures are 1774×887.
- **Placement**: `layers/layout.json` defines world anchors and crop limits. Bots move up 24 world pixels; role/harness sits above the head and the card ID below the feet.
- **Compositing**: scenery → background → desks → clock/hands → bots/labels. Scale each scenery to 394×197, then crop through the background’s four transparent panes. Never stretch a view to a pane.
- **Desk animation**: `desk-work.png` is a 1136×184 horizontal atlas: four 284×184 frames, 250 ms each, looping in `desk-work.json` order. `desk-sleep.png` is one 284×184 frame. All pixels outside the display match exactly.
- **Lifecycle**: play only for occupied desks; hold work frame 0 for reduced motion. Stop playback on sleep, tab hiding or dialog close; shared desks stay active while any worker remains.
- **Provenance**: built-in imagegen prompts are in `layers/prompts.json`; the clock face was rasterized from the mockup SVG, with hands drawn at runtime. Reuse `bot-actions.png` and harness SVGs; do not bake labels or clock hands into sprites.
- **Previews**: review files live in the ignored `.akb/boards/docs/kanban/mockups/678/` folder, including `previews/desk-work.gif`; production assets stay in this directory.
