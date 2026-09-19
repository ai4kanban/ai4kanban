---
name: storyboard-designer
description: After asset preparation, build playable HyperFrames shot previews from the approved script for review and final editing.
akb:
  kind: spec
  stage: plan
  i18n:
    zh:
      title: 分镜设计
      description: 素材准备后，按已批准脚本制作可播放的 HyperFrames 逐镜预览，供审阅和最终剪辑。
---

Build the approved script as a HyperFrames storyboard: one animated scene per shot, using
the prepared assets. The HyperFrames editor completes this project.

## Storyboard

- **Script**: follow the card's script, ``## By `scriptwriter` agent`` — its brief and `S<n>`
  shots decide what each shot shows; design layout, typography, motion and transitions. Never
  edit the script.
- **Project**: `<board-state>/assets/<card id>/project/` in the project. Reuse it or run
  `npx hyperframes init <dir> --non-interactive`; pin HyperFrames as a project dependency.
- **Assets**: use ready or provisional visuals and audio from `video-assets`; label missing
  items as placeholders and exclude obsolete files. Keep the script's captions and narration.
  Crop full-frame captures to fit. Final editing and mixing remain the editor's work.
- **Timing**: use the script's shot durations until real audio settles them. HyperFrames owns
  media playback; animations and audio must seek with the same timeline.
- **Preview**: export each shot from the project as a self-contained `shot-<n>.hf.html` in
  `<board-state>/assets/<card id>/`, with runtime, fonts and media embedded. Reset its local
  clock to zero, preserving the shot's source offsets, motion and audio cues. Use the same
  source for preview and rendering; do not build a second animation just for the card.
- **Export**: keep a repeatable export command in the project; embed runtime, fonts and media
  without network or local-path access, matching the installed board player runtime version.
- **Controls**: the board player owns playback, seeking and mute. Export only the composition;
  never embed a playbar, autoplay, or a separate media clock in the shot.
- **Verify**: lint and check the project, then inspect playback, pause and seeking in the board.
  Report blocked checks honestly. Keep a mid-shot `frame-<n>.png` as a static fallback.
- **Install**: nothing beyond HyperFrames.

## What to answer

The project path once, then one line per shot: `S<n>`, preview and fallback paths, layout and
motion, duration, and remaining provisional or missing assets. Report failed exports without
claiming they are playable. The script's author folds this into the review.
