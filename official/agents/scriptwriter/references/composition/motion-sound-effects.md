# Motion, sound & effects

Motion is the message — kinetic type, beat-synced cuts, texture and VFX.
Classification: [HyperFrames examples](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/examples.mdx?plain=1#L72-L74).

## texture-launch-video

A kinetic-type teaser for the texture catalog. 22s, 1920×1080, silent.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/examples.mdx?plain=1#L77-L80).

- **Sequence**: "Hey did you know we added" → "TEXTURE", "MASK" and "feel" each flash through 7–9 fills → "METAL", "PAVING STONES" → a glass card reading "SHADERS" over a shader video → a domain-warp dissolve → the catalog URL → `npx hyperframes add <name>` types out.
- **Motion**: words filled with textures via `background-clip: text`, swapped every 0.105s; whip-blur cuts; a glass card pushing in from 1.45 to 0.88 as its blur clears; an fbm WebGL domain-warp dissolve with an iridescent edge.
- **Pacing**: fast and metronomic — 0.1s flashes, 0.2–0.8s holds.
- **Use for**: a short social teaser that shows off many variants of one thing.
- **Source**: [`texture-launch-video/index.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/texture-launch-video/index.html) holds every scene on one timeline.
- **Preview**: [Watch](https://hyperframes.dev/viewer/b92c24b4-5143-4bce-85ce-408be4c3c4ec)
- **Shared**: the glass-card push is the same code as [vfx-heygen-combined](#vfx-heygen-combined); blur zoom-through with [variables-launch](tooling-shown-working.md#variables-launch); the dissolve is [domain-warp-dissolve](shader-transitions.md#domain-warp-dissolve) with a stronger warp.

## vfx-heygen-combined

A shader and 3D sizzle for the VFX catalog. 26.3s, 1920×1080, silent.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/examples.mdx?plain=1#L81-L84).

- **Sequence**: the logo rises through a light-ray sweep → glass card "HTML-in canvas", "Now natively supported." → a 3D iPhone rises, a finger swipes, the screen scrolls and the phone spins → a chat screen types `npx hyperframes add iphone-canvas` and the cursor sends → "You can make this too" → an RGB-split 3D orbit with bloom → "Full catalog / available now" → a portal circle reveals the logo and URL.
- **Motion**: ray-marched light rays through a logo mask; a GLB phone whose screen is a scrolling canvas texture, under a camera push; additive RGB-split planes with bloom; a noise-edged portal mask with chromatic aberration.
- **Pacing**: 0.2–0.5s hand-offs and ~1s holds, then a slow ~9s portal reveal to close.
- **Use for**: a VFX sizzle for a feature launch that ends on a developer call to action.
- **Source**: [`vfx-heygen-combined/`](https://github.com/heygen-com/hyperframes-launches/tree/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/vfx-heygen-combined) — [`index.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/vfx-heygen-combined/index.html) (phone, RGB split, portal), [`vfx-text-cursor.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/vfx-heygen-combined/compositions/vfx-text-cursor.html) (light rays, glass card).
- **Preview**: [Watch](https://hyperframes.dev/viewer/3c3669b8-65d0-4f1f-8cdb-e608c1a58ff9)
- **Shared**: glass-card push with [texture-launch-video](#texture-launch-video); cursor with [pr-to-video-launch](workflows-integrations.md#pr-to-video-launch).
