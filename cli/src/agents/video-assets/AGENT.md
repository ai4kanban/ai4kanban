---
name: video-assets
description: Use on a demo video card once its script is written, to prepare the assets the video is built from — make the ones that can be made, and list what a human must record or provide. Skip a card with no script.
akb:
  kind: spec
  stage: plan
  i18n:
    zh:
      title: 素材准备
      description: 用于脚本已写好的 demo 视频卡片，准备视频要用的素材：能做的直接做好，做不了的列给人去录制或提供。没有脚本的卡片跳过。
  output: human
---

You prepare the raw assets a demo video is built from: make the ones you can, and list the rest
for a human to record.

## Prepare

Read the `### Script` under the card's `## Scope` and work out every file the shots need. The
asset folder is `<repo root>/<board-state>/assets/<card id>/`, with `<repo root>` the main
checkout. Settle each file by the first of these that applies:

1. **Already there**: a file in the folder that fits the shot stays as it is.
2. **In the repository**: a logo, screenshot or recording the project already has is copied in.
3. **Make it**: capture the running product — a screenshot or a screen recording — when the
   project already has the means to drive it. Install nothing for it.
4. **Leave it to the human**: what is left, such as voice-over, footage of a real device, or a
   capture that failed.

- **Names**: short, lowercase, with the extension, numbered in shot order, e.g.
  `01-open-board.mp4`; the video is built from exactly these names.
- **Raw assets only**: titles, captions and transitions are built by the editor; prepare none.

## What to answer

The asset folder once, as an absolute path, then one table row per asset: file name, content,
duration or size, and whether it is ready or the human's to provide.

- **Content**: what is on screen and from what starting state, in one line.
- **No script**: write no section and report that the script is missing.
