---
title: Open a Cloud board in the browser
track: features
priority: med
roi: high
status: todo
release: ""
blocked_by: [314]
related: [311]
modules: [cloud, local-ui]
questions:
  - question: "[user] Which release ships the browser surface? Deferring it means a Cloud board has no page a community can read, and a member away from their machine can press the two decisions Slack carries but cannot open a card or Resolve one."
    mode: single
    options:
      - 0.9.0 — the version after team collaboration lands, so app-first Cloud gets one release of real use first
      - with pricing and open signup — the public roadmap page is what makes an open project's board worth publishing, and that is a distribution moment
      - no release — wanted, but nothing promises it a version yet
    recommend: [1]
---

Give a Cloud workspace a URL. Today Cloud is reachable only from the installed app (#316),
so a maintainer cannot publish a roadmap the community can read, and a member away from
their machine can press the two decisions Slack carries but cannot open a card, read it whole,
or Resolve one. This card adds the hosted pages that make #314's public read-only access and
`goal.md`'s browser decision inbox real.

## Worth noting
- **Not in 0.8.0**: team collaboration ships app-first, so #311's group leaves the browser
  out and nothing in it renders a Cloud page. This card is where that surface lands.
- **The public page is the reason an open project would move to Cloud**: `goal.md` promises a
  community can read a project's roadmap and progress without installing anything, and
  today only a `docs/kanban/` folder in a repository does that.

<!-- agent -->

## Today
- Cloud has no page at a URL. #314 stores an owner/member role model and #316 drives every
  mutation from the app and CLI over the same authenticated endpoints.
- #319's notification center runs inside the installed app, and #320's Slack message records
  its own decision in Cloud and links into the app for the rest. Nothing renders a board at a
  URL.
- `kanban-ui/` already renders a board, a card page, and the Resolve flow against the board
  provider #312 defines, which is what a hosted page would render too.
- The site in `web/` is a static export on Cloudflare Pages; these pages are a different app
  and do not belong in it.

## Scope
- Serve a public read-only page for a workspace an owner has made public: the board, its
  cards, and its releases, with no sign-in.
- Serve authenticated pages for a signed-in member: card review and the Resolve flow, with
  the same lease, revision, and attribution rules every other write obeys.
- Let an owner turn public read-only access on and off, and make a private workspace's URL
  refuse an unauthenticated reader rather than leak a card title.
- Open these pages from #320's Slack actions and #319's notifications, so a link works on a
  device with no app installed.
- Keep the pages a client of the same Cloud endpoints as the app — no second write path, no
  server-rendered board authority.
- Out of scope: creating or importing a workspace from the browser, membership management,
  delivery, and anything that touches a repository.

## Todo
- [ ] Host the pages and route a workspace URL to them.
- [ ] Render the public read-only board for a workspace an owner has published.
- [ ] Refuse a private workspace's URL to an unauthenticated reader.
- [ ] Add GitHub sign-in and the authenticated card review and Resolve pages.
- [ ] Add the owner's public-access switch, in the app and on the page.
- [ ] Point #319's and #320's actions at these URLs.
- [ ] Check a public board reads without sign-in, a private one does not, and a Resolve from
      the browser is attributed to the member who performed it.

## Source
- #311 — the team-collaboration group that ships Cloud app-first and leaves this out.
- `plan.md` — the roles and the private-by-default workspace with a public read-only switch.
- `notify-plan.md` — the review and Resolve actions these pages have to answer.
- `docs/kanban/memory/goal.md`, the 团队协作 section — the public roadmap and the browser
  decision inbox.
