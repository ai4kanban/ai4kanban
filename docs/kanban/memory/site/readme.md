# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## The site in five languages

- The landing page and the four comparison pages read in Chinese, Spanish, Japanese and
  French at `/zh`, `/es`, `/ja`, `/fr`. English keeps its old URLs, a footer switcher moves
  between languages by hand, and nothing redirects by browser language. Recipes and the
  Markdown mirrors stay English.

## Getting started

- The landing page starts you on the board app, in all five languages: the button at the
  top is the download, the getting-started section leads with the app and what a Mac user
  has to click through on first open, and carries a picture of the guided first run. The
  download is the only way in the section offers — no npm or npx line and no setup-prompt
  link. One line under it says the app installs the `akb` command at first open, so a reader
  who wanted a terminal knows the download already gave them one.
- The install section says what setup actually does: the agent asks only for the project
  goal, settles the first decisions from it, and creates the first ten tasks.
- The plain-Markdown mirror at `/index.md` and the file index at `/llms.txt` say the same
  as the page they mirror: the opening pitch, the comparison with a traditional board,
  the four steps that keep work moving, the project-memory file tree, continuous
  iteration, and getting started last.

## Comparison pages

- `/vs-task-master` — what each one needs from you on day one (a written PRD, or one rough
  line it asks questions about), the board as one `tasks.json` versus one Markdown file per
  card, and where Task Master is ahead: batch autonomous runs, built-in research, many more
  editors and model providers, and a paid hosted tier for teams.
- `/vs-linear` — repo-local agent planning versus Linear's team workspace, with current
  agent features, pricing, and honest guidance on who should stay with Linear.
- `/vs-vibe-kanban` — where Vibe Kanban stands after Bloop closed in April 2026, what it
  still does better (running many coding agents in parallel, which we don't do), and who
  should pick which. The page names no forks and no other alternatives.
- `/vs-hermes-kanban` — the memory section names the files the board really writes
  (`readme.md`, `decisions.md`, `rejected.md`, `redesign.md`, one folder per module, with
  `goal.md` on its own at the top of the memory folder), in all five languages and in the
  page's plain-Markdown mirror; the Multica mirror says the same as its page.

## Recipes

- The competitor analysis recipe at `/recipes/competitor-analysis-loop` keeps one feature
  checklist per competitor instead of a prose study: every feature they offer as one line,
  ticked when your users can already do it, carrying a card id when one of your cards is
  building it, and bare when nobody has touched it — the bare lines are the gap list the
  run files cards from. The published card is `web/public/recipes/competitor-analysis-loop.md`.
- The memory-pruning recipe at `/recipes/daily-kanban-maintenance` rewrites the project-wide
  and per-module memory sets to retain only what still helps plan future work. The
  published card is `web/public/recipes/prune-the-memory.md`.
- ZCode is on the home page's agent strip and named in the comparison pages, in all five
  languages and in the plain-markdown copies under `web/public/`, so someone on a Z.ai GLM
  plan can see the board runs on their agent before downloading anything.

## Legal pages

- `/privacy` and `/terms` are their own English-only pages, set in the blog's prose and
  linked from the site footer in all five languages. Both name NULLREACH LTD as the operator and
  `support@ai4kanban.dev` as the address for support and data requests. The bodies are MDX
  in `web/legal/`, and the effective date on each page is also its sitemap `lastmod`.

- **The privacy page says what a Cloud notification holds and how long it is kept.** A new
  "What an event holds" section under *Using AI4Kanban Cloud* names the task's number,
  title, release, revision and open questions — and says the card body, the plan and the
  board's folder are not among them — and both it and the retention list state that an
  event is deleted 30 days after it reaches a final outcome. The summary at the top of the
  page carries the same line in one sentence.

- **Both legal pages now describe the Cloud that 0.8.0 actually ships.** They described a team
  workspace holding a shared board, with members, roles, an owner's export and an owner's
  deletion — none of which exists. `/privacy` and `/terms` now describe a relay for one
  signed-in account's task events, point at [/cloud](https://ai4kanban.dev/cloud) for what the
  product is rather than describing it, and say what the release really does: which records it
  keeps and what deletes each one, that a board is registered under its folder's own name, that
  nothing but disconnecting Slack and the 30-day event sweep deletes anything on its own, and
  that the one removal the service has takes the whole account. The subprocessor table gains
  the mailbox behind `support@ai4kanban.dev` — Cloudflare Email Routing, forwarding to Spacemail
  (Spaceship, Inc.) in the United States — and a notice about the preview is now stated as mail
  sent by hand from that address, the app and Slack routes having been promises the release
  cannot keep.

## The Cloud page

- **[/cloud](https://ai4kanban.dev/cloud) says what AI4Kanban Cloud is.** One English page,
  linked from the site footer in all five languages beside Privacy and Terms: what the relay
  carries to the desktop and to Slack, that nothing is sent until Cloud is turned on for a
  board, what stays on the machine against what an event carries off it, what the preview does
  not ship, and how an invited person signs in and redeems a code. Nobody has to read the
  product out of a data policy any more.

