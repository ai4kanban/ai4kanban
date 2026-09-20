---
name: hyperframes-assets
description: After the user approves the video script, prepare its media and playable HyperFrames shot previews for review.
akb:
  kind: spec
  stage: plan
  i18n:
    en:
      title: HyperFrames assets
    zh:
      title: HyperFrames 素材
      description: 按已批准脚本准备画面、声音和可播放的逐镜预览，供用户审阅。
  output: human
---

Read the card's script, ``## By `scriptwriter` agent``, and work out every visual and audio file
its `S<n>` shots need; never edit the script. Reuse existing files, capture product screens and
interactions, and generate narration. Save the selected files in
`<board-state>/assets/<card id>/` in the project.

Follow the approved script for all creative choices. If a direction is missing or cannot be
executed, report it to the scriptwriter and pause the affected shot; never invent a substitute.

## Prepare

Use the first available source for each file:

1. **Asset folder**: reuse a suitable file.
2. **Memory**: copy a suitable asset from `assets.md`.
3. **Repository**: copy an existing asset.
4. **Create**: capture the running product with existing tools, or generate sound as below.
5. **Human**: list anything you cannot prepare, including failed captures or unclear rights.

- **Capture**: record the scripted shots in the running product with demo data through existing
  browser automation or screen recording; convert with `ffmpeg` when needed. Follow the shot's
  scripted capture requirements and sequence. Keep source captures.
- **Names**: use short, lowercase names with extensions, numbered by shot, e.g.
  `01-open-board.mp4`, `01-narration.wav`. The editor uses these exact names.
- **Tools**: use existing tools and HyperFrames; install nothing else.

## Sound

- **Narration**: for TTS, generate one file per voiced shot from its exact scripted lines with
  HyperFrames TTS (`npx hyperframes tts`). For a human voice, reuse the supplied recording or
  give the exact lines for recording and mark the audio missing; never substitute TTS silently.
- **Music and effects**: follow the source order above; describe any missing asset in one line.
- **Silent video**: prepare no audio; state that the video is silent.

## The preview

Build the approved script as one HyperFrames project: one animated scene per shot, exported as a
playable preview the user reviews in the board. The HyperFrames editor finishes this same project.

- **Project**: `<board-state>/assets/<card id>/project/` in the project. Reuse it or run
  `npx hyperframes init <dir> --non-interactive`; pin HyperFrames as a project dependency.
- **Build**: assemble the scripted shots with the prepared media. Label missing items as
  placeholders and exclude obsolete files. Final editing and mixing remain the editor's work.
- **Timing**: report measured audio durations and any mismatch with the script to the
  scriptwriter. Apply the reconciled shot timings; HyperFrames owns playback on one timeline.
- **Export**: export each shot from the project as a self-contained `shot-<n>.hf.html` in
  `<board-state>/assets/<card id>/`, with runtime, fonts and media embedded, no network or
  local-path access, and matching the installed board player runtime version. Reset its local
  clock to zero, preserving the shot's source offsets, motion and audio cues. Keep a repeatable
  export command in the project, and use one source for preview and rendering.
- **Controls**: the board player owns playback, seeking and mute. Export the composition only;
  never embed a playbar, autoplay, or a separate media clock in the shot.
- **Check it**: lint and check the project, then play, pause and drag each preview in the board.
  Keep a mid-shot `frame-<n>.png` as a static fallback. Report a failed or blocked check
  honestly, and never call a failed export playable.

## Verify

Repository assets are trusted: skip visual/audio quality and source/rights checks, including
for unchanged copies. Check other assets before marking them ready:

- **Quality**: inspect visuals for the required resolution and screen state; listen for clear
  audio with consistent levels and no clipping.
- **Script match**: play captures and previews at the intended size and compare them with the
  approved shots. Correct execution errors; send script deficiencies back to the scriptwriter.
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

Update your section in place, grouped by the script's stable `S<n>` IDs. Give the asset folder
and shared project path once; list shared media once before the shots.

- **Media**: present each shot's clips, images and audio with an `<Asset>` block on its own
  line, outside lists. State file name, content, duration or size, source and rights, and status:
  ready, provisional (replacement), missing (what the human must supply), or obsolete
  (replacement; never played). For repository assets, the source path is enough.
- **Preview**: under each shot label, put
  `<Asset src=".assets/<card id>/shot-<n>.hf.html" label="S<n>" />` on its own line. State its
  duration, remaining placeholders and fallback path; never present a preview as finished footage.
- **Blocked work**: report failed checks or exports without calling them playable. For missing
  human recordings, relay the scripted lines or actions, format and target length. Note sensitive
  data removed. Refresh affected media and previews in place; keep this section separate from
  the script.
- **No approved script**: write no section; report that the script is missing or unapproved.
