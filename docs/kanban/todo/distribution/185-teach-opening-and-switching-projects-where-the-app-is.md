---
title: Teach opening and switching projects where the app is
track: distribution
priority: med
roi: med
status: ready
release: 0.6.0
blocked_by: []
related: []
modules: [local-ui, site]
questions: []
---

The app now opens any folder on the machine and switches between the projects you opened
before, but nothing we publish says so. The UI's README mentions only that the header path
and **File → Open Project…** open another project, and the download page still reads like
one app per repo. So a user who works on three projects never learns the app already
covers all three.

## Scope
- **The UI's README teaches the whole flow**, in the section that already talks about the
  app: pick a folder, come back to a project you opened before from the list, take one off
  the list, what a project whose folder is gone says, that one project is open at a time
  and switching reloads everything, that a folder with no board starts making one, and
  that a run keeps going in the project it started in and is marked on the list.
- **The download page says one app covers every project on the machine**, so someone
  deciding whether to download knows they don't need one per repo.
- **The download page's other languages say the same thing**, so a reader in Chinese,
  Spanish, Japanese or French isn't left on the old story.

## Decided by the agent
- **Whether the download page mentions this at all**: yes, but one line only. It is a
  reason to download, not a feature list — the page's job is to get the app onto the
  machine, and the README teaches the rest.

## Todo
- [ ] Extend the UI's README so opening, switching, and removing a project are all taught
      where the app is described.
- [ ] Say on the download page that one app opens every project on the machine.
- [ ] Re-sync the download page's other languages with the English copy.
- [ ] Read the download page in each language and check the new line reads like it was
      written in that language.
