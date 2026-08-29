---
title: See how the app is actually used, from download to daily work
track: distribution
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: [telemetry, local-ui]
questions:
  - question: "[user] 0.7.2 already holds 29 cards, and this group is the only one in it that ships nothing a user can see. Does it stay in 0.7.2?"
    mode: single
    options:
      - keep it in 0.7.2 — we stop guessing about downloads and daily use sooner
      - take it out of 0.7.2 and leave it unreleased until a version is picked for it
      - drop the group — we do not want usage reporting in the product at all
    recommend: [2]
---

We ship an app, a command and a landing page, and we cannot say how many people download
it, how many ever open it, or whether anyone comes back the next day. Every product call
we make is a guess. Collect a small set of usage numbers from the site and the app, send
them to a server we run, and read them in one place. This is a group task; each piece is
its own subtask in this folder.

## Worth noting
- This cuts against the product's own positioning. The site sells the board as local-first
  — plain markdown in your own repo. The app already calls out to GitHub to see whether a
  newer release exists, so this is not the first outbound call, but it is the first one
  that is about the user rather than for them, and someone who notices it after the fact
  will read it as a broken promise. Worth doing only if the consent step in #293 is
  genuinely plain, and #293's open question is a live part of that: on by default would
  make the broken-promise reading the likely one.
- Nothing here is a feature a user gets, which is what the open question above asks about.

<!-- agent -->

## Today
- The site counts nothing. We do not know how many visitors reach the download page or
  press the button.
- The app reports nothing. An install that is opened once and an install used every day
  look identical to us. Its one outbound call asks GitHub whether a newer release is out,
  which tells us nothing.
- Board settings live in `docs/kanban/ui.config.json`, inside the user's repository. The
  desktop app keeps a small file of its own outside every repository, but the `akb`
  command cannot read it, so there is nowhere both of them can keep an answer about
  privacy or an install id. #293 has to make that place first.
- `docs/kanban/metrics.csv` and `docs/kanban/record.csv` already count real board work,
  but only inside the user's own repo. We never see them.
- GitHub's release download counts are the only number we have for the app, and they mix
  real users with mirrors and scripts.
- npm publishes an install count for the `ai4kanban` command, and the command is also
  installed from the Claude Code plugin marketplace. Nobody reads either number.

## Scope
- The numbers to answer four questions: how many people download, how many open the app,
  how many keep using it, and how much planning the board actually does for them.
- The app sends nothing from a machine where the ask has not been shown. Whether the
  answer starts as yes or no is #293's open question, not settled here.
- The site counts page visits and download presses with no cookie and no identifier, so it
  needs no banner. A site visit is never tied to an install.
- Nothing that identifies a person, a project or a repository is ever sent — no card
  titles, no file paths, no goal text, no repo name, no email.
- One anonymous install id, made on the machine, is the only thing that ties two events
  together.
- The user can turn it off at any time, and turning it off stops all sending.
- Every fact is sent by exactly one card. #296 sends what the board already writes down in
  `metrics.csv` and `record.csv`; #295 sends only what a running app or command knows and
  those files do not hold.
- Only installs that were asked in the app are ever counted. Someone who installs the
  command from npm or the plugin marketplace and never opens the app is absent from these
  numbers rather than counted as a no-show.
- Wherever the numbers are read, they say that app opens and board use cover the app only.
- The command's public npm install count is pulled on the same schedule as GitHub's release
  counts and stored beside them.
- The app works exactly the same with it off, and works offline.
- A server we run takes the events in and stores them; nobody outside the project reads
  them.
- One page or query we can read the numbers from. A dashboard for users is not part of
  this group.
- The published list of what is sent never lags what is sent: a card that adds an event
  adds it to that page in the same change.
- Out of this group: showing any of these numbers to the user, showing them in public,
  per-user analysis, and anything sent to an advertising or attribution service.

## Todo
- [ ] Ask before any usage data leaves the machine, and let it be turned off #293
- [ ] Take in usage events on a server we run #294
- [ ] Report app opens and which parts of the board get used #295
- [ ] Report the board's own numbers from metrics.csv and record.csv #296
- [ ] Count how many site visitors go on to download the app #297

## Decided by the agent
- **Why a group and not one card** — the consent switch, the receiving server, the two
  senders and the site counter are four different systems. None of them is worth building
  without the others, and none fits in one run.
- **Why our own server rather than a hosted analytics product** — the product's promise is
  that nothing leaves your repo. Sending a user's usage to a third party would be the
  opposite of that even when the payload is harmless. #294 settles where it runs.
- **Where each number comes from** — the board already writes every card created, archived
  and rejected, and every question closed, into `record.csv` as it happens. Sending those a
  second time as live events would give two counts of one fact that disagree the moment a
  file is hand-edited or a send is dropped. So #295 sends what only the running app knows —
  opens, daily use, runs, chat — and #296 sends the board's own record.
- **What the board's own record adds** — the board's own planning scores say how well it
  plans, but only for the board that wrote them. Aggregated across installs they say
  whether the product works at all, which is the thing we cannot learn any other way.
- **Why the command's npm count is in and nothing else about the command is** — it is one
  public number on a schedule that already exists, and it is the only sign we get of the
  people who install `akb` and never open the app. It says how many took the command, not
  what they did with it, and it is read as a separate number rather than added to app opens.
- **Why the numbers must carry their own limit** — the group cannot see terminal-only use at
  all. A page that shows "opens" without saying what it excludes invites the reading that
  nobody is using the product, which is the opposite of what the number supports.
- **Download rate and open rate are one funnel** — they only mean something read together,
  so both land in the same store even though one is measured on the site and one in the
  app.
