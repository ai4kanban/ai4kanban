---
title: Publish the privacy and terms pages the Cloud preview needs
track: distribution
priority: high
roi: med
status: todo
release: 0.8.0
blocked_by: []
related: [311]
modules: [site, cloud]
questions:
  - question: "[user] The privacy and terms pages have to name who runs AI4Kanban Cloud and where to write about the data in it. Which name ships?"
    mode: single
    options:
      - your own name as the individual who runs the preview, with a contact email
      - a registered company — name it and its address in the answer
      - hold the pages until a company exists — the preview stays uninvited until then
    recommend: [1]
---

The Cloud preview keeps another team's board on servers we run, and the site says nothing
today about what that stores or what the preview promises. Publish a privacy page and a
terms page, and link them from the Cloud choice in onboarding, before the first outside
team is invited.

## Worth noting
- **Built with the blog's page code**: both pages are MDX bodies rendered by the same route,
  MDX components, and prose stylesheet the blog already uses, so no new page style is
  invented for them.
- **One privacy page, not two**: #293 writes the site's first privacy page for telemetry.
  Cloud adds its own section to that page; whichever card ships first builds the shell.

<!-- agent -->

## Today
- The site has no privacy page and no terms page. `/blog/[slug]` renders an MDX body from
  `web/blogs/` through `BlogMdx`, `app/blog-prose.css`, `Header`, and `SiteFooter`.
- #293 owns the telemetry half of the privacy page and has not shipped.
- The blog is English-only (`TRANSLATED_PATHS` in `web/lib/i18n.ts`), and these pages follow it.

## Scope
- Publish `/privacy` and `/terms`, rendered by the blog's MDX page code, with the site
  header, footer, and prose styles.
- The privacy page states, for Cloud: what a workspace stores, where it runs, who can read
  it, that code, credentials, and model keys never reach it, that an owner can delete a
  workspace and everything in it, and where to write for a data request.
- The terms page states that Cloud is an invite-only preview with no availability promise,
  what we may do with a workspace, and how the preview ends.
- The terms page states that the preview keeps no backups, and that exporting a workspace
  is how a team keeps its own copy.
- Both pages carry the operator's name and contact address.
- Link both from the site footer and from the Cloud choice in onboarding (#317).
- Out of scope: pricing, billing terms, and any public announcement of Cloud.

## Todo
- [ ] Render `/privacy` and `/terms` from MDX bodies using the blog's page code and styles.
- [ ] Write the Cloud sections of the privacy page and the whole terms page.
- [ ] Add both to the footer, the sitemap, and the Cloud choice in onboarding.
- [ ] Check the built export serves both pages and that no link to them 404s.

## Decided by the agent
- **Why the site and not an in-app note**: an open-source maintainer reads this before
  putting a roadmap on a hosted board, which means a URL they can open without installing
  anything.
- **English only**: the pages follow the blog, which is not translated.

## Source
- `web/app/(en)/blog/[slug]/page.tsx`, `web/components/blog/BlogMdx.tsx`,
  `web/app/blog-prose.css` — the page code these pages reuse.
- #293 — the telemetry half of the privacy page.
- #311 — the Cloud preview these pages have to describe.
