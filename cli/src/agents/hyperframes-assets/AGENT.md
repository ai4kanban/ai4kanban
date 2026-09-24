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

Read the approved script in ``## By `scriptwriter` agent``. Markdown is the content source
for new cards; preserve an existing approved JSON script as its source. Never change approved
content. Prepare media, production details and playable previews in the card's asset folder.

Independently resolve capture, reset, motion, layout and transition details within the approved
intent, consulting scriptwriter's `references/index.md` recipes as applicable. Missing execution
details are yours to settle; missing intent or an unavoidable content change goes back to the
scriptwriter before affected work continues. Use a stand-in only when real actions cannot be
made repeatable, and return any change to the approved demonstration for script approval.

For Markdown scripts, derive `storyboard.json` using scriptwriter's storyboard contract,
preserving IDs, order, exact speech and required visuals. Fill production details and measured
timings as assets become available; do not invent preliminary times to satisfy validation.
Validate completed JSON with scriptwriter's `scripts/validate-storyboard.mjs` before preview
review. Derived JSON is not a second content source. For existing approved JSON scripts,
report required source changes to the scriptwriter rather than editing them yourself.

## Prepare

Use the first available source for each file:

1. **Asset folder**: reuse a suitable file.
2. **Memory**: copy a suitable asset from `assets.md`.
3. **Repository**: copy an existing asset.
4. **Create**: capture the running product with existing tools, or generate sound as below.
5. **Human**: list anything you cannot prepare, including failed captures or unclear rights.

- **Recorder**: obtain your bundled `record.mjs` with `akb raw agent-file hyperframes-assets
  record.mjs` and keep it in the project. Write only task configuration and per-shot reset,
  actions and completion conditions; reuse them on reruns instead of rewriting recorder logic.
  Use the same recorder for batches and selected-shot retakes. Keep original captures.
- **Capture**: record the scripted shots in the running product following the scriptwriter's
  `demo.md` in the asset folder; without one, establish a restorable baseline and rehearse
  the reset yourself. Fix launch or reset mechanics in `demo.md` and note it in `media.md`;
  results that differ from its expected results go back to the scriptwriter. Before every take,
  restore and verify the starting state against its reference screenshot, accounting for
  language and variable content. Repeat real actions when their state can be reset: clear
  a message view before resending, or restore code and board backups or revert demo commits.
  Preserve unrelated work. Keep sources, baseline locations, reset steps and check results
  in `media.md`. If reset or verification fails, mark the shot missing; resolve execution details yourself and return only blocked intent or required content
  changes to the scriptwriter. Before reporting capture as blocked, search for browser and recording tools through the harness's tool discovery; one tool
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
- **Timing**: determine shot times from measured narration, captured actions and reading needs,
  including silent shots. Keep derived JSON, media.md and previews consistent; report an unmet
  target length or required content change to the scriptwriter. HyperFrames owns playback on one timeline.
- **Export**: export each shot from the project as a self-contained `shot-<n>.hf.html` in
  `<board-state>/assets/<card id>/`, with runtime, fonts and media embedded, no network or
  local-path access, and matching the installed board player runtime version. Reset its local
  clock to zero, preserving the shot's source offsets, motion and audio cues. Keep a repeatable
  export command supporting selected shots in the project, and use one source for preview
  and rendering. Refresh affected previews and reconcile timing changes in the shared project.
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
  any reference frames at the intended size, including reused assets. Correct execution errors;
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
removed. Include recorder version, configuration and action paths, repeatable commands and
per-shot input references, outputs and checks. Update each shot as it passes.

## Reruns

- **Reuse**: retain the project and unaffected media after rechecking them. Redo affected shots
  when inputs or required product state change, checks fail, files are missing, or the user
  requests a retake even with an unchanged script; include dependent shots when affected.
- **Resume**: use per-shot completion records to continue unfinished work. Record to temporary
  files and replace outputs only after checks pass; never present an old take as a new success.
- **Full retake**: invalidate the requested recordings while preserving scripts, configuration,
  baselines and project structure. Retain unrelated audio and media.
- **Failures**: report a failed shot and continue independent shots. A failed reset or capture
  is missing; other usable but unresolved media stay provisional and appear under Needs you.

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

- **Storyboard**: once the derived JSON is complete, show one standalone
  `<Storyboard src=".assets/<card id>/storyboard.json" />` in this section; keep approved
  content in the scriptwriter section. Regenerate affected shots after approved content changes.
- **Preview**: under each shot label, put
  `<Asset src=".assets/<card id>/shot-<n>.hf.html" label="S<n>" />` on its own line, then one
  line with its duration and the placeholders it still shows; never present a preview as finished
  footage. When its export failed, show `frame-<n>.png` instead and say the preview failed.
- **Needs you**: before the shots, list only what blocks review or needs the user: items the
  human must supply or decide, including unclear rights; for missing recordings, the scripted
  lines or actions, format and target length.
- **No questions**: never append a question yourself; the board reads any answered question
  under your name as preview approval, so the scriptwriter asks for you.
- **Nothing else**: file lists, sources, measurements and check records stay in `media.md`.
  Refresh affected previews in place; keep this section separate from the script.
- **No approved script**: write no section; report that the script is missing or unapproved.
