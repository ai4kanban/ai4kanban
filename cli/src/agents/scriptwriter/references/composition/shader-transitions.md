# Shader transitions

WebGL cuts from one scene to the next — a 2s shader between two holds.
Classification: [Catalog navigation](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/docs.json#L460-L484), Transitions / Shader Transitions.

All fourteen blocks share one template; only the fragment shader, the palette and the label differ. 4s, 1920×1080, silent.

- **Sequence**: scene A holds 0–1s → the shader runs 1–3s on quadratic ease-in-out → scene B holds 3–4s. The left 1200px carries the scenes; the right 720px is a label card with the prompt.
- **Capture**: `captureScene` redraws each scene into a 2D canvas from background colours and leaf text only — images, video, borders and gradients are lost. Swap in a real frame capture before putting footage through it.
- **Adapt**: keep `renderShader` and the timeline, then paste one `progTrans` fragment; `u_progress` 0→1 is the only driver.

## domain-warp-dissolve

A two-level fbm domain warp; scene B grows in where the noise falls under the progress, with an iridescent rim.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/catalog/blocks/domain-warp-dissolve.mdx?plain=1#L17).

- **Motion**: both scenes slide in opposite directions along the warp field; a ±0.08 soft edge; a cosine-palette rim glow.
- **Use for**: an organic, liquid scene change with some shine.
- **Source**: [`domain-warp-dissolve.html`](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/registry/blocks/domain-warp-dissolve/domain-warp-dissolve.html)
- **Preview**: [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/domain-warp-dissolve.mp4)
- **Shared**: the same shader, with 0.72 warp instead of 0.4, is the dissolve in [texture-launch-video](motion-sound-effects.md#texture-launch-video); the noise-threshold edge with [ridged-burn](#ridged-burn).

## ridged-burn

Scene A burns away along lightning-like cracks.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/catalog/blocks/ridged-burn.mdx?plain=1#L17).

- **Motion**: a ridged fbm threshold with a hard ±0.04 edge; the edge ramps dark red → orange → yellow → white; ember sparks from high-frequency noise. Neither scene moves.
- **Use for**: an aggressive, fiery reveal between dark scenes.
- **Source**: [`ridged-burn.html`](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/registry/blocks/ridged-burn/ridged-burn.html)
- **Preview**: [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/ridged-burn.mp4)
- **Shared**: the noise-threshold edge with [domain-warp-dissolve](#domain-warp-dissolve).

## sdf-iris

A circle opens from the centre to reveal scene B.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/catalog/blocks/sdf-iris.mdx?plain=1#L17).

- **Motion**: an aspect-corrected circle whose radius grows to 1.2; a crisp edge trailed by three warm glow rings that peak mid-transition.
- **Use for**: a clean, focal reveal — a product or a title in the centre.
- **Source**: [`sdf-iris.html`](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/registry/blocks/sdf-iris/sdf-iris.html)
- **Preview**: [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/sdf-iris.mp4)

## whip-pan

A fast camera pan: both scenes slide left under horizontal motion blur.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/catalog/blocks/whip-pan.mdx?plain=1#L17).

- **Motion**: scene A exits 1.5 widths left while scene B enters from the right; 10 blur samples along the move; a straight crossfade.
- **Use for**: a quick, energetic cut between two sides of a comparison or story beats.
- **Source**: [`whip-pan.html`](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/registry/blocks/whip-pan/whip-pan.html)
- **Preview**: [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/whip-pan.mp4)
- **Shared**: the multi-sample blur with [cinematic-zoom](#cinematic-zoom), which blurs radially instead.

## cinematic-zoom

Scene A zoom-blurs outward while scene B zooms in from tight.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/catalog/blocks/cinematic-zoom.mdx?plain=1#L17).

- **Motion**: a 12-sample radial blur, with red, green and blue at slightly different strengths for a colour fringe; a straight crossfade.
- **Use for**: pushing into a new scene — a trailer beat or a jump in scale.
- **Source**: [`cinematic-zoom.html`](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/registry/blocks/cinematic-zoom/cinematic-zoom.html)
- **Preview**: [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/cinematic-zoom.mp4)
- **Shared**: multi-sample blur with [whip-pan](#whip-pan); per-channel offset with [chromatic-radial-split](#chromatic-radial-split).

## chromatic-radial-split

RGB channels split outward from the centre on scene A and converge on scene B.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/catalog/blocks/chromatic-radial-split.mdx?plain=1#L17).

- **Motion**: red and blue sampled at opposite radial offsets up to 6%, green left in place; a straight crossfade. No blur, so it stays sharp.
- **Use for**: a subtle tech or lens-flavoured cut that keeps text readable.
- **Source**: [`chromatic-radial-split.html`](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/registry/blocks/chromatic-radial-split/chromatic-radial-split.html)
- **Preview**: [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/chromatic-radial-split.mp4)
- **Shared**: channel split with [glitch](#glitch), [gravitational-lens](#gravitational-lens) and [cinematic-zoom](#cinematic-zoom).

## glitch

Scene A breaks up into digital artefacts, then scene B fades in.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/catalog/blocks/glitch.mdx?plain=1#L17).

- **Motion**: intensity peaks mid-transition; 60 scan-line bands jitter sideways; 12×8 blocks scramble; horizontal RGB split; brightness flicker; posterisation down to 8 levels. The random seeds step 11–23 times over the 2s, so it stutters rather than flows.
- **Use for**: a broken-signal, hacker or error beat.
- **Source**: [`glitch.html`](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/registry/blocks/glitch/glitch.html)
- **Preview**: [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/glitch.mp4)
- **Shared**: channel split with [chromatic-radial-split](#chromatic-radial-split).

## gravitational-lens

Scene A is pulled into a gravity well, then scene B fades in over it.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/catalog/blocks/gravitational-lens.mdx?plain=1#L17).

- **Motion**: a 1/distance pull toward the centre; red and blue lensed apart near the core; a dark core that shrinks as the pull grows; scene B fades in from 30% progress.
- **Use for**: a dramatic "everything collapses" beat, space or sci-fi themes.
- **Source**: [`gravitational-lens.html`](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/registry/blocks/gravitational-lens/gravitational-lens.html)
- **Preview**: [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/gravitational-lens.mp4)
- **Shared**: channel split with [chromatic-radial-split](#chromatic-radial-split).

## flash-through-white

Scene A brightens to white, and scene B comes back out of it.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/catalog/blocks/flash-through-white.mdx?plain=1#L17).

- **Motion**: A reaches white by 45% progress, B leaves white from 50%, and the two cross over 35–65%. No distortion.
- **Use for**: a dip between dark scenes, where a dip to black would not show.
- **Source**: [`flash-through-white.html`](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/registry/blocks/flash-through-white/flash-through-white.html)
- **Preview**: [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/flash-through-white.mp4)
- **Shared**: an overexposed hand-off like [light-leak](#light-leak), without the colour.

## light-leak

A warm film light leak floods scene A from the top-right, then gives way to scene B.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/catalog/blocks/light-leak.mdx?plain=1#L17).

- **Motion**: exponential falloff from a light source off-frame; orange-to-cream colour; a diagonal flare streak; ACES tone mapping keeps the overexposure from clipping; B crosses in over 15–85%.
- **Use for**: a warm, analogue or nostalgic cut.
- **Source**: [`light-leak.html`](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/registry/blocks/light-leak/light-leak.html)
- **Preview**: [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/light-leak.mp4)
- **Shared**: an overexposed hand-off like [flash-through-white](#flash-through-white).
