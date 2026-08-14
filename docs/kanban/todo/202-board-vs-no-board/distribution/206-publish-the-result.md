---
title: Show the result on the site and in the README
track: distribution
priority: med
roi: med
status: todo
release: 0.7.0
blocked_by: [205]
related: [202]
modules: [site, docs]
questions:
  - question: "[user] Where does the result live on the site?"
    mode: single
    options:
      - a short block on the landing page that links to a page of its own
      - its own page only, linked from the site nav
      - a section on the landing page only
    recommend: [1]
---

The record only helps if people see it where they decide whether to use this. Put the
numbers on the site and in the README, and link straight to the raw runs.

## Scope
- One short page on the site: what we asked, what the agent did with the board, what it did
  without, and a link to the record in the repo.
- One short block in `README.md` and `README-zh.md` with the headline number and the link.
- One example shown in full, both runs side by side, so a reader sees what the difference
  actually looks like instead of reading a claim about it.
- Every sentence has to be supported by the record. No rounding up.
- If the result is weak or mixed, it says so in the same place, at the same size.

## Todo
- [ ] write the site page with the numbers and the worked example
- [ ] add the headline number and the link to `README.md` and `README-zh.md`
- [ ] bring the page into the site's other languages, the way the rest of the site is kept
      in sync
- [ ] check every claim on the page against the record
