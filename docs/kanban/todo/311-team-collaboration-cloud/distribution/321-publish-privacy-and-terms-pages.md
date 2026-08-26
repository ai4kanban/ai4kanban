---
title: Publish the privacy and terms pages the Cloud preview needs
track: distribution
priority: high
roi: med
status: implementing
release: 0.8.0
blocked_by: []
related: [293, 311, 314, 317, 325]
modules: [site, cloud]
questions: []
verify:
  - Route support@ai4kanban.dev with Cloudflare Email Routing on ai4kanban.dev, to a mailbox someone reads. This is account work no checkout can do, and both pages give that address for support and for a data request, so it has to answer before they go live.
  - "Check what the live Supabase project actually holds for a signed-in member against the privacy page's 'What signing in stores about you' list. The project is not provisioned yet (#323 left that account work to the user), so this was checked against the code only: cloud/src/auth.ts reads sub, email and app_metadata.provider off the token, and migration 0001 creates no member table. Open the auth.users row for a real GitHub sign-in before publishing and correct the list if it differs."
  - Deploy web/ so /privacy and /terms answer on ai4kanban.dev before the first outside team is invited, and before #327 emails any invitation code — #327's scope holds that order.
---

The Cloud preview keeps another team's board on servers we run, and the site says nothing
today about what that stores or what the preview promises. Publish a privacy page and a
terms page, linked from the site footer, before the first outside team is invited. #317's
Cloud choice links a reader to them from inside the app.

## Worth noting
- **Who runs Cloud**: Nullreach Ltd, a private limited company registered in England and
  Wales, is the operator on both pages and the data controller on the privacy page. That
  makes the preview a company's service under English law rather than one person's side
  project, which is what an outside team has to be able to check before it puts its board
  on us.
- **What notice does the preview promise before a workspace is deleted?**: no fixed period.
  The terms say we may end the preview or close a workspace at any time, and will give the
  workspace's owners reasonable notice where practical. A 30-day promise would be a period a
  team could plan around, but it would bind a free preview running on a free tier that can
  refuse writes or be withdrawn inside that month, and a promise we break costs more than one
  we never made. The cost is that the clause reads thin to someone deciding whether to trust
  the preview, so the terms put the export beside it as the copy a team controls.
- **Where a reader writes**: both pages give `support@ai4kanban.dev`, a new mailbox on the
  site's own domain, for support and for a data request. Sharing the `support@dist0.com`
  mailbox Nullreach already runs was the cheaper option, but someone reading a page on
  ai4kanban.dev should not have to write to another product's domain to exercise a right.
  The cost is one more mailbox to set up and watch.
- **The copy is adapted from Nullreach's live pages**: `dist0.com/privacy` and
  `dist0.com/terms` are the same company's published pages, so these follow their section
  order and legal framing instead of being drafted fresh. The cost is length — two pages of
  roughly 3,500 words each, where the telemetry ask in #293 links to the privacy page
  expecting a plain list of what the app sends. That list becomes one clearly marked
  section, not the whole page.
- **Built with the blog's prose, not as blog posts**: both pages are MDX bodies rendered by
  the same MDX components and prose stylesheet the blog uses, so no new page style is
  invented for them. They are their own routes rather than posts, which costs a small page
  file each and keeps a legal page out of the blog index, the feed, and a post's furniture —
  the author line, the "on this page" rail, and the `Article` markup that says this is
  journalism.
- **One privacy page covering three things**: the page answers the site, the app, and Cloud
  in that order — a reader arrives at one URL from all three, and three pages would make
  them find out which one they were sent to. #293 writes the app section, this card writes
  the other two, and whichever ships first builds the page around them.

<!-- agent -->

## Today
- The site has no privacy page and no terms page, and no page on it names a contact address
  — the footer offers GitHub, the docs, the recipes, the blog, comparisons, and an X handle.
- `/blog/[slug]` renders an MDX body from `web/blogs/` through `BlogMdx` and
  `app/blog-prose.css`, inside `Header` and `SiteFooter`. That route also draws a post's
  furniture: the date and author line, the "on this page" rail, and `Article` JSON-LD.
- The site runs no analytics and sets no cookies. The one script it serves is the inline
  redirect from `*.pages.dev` and the old `kanbanskill.cc` domain.
