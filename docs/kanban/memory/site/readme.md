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
  terminal way sits under it as one command, `npx ai4kanban install`, with the setup prompt
  as a plain link rather than a second button.
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

## Recipes

- The competitor analysis recipe at `/recipes/competitor-analysis-loop` keeps one feature
  checklist per competitor instead of a prose study: every feature they offer as one line,
  ticked when your users can already do it, carrying a card id when one of your cards is
  building it, and bare when nobody has touched it — the bare lines are the gap list the
  run files cards from. The published card is `web/public/recipes/competitor-analysis-loop.md`.
