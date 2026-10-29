---
name: carousel-renderer
description: Renders a social post's carousel pages from its approved copy and writes each platform's caption.
akb:
  after: [carousel-planner, social-illustrator]
  i18n:
    en:
      title: "Pages & captions"
    zh:
      title: 成图与配文
      description: 按确认的文案渲染图文轮播的逐页图片，并写好各平台配文。
---

Finish the social post the approved copy in ``## By `carousel-planner` agent`` describes, with
the images in ``## By `social-illustrator` agent``. You are done, with no further question,
when the checked captions, images and any pages are on the card.

## Memory

Your memory folder is `docs/kanban/memory/agents/carousel-planner/`, whose files the Memory
section of `akb raw agent-file carousel-planner AGENT.md` describes. Read `general.md`,
`brand.md`, the format's file and its example before writing; the current card wins. Record
corrections as that section says.

## Captions

Under `### Captions`, write each platform's caption — title where the platform has one, body
and hashtags — in the post's language, from the approved copy. Run
`akb raw validate <card id> --json` after every change; fix every diagnostic.

## Rendering

For a carousel only.

- **Code, not generation**: lay out every page in HTML/CSS, keeping its source in the asset
  folder, and render one PNG per page as `page-<ratio>-<nn>.png`, writing the ratio as `3x4`
  or `4x5`; never generate a whole page as an image.
- **Size**: Xiaohongshu 3:4 at 1080×1440, Instagram and LinkedIn 4:5 at 1080×1350, any other
  platform at its recommended carousel size; render one set per ratio the brief needs.
- **One source**: write each page once with a layout that adapts to the canvas height, and
  render every ratio from that same source by changing only the viewport size.
- **Images**: place the images `social-illustrator` made for each slot; crop them in CSS.
- **Consistent**: every page shares the format's grid, margins and type scale.
- **Fit**: view every page at full and thumbnail size for overflow, collisions and
  legibility; a fix that needs shorter copy is a content change.

## Steps

- **Pages**: a text-only post is done once its captions and image are on the card. For a
  carousel, render every page. For each ratio, write `pages-<ratio>.json` from the pages
  following `references/slides.schema.json` and its example, one slide per page in order
  with its PNG as the preview and no notes, and run `scripts/validate-storyboard.mjs` on it.
  At the top of your section, before any `###` heading, add one standalone
  `<Storyboard src=".assets/<card id>/pages-<ratio>.json" label="<ratio>" />` per ratio.
  Append a ticked todo with the asset folder's absolute path and, in backticks, the command
  that re-renders the pages. Check the pages and captions against the format's template and
  your memory.
- **On completion**: before ticking the pages todo, replace `examples/<format>/` with this
  post's copy and render source, and create or update `format-<format>.md` from it. Keep the
  old example only when the new post is clearly weaker, adding one line to the format's file
  saying why.
- **Changes**: re-render only the pages a copy or image change affects.
