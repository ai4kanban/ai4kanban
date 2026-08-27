# Design a screen

Read this before planning a card that changes a screen.

## Describe the screen

- **Match the existing product**: inspect its screens and reuse their colours, fonts, and
  spacing. If it has no style, use a plain, neutral one.
- **Say what the user sees and does**: not the parts the screen is built from. "Each card
  is a row with its title and a Run button", not "a CardList of CardRows".
- **Cover empty and failure states**: say what the user sees and can do.

## Ask which layout by drawing it

Draw layout options instead of describing them in a question.

- **Format**: a rendered screen in a file, or a plain-text drawing in the card. A card uses
  one of them throughout — never a mix — and which one the `ui-design` agent draws is the
  board's Mockup style setting (`akb spec`).
  - **A rendered screen** is one file per option in `docs/kanban/.mockups/<card id>/`, named
    for its label: `a` for `A`, `b` for `B`. Write it as `.tsx` — one default-exported React
    component using only React, Tailwind classes, and inline icons — or as `.html`, a
    complete self-styled page, for a screen that is not a component. Draw terminals and
    command output as monospaced text inside the mockup too.
  - **A plain-text drawing** goes in the card body itself, in a fenced block under a `###`
    heading naming its label. Draw the boxes, labels, controls and real-looking data the user
    sees, not boxes named "content area". No line may exceed 96 columns. Use plain ASCII or
    `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`; emoji and full-width characters break alignment. Put colour,
    hover and click-only details in a short `[note]` line below the drawing, inside its block.
- **Content**: draw one static screen in its normal state. Do not handle clicks, load from
  the network, or read board data.
- **Card body**: label options `A`, `B`, `C` in order. The drawing says what the layout is,
  so nothing under it describes it back. A rendered screen is one tag per option, standing
  in a paragraph of its own — a blank line above it and a blank line below:

  ```
  <Mockup src=".mockups/<card id>/a.tsx" label="A" />

  <Mockup src=".mockups/<card id>/b.tsx" label="B" />
  ```

  A tag sharing a line or paragraph with prose is printed as text. `src` is relative to
  `docs/kanban/`, and `label` is optional. `<Mockup>` is the only HTML tag allowed in a card
  body; inside backticks or a fenced block, it remains text.
- **Question**: ask one short line whose options are only those labels:

  ```
  akb board update-questions <id> --append "[user] Which layout for the run panel?" \
    --recommended-option "A" --option "B"
  ```

Keep the mockups in the card body, not the question.

## Mockup lifetime

Mockup files are keyed by card ID, so they survive track changes. Archiving or rejecting a
card deletes its mockups; doing so to a group also deletes its subtasks' mockups. Because
`.mockups/` is gitignored, missing mockups may need to be redrawn — a plain-text drawing
sits in the card, so it travels with it. Record the final design in the card itself.
