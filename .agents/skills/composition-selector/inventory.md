# Composition inventory

Work list for growing the selection index: every renderable composition in the two source repos, with its status. Built from metadata only. For maintainers of this repository; it is not distributed with the agent.

- **hyperframes**: [`0641921558eadcee0a026fa6db39e3e9e5b76f62`](https://github.com/heygen-com/hyperframes/tree/0641921558eadcee0a026fa6db39e3e9e5b76f62)
- **hyperframes-launches**: [`6259ea7aa45042fa6ebf941538cf7621cf6dad0f`](https://github.com/heygen-com/hyperframes-launches/tree/6259ea7aa45042fa6ebf941538cf7621cf6dad0f)
- **SHA**: first 12 characters of the git tree SHA for a directory row, blob SHA for a file row. Fetch a newer tree with `gh api repos/heygen-com/<repo>/git/trees/<sha>?recursive=1`; a changed SHA is a changed row, a missing path a new one.
- **Row**: a directory holding `index.html` or `registry-item.json`, or one file where a directory lays out several standalone HTML files. The HTML inside a row's directory belongs to that row.
- **Status**: `documented` (in the index), `pending`, `duplicate` (the note names the row it repeats), `excluded` (the note gives the reason).
- **Complexity**: launch projects and registry examples with a `compositions/` folder are complex; the rest are simple.
- **Group**: launches take their [examples page](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/examples.mdx?plain=1#L10) group, blocks and components their [Catalog navigation](https://github.com/heygen-com/hyperframes/blob/0641921558eadcee0a026fa6db39e3e9e5b76f62/docs/docs.json) `group / subgroup`; everything else is Uncategorized.
- **Preview**: the `preview.video` of `registry-item.json`, or the launches README video link; blank when neither has one.

## Launches

`heygen-com/hyperframes-launches`.

| Path | SHA | Complexity | Status | Note | Group | Preview |
| --- | --- | --- | --- | --- | --- | --- |
| `HF-heygen-stripe/` | `c03789dfcbd5` | complex | pending |  | Product & launch films | [Watch](https://hyperframes.dev/viewer/d6f7d40f-1e32-4b73-a551-af47cc19e8a2) |
| `claude-design-send-hyperframes-launch/` | `7ed32a15e379` | complex | pending | likely the examples page's *Claude Design* card, but its poster slug `claude-design-hyperframes-video` names no directory | Uncategorized |  |
| `claude-paper-launch/` | `859e81bf7ea2` | complex | pending |  | Uncategorized | [Watch](https://hyperframes.dev/viewer/659498ab-d77e-48a8-a719-dd97adbbd3e5) |
| `cloud-render-launch/` | `65cee7ed2121` | complex | pending |  | The tooling, shown working | [Watch](https://hyperframes.dev/viewer/4259dc01-157a-4966-9c58-4e97faa2548e) |
| `codex-five-hour-limit-replica/` | `6d7cf59a687f` | complex | pending |  | Uncategorized | [Watch](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/codex-five-hour-limit-replica/codex-five-hour-limit-replica.mp4) |
| `figma-launch/` | `fb39ca1f0dfc` | complex | pending |  | Workflows & integrations | [Watch](https://hyperframes.dev/viewer/58fdce81-6ef0-4860-899d-d6b3da692a54) |
| `frame-md-launch-storyboard/` | `63dcb88bf364` | complex | pending |  | Workflows & integrations | [Watch](https://hyperframes.dev/viewer/c5198458-4eaa-4933-a4e8-029c8010a845) |
| `heygen-apple-motion/01-ui-sting/` | `dedd6529e04c` | complex | pending |  | Uncategorized |  |
| `heygen-apple-motion/02-bouncy-ui/` | `f8ace6976a7a` | complex | pending |  | Uncategorized |  |
| `heygen-apple-motion/03-message-sting/` | `e0ee0683b3fe` | complex | pending |  | Uncategorized |  |
| `heygen-apple-motion/04-generate-reel/` | `827548a0c0c1` | complex | pending |  | Uncategorized |  |
| `heygen-apple-motion/examples/instagram/` | `9823d70d135b` | complex | duplicate | rebrand of `heygen-apple-motion/01-ui-sting` (meta.json `*-ui-sting`; README: re-brandable templates) | Uncategorized |  |
| `heygen-apple-motion/examples/spotify/` | `17c9280367cd` | complex | duplicate | rebrand of `heygen-apple-motion/01-ui-sting` (meta.json `*-ui-sting`; README: re-brandable templates) | Uncategorized |  |
| `heygen-apple-motion/hero/` | `680b38809917` | complex | pending |  | Uncategorized |  |
| `hyperframes-launch/` | `0328ebbad7e0` | complex | pending |  | Product & launch films | [Watch](https://hyperframes.dev/viewer/9ab8d480-7507-4905-9222-ae6ea4b2fb5a) |
| `inspector-launch/` | `1f91be4d0dd0` | complex | pending |  | The tooling, shown working | [Watch](https://hyperframes.dev/viewer/87889a4c-cc67-4e4a-b576-b57dd892fee3) |
| `k3-promo/` | `333d1ad2d39a` | complex | pending |  | Product & launch films | [Watch](https://github.com/heygen-com/hyperframes-launches/blob/6259ea7aa45042fa6ebf941538cf7621cf6dad0f/k3-promo/k3-promo.mp4) |
| `liquid-brand-refraction/` | `f937ef50c549` | complex | pending |  | Uncategorized |  |
| `pr-to-video-launch/` | `2e047714ef6d` | complex | documented |  | Workflows & integrations | [Watch](https://hyperframes.dev/viewer/72c9b502-0c96-4bde-9a78-9a178267c475) |
| `sfx-music-launch/` | `049c891b8ff3` | complex | pending |  | Motion, sound & effects | [Watch](https://hyperframes.dev/viewer/1adcf040-9df5-46b9-ab56-8e33795b5f84) |
| `spacex-launch/` | `6c65d9ab8af0` | complex | documented |  | Product & launch films | [Watch](https://hyperframes.dev/viewer/58d80c88-37fe-4527-a803-1b29c35373b7) |
| `texture-launch-video/` | `efe00242dc03` | complex | documented |  | Motion, sound & effects | [Watch](https://hyperframes.dev/viewer/b92c24b4-5143-4bce-85ce-408be4c3c4ec) |
| `timeline-launch/` | `ecbcdc16ea0b` | complex | pending |  | The tooling, shown working | [Watch](https://hyperframes.dev/viewer/105200be-ebda-4209-a225-a2edf01cf1b7) |
| `variables-launch/` | `95e4d2c6148d` | complex | documented |  | The tooling, shown working | [Watch](https://hyperframes.dev/viewer/6387d7c2-3819-4e60-916c-e346a3598b67) |
| `vfx-heygen-combined/` | `1a59636c349a` | complex | documented |  | Motion, sound & effects | [Watch](https://hyperframes.dev/viewer/3c3669b8-65d0-4f1f-8cdb-e608c1a58ff9) |
| `website-to-hyperframes/` | `530bd83e002f` | complex | pending |  | Product & launch films | [Watch](https://hyperframes.dev/viewer/85d2d8d5-bf5b-4d04-901d-7c3ae157a30a) |

## Registry examples

`heygen-com/hyperframes`, `registry/examples/`. Four have no `registry-item.json` and are missing from `registry.json`.

| Path | SHA | Complexity | Status | Note | Group | Preview |
| --- | --- | --- | --- | --- | --- | --- |
| `registry/examples/airbnb-deck/` | `d854fa2e2ad5` | simple | pending | not in `registry.json`; no `registry-item.json` | Uncategorized |  |
| `registry/examples/decision-tree/` | `4f553485d53f` | complex | pending |  | Uncategorized |  |
| `registry/examples/kinetic-type/` | `a157252e6471` | complex | pending |  | Uncategorized |  |
| `registry/examples/motion-blur/` | `f048d49ec941` | simple | pending | not in `registry.json`; no `registry-item.json` | Uncategorized |  |
| `registry/examples/nyt-graph/` | `c4af2b3c6470` | complex | pending |  | Uncategorized |  |
| `registry/examples/play-mode/` | `329c7320b949` | complex | pending |  | Uncategorized |  |
| `registry/examples/product-promo/` | `e73dd28c7441` | complex | pending |  | Uncategorized |  |
| `registry/examples/slideshow-demo/` | `df71c2251764` | simple | pending | not in `registry.json`; no `registry-item.json` | Uncategorized |  |
| `registry/examples/startup-pitch/` | `653aea42dca6` | simple | pending | not in `registry.json`; no `registry-item.json` | Uncategorized |  |
| `registry/examples/swiss-grid/` | `b2119e959dce` | complex | pending |  | Uncategorized |  |
| `registry/examples/vignelli/` | `99284558b47b` | complex | pending |  | Uncategorized |  |
| `registry/examples/vscode-theme-visualizer/` | `f7b037d3c1f6` | simple | pending |  | Uncategorized |  |
| `registry/examples/warm-grain/` | `19f542475947` | complex | pending |  | Uncategorized |  |

## Blocks

`heygen-com/hyperframes`, `registry/blocks/`.

| Path | SHA | Complexity | Status | Note | Group | Preview |
| --- | --- | --- | --- | --- | --- | --- |
| `registry/blocks/ai-chat-reveal/` | `4b559698e7d4` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/app-showcase/` | `51f65b5ded0c` | simple | pending |  | Scenes & demos / Showcases | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/app-showcase.mp4) |
| `registry/blocks/apple-money-count/` | `c681266621ca` | simple | pending |  | Scenes & demos / Showcases | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/apple-money-count.mp4) |
| `registry/blocks/bar-chart-race/` | `67013810a750` | simple | pending |  | Data & charts / Data |  |
| `registry/blocks/beat-freeze-cut/` | `c0e11ad2850c` | simple | pending |  | Transitions / CSS Transitions |  |
| `registry/blocks/blue-sweater-intro-video/` | `e8a90f381b6d` | simple | pending |  | Scenes & demos / Showcases | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/blue-sweater-intro-video.mp4) |
| `registry/blocks/camcorder-hud/` | `6cada3916c26` | simple | pending |  | Motion & effects / Camera & 3D | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/camcorder-hud.mp4) |
| `registry/blocks/camera-dolly-zoom/` | `61b10f36e690` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/canopy-part-title/` | `d723c3d1ab30` | simple | pending |  | 3D motion | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/canopy-part-title.mp4) |
| `registry/blocks/carousel-circle-1/` | `6f208278ca44` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-circle-2/` | `adc28f391cfa` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-circle-3/` | `842aabe487d5` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-circle-4/` | `673250a3efeb` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-circle-5/` | `242fab540766` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-orbit-1/` | `3552bce634d4` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-orbit-2/` | `05633470c190` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-orbit-3/` | `30bfcc4ab421` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-orbit-4/` | `5eba0091147c` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-orbit-5/` | `b505c8ddb565` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-path-1/` | `a7cb19ac5de0` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-path-2/` | `eaae3a5a92bb` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-path-3/` | `62888ed2e135` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-path-4/` | `824e4229c9da` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-path-5/` | `e9ebe6c53d68` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-text-circle-1/` | `168ab690fa24` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-text-circle-2/` | `0b389459bc67` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-text-circle-3/` | `0ab7347f4c79` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-text-circle-4/` | `e31ea91e98c6` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-text-circle-5/` | `d5a6c0b0ab60` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-vision-1/` | `48a7ebbcbfa6` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-vision-2/` | `e09321d8386b` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-vision-3/` | `2a652c95c66e` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-vision-4/` | `a2751d5c8da8` | simple | pending |  | Carousels |  |
| `registry/blocks/carousel-vision-5/` | `752e371eb822` | simple | pending |  | Carousels |  |
| `registry/blocks/chatgpt-exchange/` | `d0e90701404a` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/chromatic-radial-split/` | `1cb7cc65a9f2` | simple | documented |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/chromatic-radial-split.mp4) |
| `registry/blocks/cinematic-zoom/` | `698319b00fa2` | simple | documented |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/cinematic-zoom.mp4) |
| `registry/blocks/claude-exchange/` | `55e19d622b4c` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/code-3d-extrude/` | `1f09413c5475` | simple | pending |  | Code / Code Animations | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-3d-extrude.mp4) |
| `registry/blocks/code-diff/` | `dad0069595f0` | simple | pending |  | Code / Code Animations | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-diff.mp4) |
| `registry/blocks/code-highlight/` | `29dc63d08a1f` | simple | pending |  | Code / Code Animations | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-highlight.mp4) |
| `registry/blocks/code-morph/` | `381837092083` | simple | pending |  | Code / Code Animations | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-morph.mp4) |
| `registry/blocks/code-particle-assemble/` | `022827671998` | simple | pending |  | Code / Code Animations | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-particle-assemble.mp4) |
| `registry/blocks/code-scroll/` | `9375fbdc5690` | simple | pending |  | Code / Code Animations | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-scroll.mp4) |
| `registry/blocks/code-shader-dissolve/` | `fc9029ddecac` | simple | pending |  | Code / Code Animations | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-shader-dissolve.mp4) |
| `registry/blocks/code-slice-hero/` | `199f32eba460` | simple | pending |  | 3D motion | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-slice-hero.mp4) |
| `registry/blocks/code-snippet-apple-terminal-basic/` | `3184af598d75` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-basic.mp4) |
| `registry/blocks/code-snippet-apple-terminal-clear-dark/` | `5fe3214b35f6` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-clear-dark.mp4) |
| `registry/blocks/code-snippet-apple-terminal-clear-light/` | `2dadaeb108e5` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-clear-light.mp4) |
| `registry/blocks/code-snippet-apple-terminal-grass/` | `d1266f61a715` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-grass.mp4) |
| `registry/blocks/code-snippet-apple-terminal-homebrew/` | `20d805492f9e` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-homebrew.mp4) |
| `registry/blocks/code-snippet-apple-terminal-man-page/` | `ce97fc5d1e42` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-man-page.mp4) |
| `registry/blocks/code-snippet-apple-terminal-novel/` | `36028a7cee26` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-novel.mp4) |
| `registry/blocks/code-snippet-apple-terminal-ocean/` | `2afe416b04a8` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-ocean.mp4) |
| `registry/blocks/code-snippet-apple-terminal-pro/` | `fb1f5a91c908` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-pro.mp4) |
| `registry/blocks/code-snippet-apple-terminal-red-sands/` | `dcd84a033a26` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-red-sands.mp4) |
| `registry/blocks/code-snippet-apple-terminal-silver-aerogel/` | `2456c408886a` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-silver-aerogel.mp4) |
| `registry/blocks/code-snippet-apple-terminal-solid-colors/` | `25f0f5a4f86e` | simple | pending |  | Code / Code Snippets | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-apple-terminal-solid-colors.mp4) |
| `registry/blocks/code-snippet-dark-2026/` | `919de2aa2589` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-dark-modern/` | `cf026c520dfe` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-dark-plus/` | `bca736ce2454` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-flight/` | `2ee038fb283f` | simple | pending |  | Code / Code Animations | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-snippet-flight.mp4) |
| `registry/blocks/code-snippet-high-contrast/` | `2958e3806c0f` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-high-contrast-light/` | `5ef089bab62d` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-light-2026/` | `261e5d8d7307` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-light-modern/` | `2b3b9629a577` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-light-plus/` | `db6225445db6` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-monokai/` | `f90b5a426bc8` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-solarized-light/` | `e8fb4b5fc672` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-visual-studio-dark/` | `3993f04497e2` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-snippet-visual-studio-light/` | `987728826ead` | simple | pending |  | Code / Code Snippets |  |
| `registry/blocks/code-typing/` | `849607140b85` | simple | pending |  | Code / Code Animations | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/code-typing.mp4) |
| `registry/blocks/cosmic-orb/` | `e0daebac3a22` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/cross-warp-morph/` | `0c5e700173c1` | simple | pending |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/cross-warp-morph.mp4) |
| `registry/blocks/cuboid-carousel/` | `990339dbcfcc` | simple | pending |  | 3D motion | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/cuboid-carousel.mp4) |
| `registry/blocks/data-chart/` | `c4dafbd19285` | simple | pending |  | Data & charts / Data | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/data-chart.mp4) |
| `registry/blocks/domain-warp-dissolve/` | `2309947c175d` | simple | documented |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/domain-warp-dissolve.mp4) |
| `registry/blocks/editorial-flash-overlay/` | `d25d6cee7e17` | simple | pending |  | Scenes & demos / Social Overlays | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/editorial-flash-overlay.mp4) |
| `registry/blocks/flash-through-white/` | `9ead226ddd03` | simple | documented |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/flash-through-white.mp4) |
| `registry/blocks/flowchart/` | `8743365b1073` | simple | pending |  | Blocks | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/flowchart.mp4) |
| `registry/blocks/flowchart-vertical/` | `c7ff9dd6b48c` | simple | pending |  | Blocks | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/flowchart-vertical.mp4) |
| `registry/blocks/freeze-frame-dressing/` | `c4e185ef199e` | simple | pending |  | Scenes & demos / Social Overlays | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/freeze-frame-dressing.mp4) |
| `registry/blocks/frost-sequence-camera-orbit/` | `9f0b6d502f50` | simple | pending |  | 3D motion | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/frost-sequence-camera-orbit.mp4) |
| `registry/blocks/gallery-tunnel/` | `d64fa9b649df` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/glass-shard-title/` | `acd505c55f8e` | simple | pending |  | 3D motion | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/glass-shard-title.mp4) |
| `registry/blocks/glitch/` | `590946aa9d92` | simple | documented |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/glitch.mp4) |
| `registry/blocks/gravitational-lens/` | `a90897fa199b` | simple | documented |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/gravitational-lens.mp4) |
| `registry/blocks/halftone-field/` | `94e683fae525` | simple | pending |  | Surfaces / Texture |  |
| `registry/blocks/heygen-avatar-promo-card/` | `41111b9f2218` | simple | pending |  | Scenes & demos / Showcases | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/heygen-avatar-promo-card.mp4) |
| `registry/blocks/hw-frame/` | `3048dab421f5` | simple | pending |  | Blocks |  |
| `registry/blocks/hw-path-text/` | `91b708cd2b69` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/blocks/hw-pipeline/` | `c98f2e1831be` | simple | pending |  | Blocks |  |
| `registry/blocks/hw-scribble-transition/` | `50c32c2a7836` | simple | pending |  | Transitions / CSS Transitions |  |
| `registry/blocks/hw-text-cloud/` | `d260f3da588e` | simple | pending |  | Blocks |  |
| `registry/blocks/hw-title/` | `d7e0ce13c541` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/blocks/hw-write-title/` | `f37e5763a962` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/blocks/instagram-follow/` | `26ac0a6a8916` | simple | pending |  | Scenes & demos / Social Overlays | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/instagram-follow.mp4) |
| `registry/blocks/ios26-liquid-glass/` | `7aaf8f45e350` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/ios26-liquid-glass.mp4) |
| `registry/blocks/light-leak/` | `e6446ac2a384` | simple | documented |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/light-leak.mp4) |
| `registry/blocks/liquid-glass-context-menu/` | `8c54666cc114` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/liquid-glass-context-menu.mp4) |
| `registry/blocks/liquid-glass-media-controls/` | `bec2ab988c2d` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/liquid-glass-media-controls.mp4) |
| `registry/blocks/liquid-glass-notification/` | `bbdf3c07de2f` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/liquid-glass-notification.mp4) |
| `registry/blocks/liquid-glass-widgets/` | `b19034c54f45` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/liquid-glass-widgets.mp4) |
| `registry/blocks/logo-outro/` | `fa1998825566` | simple | pending |  | Blocks | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/logo-outro.mp4) |
| `registry/blocks/lower-third-bild/` | `bc76b0fccb87` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/lt-accent-underline/` | `16791b47656c` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/lt-bold-block/` | `893deceee86a` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/lt-clean-bar/` | `c9dd8db0e4e4` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/lt-color-block/` | `ceffb8d3e1c7` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/lt-dark-card/` | `ad7c304b3e15` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/lt-kicker-name/` | `3a77dae9b93c` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/lt-mask-reveal/` | `ad430242c799` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/lt-neon-border/` | `e00abaaf6d2a` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/blocks/lt-side-rule/` | `44cf621bf1d5` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/lt-soft-pill/` | `f2690e3d12d1` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/lt-stack-bars/` | `da3b3812bf92` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/macos-notification/` | `0380262edfbd` | simple | pending |  | Scenes & demos / Social Overlays | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/macos-notification.mp4) |
| `registry/blocks/macos-tahoe-liquid-glass/` | `09a35d60f124` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/macos-tahoe-liquid-glass.mp4) |
| `registry/blocks/message-thread-reveal/` | `755bf891d0e7` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/mk-background/` | `fc90a449b55c` | simple | pending |  | Blocks |  |
| `registry/blocks/mk-callout-highlight/` | `1953edec2393` | simple | pending |  | Text & captions / Captions |  |
| `registry/blocks/mk-clone-wall-transition/` | `8e3420798d19` | simple | pending |  | Transitions / CSS Transitions |  |
| `registry/blocks/mk-line-graph/` | `b2b8bea53ec7` | simple | pending |  | Data & charts / Data |  |
| `registry/blocks/mk-placeholder-grid/` | `cee37f12b63e` | simple | pending |  | Blocks |  |
| `registry/blocks/mk-progress-stat/` | `cd41cec3f2a1` | simple | pending |  | Blocks |  |
| `registry/blocks/mk-specs-list/` | `5261d9b71dcc` | simple | pending |  | Blocks |  |
| `registry/blocks/news-ticker/` | `3f8faef3a616` | simple | pending |  | Text & captions / Lower Thirds |  |
| `registry/blocks/north-korea-locked-down/` | `bec93d21b04b` | simple | pending |  | Scenes & demos / Showcases | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/north-korea-locked-down.mp4) |
| `registry/blocks/notes-reveal/` | `e83da80678ab` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/notification-cascade/` | `b61432394a32` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/nyc-paris-flight/` | `29006dd894ed` | simple | pending |  | Scenes & demos / Showcases | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/nyc-paris-flight.mp4) |
| `registry/blocks/orbit-card/` | `50e0b394b2c3` | simple | pending |  | 3D motion | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/orbit-card.mp4) |
| `registry/blocks/organic-light-leak-overlay/` | `09840dfe61d8` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/organic-light-leak-overlay.mp4) |
| `registry/blocks/oscilloscope-trace/` | `965ebad60e9d` | simple | pending |  | Scenes & demos / Showcases | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/oscilloscope-trace.mp4) |
| `registry/blocks/rack-focus/` | `15c549c8d127` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/reddit-post/` | `87b7b0823c24` | simple | pending |  | Scenes & demos / Social Overlays | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/reddit-post.mp4) |
| `registry/blocks/ridged-burn/` | `59c5833b1551` | simple | documented |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/ridged-burn.mp4) |
| `registry/blocks/ripple-waves/` | `e78c8b066b2b` | simple | pending |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/ripple-waves.mp4) |
| `registry/blocks/sdf-iris/` | `6b16cd1bc1e1` | simple | documented |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/sdf-iris.mp4) |
| `registry/blocks/share-sheet-carousel/` | `1578c979ef87` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/slack-notification-ad/` | `2888a261cbda` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/spain-map/` | `7e8ec5afeaed` | simple | pending |  | Data & charts / Data | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/spain-map.mp4) |
| `registry/blocks/spiral-galaxy/` | `fc5751c06f17` | simple | pending |  | Blocks |  |
| `registry/blocks/split-flap-board/` | `378e4ed8394f` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/blocks/spotify-card/` | `4cda88f6662f` | simple | pending |  | Scenes & demos / Social Overlays | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/spotify-card.mp4) |
| `registry/blocks/swirl-vortex/` | `1389cabc8b34` | simple | pending |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/swirl-vortex.mp4) |
| `registry/blocks/thermal-distortion/` | `ffd58137797d` | simple | pending |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/thermal-distortion.mp4) |
| `registry/blocks/thread-message-stack/` | `dd64b6942fa6` | simple | pending |  | Scenes & demos / Social Overlays |  |
| `registry/blocks/tiktok-follow/` | `62e1d47c8341` | simple | pending |  | Scenes & demos / Social Overlays | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/tiktok-follow.mp4) |
| `registry/blocks/transitions-3d/` | `9b95b7650b61` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-3d.mp4) |
| `registry/blocks/transitions-blur/` | `05f3a5f86c8b` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-blur.mp4) |
| `registry/blocks/transitions-cover/` | `6e8a6f4b477e` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-cover.mp4) |
| `registry/blocks/transitions-destruction/` | `24db2ac42528` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-destruction.mp4) |
| `registry/blocks/transitions-dissolve/` | `4d21304627c9` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-dissolve.mp4) |
| `registry/blocks/transitions-distortion/` | `5ce5b1df444b` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-distortion.mp4) |
| `registry/blocks/transitions-grid/` | `9b0be063f1a2` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-grid.mp4) |
| `registry/blocks/transitions-light/` | `42d219dbcae7` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-light.mp4) |
| `registry/blocks/transitions-mechanical/` | `264a931a708b` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-mechanical.mp4) |
| `registry/blocks/transitions-other/` | `d4902499521e` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-other.mp4) |
| `registry/blocks/transitions-push/` | `00db35b2b54f` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-push.mp4) |
| `registry/blocks/transitions-radial/` | `c2b63f10fbcb` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-radial.mp4) |
| `registry/blocks/transitions-scale/` | `54bb27102eff` | simple | pending |  | Transitions / CSS Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/transitions-scale.mp4) |
| `registry/blocks/ui-3d-reveal/` | `507633043637` | simple | pending |  | Scenes & demos / Showcases | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/ui-3d-reveal.mp4) |
| `registry/blocks/us-map/` | `a584b48d604e` | simple | pending |  | Data & charts / Data | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/us-map.mp4) |
| `registry/blocks/us-map-bubble/` | `95fc13a074ea` | simple | pending |  | Data & charts / Data | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/us-map-bubble.mp4) |
| `registry/blocks/us-map-flow/` | `ae561fb48dc2` | simple | pending |  | Data & charts / Data | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/us-map-flow.mp4) |
| `registry/blocks/us-map-hex/` | `3979732894a9` | simple | pending |  | Data & charts / Data | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/us-map-hex.mp4) |
| `registry/blocks/vfx-anamorphic-flare/` | `1eea4589ef9e` | simple | pending |  | Scenes & demos / Showcases |  |
| `registry/blocks/vfx-iphone-device/` | `60243d8d4127` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/vfx-iphone-device.mp4) |
| `registry/blocks/vfx-liquid-background/` | `3a377cadf44a` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/vfx-liquid-background.mp4) |
| `registry/blocks/vfx-liquid-glass/` | `c8690a282a40` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/vfx-liquid-glass.mp4) |
| `registry/blocks/vfx-magnetic/` | `77b191fbd000` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/vfx-magnetic.mp4) |
| `registry/blocks/vfx-portal/` | `7335cd750cbb` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/vfx-portal.mp4) |
| `registry/blocks/vfx-shatter/` | `0e54b7c4fb3d` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/vfx-shatter.mp4) |
| `registry/blocks/vfx-text-cursor/` | `ced4cf90ff1b` | simple | pending |  | Surfaces / HTML-in-Canvas | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/vfx-text-cursor.mp4) |
| `registry/blocks/vpn-youtube-spot/` | `9bfe4e95c084` | simple | pending |  | Scenes & demos / Showcases | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/vpn-youtube-spot.mp4) |
| `registry/blocks/weight-wave/` | `85bdcd32dd89` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/blocks/whip-pan/` | `08a61007b4d0` | simple | documented |  | Transitions / Shader Transitions | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/whip-pan.mp4) |
| `registry/blocks/wireframe-portal-title/` | `6e6921434dc9` | simple | pending |  | 3D motion | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/wireframe-portal-title.mp4) |
| `registry/blocks/world-map/` | `24b94373d976` | simple | pending |  | Data & charts / Data | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/world-map.mp4) |
| `registry/blocks/x-post/` | `51a278bc7d81` | simple | pending |  | Scenes & demos / Social Overlays | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/x-post.mp4) |
| `registry/blocks/yt-comment-card/` | `9d4ce172a33a` | simple | pending |  | Scenes & demos / Social Overlays |  |
| `registry/blocks/yt-lcd-background/` | `b4bed2ce02bc` | simple | pending |  | Surfaces / Texture |  |
| `registry/blocks/yt-logo-intro/` | `b98927f6aedb` | simple | pending |  | Blocks |  |
| `registry/blocks/yt-lower-third/` | `451de90699ae` | simple | pending |  | Scenes & demos / Social Overlays | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/blocks/yt-lower-third.mp4) |
| `registry/blocks/yt-prism-title/` | `8b7a877bfa14` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/blocks/yt-vertical-fill/` | `f99d8b49ba24` | simple | pending |  | Blocks |  |

