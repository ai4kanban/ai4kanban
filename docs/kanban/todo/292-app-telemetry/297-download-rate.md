---
title: Count how many site visitors go on to download the app
priority: med
roi: high
status: todo
release: 0.9.0
blocked_by: []
related: [292, 400]
modules: [site, telemetry]
questions: []
---

The landing page's main button is the download. Nothing counts how many visitors reach it
and how many press it, so we cannot say whether the page works.

## Worth noting
- **The site's own promise changes**: the privacy page says today that this site collects
  nothing and measures no page views, and this card replaces that with what it does count —
  still no cookie and no identifier, but no longer nothing.
- **The rate is per visit, not per person**: with no cookie there is no returning visitor
  here, so someone who opens the page four times before downloading reads as a poor rate.
- **Our presses and GitHub's counts never agree**: neither is wrong, and they stay two
  numbers read side by side rather than one reconciled figure.

<!-- agent -->

## Today
- The site is a static export on Cloudflare Pages and measures nothing. It uses `next/link`
  nowhere, so every navigation is a full document load.
- Two root layouts render every page of the site: `app/(en)/layout.tsx` for English and
  `app/(intl)/[locale]/layout.tsx` for the other four languages.
- One button, in three places: `components/PlatformCta.tsx` is the landing page's hero and
  its getting-started section, and `components/download/DownloadHero.tsx` is the download
  page's. `DownloadBlock.tsx` lists every file under the latter.
- Until the browser says which system it is on, the landing page's buttons point at
  `/download` and the download page's at the release page — so an undetected click on the
  landing page never leaves the site.
- #294 landed the endpoint and the shared contract. `telemetry/contract.ts` already names
  `page_view` and `download_press`, with page, language, os, arch and version; a site batch
  carries no install id and is never de-duplicated; the Worker answers `ai4kanban.dev` and
  `www.ai4kanban.dev` and nothing else.
- #294's daily summary already spreads views and presses by page and by language, and
  `npm run numbers` already prints views, presses and a rate — but that rate is presses over
  every page of the site, there is no split by page or language, and nothing sends the
  events. Presses carry arch and version that no summary reads, so today they would not
  survive the 90-day deletion.
- `web/next.config.mjs` has no `experimental.externalDir`, which the service's README says is
  what lets `web/` import the contract.
- `public/_headers` sets no content security policy, so nothing on the site blocks the
  endpoint.
- The endpoint's hourly limit is 600 requests per address, shared by every sender behind it
  and sized for app installs. One page view is one request, so a whole office or a mobile
  carrier behind one address can reach it.
- `web/legal/privacy.mdx` states twice that the site collects nothing — in its summary, and
  again under "No analytics", which says in as many words that we do not measure page views.
- The longest page path today is `/blog/project-decisions-are-the-bottleneck`, 42 characters.
  The contract drops a token over 64, which would cost that press its page and not the press.

## Scope
- **Count a page load**: one event per document load, on every page of the site, carrying the
  route with its language prefix removed and the language in its own field, so a page reads
  across languages and a language reads across pages. A route longer than the contract allows
  is cut rather than sent whole, so a long blog path never loses its page.
- **Count a press**: a click on a link that leaves for GitHub — a release file, or the
  release page — carrying the system, the architecture, the version and which place on the
  page it was: the landing page's hero or its getting-started section, the download page's
  button or the file list under it.
- **A click that stays on the site is not a press**: an undetected landing-page click goes to
  `/download` and is counted as that page's view, not as a download.
- **A press with nothing detected still counts**: the download page's button falls back to
  the release page, and that press is sent with the version it offered and `unknown` for the
  system and the architecture.
- **Nothing is stored in the browser**: no cookie, no local storage, no identifier of any
  kind, so no banner is needed and no press is ever tied to the visit before it.
- **The click is never held**: the counting never delays, cancels or redirects it, and the
  file starts downloading whether the count is sent, blocked, refused or slow.
