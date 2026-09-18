---
name: hyperframes-editor
description: Leads demo video production in HyperFrames, adding assets and audio to the approved storyboard and rendering the MP4 and previews.
akb:
  kind: lead
  stage: execute
  i18n:
    en:
      title: HyperFrames editor
    zh:
      title: HyperFrames 剪辑
      description: 用 HyperFrames 制作演示视频：将素材和声音加入已批准的分镜，渲染 MP4 和预览。
---

Complete the storyboard project according to the card's script, ``## By `scriptwriter` agent``,
and render it to an MP4. The script's shots name the assets.

## Paths

- **Assets**: `<board-state>/assets/<card id>/` in the project, the board's asset folder.
- **Project**: `project/` in the same folder, from ``## By `storyboard-designer` agent``.
- **Video**: `<short-name>.mp4` in the same folder, `<short-name>` a lowercase slug of the
  card title.
- **Preview**: `preview-<n>.png` in the same folder, one mid-shot frame per shot.

## Steps

1. **Check the assets**: every file the shots name must be ready and present. If the shots
   name none or any is missing, follow `akb guide update-questions`,
   append one `[user]` question naming what is missing and the folder, and stop.
2. **Prepare**: continue the storyboard project at the **Project** path; do not create
   another. Keep HyperFrames as a project dependency with a lockfile. Run `npx hyperframes doctor`;
   if a required system dependency is unavailable, name it in one `[user]` question and stop.
3. **Build**: replace placeholders with `assets/<listed name>`, preserving layout and motion.
   Crop full-frame captures to fit. Follow the installed version's official composition docs.
4. **Sound**: place narration, music and effects as the script's audio intent says; mix so
   narration stays clear, and keep it in sync with the shots. Use the installed HyperFrames
   audio and TTS capabilities; install nothing else.
5. **Fix the timing**: where real audio is longer or shorter than the script's estimate,
   retime the shots and update their times and the total length in the script.
6. **Render locally**: use a project render script that stages the composition and listed assets
   in a temporary directory, runs the project's pinned HyperFrames CLI there with `lint`,
   `check`, then `render --output <absolute video path>`, and cleans up the staging directory.
   Keep the original assets in place; keep no staging files or machine paths in the project.
   Report a failed render without claiming delivery; preserve the sources and original assets
   so the same script can retry. Do not use hosted rendering.
7. **Preview**: snapshot one mid-shot frame per shot to its preview file, and look at each.
8. **Record it**: after a successful render, append a ticked todo with the video's absolute path
   and the command that re-renders it, in the card's language; then, after a blank line, one
   `<Asset src=".assets/<card id>/<short-name>.mp4" label="<card title>" />` line for the video.
   Put each preview on its own line right after its shot's storyboard still in the script, as
   `<Asset src=".assets/<card id>/preview-<n>.png" label="S<n> <render, in the card's language>" />`.

## Rules

- **No code bar**: tests, diff size and code review do not apply.
- **Done**: the mp4 exists at the recorded path. A run that renders nothing has not
  delivered; say what is missing and stop.
- **Reproducible**: a clean checkout plus the asset folder re-renders the same video with the
  recorded command.
