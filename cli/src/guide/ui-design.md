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

- **Files**: write one per option in `docs/kanban/.mockups/<card id>/`, named for its
  label: `a` for `A`, `b` for `B`, and so on.
- **Format**: one of three, and a card uses one of them throughout — never a mix.
  - `.tsx` — one default-exported React component using only React, Tailwind classes, and
    inline icons. This is the one to prefer.
  - `.html` — a complete, self-styled page, for a screen that is not a component.
  - `.txt` — a plain-text drawing of the screen, no line longer than 96 columns and every
    character one column wide. The board shows it as it stands, so the file reads the same
    in a terminal as on the card.
  - Which one the `ui-design` agent writes is the board's Mockup style setting (`akb spec`).
- **Content**: draw one static screen in its normal state. Do not handle clicks, load from
  the network, or read board data.
- **Card body**: label options `A`, `B`, `C` in order. Each tag stands in a paragraph of
  its own — a blank line above it and a blank line below — and its tradeoff is the
  paragraph under it:

  ```
  <Mockup src=".mockups/<card id>/a.tsx" label="A" />

  Folded rows: … — what it is good for, at the cost of ….
  ```

  A tag sharing a line or a paragraph with prose is printed as text instead of drawn.
  `src` is relative to `docs/kanban/`, and `label` is optional. `<Mockup>` is the only
  HTML tag allowed in a card body; inside backticks or a fenced block, it remains text.
- **Question**: ask one short line whose options are only those labels:

  ```
  akb board update-questions <id> --append "[user] Which layout for the run panel?" \
    --recommended-option "A" --option "B" --mode single
  ```

Keep the mockups in the card body, not the question.

## Mockup lifetime

Mockups are keyed by card ID, so they survive track changes. Archiving or rejecting a
card deletes its mockups; doing so to a group also deletes its subtasks' mockups. Because
`.mockups/` is gitignored, missing mockups may need to be redrawn. Record the final design
in the card itself.
