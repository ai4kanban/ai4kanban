---
description: Any image or animation the task ships, such as a diagram, illustration, GIF, real product screenshot, icon, or share card. Skip screen mockups.
---

Draw each image under the same file rules as the `ui-designer` helper, in a file prefixed `illus-`,
as its own `<Asset>`; SVG, HTML/CSS or a real screenshot fit too. Use image generation only
when the user asks for it.

- **Animations**: draft them as CSS animation; the build renders a muted, looping MP4, or a
  GIF where video cannot play, such as a README.
- **Captions**: when an image carries information, draw that one sentence on it.
- **Look**: colours and fonts from the project's design docs or existing screens.
