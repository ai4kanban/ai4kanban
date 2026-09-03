## Mockup format: a rendered screen

Each mockup is one file in `docs/kanban/.mockups/<card id>/`, named for its label: `a` for
`A`, `b` for `B`.

- **`.tsx`**: one default-exported React component using only React, Tailwind classes, and
  inline icons.
- **`.html`**: a complete self-styled page, for a screen that is not a component.

Draw terminals and command output as monospaced text inside the mockup too.

Point at each file from your section with one `<Mockup>` tag standing in a paragraph of its
own — a blank line above it and a blank line below:

```
<Mockup src=".mockups/<card id>/a.tsx" label="A" />

<Mockup src=".mockups/<card id>/b.tsx" label="B" />
```

A tag sharing a line or paragraph with prose is printed as text. `src` is relative to
`docs/kanban/`, and `label` is optional. `<Mockup>` is the only HTML tag allowed in a card
body; inside backticks or a fenced block, it remains text.
