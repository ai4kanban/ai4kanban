---
title: Make a group task archiveable once all its subtasks are done
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: [45]
modules: [local-ui]
questions: []
---

When every subtask of a group root is resolved, show the Archive button on the root so the user can close out the group.

## Scope
- A group root is a folder with `root.md`. Recognize it by that folder shape, not by counting subtask files.
- On a group root, keep the Implement button hidden. A group is finished by finishing its subtasks, never by a direct implement.
- Show Archive on the root once every subtask is resolved (done or rejected).
- This is all in the local UI. The button rules live in one place: `visibleActions(card)` in `kanban-ui/components/CardPage.tsx`.

## The bug today
`isGroup` is `subtasks.length > 0`. A done or rejected subtask has its file removed, so it drops out of `subtasks`. When the last subtask goes, `subtasks` is empty and `isGroup` flips to false. The root then acts like a plain card: Implement can come back, and Archive only shows if the root's own todo boxes are all checked. So a group never reliably becomes archiveable.

Fix: mark the root as a group from its folder shape (it has `root.md`), not from the live subtask count, so it stays a group even with zero subtask files left. The board reader already knows a folder is a group the moment it reads its `root.md`, so it can set an explicit group flag right there.

## How the root learns a subtask finished

The root's `## Todo` is the source of truth, and `kanban.mjs` keeps it accurate — every subtask edit goes through the script, so the checklist never drifts. This is already built (`markSubtask` / `enclosingGroupRoot` / `cmdRemove` in `kanban.mjs`):

- Each subtask is one `- [ ] … #<subid>` line in the root's `## Todo`.
- `kanban.mjs archive <subid>` ticks that line to `- [x] … #<subid>` (done).
- `kanban.mjs reject <subid>` strikes the line's text with `~~…~~`, leaving the box `[ ]` (rejected).

So done vs rejected is told apart right on the root: `[x]` = done, struck text = rejected. We do **not** infer done-ness from the subtask folder emptying — an empty folder can't tell a done subtask from a rejected one. Because the root file already carries the outcome, the local UI only has to read `root.md`; the subtask files being gone doesn't matter.

## When Archive shows on the root

A group root is archiveable once **every subtask line in it is resolved** — ticked `[x]` (done) or struck `~~…~~` (rejected). A rejected subtask never turns into `[x]`, so a struck line has to count as resolved; otherwise one rejected subtask would block Archive forever.

Two details to get right:

- **Only subtask lines count, wherever they sit.** A subtask line is a todo line that carries a `#<subid>` ref (that is how `markSubtask` finds it). The gate scans the whole root card, not just its `## Todo` — `kanban.mjs` ticks and strikes a matching line anywhere in the file, so the reader has to look everywhere the writer writes. A root's own stray todo — say a leftover doc-update line — carries no `#<subid>` and does not block Archive; the goal is "all subtasks done", not "all todos done".
- **Leave the shared `countTodos` alone.** Its `allDone = done === total` gate reads a struck-but-unchecked line as incomplete, and it drives every card's progress count. Don't change it. Add a separate group-root check that treats a struck line as resolved, so plain cards' progress display stays as is.

Reject stays available on the root regardless (it always is), so a group whose subtasks were all rejected can be closed with Reject instead of Archive. A group root that never got any subtask lines is not archiveable by this gate — that is intended; close it with Reject.

## Decided
- **The gate scans the whole root card, not just `## Todo`.** `markSubtask` in `kanban.mjs` ticks or strikes a subtask line wherever it sits in the file, so a reader limited to `## Todo` would miss a line the writer just changed and leave the root un-archiveable. Both sides stay whole-card. Cards keep their subtask lines under `## Todo` by convention; the gate just doesn't depend on it.
- **User-facing UI docs live in `kanban-ui/README.md`.** The skill's `references/local-ui.md` keeps installation only — how to run it, where the board is found, the options, updating. Everything about using the UI (the buttons, the Configuration dialog, group tasks) belongs with the app. This also settles a standing conflict: `CLAUDE.md` says files under `skill/` never mention `ui.config.json` or `claude -p`, and `local-ui.md` was doing both.

## Todo
- [x] In the board reader, set an explicit group flag on the card from the folder shape (the folder has `root.md`) — `kanban-ui/lib/board.ts` / `kanban-ui/lib/types.ts`.
- [x] In `visibleActions`, use that flag instead of `subtasks.length > 0` to decide group vs plain card.
- [x] Keep Implement hidden on a group root.
- [x] Add a group-root "all subtasks resolved" check: scan the whole root card for subtask lines (`#<subid>`), counting each as resolved when `[x]` or struck `~~…~~`. Leave shared `countTodos` untouched.
- [x] Show Archive on a group root once all its subtasks are resolved.
- [x] Write `kanban-ui/README.md` — the user-facing guide to the UI, with the group-root button rules in it.
- [x] Cut usage out of `skill/references/local-ui.md` so it covers installation only, and point it at the README.
- [x] Update the board's local-ui memory readme, and the pointers on other cards and in the install prompt that still send doc updates to `local-ui.md`.
