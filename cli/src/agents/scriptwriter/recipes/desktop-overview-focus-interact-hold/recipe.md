# Desktop overview → focus → interact → hold

Compose desktop overview, focus, interaction and hold in the order the shot needs. The title
names one example, not a required sequence. Repeat or interleave actions and camera moves,
interact before focusing, or return to overview without choosing a different recipe.

A shot that uses this recipe fills all six fields below for the actual product; a shot that
does not — a title card, a typographic animation — is untouched by them. Write one ordered
sequence aligning camera moves, actions, visible wait conditions and holds. Preserve the
requested action order; a submission includes its visible result. Example text, coordinates,
timing and submission state are not defaults.

- **Starting view**: layout, page and initial state; desktop unless demonstrating mobile.
- **Framing**: deliberate full-bleed crop; output aspect ratio never changes responsive layout.
- **Camera**: opening pose and each move's target, start, duration, landing crop and return. Crop
  and scale the picture, never narrow the browser. See adjacent `demo.tsx` for tested motion.
- **Actions**: every click, exact typed text and scroll result in order, with a visible pointer.
- **Pacing**: visible wait conditions and time to see, follow and read; never skip intermediate
  steps to meet a length limit.
- **Ending state**: final frame, readable hold and whether the action is submitted.

## Verified demos

Both clips come from this prompt as it now stands (prompt v3), rendered from a project the
generator below wrote. Verification v2 came from an earlier prompt and is history only.
Build: HyperFrames 0.8.55, GSAP 3.14.2.

### v3 — one push-in, ending unsubmitted

- **Video**: https://cdn.ai4kanban.dev/video-recipes/desktop-overview-focus-interact-hold-v3.mp4
- **Input**: `05-type-request.mp4`, a 1920×1080, 10.57s desktop capture of a card chat. It types
  "Also support keyboard playback controls." and never submits. Silent: the source has no audio.
- **Camera**: overview until 3s, then 0.4s of `power2.inOut` to scale 1.8, x −1536, y −864, held
  to the end. No `shot.json` — this is the generator's default.
- **Project**: `output/946-recipe-v3/`.

### v4 — reordered, two moves, submitted

- **Video**: https://cdn.ai4kanban.dev/video-recipes/desktop-overview-focus-interact-hold-v4.mp4
- **Input**: `capture.mp4`, a 1920×1080, 13.6s capture of an unrelated desktop support app —
  overview, open a ticket, focus the composer, type a reply, send it, the posted reply and its
  status line appear, hold.
- **Camera**: a `shot.json` with two moves — 3.5s, 0.4s to scale 1.5, x −960, y −345; then 10.8s,
  0.5s back to overview so the result is readable.
- **Project**: `output/946-recipe-v4/`, with the app and the capture script it was recorded from.

**Limits**: every coordinate above belongs to its own capture — recalculate for another layout.
Capture enough resolution for the final zoom: a 1080p source enlarges pixels at 1.8×. Neither
source is bundled.

## Running the generator

`demo.tsx` generates the HyperFrames HTML these clips were rendered from. It is a Node
generator, not a React/Remotion component; HyperFrames owns media playback. Save it as
`demo.mjs` (it contains plain JavaScript) and run it with Node.js and npm available — no
checkout and no esbuild:

```sh
node demo.mjs capture.mp4 demo-project
cd demo-project
npm run check
npm run render -- --workers 1 --quality looks --output demo.mp4
```

The generator writes the project configuration and copies the capture in under its own name.
Let HyperFrames discover the browser, or set `HYPERFRAMES_BROWSER_PATH` to an installed
compatible browser on your host.

An optional third argument, `shot.json`, supplies `width`, `height`, `duration` and a `moves`
array. Each move supplies `start`, `duration`, `scale`, `x` and `y`; times are in seconds,
positions are pixels from the top-left. Moves are ordered and non-overlapping; gaps hold the
current crop. Return to overview with scale 1 and x/y 0. An empty array keeps the overview.
Without a configuration, the generator reproduces v3's single push-in.

Record interactions and waits in their scripted order in the source video; this generator only
moves the camera over continuous footage. It neither creates clicks nor changes their order.
Supply footage at the configured dimensions and at least the configured duration.
