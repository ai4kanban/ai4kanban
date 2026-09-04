# Decisions

This module's settled answers to cards' open questions, grouped by topic. Keep only
**user-facing** calls that still guide future planning — what a user can see, do, or
would care about. Code detail stays on the card. Read before proposing so you don't
re-ask a settled call.

## Translations

- Translate the acquisition surface only: the landing page and the three vs pages. The
  recipes and the plain-Markdown page mirrors stay English — they serve AI crawlers and
  existing users, who read English fine.
- Never redirect a visitor by browser language. English is always the root; offer a
  visible language switcher.
- Translations are kept current by hand with a `/translate-sync` command — the same
  meaning said the way each language naturally would, not a literal translation. No
  pre-deploy gate.
- Language paths are `/zh`, `/es`, `/ja`, `/fr`; the switcher sits in the footer and
  labels each language in its own name. Chinese is published as Simplified only, so it
  is tagged `zh-Hans` — a bare `zh` would also claim Traditional readers.
- Product names, file names, module names, shell commands, and the terminal capture on
  the landing page stay English in every language. They're things a reader types or
  sees on their own screen, so translating them would mislead.
- A page that exists in only one language shows no language switcher — there'd be
  nowhere for the links to go.
- Translated copy is written and reviewed by the repo's `translator` skill, not gated on
  a native-speaker read. A native read is welcome later but never blocks publishing.

## What the copy promises

- **What does "no dashboard, no separate tool" promise?**: no *external* tool — nothing
  outside your repo to sync with. It never promised the board has no charts, so a view
  built into the board doesn't break it. Say "no external tool" in the copy.
- **Does the copy say a second agent reviews every delivery?**: no. Review is a detail of
  how a delivery works, not a selling point — keep it off the landing page and the
  comparison pages.

## The quick start

- **What is the landing page's main button?**: downloading the board app.
- **Does the landing page offer any way in but the download?**: no. The app carries `akb`
  and installs it at first open, so a terminal install is a second, worse route to the same
  board. No npm or npx line, and no setup-prompt link, on the landing page. One line says
  the app brings the command with it, for the reader who wanted a terminal.
- **Do the pages say the last setup steps go to a coding agent?**: no. The app finishes
  setup itself, so the pages are written for the app-first way in.
- The setup prompt stays linked from the READMEs and the npm page — read by someone who is
  already in a terminal — never from the landing page.
- **Which GitHub repo do the site's links point at?**: `ai4kanban/ai4kanban`. No page
  leans on the old `dist0com` redirect.

## Vibe Kanban comparison

- Say plainly that Vibe Kanban shut down and its repo is stalled. Don't soften it.
- Name and link no competitor, alternative, or community fork. For readers who wanted
  parallel-agent orchestration, say our skill isn't that and stop there.

## Linear comparison

- **Who is the Linear comparison for?**: Solo developers and small teams using an AI
  coding agent. Linear is a workspace for a team of people and agents; AI4Kanban is a
  repo-local board an agent plans in.

## The legal pages

- **Whose name is on the site's privacy and terms pages?**: Nullreach Ltd, registered in
  England and Wales, with English and Welsh law governing the terms. The same company
  publishes both pages for dist0, so the site's versions adapt those rather than starting
  from a template — one operator, one set of terms.
- **Are the legal pages translated?**: no. They follow the blog, which is English-only.
- **Which address do the legal pages give for support and data requests?**:
  `support@ai4kanban.dev`, on the site's own domain rather than the `support@dist0.com`
  mailbox Nullreach already runs. Any later page needing a contact uses it too.
- Behind it is Spacemail (Spaceship, Inc.), reached through Cloudflare Email Routing. The
  subprocessor table names it and places it in the United States, taken from Spaceship's own
  privacy policy — its DPA permits only a US transfer and publishes no subprocessor list, so
  the pages cite no document for the location.
