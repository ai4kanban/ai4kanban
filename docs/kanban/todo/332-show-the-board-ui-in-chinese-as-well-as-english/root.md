---
title: Show the board UI in Chinese as well as English
track: features
priority: med
roi: med
status: todo
release: 0.8.0
blocked_by: []
related: [335, 336, 337]
modules: [local-ui, skill]
questions:
  - question: "[user] Every failure the app shows is text the `akb` command produced, so a Chinese app still reports every error in English. Do the errors on screen stay English?"
    mode: single
    options:
      - Stay English — an error names a command, a path or a card id, and giving them Chinese means a second copy of the command's whole error surface kept in sync forever
      - Translate them — add a subtask for the errors the app surfaces, so a Chinese user is not dropped into English at the moment something breaks
    recommend: [1]
---

The app speaks only English. The site already ships in Chinese, so a Chinese reader who
arrives from `ai4kanban.dev/zh` opens the board and is back in English for every button,
column and dialog — and for every card and memory line the agent writes for them. Give
the app a language setting with two choices, English and Simplified Chinese, that both
translates the words the app renders and tells the agent which language to write the
board in. This is a group task; each piece is its own subtask in this folder.

## Worth noting
- **Which languages?**: English and Simplified Chinese only. The site's other three
  languages wait until someone asks; each one added is a file to keep in sync forever.
- **How is the language picked?**: guessed once from the operating system on a machine that
  has never said, then owned by the user — a switcher changes it and nothing guesses over
  that answer again. The cost is a divergence from the site, which never guesses: a browser
  hands over the reader's languages and carries a switcher in its own header, and the app's
  first screen has neither.
- **How does a Chinese reader reach the language before there is a board?**: from a small
  switcher on the launcher — the Open Folder screen the app opens onto, ahead of every other
  screen. Setup already draws the header, so Configuration → Language is on it; the launcher
  covers the two screens that draw no header, because both are reached through it. The cost
  is one more control on the app's front door.
- **Does the setting also decide what the agent writes?**: yes — one setting, so a Chinese
  user gets a Chinese board end to end: card text, open questions, memory and changelogs,
  not only the buttons around them. The cost is that board content is shared through git
  and the setting is not, so a teammate left on English writes English cards onto the same
  board and nothing reconciles the two.
- **Where is the setting kept?**: on the machine, not in the board — one answer that
  follows the user into every project they open, rather than a line in `docs/kanban/` a
  teammate inherits. The cost: a second machine starts in English again.
- **What stays English even in a Chinese card?**: everything the board itself reads — a
  frontmatter key and its fixed values, section headings, the agent boundary, file names,
  commands and paths. They are structure the command matches literally, so a Chinese card
  carries English scaffolding around its Chinese words. The prose a frontmatter field holds
  — a title, a question, an option, a verify line — is prose and follows the language.
- **What happens to a board already written in English when the language changes?**:
  nothing — what is on disk stays as written, and only new writing follows the setting. The
  cost is a board holding both languages at once; the one-off pass that would rewrite every
  card and memory file lost to it, because a bad translation of a whole board is far more
  expensive to undo than a mixed board is to live with.
- **Does the `akb` command speak Chinese too?**: no — the app is what speaks Chinese: its
  screens, and the menu and dialogs the desktop draws outside them. What the command prints
  in a terminal, its help, and the flows it ships are read by a developer and by a coding
  agent, so translating them would double a large English surface and change how an agent is
  instructed. The cost is that a Chinese user who drops into a terminal is back in English.

<!-- agent -->

## Scope
- **Two languages**: English and Simplified Chinese. English is the source of truth and
  the default.
- **One setting for both halves**: the words the app renders and the language the agent
  writes the board in follow the same answer. It is a fact about the machine, saved
  outside every repository, and never lands in `docs/kanban/`.
- **The words the app renders**: every string `kanban-ui/` draws, plus the words the desktop
  draws outside the page — its menu bar, the launcher, and its own dialogs: the folder picker,
  the `akb`-on-PATH prompt, the update notices and the start-up failure. Not what `akb` prints
  in a terminal, and not the flows in `akb guide`.
- **The prose the agent writes**: card titles and bodies, open questions and their options,
  the verify lines a user checks by hand before accepting work, memory entries, changelogs,
  and chat replies.
- **What stays English whatever the setting**: the structure the board matches by literal
  English regex — frontmatter keys and their fixed values, section headings, the
  `<!-- agent -->` boundary, todo checkboxes, the `[user]` tag, and card filenames. Prose
  held in frontmatter is still prose: a title, a question, an option and a verify line
  follow the language.
- **Picked once, then owned by the user**: a machine that has never said opens in the
  operating system's language, and a switcher — on the launcher and in Configuration —
  changes it. Nothing guesses again after that.
- **Nothing already written is translated**: changing the setting never rewrites a card, a
  memory file or a changelog, and the app offers no command that does. An edit follows the
  language the file is already in.
- **Keep names as they are**: product names, file names, paths, track names, shell commands
  and URLs stay in English in both languages, matching `web/i18n/index.ts`.
- **Out of this group**: the site's other three languages, Traditional Chinese, a one-off
  pass that translates an existing board, and anything the Cloud relay sends off the
  machine.

## Todo
- [x] Remember which language the app and the agent work in #334
- [ ] Move the board UI's words into one typed copy module #335
- [x] Open the app in the machine's own language #339
- [ ] Show the board UI in Simplified Chinese #336
- [ ] Write the board in the language the user picked #337

## Decided by the agent
- **Why a group and not one card**: the setting, the extraction of every string in a
  15,000-line UI, the Chinese copy itself, the rules that tell every flow which language to
  write in, and the guess that opens the app in the machine's own language are five different
  jobs. None of them fits in one run, and a card that cannot finish in one run comes back as a
  half-done delivery.
- **Why the setting landed first**: #334 is the answer every other piece reads or writes.
  The copy module (#335) could be built beside it, but neither the Chinese copy nor the
  agent's language had anywhere to look until the setting existed.
- **Why #336 waits on #339**: the launcher's switcher is written in English where the main
  process draws the page, and #336 is the one pass that translates the words written there.
  Running it first would leave the switcher English in a Chinese app.
- **Why the desktop's own dialogs and not only its menu bar?**: they are the same surface to
  the same reader, and the `akb`-on-PATH prompt is the first modal a new user ever meets. They
  live in `desktop/src/main.ts` rather than in the copy module, so #336 translates them in
  place beside the menu — eight strings, and the main process already reads the language at
  startup. The launcher (#339) is the same surface for the same reason.
- **Why the guess is its own subtask (#339)**: it is main-process work — Electron's locale,
  a bridge call, a control on a page drawn outside `kanban-ui/` — so it shares no file with
  the copy module and can land beside it.
- **Does a board rule do this job already?**: no. `docs/kanban/rules/` could carry "write in
  Chinese", but it is per flow, per board and hand-written, so it would have to be repeated
  on every flow and typed again for each project.
