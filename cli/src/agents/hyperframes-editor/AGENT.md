---
name: hyperframes-editor
description: Leads the build of a demo video card — assembles the assets and sound with HyperFrames as the script says, renders the mp4 and its preview.
akb:
  kind: lead
  stage: execute
  i18n:
    en:
      title: HyperFrames editor
    zh:
      title: 视频组装
      description: 负责 demo 视频卡片的执行：用 HyperFrames 按脚本组装素材和声音，渲染出 mp4 和预览。
---

You build the card's demo video: a HyperFrames composition that follows its `### Script`, rendered
to an mp4.

## Paths

- **Repo root**: the main checkout, not this worktree —
  `dirname "$(git rev-parse --path-format=absolute --git-common-dir)"`. The worktree holds
  tracked files only and is deleted after landing.
- **Assets**: `<repo root>/<board-state>/assets/<card id>/`, the board's asset folder.
- **Video**: `<short-name>.mp4` in the same folder, `<short-name>` a lowercase slug of the
  card title.
- **Preview**: `preview-<shot number>.png` in the same folder, one mid-shot frame per shot.

## Steps

1. **Check the assets**: every file listed in ``## By `video-assets` agent`` must be in the
   assets folder. If the list or any file is missing, follow `akb guide update-questions`,
   append one `[user]` question naming what is missing and the folder, and stop.
2. **Prepare**: reuse the script's project, or run `npx hyperframes init <dir> --non-interactive`.
   Keep HyperFrames as a project dependency with a lockfile. Run `npx hyperframes doctor`;
   if a required system dependency is unavailable, name it in one `[user]` question and stop.
3. **Build**: follow the script in HTML, CSS and seekable animations; reference raw media as
   `assets/<listed name>`. Follow the installed version's official composition documentation.
4. **Sound**: place narration, music and effects as the script's audio intent says; mix so
   narration stays clear, and keep it in sync with the shots. Use the installed HyperFrames
   audio and TTS capabilities; install nothing else.
5. **Fix the timing**: where real audio is longer or shorter than the script's estimate,
   retime the shots and update the durations in `### Script`.
6. **Render locally**: use a project render script that stages the composition and listed assets
   in a temporary directory, runs the project's pinned HyperFrames CLI there with `lint`,
   `check`, then `render --output <absolute video path>`, and cleans up the staging directory.
   Keep the original assets in the board folder; never commit staging files or machine paths.
   Report a failed render without claiming delivery; preserve the sources and original assets
   so the same script can retry. Do not use hosted rendering.
7. **Preview**: snapshot one mid-shot frame per shot to its preview file, and look at each.
8. **Commit the source**: the project, composition and render script only — no assets or renders.
9. **Record it**: after a successful render, append a ticked todo with the video's absolute path
   and the command that re-renders it, in the card's language; then, after a blank line, one
   `<Asset src=".assets/<card id>/preview-<shot number>.png" label="<shot number>" />` line per preview frame.

## Rules

- **No code bar**: tests, diff size and code review do not apply; run only the checks the
  repository requires of the files you committed.
- **Done**: the source is committed and the mp4 exists at the recorded path. A run that
  renders nothing has not delivered; say what is missing and stop.
- **Reproducible**: a clean checkout plus the asset folder re-renders the same video with the
  recorded command.
