# Product & launch films

A whole product cut into a launch film — its own screens, type and colour.
Classification: [HyperFrames examples](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/examples.mdx?plain=1#L14-L16).

## spacex-launch

A Grok connector demo: a SpaceX IPO question becomes a finished video. 39.5s, 1920×1080.
Classification: [card](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/examples.mdx?plain=1#L31-L34).

- **Sequence**: cursor opens the connector menu and switches HyperFrames on → the prompt is typed and a "Thinking" shimmer runs → a long answer scrolls in → a follow-up asks for a video → "Making your video…" → tasks tick off, the card becomes a player, $0.0T→$1.0T counts up with a coin burst → "HyperFrames MCP" outro on the Grok logo.
- **Motion**: a cursor with a 0.84 click press that carries across a hard cut; one box morphing its size and radius from menu to card; typing with jittered timing; a scroll whose ease makes each line fade in as it arrives; a count-up with a coin burst on golden-angle paths; blur zoom-through seams.
- **Pacing**: long 6–10s UI scenes, then 0.7–1.5s beats for the result. Music and voiceover; click and key sounds sit on the cursor actions.
- **Use for**: a screen-recording-style demo of a chat or AI product that ends on a result reveal.
- **Source**: [`spacex-launch/`](https://github.com/heygen-com/hyperframes-launches/tree/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/spacex-launch) — [`connector-morph.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/spacex-launch/compositions/connector-morph.html), [`chat-response.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/spacex-launch/compositions/chat-response.html), [`response-scroll.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/spacex-launch/compositions/response-scroll.html), [`compose-tasklist.html`](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/spacex-launch/compositions/compose-tasklist.html). Five other files in `compositions/` are unused.
- **Preview**: [Watch](https://hyperframes.dev/viewer/58d80c88-37fe-4527-a803-1b29c35373b7)
- **Shared**: cursor and UI morph with [pr-to-video-launch](workflows-integrations.md#pr-to-video-launch); count-up with [variables-launch](tooling-shown-working.md#variables-launch).
