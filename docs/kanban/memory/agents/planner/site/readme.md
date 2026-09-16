# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## The site in five languages

- The landing page and the comparison pages read in Chinese, Spanish, Japanese and French at
  `/zh`, `/es`, `/ja`, `/fr`. English keeps its old URLs, a footer switcher moves between
  languages by hand, and nothing redirects by browser language. Recipes and the Markdown
  mirrors stay English.

## Getting started

- The landing page starts you on the board app in all five languages: the download is the top
  button and the only way in it offers, with one line saying the app installs `akb` at first
  open, and the getting-started section shows what setup actually does.
- The plain-Markdown mirror at `/index.md` and the file index at `/llms.txt` say the same as
  the page they mirror.
- The home page's agent strip names every agent the board runs, in all five languages and in
  the plain-Markdown copies.
- The home page's last loop step shows Configuration → Board the way the app draws it: the
  jobs you start yourself over the ones the board can run on its own, each with its own
  runtime and instructions. Both READMEs' at-a-glance figure carries the same drawing.
- That step's text, in all five languages, separates the one automatic job that ships on —
  reviewing chat memory, daily — from the ones that wait to be switched on.

## Comparison pages

- `/vs-task-master` — what each needs from you on day one, one `tasks.json` versus one
  Markdown file per card, and where Task Master is ahead.
- `/vs-linear` — repo-local agent planning versus Linear's team workspace, with honest
  guidance on who should stay with Linear.
- `/vs-vibe-kanban` — where Vibe Kanban stands after Bloop closed, what it still does better,
  and who should pick which. It names no forks and no other alternatives.
- `/vs-hermes-kanban` — its memory section names the files the board really writes.

## Recipes

- `/recipes/competitor-analysis-loop` — one feature checklist per competitor, where the bare
  lines are the gap list: `web/public/recipes/competitor-analysis-loop.md`.
- `/recipes/daily-kanban-maintenance` — rewriting the project-wide and per-module memory sets
  to keep only what still helps plan: `web/public/recipes/prune-the-memory.md`.

## Legal and Cloud pages

- [/cloud](https://ai4kanban.dev/cloud) says what AI4Kanban Cloud is: what the relay carries,
  that nothing is sent until Cloud is turned on, what stays on the machine, what the preview
  does not ship, and how somebody signs in and asks for an invite.
- [/privacy](https://ai4kanban.dev/privacy) and [/terms](https://ai4kanban.dev/terms) are
  English-only pages set in the blog's prose, linked from the footer in all five languages,
  naming NULLREACH LTD as the operator and `support@ai4kanban.dev` for support and data
  requests. Each page's effective date is also its sitemap `lastmod`.
- Both describe the Cloud that actually ships — a relay for one signed-in account, and a
  workspace where the board itself is kept when you ask for it — saying which records are
  kept, what deletes each one, and that the one removal the service has takes the whole
  account.
- `/privacy` covers what an event holds and its 30-day sweep, what a chat connection holds,
  anonymous usage reporting with every field, where it goes and how to have an install's
  events deleted, and what booking a training session sends us.
- The subprocessor table names the mailbox behind `support@ai4kanban.dev` and places it in
  the United States.

## Training

- [/training](https://ai4kanban.dev/training) sells one-to-one project guidance and takes the
  booking on the page: what a session covers, $99 for one and $349 a month for four, and the
  visitor's own current week hour by hour in their timezone. Confirming holds that hour there
  and then, and the confirmation's link is the only way to cancel it. It is the site's one
  form, published in English at `/training` and Chinese at `/zh/training` only.
