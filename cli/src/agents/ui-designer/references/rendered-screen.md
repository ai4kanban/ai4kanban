## Mockup format: a rendered screen

A mockup is a folder of files under `docs/kanban/.assets/<card id>/`, and it starts as a copy
of the real screen's own source — never a lookalike written from scratch. Copy first, trim
second, and design only what this card changes.

### Build the copy

- **Copy the files**: find the components the screen is really built from and copy them into
  the card's folder, filenames and all, together with every file they import.
- **Point the imports at the copies**: rewrite aliases and any path that leaves the folder to a
  relative path inside it. A mockup reads its own folder and nothing else.
- **Bring the stylesheet**: copy the app's global stylesheet in and import it from the entry
  file — `import "./globals.css"`. It carries the theme, so without it the copy loses the
  product's colours, fonts and spacing.
- **Trim the wiring**: remove data fetching, server actions, file and board reads, storage,
  timers, and anything that answers a click. Put fixed sample data where they fed, showing the
  state this mockup is named for.
- **Keep the look**: layout, controls, sizes and classes stay exactly as the copy had them.
- **Design only the change**: write new markup only where the card adds or changes something.

### What the board can run

- **The entry file**: the `.tsx` the `<Asset>` tag names, default-exporting the screen. Name it
  in lowercase ASCII with dashes for the page or state it draws: `board-empty`,
  `card-run-failed`. Supporting copies keep their original names.
- **Available unchanged**: React, `react-icons/fi`, `react-icons/fa`, `react-icons/si`,
  `next/link`, `next/image`, `next/navigation`, `clsx`, `tailwind-merge`,
  `class-variance-authority`.
- **Nothing else**: no other package, no network, no `node:` module. Whatever is left must be
  copied into the folder as a file or trimmed out.
- **A snapshot, not a link**: the copy is frozen where it was taken. It neither reaches the
  running app nor follows the app when the app changes.
- **`.html`**: a complete self-styled page, for a screen that is not a component.

Draw terminals and command output as monospaced text inside the mockup too.

Point at each screen from your section with one `<Asset>` tag standing in a paragraph of its
own — a blank line above it and a blank line below:

```
<Asset src=".assets/<card id>/board-empty.tsx" label="Board, nothing on it" />

<Asset src=".assets/<card id>/card-run-failed.tsx" label="Card page, run failed" />
```

A tag sharing a line or paragraph with prose is printed as text. `src` is the entry file's name,
written exactly as above and resolved by the board; `label` is required and is the screen's name
for a reader, in the board's language. `<Asset>` is the only HTML tag allowed in a card body;
inside backticks or a fenced block, it remains text.
