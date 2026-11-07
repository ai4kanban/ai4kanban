# The tooling, shown working

Each film is HyperFrames demonstrating one of its own features.
Classification: [HyperFrames examples](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/examples.mdx?plain=1#L41-L43).

## variables-launch

One composition rendered as many versions. 43.6s, 1920×1080, white and text-led.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/examples.mdx?plain=1#L62-L65).

- **Sequence**: "the perfect [launch/explainer/…] video" on a split-flap word dial → a 9:16 glass card plays an ad → "What if you could test variations…" → three cards whose code values swap, then play their variants → "Now a template." with the attribute typed on → a 3×3 video grid fans out → "Render on AWS at scale" with 50 progress rows → "Scale your best work." and the logo.
- **Motion**: a 3D split-flap dial (rotateX ±55° with a click per flip); a gradient sweeping through text; code values swapping into video; a staggered grid fan-out; words rising through a clip-path mask; count-up percentages over a scrolling list; blur slides and zoom-through between scenes.
- **Pacing**: 3–6s scenes with 0.3–0.5s holds; the variants scene runs 10.5s. No music or voiceover, so the animation sets the tempo.
- **Use for**: a minimal feature launch that proves itself with UI and code.
- **Source**: [`variables-launch/`](https://github.com/heygen-com/hyperframes-launches/tree/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/variables-launch) — [`scene-01.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/variables-launch/compositions/scene-01.html) (dial), [`scene-04.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/variables-launch/compositions/scene-04.html) (value swap), [`scene-06.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/variables-launch/compositions/scene-06.html) (grid), [`scene-08.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/variables-launch/compositions/scene-08.html) (render list). `HANDOFF-HOOK-VARIANTS.md` describes another project; trust the code.
- **Preview**: [Watch](https://hyperframes.dev/viewer/6387d7c2-3819-4e60-916c-e346a3598b67)
- **Shared**: count-up with [spacex-launch](product-launch-films.md#spacex-launch); blur zoom-through with [texture-launch-video](motion-sound-effects.md#texture-launch-video).
