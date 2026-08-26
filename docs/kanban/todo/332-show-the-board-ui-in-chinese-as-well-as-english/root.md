---
title: Show the board UI in Chinese as well as English
track: features
priority: med
roi: med
status: todo
release: 0.8.0
blocked_by: []
related: [334, 335, 336, 337]
modules: [local-ui, skill]
questions: []
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
- **How is the language picked?**: by the user, from a switcher, and remembered. The app
  never guesses from the operating system or the browser — same stance the site takes.
- **Does the setting also decide what the agent writes?**: yes — one setting, so a Chinese
  user gets a Chinese board end to end: card text, open questions, memory and changelogs,
  not only the buttons around them. The cost is that board content is shared through git
  and the setting is not, so a teammate left on English writes English cards onto the same
  board and nothing reconciles the two.
- **Where is the setting kept?**: on the machine, not in the board — one answer that
  follows the user into every project they open, rather than a line in `docs/kanban/` a
  teammate inherits. The cost: a second machine starts in English again.
- **What stays English even in a Chinese card?**: everything the board itself reads —
  frontmatter, section headings, the agent boundary, file names, commands and paths. They
  are structure the command matches literally, not prose, so a Chinese card still carries
  English scaffolding around its Chinese words.
- **What happens to a board already written in English when the language changes?**:
  nothing — what is on disk stays as written, and only new writing follows the setting. The
  cost is a board holding both languages at once; the one-off pass that would rewrite every
  card and memory file lost to it, because a bad translation of a whole board is far more
  expensive to undo than a mixed board is to live with.
- **Does the `akb` command speak Chinese too?**: no — the app's screens and the desktop
  menu, and nothing else. What the command prints in a terminal, its help, and the flows it
  ships are read by a developer and by a coding agent, so translating them would double a
  large English surface and change how an agent is instructed. The cost is that a Chinese
  user who drops into a terminal is back in English.

<!-- agent -->

## Scope
- **Two languages**: English and Simplified Chinese. English is the source of truth and
  the default.
- **One setting for both halves**: the words the app renders and the language the agent
  writes the board in follow the same answer. It is a fact about the machine, saved
  outside every repository, and never lands in `docs/kanban/`.
- **The words the app renders**: every string `kanban-ui/` draws, plus the desktop menu
  bar. Not what `akb` prints in a terminal, and not the flows in `akb guide`.
- **The prose the agent writes**: card titles and bodies, open questions and their options,
  memory entries, changelogs, and chat replies. Not the structure around them — frontmatter,
  section headings, the `<!-- agent -->` boundary, todo checkboxes, the `[user]` tag, and
  card filenames all stay English, because the board matches them by literal English regex.
- **Nothing already written is translated**: changing the setting never rewrites a card, a
  memory file or a changelog, and the app offers no command that does. An edit follows the
  language the file is already in.
- **Keep names as they are**: product names, file names, paths, track names, shell commands
  and URLs stay in English in both languages, matching `web/i18n/index.ts`.
- **Out of this group**: the site's other three languages, Traditional Chinese, a one-off
  pass that translates an existing board, and anything the Cloud relay sends off the
  machine.

## Todo
- [ ] Remember which language the app and the agent work in #334
- [ ] Move the board UI's words into one typed copy module #335
- [ ] Show the board UI in Simplified Chinese #336
- [ ] Write the board in the language the user picked #337

## Decided by the agent
- **Why a group and not one card**: the setting, the extraction of every string in a
  15,000-line UI, the Chinese copy itself, and the rules that tell every flow which language
  to write in are four different jobs. None of them fits in one run, and a card that cannot
  finish in one run comes back as a half-done delivery.
- **Why the setting lands first**: #334 is what the other three read. The copy module (#335)
  can be built beside it, but neither the Chinese copy nor the agent's language has anywhere
  to look until the setting exists.
- **How does the language reach the agent?**: in the run's prompt, at the point
  `buildPrompt` already appends the board's flow rules — one place, so every flow and every
  connector is told the same thing.
- **Does a board rule do this job already?**: no. `docs/kanban/rules/` could carry "write in
  Chinese", but it is per flow, per board and hand-written, so it would have to be repeated
  on every flow and typed again for each project.
