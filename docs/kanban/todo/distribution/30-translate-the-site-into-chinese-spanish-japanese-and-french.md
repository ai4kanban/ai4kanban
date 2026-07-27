---
title: Translate the site into Chinese, Spanish, Japanese, and French
track: distribution
priority: med
roi: med
status: todo
blocked_by: []
related: [5, 46]
modules: [site]
questions: []
---

Add Chinese, Spanish, Japanese, and French versions of the site, so people who don't read English can still get it.

## Scope
- The site lives in web/. It is a Next.js app built as static files and served on Cloudflare Pages.
- Static export means Next's built-in language routing does not work. Instead, each language gets its own path: /zh/, /es/, /ja/, /fr/. A `[locale]` route segment builds one copy of each translated page per language at build time.
- English stays at the root paths. No existing URL changes.
- Translate the acquisition surface only: the landing page and the three vs pages that exist today (`vs-github-issues`, `vs-hermes-kanban`, `vs-vibe-kanban`). Recipes stay English.
- Each language page needs the right SEO tags: hreflang links to its siblings plus an `x-default` pointing at the English root, a translated title and description, and an entry in the sitemap.
- Add a visible language switcher so visitors change language by hand. No auto-redirect by browser language.

## How the pieces fit
Today every page's copy is written straight into its React components (`Hero`, `Features`,
the `Vs*` sections, and so on), and each page's title/description is hardcoded in its
`page.tsx`. Translation needs that copy pulled out of the layout so each language can supply
its own words. So the work is, in order:

1. **Separate copy from layout.** Move the visible text of the landing page and the three vs
   pages out of the components into English source-of-truth copy, keyed so a language version
   can swap in its own. English is the source of truth; the other four read from it. Page
   metadata (title, description) moves out the same way, since those get translated too.
2. **Build one copy per language.** A `[locale]` route builds the landing page and the three
   vs pages once for each of /zh/, /es/, /ja/, /fr/, reading that language's copy. English
   stays at the root paths, untouched.
3. **SEO for each language page.** Add hreflang alternates linking each page to its siblings
   in the other languages, plus `x-default` → the English root. Translate the title and
   description. List every new locale URL in the sitemap.
4. **Language switcher.** A visible switcher (default in the footer) that jumps to the same
   page in another language, labelled with each language's own name (中文, Español, 日本語,
   Français, English). Switcher only — never redirect by browser language.
5. **Translate.** One pass per language for the five surfaces (landing + three vs pages),
   natural re-expression rather than literal, then a fresh-reader review for tone and
   accuracy.

The `/translate-sync` upkeep command (keeping the four translations current as English
changes) is split out to card #46 — it needs this structure to exist first.

## Todo
- [x] Pull the landing-page and vs-page copy (text plus title/description) out of the components into English source-of-truth files, keyed so a language version swaps in its own words
- [x] Add a `[locale]` route that builds the landing page and the three vs pages once per language; keep English at the root
- [x] Add hreflang alternates (siblings + `x-default` → English root) and translated title/description to each language page
- [x] Add every language URL to the sitemap
- [x] Add a footer language switcher that jumps to the same page in another language, labelled in each language's own name (switcher only — no browser-language auto-redirect)
- [x] Translate the landing page and the three vs pages: one pass each for Chinese, Spanish, Japanese, and French (natural re-expression, not literal)
- [x] Review each translation with a fresh reader (agent or human) for tone and accuracy — an agent pass caught and fixed two French slips; see the open question about a native-speaker read
- [x] Update web/design.md if the switcher or new routes change what it describes — no-op, see the open question
- [x] Build the static export and check every language URL works on Cloudflare Pages — all 20 URLs build and export; the deploy itself is not done (see the open question)

## Resolved
- **Who checks the four translations?** No native-speaker gate. Instead the four copy
  files go through the repo's own `translator` skill — meaning over words, the term the
  field actually uses in that language, target-language punctuation, professional
  register, commands and file names left exact. That pass is the review; a native read
  stays a nice-to-have later, not a blocker on publishing.
- **web/design.md — rewrite or delete?** Rewrite. The old file wasn't stale, it was
  foreign: it described a "Soft Neo-Brutalism" system with `nb-*` tokens (zero of which
  appear in `web/app/globals.css`) on a warm cream canvas, and pointed at files this repo
  doesn't have (`components/site/sections/root/**`, `auth-actions.tsx`,
  `checkout-button.tsx`). The real site is a dark GitHub-style theme. Replace the whole
  file with an accurate description of this site, including the locale routes and the
  footer switcher.
- **Deploy the 20 language URLs?** Yes — run `/deploy` once the translator pass lands and
  the build is clean.

## Decided by the agent
- **Do the plain-Markdown page mirrors (`/index.md`, `/vs-x.md`) get translated?** No — keep
  them English. They exist for AI crawlers and llms.txt consumers, which read English fine;
  same reason the recipes stay English. Only the human-facing HTML pages get the four
  languages.
- **hreflang completeness → add `x-default`.** Beyond the sibling-language links, each page
  declares `x-default` pointing at the English root, so search engines have a defined
  fallback for unmatched languages.
- **Switcher placement and labels (default).** Put the switcher in the footer, unobtrusive,
  with each language shown in its own name. Reasonable, low-cost default — easy to move to
  the header later if wanted.
- **Split off `/translate-sync` (#46).** The sync command is upkeep that only matters once
  translations exist, so it's not needed to meet this card's goal. Moved to its own card,
  blocked by this one.
