# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## The site in five languages

- The landing page and the four comparison pages read in Chinese, Spanish, Japanese and
  French at `/zh`, `/es`, `/ja`, `/fr`. English keeps its old URLs, a footer switcher moves
  between languages by hand, and nothing redirects by browser language. Recipes and the
  Markdown mirrors stay English.

## Getting started

- The landing page starts you on the board app in all five languages: the top button is the
  download, the getting-started section leads with the app and what a Mac user clicks
  through on first open, and carries a picture of the guided first run. The download is the
  only way in it offers — no npm or npx line, no setup-prompt link — with one line saying
  the app installs the `akb` command at first open.
- The install section says what setup actually does: the agent asks only for the project
  goal, settles the first decisions from it, and creates the first ten tasks.
- The plain-Markdown mirror at `/index.md` and the file index at `/llms.txt` say the same as
  the page they mirror.
- ZCode is on the home page's agent strip and named in the comparison pages, in all five
  languages and in the plain-markdown copies, so someone on a Z.ai GLM plan can see the
  board runs on their agent before downloading anything.

## Comparison pages

- `/vs-task-master` — what each one needs from you on day one, one `tasks.json` versus one
  Markdown file per card, and where Task Master is ahead: batch autonomous runs, built-in
  research, more editors and providers, and a paid hosted tier.
- `/vs-linear` — repo-local agent planning versus Linear's team workspace, with current
  agent features, pricing, and honest guidance on who should stay with Linear.
- `/vs-vibe-kanban` — where Vibe Kanban stands after Bloop closed in April 2026, what it
  still does better (running many coding agents in parallel), and who should pick which. It
  names no forks and no other alternatives.
- `/vs-hermes-kanban` — its memory section names the files the board really writes, in all
  five languages and in the plain-Markdown mirrors.

## Recipes

- `/recipes/competitor-analysis-loop` keeps one feature checklist per competitor instead of
  a prose study: every feature as one line, ticked when your users can already do it,
  carrying a card id when a card is building it, and bare when nobody has touched it — the
  bare lines are the gap list. Published card:
  `web/public/recipes/competitor-analysis-loop.md`.
- `/recipes/daily-kanban-maintenance` rewrites the project-wide and per-module memory sets
  to keep only what still helps plan future work. Published card:
  `web/public/recipes/prune-the-memory.md`.

## Legal and Cloud pages

- `/privacy` and `/terms` are English-only pages set in the blog's prose, linked from the
  footer in all five languages, naming NULLREACH LTD as the operator and
  `support@ai4kanban.dev` for support and data requests. The bodies are MDX in `web/legal/`,
  and each page's effective date is also its sitemap `lastmod`.
- Both describe the Cloud that actually ships: a relay for one signed-in account's task
  events, not a team workspace. They say which records are kept and what deletes each one,
  that a board is registered under its folder's own name, that nothing but disconnecting a
  chat connection and the 30-day event sweep deletes anything on its own, and that the one
  removal the service has takes the whole account.
- `/privacy` says what an event holds — number, title, release, revision and open questions,
  not the card body, the plan or the board's folder — that it is deleted 30 days after a
  final outcome, and which message in a chat a card's is (the board, task number, chat and
  the chat's own identifier for that message, and none of its words).
- The subprocessor table names the mailbox behind `support@ai4kanban.dev` — Cloudflare Email
  Routing forwarding to Spacemail (Spaceship, Inc.) in the United States — and a notice
  about the preview is stated as mail sent by hand from that address.
- [/cloud](https://ai4kanban.dev/cloud) says what AI4Kanban Cloud is: one English page,
  linked from the footer in all five languages, covering what the relay carries, that
  nothing is sent until Cloud is turned on for a board, what stays on the machine, what the
  preview does not ship, and how somebody signs in, asks for an invite and is answered.
- All three pages name Lark beside Slack: what a connection holds, what leaves Cloud for
  that chat on your own instruction, and that disconnecting either is a removal you can make
  yourself.
- The landing page's agent strip and the Linear, Multica and Task Master comparison pages
  name Grok Build alongside the other six agents, in all five languages.
