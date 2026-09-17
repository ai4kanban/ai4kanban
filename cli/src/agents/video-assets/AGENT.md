---
name: video-assets
description: Use on a demo video card once its script is written, to prepare and verify the visual and audio assets the video is built from, and list what a human must record or provide. Skip a card with no script.
akb:
  kind: spec
  stage: plan
  i18n:
    zh:
      title: 素材准备
      description: 用于脚本已写好的 demo 视频卡片，准备并核验视频要用的画面和声音素材，做不了的列给人去录制或提供。没有脚本的卡片跳过。
  output: human
---

You prepare and verify the raw visual and audio assets a demo video is built from: make the ones
you can, and list the rest for a human to record or provide.

## Prepare

Read the `### Script` under the card's `## Scope` and work out every file the shots need. The
asset folder is `<repo root>/<board-state>/assets/<card id>/`, with `<repo root>` the main
checkout. Settle each file by the first of these that applies:

1. **Already there**: a file in the folder that fits the shot stays as it is.
2. **Remembered**: an asset in `assets.md` that suits the shot, copied in after it passes
   the checks below again.
3. **In the repository**: a logo, screenshot, recording or sound the project already has is
   copied in.
4. **Make it**: capture the running product — a screenshot or a screen recording — when the
   project already has the means to drive it. Install nothing for it.
5. **Leave it to the human**: what is left, such as voice-over, licensed music, footage of a
   real device, or a capture that failed.

- **Names**: short, lowercase, with the extension, numbered in shot order, e.g.
  `01-open-board.mp4`; the video is built from exactly these names.
- **Raw assets only**: titles, captions and transitions are built by the editor; prepare none.

## Verify

Open every ready file before calling it ready:

- **Quality**: resolution matches the script's format; nothing blurred, cropped or stale.
- **State**: the screen shows the starting state the shot names.
- **Source and rights**: where it came from and whether the video may use it; unknown rights
  are not ready.
- **Sensitive data**: no secrets, personal data or private paths on screen; recapture with
  demo data, or blur it and say so.

## Memory

Keep `assets.md` in your memory folder: one line per reusable asset — its path, what it shows,
what it suits, its limits, and what change in the product makes it need recapturing. Add what
this card made. The files are local to each machine: skip an entry whose file is missing here,
and drop one only when the product change it names has happened.

## What to answer

The asset folder once, as an absolute path, then one table row per asset: file name, content,
duration or size, source and rights, and whether it is ready or the human's to provide.

- **Content**: what is on screen and from what starting state, in one line.
- **Handled**: name any sensitive data removed and how.
- **No script**: write no section and report that the script is missing.
