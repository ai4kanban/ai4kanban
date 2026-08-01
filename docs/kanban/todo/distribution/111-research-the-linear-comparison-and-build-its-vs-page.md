---
title: Research the Linear comparison and build its vs page
track: distribution
priority: med
roi: med
status: todo
blocked_by: []
related: [5]
modules: [site]
questions:
  - question: "[user] Which reader should the vs-linear page aim at? This sets the whole page's angle."
    mode: single
    options:
      - Solo devs and small teams using an AI coding agent — Linear is built for a team of humans, we are a board an agent plans in. Closest to who we actually serve.
      - People already on Linear — frame us as something you run next to Linear, not instead of it. Honest, but a weak reason to try us.
      - People shopping for a cheaper Linear — lead on free, git-based, no lock-in. Most search traffic, but sets up a feature comparison we lose.
    recommend: [1]
---

Add a `vs-linear` page to the site, so people searching for Linear or for an
alternative to it find us.

Linear is a well-known project management and issue tracker for product teams. It is
much bigger than the tools our other vs pages compare against, so a lot of people
search for it. The page follows the same pattern as `vs-github-issues`,
`vs-hermes-kanban`, and `vs-vibe-kanban`: one comparison table, then a page built from
it, in all five languages.

The page has to be honest. Linear is a polished, mature tool a whole team lives in —
sprints, cycles, triage, integrations, a real app. We are a planning board in your repo
that an AI agent reads and writes. Say plainly where Linear wins and who should stay
there.

## Scope
- Research Linear as it is today: who it is for, what it costs, what it does with AI
  agents, and what it does not do.
- Pick the search terms the page targets, and check they are worth targeting.
- Write the comparison table first — it is the source the page is built from.
- Build the page from that table, matching the existing vs pages section for section.
- Ship it in English plus Chinese, Spanish, Japanese, and French, like the other vs
  pages.
- Link it in the header nav and in the language switcher, so it is reachable.

## Todo
- [ ] Research what Linear is today: audience, pricing, AI features, and where it fits.
- [ ] Pick the keywords the page targets and note the volume for each.
- [ ] Write the comparison table as `web/public/vs-linear.md`, same shape as the other
  vs source files.
- [ ] Build the route and page sections from that table.
- [ ] Translate the copy into Chinese, Spanish, Japanese, and French.
- [ ] Add the page to the header nav and to the translated-paths list the language
  switcher reads.
- [ ] Read the finished page for honesty: it must state where Linear wins and who
  should stay on Linear, with no unverified claim about their product or pricing.
- [ ] Typecheck and lint the site (`cd web && pnpm typecheck && pnpm run lint`).

## Decided by the agent
- One card or a group task? One card. It is a single page, built the same way three
  other pages already were — the same size of work as #5.
- English only, or all five languages? All five. Every other vs page is translated, and
  a missing key in a language is a build error, so shipping English only would break
  the site's own rule.
- Compare against Linear only, or also mention its alternatives? Linear only, same as
  the Vibe Kanban page decided — the page does not point readers at other tools.

## Out of scope
- Reworking the home page or README copy for Linear-related keywords. That is separate
  SEO work.
