---
title: Show the board UI in Simplified Chinese
track: features
priority: med
roi: high
status: todo
release: 0.8.0
blocked_by: [335]
related: [332]
modules: [local-ui]
schedule:
  action: refine
questions: []
---


With the words in one module and a setting to pick from, the app can finally speak Chinese.
Write the Chinese half of the copy, translate the desktop menu, and read every screen in
Chinese to fix what a translated string breaks.

<!-- agent -->

## Scope
- **Simplified Chinese for every string in `kanban-ui/i18n/`**: written, professional
  register, following the vocabulary in `docs/kanban/memory/goal.md` — 自主拆解、循环澄清、
  需求、决策可追溯、自进化、交付闭环 — and full-width ，。；：？（）.
- **The desktop menu, the launcher and its dialogs too**: the labels in
  `desktop/src/lib/menu.ts`, the launcher page in `desktop/src/lib/launcher.ts` (#339), and
  the dialogs in `desktop/src/main.ts` — the folder picker, the `akb`-on-PATH prompt, the
  update notices and the start-up failure — are drawn by the main process and are not in the
  copy module, so they are translated in place.
- **Names stay English**: product names, file names, paths, track names, shell commands and
  URLs, matching `web/i18n/index.ts`.
- **Read the app in Chinese**: every screen, and fix what overflows, wraps badly, or reads
  like a literal translation. The fix is the layout or the wording — never a shorter word
  chosen to fit the English box.
- **Nothing on disk is translated**: cards, memory and changelogs render exactly as
  written, in whichever language they were written in.

## Todo
- [ ] Write the Chinese half of `kanban-ui/i18n/`.
- [ ] Translate the desktop menu's labels, the launcher page, and the main process's own
      dialogs.
- [ ] Read every screen in Chinese and fix what overflows, wraps badly, or reads like a
      translation.

## Decided by the agent
- **Who writes the Chinese?**: the repo's `translator` skill, reviewed by hand — the route
  the site's four languages already take, so the app reads in the register a visitor
  already met on `ai4kanban.dev/zh`.
