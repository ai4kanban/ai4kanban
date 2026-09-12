# Runs scene art

- **Office**: `office-eight-desks.png` includes eight desks and a two-seat sofa in one background.
- **Robot**: `bot-actions.png` is an RGBA atlas; `bot-actions.json` supplies registered source rectangles for `type`, `walk-left`, `walk-right`, and `sit`, four frames each.
- **Display**: render the 300 px frames at 85.5 px inside a 96 px cell with nearest-neighbor sampling; their ground line is source y=285. The mockups offset the texture by (5.25, 8.775) px. Do not slice the sheet as an equal grid.
- **Identity**: overlay role names and harness logos in dark ink. All roles share the rear-facing work sheet; `public/agent-art/` remains the canonical role family. Green belongs only to the eyes inside the cream face, never to ear lights.
- **Proportions**: derive poses from the actual `agent-art/base.png` and `builder.png` images: solid black arms, shaped hands, small feet and the original softer raster shading. Preserve the original body proportions; hands are not lines.
- **Playback**: loop typing/walking independently; hold one seated frame after completion. Freeze motion for reduced-motion settings.
- **Reuse**: these are the textures embedded in task 399's mockups. Carry this directory into the implementation checkout; no regeneration is required for these four actions.

Generated with the built-in imagegen tool from this project's existing workshop and robot references.
