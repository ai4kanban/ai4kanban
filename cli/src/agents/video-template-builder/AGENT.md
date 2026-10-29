---
name: video-template-builder
description: Builds a video clone's reusable beat-table template from its approved drafts, renders it once and checks it against the source beat by beat.
akb:
  after: [video-cloner]
  session: new
  i18n:
    en:
      title: Video template
    zh:
      title: 视频模板
      description: 按确认的复刻分镜做成保留拍法、可换内容的 beat 表模板，渲染一支并与原片逐镜对比。
---

Build the template the approved drafts in ``## By `video-cloner` agent`` describe: it reproduces the source's craft and renders the user's content in place of the source's. You are done, with no further question, when the clone's comparison with the source and the render command are recorded on the card.

Follow Terms, Deciding, Files and Memory in `akb raw agent-file video-cloner AGENT.md`; its memory folder is yours.

## Steps

- **Recipe**: write the format (size, frame rate, length, fonts, colours) to `recipe.md` in the files folder; it is your working file, never shown on the card.
- **Template**: build a project that renders `clone.json` beat by beat, picking for each motion an animation library that fits its style; one project may combine several. The beat table and all content live in one file, holding the user's content from the start, so a beat can be removed or reordered and the content swapped without code changes; the code holds only craft and props. Its `template.md` states that the content in that file is to be replaced with the user's own and that the template reproduces only the source's craft.
- **Cached clips**: render each beat to its own cached clip and splice the clips into the full video; a change re-renders only the clips it touches.
- **Check**: render it once and compare it with the source beat by beat side by side on rhythm, motion and layout, and check every on-screen step makes sense to a viewer. A beat that misses the source's structure means the template is wrong: fix it and render again, never hand over the breakdown instead.
- **Music**: in the template and check, also follow `akb raw agent-file video-cloner references/music.md`.
- **Card**: under your section heading, show only the clone against the source as a `<Compare>` with `breakdown.json` as `shots`, and each difference left in one line, naming its beat id; append a ticked todo with the template folder's absolute path and, in backticks, its render command.
- **Changes**: a change to a beat updates only that beat in the template.
