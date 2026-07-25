---
title: Research the Vibe Kanban comparison and build its vs page
track: distribution
priority: med
roi: med
status: todo
blocked_by: []
related: [2]
modules: [site]
questions:
  - The page copy was written by a prior run that skipped the card's 'get the table reviewed' gate (and it still carries the fork mentions the framing decision forbids). Do you want to review/approve the finished page copy — hero, the 'where Vibe wins' section, decision columns — before it ships, or is trimming the fork mentions the only thing left before this is done?
---

The `vs-vibe-kanban` page is **already built** (see "What already shipped"). This card is
now about one thing: bringing that page in line with the resolved framing, then checking it
before it ships.

The vs pages exist mainly for SEO — they catch people searching for one tool and show them
ours. We already ship `vs-github-issues` and `vs-hermes-kanban`, and this page follows the
same pattern.

Vibe Kanban is the best-known "kanban for AI coding agents" and it is shutting down (Bloop
closed in April 2026; the project went open source under Apache-2.0 but the official repo
has had no commits since late April 2026). That leaves people searching for where to go
next. We catch some of them — but only if we are honest: Vibe Kanban is a cockpit for
running many coding agents in parallel; our skill is a planning board an agent edits in your
repo. We do not orchestrate parallel agents, and the page has to say that plainly.

Keywords this page targets (US Google): `vibe kanban alternative` (~30/mo) and `vibe kanban
shutdown`. `vibe kanban` itself (1,900/mo, difficulty 12) is branded and navigational —
every top result is Vibe Kanban itself, so we don't headline it.

## Framing decisions (resolved)
- **Frame the page on the honest shutdown version — approved.** Build it on: Bloop closed
  in April 2026, the project went fully local, and the official BloopAI/vibe-kanban repo
  has had no new commits since late April 2026 (last was v0.1.44 on Apr 24, 2026, verified
  against the repo's own commit history). This blunt version is fine; don't soften it.
- **Center the page on the official Vibe Kanban — do not point readers elsewhere.** The page
  compares us against the official Vibe Kanban only. Do **not** name or link any competitor,
  still-maintained alternative, or community fork — not even a generic "keep an eye on the
  community forks" nudge. Where a reader came for parallel-agent orchestration (which we
  don't do), say plainly our skill isn't that and stop there.

## What already shipped
The page and its parts are written and wired in — staged in git, not yet committed:
- `web/public/vs-vibe-kanban.md` — the markdown comparison table, the source the page is
  built from (matches the shape of `vs-github-issues.md`).
- `web/app/vs-vibe-kanban/` route and `web/components/vs-vibe-kanban/` parts (hero, purpose,
  comparison matrix, "where each wins", decision columns, summary).
- Linked in the header nav. The sitemap auto-discovers every `vs-*` route, so it's already
  covered — no manual sitemap edit needed.

## Todo
- [x] Research what Vibe Kanban is today and its shutdown status.
- [x] Write the comparison as `web/public/vs-vibe-kanban.md`.
- [x] Build the route and components from the table.
- [x] Add the page to the header nav (sitemap auto-discovers it).
- [ ] Remove every "community fork" mention — it breaks the resolved "don't point readers
  elsewhere" rule. Four spots: the last item in `decisionVibe` in `vs-vibe-content.ts`,
  `VkSummary.tsx`, `VkPurpose.tsx`, and the matching lines in `web/public/vs-vibe-kanban.md`.
  Replace each with the plain "our skill isn't that engine, and stop there" line — no nudge
  to a fork.
- [ ] Read the finished page against the two framing decisions and check the copy is honest
  and matches the source table.
- [ ] Typecheck and lint the web build (`cd web && pnpm typecheck && pnpm run lint`).

## Out of scope
- Reworking the README or home-page copy for keywords like `claude code kanban` or
  `markdown task board`. That is separate site/SEO work, not this page.
