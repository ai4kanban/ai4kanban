# Desktop overview → focus → interact → hold

Compose desktop overview, focus, interaction and hold in the order the shot needs. The title
names one example, not a required sequence. Repeat or interleave actions and camera moves,
interact before focusing, or return to overview without choosing a different recipe.

Fill all six fields for the actual product. Write one ordered sequence aligning camera moves,
actions, visible wait conditions and holds. Preserve the requested action order; a submission
includes its visible result. Example text, coordinates, timing and submission state are not defaults.

- **Starting view**: layout, page and initial state; desktop unless demonstrating mobile.
- **Framing**: deliberate full-bleed crop; output aspect ratio never changes responsive layout.
- **Camera**: opening pose and each move’s target, start, duration, landing crop and return. Crop
  and scale the picture, never narrow the browser. See adjacent `demo.tsx` for tested motion.
- **Actions**: every click, exact typed text and scroll result in order, with a visible pointer.
- **Pacing**: visible wait conditions and time to see, follow and read; never skip intermediate steps to meet a length limit.
- **Ending state**: final frame, readable hold and whether the action is submitted.

## Verified demo

The clip below verifies the original single push-in only; reordered actions and multiple moves
require a new verification clip before this task is complete.

- **Version**: historical prompt v2; verification v2; HyperFrames 0.8.55, GSAP 3.14.2.
- **Input**: `output/946-recording-sequence-demo/05-type-request.mp4`, a 1920×1080 desktop
  capture of the card chat. Type “Also support keyboard playback controls.” and leave it
  unsubmitted. Preserve its original typing and unsubmitted ending, without trimming or retiming.
- **Camera**: hold overview until 3s; push over 0.4s with `power2.inOut` to scale 1.8,
  x −1536, y −864; hold that crop through the 10.57s ending.
- **Audio**: silent; the source has no audio stream.
- **Video**: https://cdn.ai4kanban.dev/video-recipes/desktop-overview-focus-interact-hold-v2.mp4
- **Output**: `output/946-recording-sequence-demo/recording-sequence-verification.mp4`.
- **Limits**: coordinates belong to this capture; recalculate for other layouts. Capture enough
  resolution for the final zoom: this 1080p source enlarges pixels at 1.8×.
- **Code**: `demo.tsx` generates the actual HyperFrames HTML used for verification. It is a
  Node generator, not a React/Remotion component; HyperFrames owns media playback.

Save adjacent `demo.tsx` as `demo.mjs` (it contains plain JavaScript), then run with Node.js
and npm available. No checkout or esbuild dependency is needed:

```sh
node demo.mjs capture.mp4 demo-project
cd demo-project
npm run check
npm run render -- --workers 1 --quality looks --output demo.mp4
```

The generator creates the project configuration. Let HyperFrames discover the browser, or
set `HYPERFRAMES_BROWSER_PATH` to an installed compatible browser on your host.

An optional third argument, `shot.json`, supplies `width`, `height`, `duration` and a `moves`
array. Each move supplies `start`, `duration`, `scale`, `x` and `y`; times are in seconds,
positions are pixels from the top-left. Moves are ordered and non-overlapping; gaps hold
the current crop. Return to overview with scale 1 and x/y 0. An empty array keeps the overview.
Without a configuration, the generator reproduces the historical demo's single push-in.

Record interactions and waits in their scripted order in the source video; this generator
only moves the camera over continuous footage. It neither creates clicks nor changes their
order. Supply footage at the configured dimensions and at least the configured duration.
The source capture is not bundled; recalculate framing and timing for another capture.
