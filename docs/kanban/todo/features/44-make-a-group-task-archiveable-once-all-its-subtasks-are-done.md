---
title: Make a group task archiveable once all its subtasks are done
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: [45]
modules: [local-ui]
questions:
  - When a subtask finishes, how does the group root learn it is done, and how do we tell a done subtask from a rejected one (both delete the subtask file)? Check off the root's matching ## Todo line when a subtask is archived (a skill archive-flow change), or infer done-ness from the folder emptying (which cannot tell done from rejected)?
---

When all subtasks of a group root are done, show the Archive button on the root so the user can close out the group.

## Scope
- A group root is a folder with `root.md`. Recognize it by that folder shape, not by counting subtask files.
- On a group root, keep the Implement button hidden. It is finished by finishing its subtasks, never by a direct implement.
- Show Archive on the root once every subtask is done.
- This is all in the local UI. The button rules live in one place: `visibleActions(card)` in `kanban-ui/components/CardPage.tsx`.

The bug today: `isGroup` is `subtasks.length > 0`. A done or rejected subtask has its file removed, so it drops out of `subtasks`. When the last subtask goes, `subtasks` is empty and `isGroup` flips to false. The root then acts like a plain card: Implement can come back, and Archive only shows if the root's own `## Todo` boxes are all checked. So a group task never reliably becomes archiveable. Fix: mark the root as a group from its folder shape (it has `root.md`), so it stays a group even with zero subtasks left.

## Todo
- [ ] Carry a flag on the card that says "this is a group root", set from the folder shape (has `root.md`) in `kanban-ui/lib/board.ts` / `kanban-ui/lib/types.ts`.
- [ ] In `visibleActions`, use that flag instead of `subtasks.length > 0` to decide group vs plain card.
- [ ] Keep Implement hidden on a group root.
- [ ] Show Archive on a group root once all subtasks are done.
- [ ] Decide how the root learns all subtasks are done (see the open question in the frontmatter), and build the Archive condition on that answer.
- [ ] If the visible behavior changes, note it: update `kanban-ui/README.md` and the board's memory readme for any undocumented behavior.
