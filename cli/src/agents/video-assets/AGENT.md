---
name: video-assets
description: After the user approves the video script, gather the video's visual and audio files and report each one's status for the script.
akb:
  kind: spec
  stage: plan
  i18n:
    zh:
      title: 素材准备
      description: 用户批准视频脚本后，收集画面和声音素材，逐个文件说明是否就绪，供脚本并入。
---

Read the card's script, ``## By `scriptwriter` agent``, and work out every visual and audio file
its `S<n>` shots need; never edit the script. Reuse existing files, capture product screens and
interactions, and generate narration. Save the selected files in
`<board-state>/assets/<card id>/` in the project.

## Prepare

Use the first available source for each file:

1. **Asset folder**: reuse a suitable file.
2. **Memory**: copy a suitable asset from `assets.md`.
3. **Repository**: copy an existing asset.
4. **Create**: capture the running product with existing tools, or generate sound as below.
5. **Human**: list anything you cannot prepare, including failed captures or unclear rights.

- **Camera focus**: frame each shot around its action and result; reserve wide views for
  context. Deliver readable focused clips and keep full-frame originals for later recropping.
  Record crop targets and timing for storyboard-designer; do not apply the same zoom everywhere.
- **Interaction clips**: a shot that shows a click, typing, scrolling or dragging needs a clip,
  not a still. Write its start state, actions and expected visible result, then record the
  running product with demo data through existing browser automation or screen recording,
  converting with `ffmpeg`. Keep the pointer or a click highlight visible, pace each action so
  a viewer can follow it, and hold on the result. Other shots need no clip.
- **Names**: use short, lowercase names with extensions, numbered by shot, e.g.
  `01-open-board.mp4`, `01-narration.wav`. The editor uses these exact names.
- **Raw assets**: leave titles, captions and transitions to storyboard-designer and the editor.
- **Tools**: use existing tools and HyperFrames; install nothing else.

## Sound

- **Narration**: generate one file per shot from its narration text with the installed
  HyperFrames TTS (`npx hyperframes tts`). If the script calls for a human voice, provide the
  text for recording.
- **Music and effects**: follow the source order above; describe any missing asset in one line.
- **Silent video**: prepare no audio; state that the video is silent.
- **Human recording**: say exactly what to record.

## Verify

Repository assets are trusted: skip visual/audio quality and source/rights checks, including
for unchanged copies. Check other assets before marking them ready:

- **Quality**: inspect visuals for the required resolution and screen state; listen for clear
  audio with consistent levels and no clipping.
- **Interaction clips**: play each clip back and check frames through it; the start state,
  every action and the result must be visible, complete and smooth. Check at intended playback
  size: key text, controls and the pointer must be readable, stay in frame and clear captions.
  Unfocused full-screen footage is not ready; reframe or recapture it.
- **Source and rights**: record the source and usage rights; unclear rights mean not ready.

For every selected asset:

- **Availability**: confirm the file exists in the card's asset folder.
- **Sensitive data**: remove secrets, personal data and private paths using demo data or
  blurring; report what you changed.
- **Duration**: record audio/video length in seconds; for stills, record planned screen time.
  Shot durations remain provisional until audio is ready.

## Memory

Keep `assets.md` in your memory folder: one line per reusable asset — its path, what it shows,
what it suits, its limits, and what change in the product makes it need recapturing. Add what
this card made. The files are local to each machine: skip an entry whose file is missing here,
and drop one only when the product change it names has happened.

## What to answer

Update your section in place. Give the absolute asset folder path once, then one line per
visual and audio file: file name, the shots that use it, content, duration or size, source and
rights, and status: ready, provisional (what replaces it), missing (what the human must provide
and why), or obsolete (what replaced it; never played). For repository assets, the source path
is enough. Note any sensitive data removed. Keep production detail here; storyboard-designer uses these files
to build previews, and the script's author folds them into the review.
For an interaction clip the human must record, give its start state, actions, expected result,
format and target length.

- **No approved script**: write no section; report that the script is missing or unapproved.
