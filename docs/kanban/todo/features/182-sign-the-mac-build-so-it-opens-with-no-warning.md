---
title: Sign the Mac build so it opens with no warning
track: features
priority: med
roi: med
status: todo
release: 0.7.0
blocked_by: []
related: []
modules: [local-ui]
questions:
  - Does a signed and notarized Mac build still reach the coding agent's saved login? The unsigned build does — a Dock launch passed Test Connection in 6.2s. Claude Code keeps its login in the macOS keychain, and a keychain item is tied to the signing identity, so the first signed build has to be checked against a real run before it is handed out.
---

The Mac app ships unsigned (#175), so a first-time user has to click past a warning that
says the app can't be trusted. Sign it, so the download opens with a double-click and the
warning is gone.

## Scope
- Buying the Apple developer account and waiting for it is part of this task, not a
  blocker on shipping the app. The app ships unsigned until this lands.
- A fresh download opens with a double-click on a Mac that has never run the app — no
  warning, no extra step.
- The download page, the READMEs and the release notes stop teaching the workaround for
  macOS once it is signed, and say the Mac build is signed.
- Windows stays unsigned. A Windows certificate is a separate cost and a separate task;
  revisit it when users ask.

## Decided by the agent
- **Only after the app has shipped**: getting the account approved takes days, and the app
  is worth more in people's hands unsigned than held back for it. This is the follow-up.

## Todo
- [ ] Buy the Apple developer account the Mac signing needs ($99 a year), and get it
      approved.
- [ ] Sign and notarize the Mac build, and check it on a machine that has never run the
      app: a fresh download opens with a double-click and no warning.
- [ ] Check a run still works end to end from the signed app, so nothing about the saved
      login broke.
- [ ] Drop the macOS workaround from everywhere it is taught — the download page in all
      five languages, `README.md`, `README-zh.md`, the guides and the skill — and say the
      Mac build is signed.