- The footer's links come from translated copy (`web/i18n/shared/*.ts`), and
  `LanguageSwitcher` returns nothing on a path outside `TRANSLATED_PATHS`, so an
  English-only page needs no locale route and shows no switcher.
- The site's origin is `https://ai4kanban.dev` (`web/lib/site.ts`), on the same Cloudflare
  account the site deploys from and #294 puts `t.ai4kanban.dev` on.
- Nullreach Ltd already publishes a privacy page and a terms page for its earlier product at
  `dist0.com`. Those are the source this card adapts, not a third-party template.
- #293 owns the app-telemetry section of the privacy page and has not shipped. The app
  reaches the network once today — it asks GitHub for the newest release — and sends nothing
  else.
- Sign-in is Supabase Auth's GitHub provider (#323), which writes an `auth.users` row of its
  own. Its default scopes include the member's email, so what the preview holds about a
  member is not settled by #314's tables alone, and none of it is built yet.
- #317 owns the link from the Cloud choice in onboarding, and already carries that step.
- The blog is English-only (`TRANSLATED_PATHS` in `web/lib/i18n.ts`), and these pages follow it.

## Scope
- Publish `/privacy` and `/terms` as their own English-only routes, rendering an MDX body
  with the blog's MDX components and prose stylesheet inside the site header and footer,
  without a post's author line, "on this page" rail, or `Article` markup.
- The privacy page runs in three sections — visiting the site, using the app, using Cloud —
  before the rights and boilerplate sections. #293 fills the app section; whichever card
  ships first builds the page around all three.
- If this card ships before #293, its app section describes the app as it is today — it asks
  GitHub for the newest release and sends nothing else — so no section is published empty.
- The site section states that the site runs no analytics, sets no cookies, and is served by
  Cloudflare.
- Both pages name the operator: NULLREACH LTD, a private limited company registered in
  England and Wales, Suite 11615, 61 Bridge Street, Kington, United Kingdom, HR5 3DJ.
- Both pages give `support@ai4kanban.dev` for support and for data requests, and the privacy
  page names Tao Wu as the data protection contact.
- Both pages show the date they take effect.
- Both follow the section order and legal framing of `dist0.com/privacy` and
  `dist0.com/terms`, with every product-specific passage rewritten for AI4Kanban.
- The terms are governed by the law of England and Wales, with the courts there.
- The privacy page keeps the rights sections that page already carries — UK GDPR, GDPR,
  Swiss law, and CCPA/CPRA — along with international transfers, retention, security, and
  children.
- The privacy page states, for Cloud: what a workspace stores, where it runs, who can read
  it, that code, credentials, and model keys never reach it, that no model is ever run over
  board content, that an owner can delete a workspace and everything in it, and where to
  write for a data request.
- The privacy page states that deleting a workspace removes it at once and that, because the
  preview keeps no backups, no copy of it survives elsewhere.
- The privacy page names where the workspace database runs — `eu-central-1`, Frankfurt, the
  region #323 creates it in — and names its two subprocessors inline: Cloudflare for
  compute and hosting, Supabase for the database and sign-in, with GitHub as the identity
  provider a member signs in through.
- The privacy page lists what signing in stores about a member — the GitHub login and public
  profile, and any email address Supabase Auth records with them — taken from what the live
  project holds rather than from what the OAuth app was registered with. This is the one place
  the preview may hold a personal contact detail, so the page states it exactly.
- The privacy page names a connected Slack destination as somewhere the team may choose to
  send board content, and says that content leaves Cloud on the team's own instruction.
- The terms page states that Cloud is an invite-only preview with no availability promise,
  and what we may do with a workspace.
- The terms page states how the preview ends: we may end the preview or close a workspace at
  any time, we give the workspace's owners reasonable notice where practical, and no fixed
  notice period is promised.
- The terms page says where such a notice is delivered — in the app and in any Slack channel
  the workspace has configured — and states that the preview sends no email at all.
- The terms page states that the preview keeps no backups, that exporting a workspace is how
  a team keeps its own copy, and that an export taken beforehand is what survives a workspace
  being closed.
- The terms page states that the preview is free today and that any paid plan arrives with
  notice before a charge.
