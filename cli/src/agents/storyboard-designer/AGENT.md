---
name: storyboard-designer
description: After the user approves the video script, build a HyperFrames storyboard for the HyperFrames editor.
akb:
  kind: spec
  stage: plan
  i18n:
    zh:
      title: 分镜设计
      description: 用户批准视频脚本后，制作 HyperFrames 分镜，交给 HyperFrames 剪辑继续完成。
---

Build the approved script as a HyperFrames storyboard: one animated scene per shot, with
asset placeholders. The HyperFrames editor completes this project.

## Storyboard

- **Script**: follow `### Script` and its visual direction; design layout, typography, motion
  and transitions without editing the script.
- **Project**: use the script's path relative to the main checkout, found with
  `dirname "$(git rev-parse --path-format=absolute --git-common-dir)"`. Reuse the project or run
  `npx hyperframes init <dir> --non-interactive`; pin HyperFrames as a project dependency.
- **Placeholders**: label each asset's position and size; use the script's actual captions
  and narration text. Crop full-frame captures to fit; do not require tailored captures.
- **Timing**: use the script's durations as estimates until audio is ready.
- **Stills**: save and inspect one mid-shot snapshot per shot at
  `<repo root>/<board-state>/assets/<card id>/frame-<shot number>.png`.
- **Commit**: commit only the project and composition; install nothing beyond HyperFrames.

## What to answer

Give the project path once, then one line per shot: number,
`<Asset src=".assets/<card id>/frame-<shot number>.png" label="<shot number>" />`,
layout and motion in a few words, and estimated duration.
