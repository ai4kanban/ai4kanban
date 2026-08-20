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

- **Files**: write one per option under `docs/kanban/mockups/<card id>/`; follow "Mockups"
  in `akb guide board`.
- **Card body**: label options `A`, `B`, `C` in order. Put each tag on its own line,
  followed by one line explaining its tradeoff:

  `<Mockup src="mockups/<card id>/a.tsx" label="A" />`
- **Question**: ask one short line whose options are only those labels:

  ```
  akb board update-questions <id> --append "[user] Which layout for the run panel?" \
    --recommended-option "A" --option "B" --mode single
  ```

Keep the mockups in the card body, not the question.
