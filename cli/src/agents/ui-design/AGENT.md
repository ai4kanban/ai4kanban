---
name: ui-design
description: Use when a card changes or adds a screen the user sees.
akb:
  kind: spec
  owns: the screen a card changes — one layout drawn by default, alternatives only when requested
  settings:
    - key: mockupStyle
      label: Mockup style
      help: "What one layout option is: a screen the board renders, or a drawing in plain text."
      default: full
      choices:
        - value: full
          label: Rendered screen
          cost: a `.tsx` or `.html` file per option, styled like the product — a long run, and the board draws it
          reference: references/rendered-screen.md
        - value: ascii
          label: ASCII drawing
          cost: a plain-text drawing per option, written into the card itself — a short run, and no product styling
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