## Components

`heygen-com/hyperframes`, `registry/components/`.

| Path | SHA | Complexity | Status | Note | Group | Preview |
| --- | --- | --- | --- | --- | --- | --- |
| `registry/components/animated-bar-chart/` | `7c22845d65a8` | simple | pending |  | Data & charts / Data |  |
| `registry/components/arc-motion-path/` | `5fa831d1031d` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/ascii-render-pass/` | `4d5b8611da33` | simple | pending |  | Data & charts / Data |  |
| `registry/components/ascii-trail-reveal/` | `9ed3a25a1abe` | simple | pending |  | Data & charts / Data |  |
| `registry/components/aurora-drift/` | `26371e0cef1b` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/avatar-cloud/` | `38596d86e5ec` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/avatar-group-hover/` | `50396179540c` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/badge-pop/` | `956c44a892a6` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/beat-accent/` | `3cebcc1eec7f` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/beat-pulse-background/` | `7e58ec43a178` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/beat-timeline/` | `160015849759` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/before-after-wipe/` | `90638ed70ce7` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/blur-in/` | `9f7163a5cb2b` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/blur-out-up/` | `38b10d2eb9f3` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/bottom-up-letters/` | `4774356e8491` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/browser-device-stage/` | `b063c0e5885a` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/camera-rig-depth-stack/` | `1ce8ccdd9033` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/camera-scan-gate/` | `2ed8912b5ec9` | simple | pending |  | Motion & effects / Camera & 3D |  |
| `registry/components/camera-shake/` | `8a5966dac490` | simple | pending |  | Motion & effects / Camera & 3D |  |
| `registry/components/caption-blend-difference/` | `04768ef3f712` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/caption-camera-follow/` | `59672da678c8` | simple | pending |  | Text & captions / Captions |  |
| `registry/components/caption-clip-wipe/` | `2e6608742039` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-clip-wipe/preview-v2.mp4) |
| `registry/components/caption-editorial-emphasis/` | `dab863916dbd` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-editorial-emphasis/preview.mp4?v=1779051416) |
| `registry/components/caption-emoji-pop/` | `dfdbec99b855` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-emoji-pop/preview.mp4?v=1779051416) |
| `registry/components/caption-glitch-rgb/` | `1f15c7d1c691` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-glitch-rgb/preview-v2.mp4) |
| `registry/components/caption-gradient-fill/` | `c458d4f8b91b` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-gradient-fill/preview-v2.mp4) |
| `registry/components/caption-highlight/` | `0f9b495ae353` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-highlight/preview-v2.mp4) |
| `registry/components/caption-kinetic-slam/` | `3c837e631967` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-kinetic-slam/preview.mp4?v=1779051416) |
| `registry/components/caption-matrix-decode/` | `d4fb08671444` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-matrix-decode/preview-v2.mp4) |
| `registry/components/caption-neon-accent/` | `e28daee5649e` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-neon-accent/preview.mp4?v=1779051416) |
| `registry/components/caption-neon-glow/` | `25f5992a10e6` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-neon-glow/preview.mp4?v=1779051416) |
| `registry/components/caption-parallax-layers/` | `f0ecfc0cdf9a` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-parallax-layers/preview.mp4?v=1779051692) |
| `registry/components/caption-particle-burst/` | `ff8b68b29f33` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-particle-burst/preview.mp4?v=1779051416) |
| `registry/components/caption-pill-karaoke/` | `a3881c634400` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-pill-karaoke/preview.mp4?v=1779051416) |
| `registry/components/caption-texture/` | `6a8c3246cde9` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-texture-lava/preview.mp4?v=1779051416) |
| `registry/components/caption-weight-shift/` | `ebf7ac44bd39` | simple | pending |  | Text & captions / Captions | [Watch](https://static.heygen.ai/hyperframes-oss/registry/components/caption-weight-shift/preview-v2.mp4) |
| `registry/components/card-resize/` | `13c82118b1e4` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/char-slam-explode/` | `adc9916f57ec` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/chart-story/` | `211277dd2464` | simple | pending |  | Data & charts / Data |  |
| `registry/components/chat-message/` | `10e34c6aeed5` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/chat-thread/` | `1c9bbd3907eb` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/chromatic-aberration-wipe/` | `f4c3122b36d4` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/code-terminal-run/` | `56ad96a2f7d5` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/comparison-split/` | `396ea0531f0d` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/confetti/` | `80695d1a3938` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/conic-progress-ring/` | `203a5cefc5ec` | simple | pending |  | Data & charts / Data |  |
| `registry/components/constellation-hub/` | `4aa190c6bacf` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/count-up/` | `b24fe78731c3` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/cta-close/` | `c27ef447db88` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/cta-lockup/` | `c6d2c635d3e2` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/cursor-glyph-trail/` | `c703d0bc7e73` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/cut-the-curve/` | `e647be18c701` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/decline-chart/` | `5f1df79a1f57` | simple | pending |  | Data & charts / Data |  |
| `registry/components/device-frame-stage/` | `4cfc08539829` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/directional-wipe/` | `69bb187db34b` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/drift-hold/` | `0e8bfcd3f3b7` | simple | pending |  | Motion & effects / Camera & 3D |  |
| `registry/components/dynamic-grid/` | `be23cbb892d2` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/echo-trail/` | `e0628bde19eb` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/facet-morph/` | `3e982a3def41` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/fade-through/` | `dae0539a3e0c` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/focus-blur-resolve/` | `151b8bccbd34` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/focus-rack/` | `1d41b0950cd8` | simple | pending |  | Motion & effects / Camera & 3D |  |
| `registry/components/focus-swap/` | `f69ed995cca8` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/gesture-tap/` | `8190b04dad3c` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/gloss-sweep/` | `b2d5f520c46b` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/grade-split-reveal/` | `4b506a767c6f` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/grain-field/` | `c8c8242bc595` | simple | pending |  | Surfaces / Texture |  |
| `registry/components/grain-overlay/` | `9da68f54ee99` | simple | pending |  | Surfaces / Texture |  |
| `registry/components/grid-card-assemble/` | `308e80f04ca7` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/grid-pixelate-wipe/` | `a0829dcc9acc` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/halftone-dissolve/` | `19deff20b254` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/headline-slam/` | `9284df0e1826` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/hw-arrow/` | `deafc93c9ba9` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/hw-boil/` | `2f4efe553681` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/hw-box-label/` | `b214ff15e04b` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/hw-callout-circle/` | `843e1f685838` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/hw-underline/` | `4b7010241ac3` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/icon-morph-beat/` | `f1e842ade7f7` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/icon-swap/` | `a8e86bb7a077` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/ink-bleed-reveal/` | `78b5c8568a95` | simple | pending |  | Surfaces / Texture |  |
| `registry/components/inline-highlight/` | `a21afefeba9d` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/input-feedback/` | `4ea41cb29c87` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/iris-reveal/` | `e9836bb05983` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/keyframe-scrub-stack/` | `6b12b45833f1` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/kinetic-center-build/` | `1e10221250bb` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/kinetic-type-swap/` | `1293a5f5f077` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/light-sweep-pass/` | `a7a73ca84c90` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/line-by-line-slide/` | `abac5bf56f48` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/line-swap/` | `5368947f71e7` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/locked-nucleus-orbit/` | `9ab61ebce17b` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/logo-brand-close/` | `d7d76d5a036e` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/logo-sting/` | `901d5ef730f7` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/logo-wall/` | `3f2f83a91de3` | simple | pending |  | Data & charts / Data |  |
| `registry/components/marker-checklist-card/` | `183fe6246a61` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/marker-highlight/` | `7201be88641f` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/match-cut/` | `5c67a1769720` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/matrix-decode/` | `9c9c07a4deaa` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/menu-morph/` | `ac23bf660b2d` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/mesh-gradient-bg/` | `970d903a1e64` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/micro-transitions/` | `bf461763dfbb` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/mk-emphasis-type/` | `7d04874a5a23` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/mk-usage-arc/` | `13d14c0cd20d` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/modal-morph/` | `fddd62b72ec0` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/morph-swap/` | `c52dad2e780e` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/morph-text/` | `6bcd50261c67` | simple | pending |  | Text & captions / Typography & Text | [Watch](https://static.heygen.ai/hyperframes-oss/docs/images/catalog/components/morph-text.mp4) |
| `registry/components/motion-blur/` | `a261fe2f3f34` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/multi-device-splay/` | `b3f1f71c79f4` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/multiplayer-cursors/` | `da581af0593d` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/native-notification-pop/` | `e04a0240eb47` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/notes-typing/` | `ad96c05d53a3` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/notification-pileup/` | `4c69e1439b34` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/notification-stack/` | `add74eb70711` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/number-pop-in/` | `c460bad6f45d` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/number-wheel/` | `6efdcfcfd656` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/offset-path-traveler/` | `4766541abccf` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/onboarding-stepper-flow/` | `155a6504c219` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/ordered-dither-pass/` | `bb86462857a3` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/outline-draw/` | `a08312314097` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/oversized-cursor/` | `063bcee95719` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/overwhelm-surround/` | `b31a36829718` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/page-slide/` | `fe427f508d91` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/pan-stations/` | `8ee9969a62f8` | simple | pending |  | Motion & effects / Camera & 3D |  |
| `registry/components/panel-reveal/` | `556d2fc76a65` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/parallax-device-dive/` | `a7b756162514` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/parallax-unzoom/` | `bef9324ac4f6` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/parallax-zoom/` | `2c1f94d094b4` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/particle-image-reveal/` | `e9dc4750874f` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/particle-text-dissolve/` | `9923daa5f646` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/per-word-crossfade/` | `02f7fd1f0425` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/per-word-rise/` | `20e554cf281c` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/perspective-marquee/` | `20ba8da70fe8` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/physical-exit/` | `482369fc378f` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/press-ripple/` | `1045f0af9fc1` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/pull-back-reveal/` | `2b4b87003d4c` | simple | pending |  | Motion & effects / Camera & 3D |  |
| `registry/components/pull-to-refresh/` | `f0ae2a103588` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/push-in/` | `b80727213eb0` | simple | pending |  | Motion & effects / Camera & 3D |  |
| `registry/components/radial-surround/` | `8485ab28585c` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/rgb-glitch-text/` | `838ef0981cfe` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/rubber-band-bumper/` | `af1a269510e1` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/scan-band/` | `189db15932be` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/scramble-reveal/` | `db7adee1c061` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/screen-flow-carousel/` | `8e99b72e7693` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/scroll-camera-story/` | `3c2a4bcbaaaf` | simple | pending |  | Motion & effects / Camera & 3D |  |
| `registry/components/scroll-feed/` | `6631ffb4bf9b` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/segmentation-flood/` | `0005f89de402` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/separator/` | `d359b70180fa` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/settings-toggle-flow/` | `4afd4b7c6317` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/shared-axis-y/` | `4f81ab678384` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/shared-axis-z/` | `8c605954557e` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/sheet-spring-up/` | `ad407b9280d7` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/shimmer-sweep/` | `5695a357aa62` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/shutter-slam/` | `1cabc64bd461` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/signup-flow/` | `3b4f6d45a806` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/simulated-cursor/` | `5f5e1bd28f6a` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/skeleton-reveal/` | `b34fe7218ac1` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/slit-scan-reveal/` | `39952f34d0df` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/slot-machine-roll/` | `ef46989261be` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/social-proof-card/` | `c4c83dea5b4e` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/soft-blob-touch/` | `687f8e83531e` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/soft-blur-in/` | `c79047eae6b4` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/split-tilt-cards/` | `5b87fa49fc35` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/spotlight-card/` | `533fde35219a` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/spring-pop/` | `862100b067d2` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/spring-stack-shuffle/` | `044970a1b9fe` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/stagger-cascade/` | `00ffc2c023ee` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/stagger-lattice/` | `0ea92b05e270` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/staggered-fade-up/` | `9b23f6b30a08` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/star-rating-fill/` | `2706823f1a91` | simple | pending |  | Data & charts / Data |  |
| `registry/components/state-chip-rail/` | `7244fb24421f` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/sticky-mock-swap/` | `e7bd9ddf2be1` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/stitched-text-draw/` | `53ccdd67c2de` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/stop-motion-cadence/` | `248960d96e82` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/store-badge-lockup/` | `37df6c6aec16` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/streaming-text/` | `56d4186b5f5c` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/strikethrough-replace/` | `fa3ee3668503` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/success-check/` | `8cae1e21d86b` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/svg-line-draw-loader/` | `25ebe0d4442e` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/svg-mask-reveal/` | `1fd797a7cb98` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/svg-stroke-trace/` | `edd409f62eb4` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/swipe-rail/` | `ca0eaa280dcb` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/tabs-slide-indicator/` | `be2a1648c9ba` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/telemetry-hud/` | `9dc1d33bf461` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/terminal-simulator/` | `0abb31a4a636` | simple | pending |  | Code / Code Animations |  |
| `registry/components/testimonial-card/` | `7a8d37f49e00` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/testimonial-proof-card/` | `d50c230ff6ab` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/text-shimmer/` | `11897073c9f3` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/text-stagger/` | `54ffe440e2b8` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/text-state-swap/` | `893489f0f2a6` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/texture-mask-text/` | `c300adfae711` | simple | pending |  | Surfaces / Texture |  |
| `registry/components/three-orbiting-cards/` | `73d4c6e40608` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/ticker-takeover/` | `a9769520e12a` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/tilt-card/` | `83b8e272c76a` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/titlecard-calm/` | `0b3f65ef1aa5` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/titlecard-lockup/` | `b32caaa75e56` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/toggle-flip/` | `2fffdbe43fd0` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/top-down-letters/` | `1c33e6c31696` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/touch-indicator/` | `cd3d1f261d04` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/tracing-beam/` | `afad2cd133d6` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/tracking-in/` | `f125e7e028df` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/trust-strip/` | `1bd7bb9fa800` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/type-match-cut/` | `a29b0866b575` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/typed-prompt/` | `5df8fbb6749e` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/typewriter/` | `300372be4896` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/typing-indicator/` | `ba5dc4ca2264` | simple | pending |  | Motion & effects / Motion Primitives |  |
| `registry/components/ui-focus-zoom/` | `71d5c22deef4` | simple | pending |  | Motion & effects / Camera & 3D |  |
| `registry/components/variable-axis-type/` | `dfe3b0f57899` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/variable-font-flex/` | `e44792ad184e` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/vector-editor-rig/` | `0f4709d74f41` | simple | pending |  | Scenes & demos / Product Demo |  |
| `registry/components/velocity-throw-snap/` | `c09fc40e6517` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/vignette/` | `b81f50a903b4` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/vox-annotate/` | `56457c4c6422` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/whip-pan-cut/` | `9b0e41fdfd4e` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/whiteboard-ink/` | `4b754e298e5d` | simple | pending |  | Scenes & demos / Motion Scenes |  |
| `registry/components/wordmark-tiles/` | `44d05bf14862` | simple | pending |  | Text & captions / Typography & Text |  |
| `registry/components/x-follow-card/` | `b06c997b0952` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/yt-camera-move/` | `cbed678924f9` | simple | pending |  | Motion & effects / Camera & 3D |  |
| `registry/components/yt-circle-pointer/` | `87c2cebf1e64` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/yt-feather-highlight/` | `f6405c2a7244` | simple | pending |  | Motion & effects / Effects |  |
| `registry/components/yt-screen-warp/` | `65573c513aa1` | simple | pending |  | Surfaces / Texture |  |
| `registry/components/zoom-through-transition/` | `38e3f5a3fd03` | simple | pending |  | Motion & effects / Effects |  |

## Skill examples

`heygen-com/hyperframes`, `skills/`.

| Path | SHA | Complexity | Status | Note | Group | Preview |
| --- | --- | --- | --- | --- | --- | --- |
| `skills/embedded-captions/modes/cinematic/cinematic-cream/template.html` | `7833cce4a8c0` | simple | pending |  | Uncategorized |  |
| `skills/embedded-captions/modes/cinematic/engine.html` | `2773bed113c5` | simple | excluded | compiler shell filled by `make-composition.cjs`, not standalone | Uncategorized |  |
| `skills/embedded-captions/references/example-renders/champion.html` | `3ec196efa703` | simple | pending |  | Uncategorized |  |
| `skills/embedded-captions/references/example-renders/memory-wall.html` | `c34d5cc22cdd` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/brand-reveal-assemble-zoom.html` | `31950a9e6cf3` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/comparison-split-cards.html` | `d60e753aea56` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/concept-demo-decode-pan.html` | `af4efcf614a1` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/cta-morph-press.html` | `3896aa43a38c` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/cta-orbit-collapse.html` | `ad5d77e935a0` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/demo-page-scroll-spotlight.html` | `4557db48dc5e` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/hook-counter-burst.html` | `7d2ae6f62d3e` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/messaging-multi-phrase.html` | `b641d96e8313` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/metric-video-text-pivot.html` | `01fb553342f4` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/problem-mockup-overwhelm.html` | `a5f780045610` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/proof-logo-chain.html` | `52df7b20b505` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/takeover-ticker-displace.html` | `6c1a23baa04d` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-animation/examples/workflow-approve-press.html` | `a5de4d62ab73` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/biennale-yellow/caption-skin.html` | `8ca668456354` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/biennale-yellow/frame-showcase.html` | `186f8252ad7a` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/blockframe/caption-skin.html` | `f0cdb26fd0a8` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/blockframe/frame-showcase.html` | `3f5a165072f6` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/blue-professional/caption-skin.html` | `5a599c2703c2` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/blue-professional/frame-showcase.html` | `ff00e7be733c` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/bold-poster/caption-skin.html` | `ee1d4bfb6871` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/bold-poster/frame-showcase.html` | `a8f91897faa3` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/broadside/caption-skin.html` | `00f4b6f8db17` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/broadside/frame-showcase.html` | `0d2a6cd15266` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/capsule/caption-skin.html` | `0742a0532170` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/capsule/frame-showcase.html` | `65b4e196dbf0` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/cartesian/caption-skin.html` | `135fa9719299` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/cartesian/frame-showcase.html` | `7918b04e9ddb` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/cobalt-grid/caption-skin.html` | `e604347cf7f5` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/cobalt-grid/frame-showcase.html` | `d9449880f1a7` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/code-editorial/caption-skin.html` | `18c7a33421fd` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/code-editorial/frame-showcase.html` | `e0a70eab89b1` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/coral/caption-skin.html` | `41f2a59603e4` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/coral/frame-showcase.html` | `ae87659f3b61` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/creative-mode/caption-skin.html` | `231e39bf048d` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/creative-mode/frame-showcase.html` | `e540e40a3973` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/daisy-days/caption-skin.html` | `6431baaa6cd6` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/daisy-days/frame-showcase.html` | `c577bdbab3a1` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/editorial-forest/caption-skin.html` | `b3d28986797c` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/frame-presets/editorial-forest/frame-showcase.html` | `c5c08718fef4` | simple | pending |  | Uncategorized |  |
| `skills/hyperframes-creative/templates/design-picker.html` | `6cb6f0878dc1` | simple | excluded | interactive style picker page, not a video | Uncategorized |  |
| `skills/motion-graphics/samples/asset-fusion/_ref-circle-highlight.html` | `ef4c83c2e739` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/3d-card-flip/` | `325182eec4dd` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/bg-flow-field/` | `133b9211f095` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/binary-decrypt/` | `2eebca0c3016` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/blur-resolve/` | `40fd5a507c80` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/braam-punch/` | `c114fb0d0530` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/chromatic-split/` | `174952696eba` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/chrome-sweep/` | `dadfd1a1ff41` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/counting-punch/` | `b93b9ea72216` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/crash-zoom-in/` | `ddebe191500e` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/datamosh-smear/` | `343889fc06af` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/directional-fill/` | `9cc11ec6bed1` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/dolly-zoom/` | `30cd1573c43c` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/electric-arc/` | `bf19e879b1c5` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/flash-cut/` | `3203469b25f5` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/gooey-metaball/` | `6fab855be605` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/hard-cut/` | `a0d8b5858dbb` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/hypercut-whip/` | `d7cfc4a71c73` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/iris-open/` | `d0a5586d4864` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/kinetic-letter-in/` | `9a1e3f53820d` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/liquid-morph/` | `f33d24dca628` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/mask-reveal/` | `1aab1ba6b18e` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/mosaic-pack/` | `79a73195f740` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/neon-flicker/` | `853811b6195b` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/outline-to-fill/` | `43e28e3d5e36` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/palette-flip/` | `4570acc64d76` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/particle-burst/` | `8a783f1ce7e2` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/pixel-dissolve/` | `0b435b2706fa` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/radial-burst-lines/` | `e550e83ec1cd` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/screen-shake/` | `ecddb51c467b` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/slot-machine-reveal/` | `3ca5bbc9a682` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/spotlight-sweep/` | `0d05a8203daa` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/staggered-exit/` | `7fa264445626` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/text-spectral-rays/` | `b9ff58dd07d8` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/text-wave-distort/` | `aa5559f6c21a` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/tile-mosaic/` | `44f2b578956b` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/typewriter-reveal/` | `a69ce069706f` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/motion-primitives/word-grid-burst/` | `df78dc296809` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/templates/card-flyby/` | `3b88ed4b17ab` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/templates/held-message-living-field/` | `17dddcd61d51` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/templates/held-text-strobe-burst/` | `ca2107b90424` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/templates/intro-kinetic-cascade/` | `0f037a1a60db` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/templates/logo-split-lockup-pulse/` | `d7ac3d9f3412` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/templates/poster-tile-mosaic/` | `46362c750101` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/templates/roll-flipbook-word-cycle/` | `e648b3ffcc07` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/templates/split-anchor-word-slot/` | `14d97891904f` | simple | pending |  | Uncategorized |  |
| `skills/music-to-video/references/templates/typewriter-phrase-keyword-shuffle/` | `83dbbe7a9995` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/frames/clean.html` | `b87f3c9e1f1a` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/frames/hairline.html` | `db98a1142c1b` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/frames/polaroid.html` | `582c0475f079` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/layouts/overlay.html` | `6a5f0b24a49d` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/layouts/pip.html` | `ee1a30be4531` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/layouts/split.html` | `a93719bf8251` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/layouts/stack.html` | `06e8b2316bd3` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/styles/academic.html` | `71f91a0b3843` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/styles/audit.html` | `13c090c58d91` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/styles/editorial.html` | `8652e88a36d4` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/styles/geom.html` | `b498b08be883` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/styles/minimal.html` | `25375498fe82` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/styles/spotlight.html` | `4e0070255013` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/styles/swiss.html` | `e8dd89a035a3` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/styles/terminal.html` | `e5b9f6130f29` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/styles/whiteboard.html` | `90d6fb44c16d` | simple | pending |  | Uncategorized |  |
| `skills/talking-head-recut/references/styles/xhs.html` | `dd2deb570336` | simple | pending |  | Uncategorized |  |

## Excluded groups

`heygen-com/hyperframes`; `hyperframes-launches` has none.

| Path | HTML files | Reason |
| --- | --- | --- |
| `registry/catalog-artifact/` | 0 | search vectors for the catalog; no compositions |
| `packages/producer/` | 253 | render regression fixtures |
| `packages/studio/` | 10 | Studio app and its e2e fixtures |
| `packages/player/` | 3 | player perf fixtures |
| `packages/cli/` | 2 | `init` scaffolds (blank, from-file) with no motion |
| `packages/core/` | 1 | docs quickstart template |
| `packages/sdk-playground/` | 1 | SDK playground app |
| `scripts/` | 1 | smoke-test fixture |
| `.github/` | 1 | CI fixture |
| `docs/` | 0 | documentation site; no compositions |
| `.agents/skills/changelog-video/`, `.claude/skills/changelog-video/` | 2 | internal changelog skeleton, same file twice |
| `skills/remotion-to-hyperframes/assets/test-corpus/` | 10 | Remotion port test corpus |
| `skills/**/_archive/` | 3 | retired templates, kept as design reference only |

## Coverage

Rows per source and group. **Gap** marks a group with nothing documented yet.

| Source | Group | Documented | Pending | Duplicate | Excluded | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| Launches | Motion, sound & effects | 2 | 1 | 0 | 0 |  |
| Launches | Product & launch films | 1 | 4 | 0 | 0 |  |
| Launches | The tooling, shown working | 1 | 3 | 0 | 0 |  |
| Launches | Workflows & integrations | 1 | 2 | 0 | 0 |  |
| Launches | Uncategorized | 0 | 9 | 2 | 0 | **Gap** |
| Registry examples | Uncategorized | 0 | 13 | 0 | 0 | **Gap** |
| Blocks | 3D motion | 0 | 7 | 0 | 0 | **Gap** |
| Blocks | Blocks | 0 | 13 | 0 | 0 | **Gap** |
| Blocks | Carousels | 0 | 25 | 0 | 0 | **Gap** |
| Blocks | Code / Code Animations | 0 | 9 | 0 | 0 | **Gap** |
| Blocks | Code / Code Snippets | 0 | 24 | 0 | 0 | **Gap** |
| Blocks | Data & charts / Data | 0 | 9 | 0 | 0 | **Gap** |
| Blocks | Motion & effects / Camera & 3D | 0 | 1 | 0 | 0 | **Gap** |
| Blocks | Motion & effects / Motion Primitives | 0 | 1 | 0 | 0 | **Gap** |
| Blocks | Scenes & demos / Showcases | 0 | 22 | 0 | 0 | **Gap** |
| Blocks | Scenes & demos / Social Overlays | 0 | 11 | 0 | 0 | **Gap** |
| Blocks | Surfaces / HTML-in-Canvas | 0 | 13 | 0 | 0 | **Gap** |
| Blocks | Surfaces / Texture | 0 | 2 | 0 | 0 | **Gap** |
| Blocks | Text & captions / Captions | 0 | 1 | 0 | 0 | **Gap** |
| Blocks | Text & captions / Lower Thirds | 0 | 12 | 0 | 0 | **Gap** |
| Blocks | Text & captions / Typography & Text | 0 | 6 | 0 | 0 | **Gap** |
| Blocks | Transitions / CSS Transitions | 0 | 17 | 0 | 0 | **Gap** |
| Blocks | Transitions / Shader Transitions | 10 | 4 | 0 | 0 |  |
| Components | Code / Code Animations | 0 | 1 | 0 | 0 | **Gap** |
| Components | Data & charts / Data | 0 | 8 | 0 | 0 | **Gap** |
| Components | Motion & effects / Camera & 3D | 0 | 10 | 0 | 0 | **Gap** |
| Components | Motion & effects / Effects | 0 | 53 | 0 | 0 | **Gap** |
| Components | Motion & effects / Motion Primitives | 0 | 29 | 0 | 0 | **Gap** |
| Components | Scenes & demos / Motion Scenes | 0 | 40 | 0 | 0 | **Gap** |
| Components | Scenes & demos / Product Demo | 0 | 22 | 0 | 0 | **Gap** |
| Components | Surfaces / Texture | 0 | 5 | 0 | 0 | **Gap** |
| Components | Text & captions / Captions | 0 | 16 | 0 | 0 | **Gap** |
| Components | Text & captions / Typography & Text | 0 | 36 | 0 | 0 | **Gap** |
| Skill examples | Uncategorized | 0 | 106 | 0 | 2 | **Gap** |
| **Total** | | 15 | 535 | 2 | 2 | |
