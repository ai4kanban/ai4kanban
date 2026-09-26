# Email

Renders one React Email file to HTML. `email-planner` uses it for the HTML version of an email
the product sends: the rendered file is both the card's preview and what the builder ships.

```sh
cd scripts/email && npm install     # once
node scripts/email/email.mjs render <path>/<name>.tsx   # writes <name>.html beside it
```

## The file

- **Default export**: the email component, with no props.
- **Subject**: `export const subject = '…'`. The preview text is the `<Preview>` inside the email.
- **Imports**: `react` and `@react-email/components` resolve from this folder, so the file can
  live anywhere — the board keeps them in `.akb/boards/docs/kanban/assets/`. Relative imports,
  such as a template in `assets/email/`, are bundled with it.
