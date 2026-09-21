# Workflows & integrations

A PR, a Figma file, a design brief — turned into a finished film.
Classification: [HyperFrames examples](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/examples.mdx?plain=1#L95-L97).

## pr-to-video-launch

A GitHub PR turned into a video by an agent skill. 30s, 1920×1080, 30fps.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/examples.mdx?plain=1#L100-L103).

- **Sequence**: a prompt is typed and sent, and the full-screen chat shrinks into a window → a PR fast-scrolls with its size figures → "Hard to read" → "summarize this PR" scrolls a long summary → "Still too long" → "use pr-to-video…" → SHOW YOUR CODE / FEATURE / REVIEW / CONTRIBUTOR → the call to action types the prompt again.
- **Motion**: a cursor with a click ring; a full-screen to window morph; typing with a stepped caret; a motion-blurred fast scroll; a zoom-through into the PR link; feature scenes sped up 2–2.6× with `timeScale`; back.out pop-ins for cards, avatars and status labels.
- **Pacing**: a problem story in 3–5s scenes and a 0.9s punch card, then features at 2–2.6s each; 0.3s crossfades. Music, with sounds on actions.
- **Use for**: a developer tool or agent launch told as a chat story from problem to product.
- **Source**: [`pr-to-video-launch/`](https://github.com/heygen-com/hyperframes-launches/tree/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/pr-to-video-launch) — [`opener.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/pr-to-video-launch/compositions/opener.html) (cursor, morph), [`pr-scroll.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/pr-to-video-launch/compositions/pr-scroll.html) (fast scroll), [`feature-discussion.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/pr-to-video-launch/compositions/feature-discussion.html) (pop-ins).
- **Preview**: [Watch](https://hyperframes.dev/viewer/72c9b502-0c96-4bde-9a78-9a178267c475)
- **Shared**: cursor and UI morph with [spacex-launch](product-launch-films.md#spacex-launch); cursor with [vfx-heygen-combined](motion-sound-effects.md#vfx-heygen-combined).
