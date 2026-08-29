---
title: Sign the Mac build so it opens with no warning
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: [local-ui]
questions:
  - question: "[user] Which Apple Developer enrolment do we buy? Both cost $99 a year — the difference is the name macOS shows people and how long approval takes."
    mode: single
    options:
      - Individual — approved in a day or two, and macOS shows your own name.
      - Organization — macOS shows a company name, but Apple asks for a business ID number (D-U-N-S) and it takes longer.
    recommend: [1]
---

The Mac app ships unsigned, so a first-time user meets a warning saying the app can't be
trusted, and has to go into System Settings to get past it. Sign the app and have Apple
check it — Apple calls that notarizing — so the download just opens.

## Scope
- A fresh download on a Mac that has never run the app opens from a double-click and one
  **Open** click.
- Nothing sends the user to System Settings, and no warning says the app can't be trusted.
- Dragging the app into Applications stays the first step.
- The signed app can still use the coding agent login the user already made.
- The app keeps shipping unsigned until this lands.
- Everywhere the macOS workaround is taught drops it, and says the Mac build is signed
  instead.
- The Windows and Linux first-open notes stay as they are.
- Windows stays unsigned.

## Decided by the agent
- **Only after the app has shipped**: getting the account approved takes days, and the app
  is worth more in people's hands unsigned than held back for it.
- **The signed app still reaches the coding agent's login**: the app never reads that login
  itself. It starts the user's own `claude`, and that program reads its own saved login
  under its own name, whoever started it. Signing the app changes nothing about it.
- **Windows stays unsigned**: a Windows certificate is a separate cost. Revisit it when
  users ask.

### Worth noting
- **macOS still asks once.** Any app someone downloads is confirmed once on its first open,
  signed or not. One **Open** click is as far as signing gets.
- **Dragging it in is still a step.** An app opened straight from the download file is not
  properly installed, signed or not, and it won't install the `akb` command from there.
- **An update is a fresh app to macOS.** The system reads the signed build as a different
  app from the unsigned one, so someone updating may be asked again for anything they
  already allowed.

## Todo
- [ ] Buy the Apple developer account the Mac signing needs ($99 a year), and get it
      approved.
- [ ] Sign the Mac build and have Apple notarize it.
- [ ] Check it on a Mac that has never run the app: the download opens from a double-click
      and one **Open** click, nothing sends the user to System Settings, and the app still
      offers to install the `akb` command.
- [ ] Check a run works end to end from the signed app on a Mac where the coding agent was
      already logged in.
- [ ] Check the update: a Mac already running the unsigned app moves to the signed one and
      still opens its board.
- [ ] Drop the macOS workaround from the download page and the home page in all five
      languages, `README.md`, `README-zh.md`, and the `local-ui` guide, and say the Mac
      build is signed.
- [ ] Rewrite the Mac part of `PUBLISHING.md` for a signed build: what a publisher needs in
      hand, and what to check on what they built.
