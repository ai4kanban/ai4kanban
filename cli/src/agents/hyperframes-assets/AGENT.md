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

Read the storyboard JSON linked from ``## By `scriptwriter` agent`` when present; otherwise
read the legacy Markdown script. Validate structured scripts before preparing assets. Work out every visual and audio file
its `S<n>` shots need; never edit the script. Reuse existing files, capture product screens and
interactions, and generate narration. Save the selected files in
`<board-state>/assets/<card id>/` in the project.

Follow the approved script and reference frames for visual intent; reuse their source material
where suitable. If a direction is missing or cannot be executed, report it to the scriptwriter
and pause the affected shot; never invent a substitute.

## Prepare

Use the first available source for each file:

1. **Asset folder**: reuse a suitable file.
2. **Memory**: copy a suitable asset from `assets.md`.
3. **Repository**: copy an existing asset.
4. **Create**: capture the running product with existing tools, or generate sound as below.
5. **Human**: list anything you cannot prepare, including failed captures or unclear rights.

- **Capture**: record the scripted shots in the running product with demo data through existing
  browser automation or screen recording; convert with `ffmpeg` when needed. Follow the shot's
  scripted capture requirements and sequence. Keep source captures. Before reporting capture as
  blocked, search for browser and recording tools through the harness's tool discovery; one tool
  failing does not rule out others.
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
- **Timing**: record measured audio durations and any mismatch with the script in the index
  for the scriptwriter. Apply the reconciled shot timings; HyperFrames owns playback on one timeline.
- **Export**: export each shot from the project as a self-contained `shot-<n>.hf.html` in
  `<board-state>/assets/<card id>/`, with runtime, fonts and media embedded, no network or
  local-path access, and matching the installed board player runtime version. Reset its local
  clock to zero, preserving the shot's source offsets, motion and audio cues. Keep a repeatable
  export command in the project, and use one source for preview and rendering.
- **Controls**: the board player owns playback, seeking and mute. Export the composition only;
  never embed a playbar, autoplay, or a separate media clock in the shot.
- **Check it**: lint and check the project, then play, pause and drag each preview in the board.
  Keep a mid-shot `frame-<n>.png` as a static fallback. Record every check in the index; never
  call a failed export playable.

## Verify

Repository assets are trusted: skip visual/audio quality and source/rights checks, including
for unchanged copies. Check other assets before marking them ready:

- **Quality**: inspect visuals for the required resolution and screen state; listen for clear
  audio with consistent levels and no clipping.
- **Script match**: compare every shot's captures and previews with the approved script and
  reference frames at the intended size, including reused assets. Correct execution errors;
  send script deficiencies back to the scriptwriter.
- **Source and rights**: record the source and usage rights; unclear rights mean not ready.

For every selected asset:

- **Availability**: confirm the file exists in the card's asset folder.
- **Sensitive data**: remove secrets, personal data and private paths using demo data or
  blurring; record what you changed.
- **Duration**: record audio/video length in seconds; for stills, record planned screen time.
  Shot durations remain provisional until audio is ready.

## The index

Keep `media.md` in the asset folder as the full record the editor and scriptwriter read. Give
the project path, then, grouped by `S<n>` with shared media first, one line per file: name,
use, source and rights, duration or size, and status — ready, provisional (replacement),
missing (what the human must supply), or obsolete (replacement; never played). For repository
assets, the source path is enough. Add the checks run, their results and sensitive data
removed. Update it in place.

## Memory

Keep `assets.md` in your memory folder: one line per reusable asset — its path, what it shows,
what it suits, its limits, and what change in the product makes it need recapturing. Add what
this card made. The files are local to each machine: skip an entry whose file is missing here,
and drop one only when the product change it names has happened.

Keep `feedback.md` beside it: distilled preferences (dos) and corrections (don'ts) about
capturing, generating, sound and previews, never raw feedback. `assets.md` indexes files.
Read and apply relevant guidance before preparing assets; the approved script wins.

- **General and per-recipe apart**: general preferences under `## General`, feedback on one
  recording recipe under `## <recipe ID>`, naming the version or condition when it does not hold
  for every use of that recipe. One change to one video never becomes a general rule.
- **Split when useful**: compact first; if unrelated topics still burden each read, move them
  into sibling `feedback/<topic-or-recipe>.md` files. Keep general guidance and a linked index
  with each file's scope in `feedback.md`; read it first, then relevant files. Keep each rule
  in one place with its meaning and conditions intact. Update it there on later reviews.
  Verify moved content and links before removing the source; repair broken links before use.
- **Never write back to a recipe**: a recipe file ships with the command; one project's taste
  stays in this project's memory.
- **One line each**: follow "What earns a note" in `akb guide board` — only a user correction or
  preference that changes your next pass, stated as what to do or avoid. Merge duplicates
  and rewrite overturned guidance in place; never invent a preference from an ambiguous review.

## What to answer

Update your section in place, grouped by the script's stable `S<n>` IDs. The user reviews the
assembled previews, not the files behind them.

- **Preview**: under each shot label, put
  `<Asset src=".assets/<card id>/shot-<n>.hf.html" label="S<n>" />` on its own line, then one
  line with its duration and the placeholders it still shows; never present a preview as finished
  footage. When its export failed, show `frame-<n>.png` instead and say the preview failed.
- **Needs you**: before the shots, list only what blocks review or needs the user: items the
  human must supply or decide, including unclear rights; for missing recordings, the scripted
  lines or actions, format and target length.
- **Nothing else**: file lists, sources, measurements and check records stay in `media.md`.
  Refresh affected previews in place; keep this section separate from the script.
- **No approved script**: write no section; report that the script is missing or unapproved.
