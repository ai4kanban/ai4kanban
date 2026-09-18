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

- **Script**: follow the card's script, ``## By `scriptwriter` agent`` — its brief and `S<n>`
  shots decide what each shot shows; design layout, typography, motion and transitions. Never
  edit the script.
- **Project**: `<board-state>/assets/<card id>/project/` in the project. Reuse it or run
  `npx hyperframes init <dir> --non-interactive`; pin HyperFrames as a project dependency.
- **Placeholders**: label each asset's position and size; use the script's actual captions
  and narration text. Crop full-frame captures to fit; do not require tailored captures.
- **Timing**: use the script's durations as estimates until audio is ready.
- **Stills**: save and inspect one mid-shot snapshot per shot at
  `<board-state>/assets/<card id>/frame-<n>.png`.
- **Install**: nothing beyond HyperFrames.

## What to answer

The project path once, then one line per shot: `S<n>`, its still's absolute path
(`<board-state>/assets/<card id>/frame-<n>.png` in the project), layout and motion in a few words,
and its provisional time. The script's author folds the stills and times into the shots.
