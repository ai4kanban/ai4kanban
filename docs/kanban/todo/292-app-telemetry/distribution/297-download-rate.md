---
title: Count how many site visitors go on to download the app
track: distribution
priority: med
roi: high
status: todo
release: ""
blocked_by: [294]
related: [292, 400]
modules: [site, telemetry]
questions: []
---

The landing page's main button is the download. Nothing counts how many visitors reach it
and how many press it, so we cannot say whether the page works.

## Worth noting
- With no cookie there is no returning visitor here. The rate is presses divided by page
  views, not per person, so someone who opens the page four times before downloading reads
  as a poor rate.
- Our press count and GitHub's download count will never agree, and neither is wrong. They
  stay two numbers read side by side rather than one reconciled figure.

<!-- agent -->

## Today
- The site is a static export on Cloudflare Pages and measures nothing.
- The download buttons link straight to files on a GitHub release, so a press is not
  recorded anywhere we can read.
- GitHub's own release download counts exist, but they mix real users with mirrors, bots
  and repeated pulls, and they say nothing about how many people saw the page. #400
  snapshots them daily; this card supplies the other half, the presses.

## Scope
- Count a visit to each page of the site, and a press of each download button.
- The press carries the operating system, the architecture and the version chosen — never
  which visitor pressed it.
- Report a rate: presses divided by visits to the pages that carry a download button.
- Count each of the site's languages separately, so a translation that is not converting
  is visible.
- Say which page a download came from — the hero, the landing page's getting-started
  section, or the download page.
- Read the presses beside the public download counts #400 already snapshots, so a press
  and a completed download can be compared. Pulling those counts is #400's job, not this
  card's.
- Set no cookie and store nothing in the browser, so no consent banner is needed.
- The site is not slowed down and the download works if the counting fails.
- Out of scope: any per-visitor identifier, any cross-site tracking, and tying a site
  visit to an app install.

## Todo
- [ ] count a visit to each page, per language
- [ ] count a download button press with system, architecture, version and which page
- [ ] read #400's snapshot beside the presses, the npm count kept as its own number
- [ ] work out the download rate per page and per language
- [ ] check the download still works when counting fails or is blocked
- [ ] check nothing is stored in the browser and no banner is required
- [ ] add the site's numbers to the privacy page from #293

## Decided by the agent
- **Why not tie a site visit to an app install** — it would need an identifier carried
  from the browser into the app, which is exactly the tracking we said we would not do.
  The two counts are read side by side instead.
- **Why the npm count sits apart from the app's downloads** — installing the command and
  downloading the app are different acts by different people. Adding them would produce one
  number that answers neither question.
- **Why count presses as well as GitHub's numbers** — a press is a real person deciding;
  GitHub's count includes anything that pulled the file. Neither is trustworthy alone.
- **Why no cookie** — a cookie would mean a consent banner on the landing page, which
  costs more visitors than the number is worth.
