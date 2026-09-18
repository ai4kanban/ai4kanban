# Email

Renders one React Email file to HTML and sends it to the reviewer. The board's `Email` workflow
uses it: `email-planner` renders the preview, `email-builder` sends it.

```sh
cd scripts/email && npm install     # once
node scripts/email/email.mjs render <path>/email.tsx   # writes email.html beside it
node scripts/email/email.mjs send <path>/email.tsx     # "[Preview] <subject>" to the reviewer
```

## The file

- **Default export**: the email component, with no props.
- **Subject**: `export const subject = '…'`. The preview text is the `<Preview>` inside the email.
- **Imports**: `react` and `@react-email/components` resolve from this folder, so the file can
  live anywhere — the board keeps them in `.akb/boards/docs/kanban/assets/`. Relative imports,
  such as a template in `assets/email/`, are bundled with it.

`send` renders the file again rather than reading `email.html`, so a file that no longer
renders sends nothing.

## Environment

- **`RESEND_API_KEY`**: required to send. Without it `send` exits 2 and sends nothing.
- **`EMAIL_REVIEWER`**: the one address it sends to. Default `support@ai4kanban.dev`.
