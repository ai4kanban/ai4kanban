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

## Vibe Kanban comparison

- Say plainly that Vibe Kanban shut down and its repo is stalled. Don't soften it.
- Name and link no competitor, alternative, or community fork. For readers who wanted
  parallel-agent orchestration, say our skill isn't that and stop there.