- Both pages are linked from the site footer, which means two keys added to the shared
  footer copy and to each of its five languages; the pages themselves stay English.
- Both routes are listed in the sitemap as English-only pages, the way the blog and the
  recipes are.
- Out of scope: pricing, billing terms, a subprocessors page, a DMCA notice process, the
  link from the Cloud choice in onboarding (#317), and any public announcement of Cloud.

## Todo
- [x] Add `/privacy` and `/terms` as routes rendering an MDX body with the blog's MDX
      components and prose stylesheet.
- [x] Adapt the dist0 pages: keep their section order and boilerplate, rewrite every product
      passage for AI4Kanban.
- [x] Write the privacy page's site and Cloud sections, and the whole terms page.
- [x] Name the operator, its registered address, `support@ai4kanban.dev`, Tao Wu as the data
      protection contact, and the effective date on both pages.
- [ ] Route `support@ai4kanban.dev` to a mailbox someone reads, with Cloudflare Email
      Routing on the site's own domain.
- [ ] Check what the live project stores for a signed-in member against what the privacy page
      lists, before publishing.
- [x] Add both to the footer copy in all five languages, and to the sitemap.
- [x] Check the built export serves both pages, that the footer reaches them from every
      language, and that no link to them 404s.

## Decided by the agent
- **Why the site and not an in-app note**: someone weighing the preview reads this before
  putting their team's board on it, which means a URL they can open without installing
  anything first.
- **English only**: the pages follow the blog, which is not translated. The footer link
  labels are translated because the footer is, so a reader in any language can reach them.
- **Why adapt rather than draft**: the same company already publishes both pages for another
  product, so adapting them keeps one operator's terms consistent and skips a fresh legal
  review of boilerplate that is already in use.
- **No subprocessors page**: the preview has two subprocessors and one identity provider, and
  a page for a three-line list is more site than the list earns. They go inline on the
  privacy page.
- **Why Slack is not listed as a subprocessor**: the team connects its own Slack destination
  and chooses to send board content there; the privacy page names that disclosure without
  presenting Slack as infrastructure AI4Kanban uses to run Cloud.
- **Why deletion can be promised outright**: the preview keeps no backups (#311), so there is
  no second copy to chase before the promise is true.
- **No DMCA section**: a Cloud workspace is private and invite-only, so there is no public
  content a takedown notice could reach. Acceptable use and termination cover misuse.
- **The AI-output clauses do not carry over**: Cloud coordinates a board and runs no model
  over it, since agents work on a member's own machine. The terms keep only the licence
  needed to store and serve a team's board.
- **Why the terms promise no email notice**: the preview builds no way to send email, and an
  address kept for sign-in is not one a member handed us for notices. The app and any
  user-connected destination are what "where practical" means.
- **Their own publish date**: both pages carry the date they ship, not dist0's.
- **Who links the pages from onboarding**: #317 builds that screen and already carries the
  step. This card publishes the pages and the footer link, so the URLs exist for it.

### Overruled by the user
- **Why the Slack webhook is not listed as a subprocessor**: an owner pastes their own
  incoming webhook (#320), so board content reaches Slack because the team sent it there.
  Listing it beside Cloudflare and Supabase would claim a contract we do not have.
- **Why the terms promise no email notice**: the preview builds no way to send email, and an
  address Supabase Auth keeps so sign-in works is not one a member handed us to be written to.
  The channels the preview already has — the app's notifications (#319) and a workspace's
  Slack webhook (#320) — are what "where practical" means.

## Source
- `web/app/(en)/blog/[slug]/page.tsx`, `web/components/blog/BlogMdx.tsx`,
  `web/app/blog-prose.css` — the page code these pages reuse.
- `web/components/SiteFooter.tsx`, `web/i18n/shared/*.ts`, `web/app/sitemap.ts` — where the
  two links and the two sitemap entries go.
- `https://www.dist0.com/privacy`, `https://www.dist0.com/terms` — Nullreach's published
  pages, adapted here.
- #293 — the app-telemetry section of the privacy page.
- #311 — the Cloud preview these pages have to describe.
- #314 — the workspace and membership tables whose contents the privacy page describes.
- #317 — links the Cloud choice to these pages.
- #325 — the authenticated event and connector foundation team notifications will extend.
- #323 — creates the database whose region the privacy page names.
