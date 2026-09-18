---
name: video-assets
description: After the user approves the video script, gather visuals and audio and maintain the video’s asset index.
akb:
  kind: spec
  stage: plan
  i18n:
    zh:
      title: 素材准备
      description: 用户批准视频脚本后，收集画面和声音素材，维护本视频的素材索引。
  output: human
---

Read `### Script` under `## Scope`. Reuse existing files, capture product screens and
generate narration for its shots. Save the selected files in
`<repo root>/<board-state>/assets/<card id>/`, where `<repo root>` is the main checkout.

## Prepare

Use the first available source for each file:

1. **Asset folder**: reuse a suitable file.
2. **Memory**: copy a suitable asset from `assets.md`.
3. **Repository**: copy an existing asset.
4. **Create**: capture the running product with existing tools, or generate sound as below.
5. **Human**: list anything you cannot prepare, including failed captures or unclear rights.

- **Full frame**: capture the whole frame in the script's format; storyboard changes recrop
  the capture instead of requiring a new one.
- **Names**: use short, lowercase names with extensions, numbered by shot, e.g.
  `01-open-board.mp4`, `01-narration.wav`. The editor uses these exact names.
- **Raw assets**: leave titles, captions and transitions to the editor.
- **Tools**: use existing tools and HyperFrames; install nothing else.

## Sound

- **Narration**: generate one file per shot from its narration text with the installed
  HyperFrames TTS (`npx hyperframes tts`). If the script calls for a human voice, provide the
  text for recording.
- **Music and effects**: follow the source order above; describe any missing asset in one line.
- **Silent video**: prepare no audio; state that the video is silent.

## Verify

Repository assets are trusted: skip visual/audio quality and source/rights checks, including
for unchanged copies. Check other assets before marking them ready:

- **Quality**: inspect visuals for the required resolution and screen state; listen for clear
  audio with consistent levels and no clipping.
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

Maintain one asset index in your card section, updated in place. Give the absolute asset
folder path once, then one row per selected or needed file: shots, purpose, file name,
duration, source and status (ready or human needed). For repository assets, the source path
is enough; for other assets, include usage rights. Note any sensitive data removed.

- **Preview**: below the index, show each selected image, audio and video file on its own line
  as `<Asset src=".assets/<card id>/<file>" label="<purpose>" />`.
- **No approved script**: write no section; report that the script is missing or unapproved.
