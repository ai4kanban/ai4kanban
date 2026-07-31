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
- Product names, file names, track names, shell commands, and the terminal capture on
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

## The quick start

- The site's quick start shows one command, `npx ai4kanban install` — never a list of
  shell steps and never a `curl … | sh` line.
- **Which GitHub repo do the site's links point at?**: `ai4kanban/ai4kanban`. The project
  moved off `dist0com/ai4kanban`, so no page leans on the old redirect.

## Vibe Kanban comparison

- Say plainly that Vibe Kanban shut down and its repo is stalled. Don't soften it.
- Name and link no competitor, alternative, or community fork. For readers who wanted
  parallel-agent orchestration, say our skill isn't that and stop there.