- **The site is not slowed down**: the counter is sent after the page is usable and nothing
  the reader sees waits on it.
- **A count that fails is lost**: no retry and no queue, because a queue would need somewhere
  in the browser to keep it.
- **The rate**: presses divided by views of the pages that carry a download button — the
  landing page and the download page — read per page, per language, and per language for one
  page.
- **A day's summary carries what the rate needs**: views and presses keyed by page and
  language together, and presses spread by place, system, architecture and version, so every
  one of them outlives the 90-day deletion of the raw events.
- **Read in the one command that already exists**: `npm run numbers` prints the site's rate
  beside the public download counts #400 snapshots into the same store. Pulling those counts
  is #400's job, not this card's; this card adds no second command, page or address.
- **A build made for development posts to the development copy**, so trying the counter never
  moves the real numbers.
- **The privacy page stops saying the site collects nothing** and lists the two site events
  and their fields beside the app's, in the same change.
- Out of scope: any per-visitor identifier, any cross-site tracking, tying a site visit to an
  app install, the referrer, the query string, the screen size, and any filtering of bots —
  the number covers browsers that ran the counter and says so where it is printed.

## Todo
- [ ] add the press's place to `telemetry/contract.ts` and deploy the service before the site
      that sends it
- [ ] let `web/` import the contract, so the site and the service cannot drift
- [ ] count one page view per document load from both root layouts, route and language apart
- [ ] count a press on every link that leaves for GitHub, carrying system, architecture,
      version and place, and count a click that stays on the site as neither
- [ ] send both without a preflight round trip, so a press is not lost to the click that
      follows it
- [ ] keep views and presses keyed by page and language together in the day's summary, and
      spread presses by place, architecture and version
- [ ] print the rate per page and per language in `npm run numbers`, over the pages that
      carry a button
- [ ] post development builds to the development copy
- [ ] check the download still works when the endpoint is blocked, refused or slow
- [ ] check nothing is written to the browser and no banner is required
- [ ] replace the privacy page's "the site collects nothing" and "No analytics" with what the
      site counts, and list the two site events and their fields

## Decided by the agent
- **Why not tie a site visit to an app install** — it would need an identifier carried from
  the browser into the app, which is exactly the tracking we said we would not do. The two
  counts are read side by side instead.
- **Why count presses as well as GitHub's numbers** — a press is a real person deciding;
  GitHub's count includes anything that pulled the file. Neither is trustworthy alone.
- **Why no cookie** — a cookie would mean a consent banner on the landing page, which costs
  more visitors than the number is worth.
- **Why leaving for GitHub is what makes a press** — the landing page's button points at
  `/download` until the system is known, so counting every click would count a page move as a
  download and inflate the one rate this card exists to produce.
- **Why the place is a field of its own** — the contract's `page` is the path, so the landing
  page's hero and its getting-started section are one page. Without a place, which of the two
  buttons works is a number that does not exist.
- **Why the route and the language are separate fields** — `/zh/download` as one key would
  make the download page five different pages, and would hide both the per-page rate and the
  per-language one.
- **Why the rate counts only the pages that carry a button** — a docs reader who did not
  download is not a failed download, and counting them would drown the number.
- **Why Do Not Track is not checked** — the counter carries no identifier and stores nothing,
  so there is nothing to opt out of, and honouring it would drop exactly the privacy-minded
  readers whose behaviour the rate is about.
- **Why a failed count is dropped rather than retried** — a queue needs somewhere in the
  browser to keep it, which is the storage this card promised not to use.
- **Why the hourly limit is left where it is** — a spent hour drops that address's views and
  presses together, so the rate holds and only the volume is understated. Raising it for the
  site would raise it for a flood too, which is the one thing it exists to stop.
- **Why the presses print in the command #400 extends rather than one of this card's** — the
  rate only means something read beside the public download counts, and after #400 both halves
  live in the same store.
