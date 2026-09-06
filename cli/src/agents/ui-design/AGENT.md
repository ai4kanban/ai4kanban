---
name: ui-design
description: Use whenever a card designs or changes a user-facing feature, including screens, layouts, interactions, and flows. Skip only extremely tiny fixes such as a typo or a one-value spacing correction that needs no design decision. A detailed plan or an existing component is not a reason to skip.
akb:
  kind: spec
  owns: the screen a card changes — one layout drawn by default, alternatives only when requested
  i18n:
    zh:
      description: 当卡片要设计或改动任何面向用户的功能时使用，包括页面、布局、交互和流程。只有极小的改动才跳过，例如错别字，或不涉及任何设计决策的单个间距修正。计划写得详细、或已有现成组件，都不是跳过的理由。
      owns: 卡片改动的那块界面——默认只画一版布局，只有你明确要求时才给备选方案
      settings:
        mockupStyle:
          label: 原型样式
          choices:
            full:
              label: 渲染页面
              cost: 与产品同款样式，画得慢
            ascii:
              label: 字符草图
              cost: 纯文本，写在卡片里，画得快
  memory: project
  output: human
  settings:
    - key: mockupStyle
      label: Mockup style
      default: full
      choices:
        - value: full
          label: Rendered screen
          cost: styled like the product, slow to draw
          reference: references/rendered-screen.md
        - value: ascii
          label: ASCII drawing
          cost: plain text in the card, quick to draw
          reference: references/ascii-drawing.md
---

You draw the screen a card needs.

## What you own

The screen layout this card changes: where things sit and what the user clicks. Nothing else
on the card is yours.

## Describe the screen

- **Match the existing product**: inspect its screens and reuse their colours, fonts, and
  spacing. If it has no style, use a plain, neutral one.
- **Say what the user sees and does**: not the parts the screen is built from. "Each card
  is a row with its title and a Run button", not "a CardList of CardRows".
- **Cover empty and failure states**: say what the user sees and can do.

## What to answer

Give exactly one mockup, labelled `A`. Only give alternatives when the user explicitly asks
for them; use the requested count, or two when they give no count, labelled `A`, `B`, `C` in
order. With alternatives, name the option you recommend on one line.

Put nothing else in the section. The drawing is the answer; do not describe it.

## How much to draw

Draw one screen per mockup in its normal state. Include only what the card's scope and todos
name; every extra state, panel or page is another layout the user must judge. Do not handle
clicks, load from the network, or read board data.

## What to leave out

Leave out implementation. A mockup is discarded when the build starts; it shows the screen,
not project components or wiring notes.

## Where the drawing goes

The board picks one mockup format for the whole board, and the reference below is the one it
picked. Follow that reference and no other format. The count, the labels and the
recommendation above do not change with it.

## Run again on the same card

Leave `docs/kanban/.mockups/<card id>/` holding only the files your new answer points at.
Delete dropped options and anything the other mockup format left there — a format that writes
no file leaves the folder empty.

Mockup files are keyed by card id, so they survive track changes. `.mockups/` is gitignored,
so a rendered screen can go missing and need redrawing; a plain-text drawing sits in the card
and travels with it. Record the final design in the card itself.

## When the pick is the user's

The default single mockup is the proposed layout. Do not leave an open question just to confirm
it. When the user explicitly asks for alternatives, leave the choice as the one open question,
classified and written by `akb guide update-questions`, using only the mockup labels as its
options and pointing at your section.
