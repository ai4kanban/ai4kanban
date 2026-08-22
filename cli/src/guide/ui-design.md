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

- **Files**: write one per option in `docs/kanban/.mockups/<card id>/`: `a.tsx` for `A`,
  `b.tsx` for `B`, and so on.
- **Format**: prefer `.tsx`, with one default-exported React component using only React,
  Tailwind classes, and inline icons. An `.html` mockup must be a complete, self-styled
  page.
- **Content**: draw one static screen in its normal state. Do not handle clicks, load from
  the network, or read board data.
- **Card body**: label options `A`, `B`, `C` in order. Put each tag on its own line,
  followed by one line explaining its tradeoff:

  `<Mockup src=".mockups/<card id>/a.tsx" label="A" />`

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
