---
title: Make every flow read and write cards through the script
track: features
priority: low
roi: med
status: todo
blocked_by: [55]
related: [57]
modules: [skill, local-ui]
questions: []
---

Today every flow opens a card with Read and Grep. That only works when the board is files
on disk. Give the script commands for reading and writing cards, and move every flow onto
them, so a flow works the same whatever the backend is.

Part of #57. It waits for #55, the storage layer, and #59 waits for it.

## Scope

- Add read commands to the script: list the board, show one card, and search card text.
  The markdown backend answers them from the same files, so a default board reads exactly
  as fast as today.
- Keep a search command that matches what Grep gives today. A flow that can no longer
  search card text has lost something real.
- Add one command that writes a card body, so a flow never needs Write on a card file.
  The script already owns the frontmatter; this closes the other half.
- Rewrite the flows to use those commands: `SKILL.md` and the reference files that point
  at board paths.
- A person can still open a card in an editor. It is the flows that stop assuming it.
- No change a user sees on the default board: same files, same output.

## Todo

- [ ] Add the read commands: list the board, show one card, search card text.
- [ ] Add the write command for a card body.
- [ ] Answer them from the markdown backend, through the #55 interface, with no direct
      file access left.
- [ ] Rewrite `SKILL.md` and the reference files that name board paths or tell the agent
      to open a card: `add-task.md`, `propose.md`, `refine.md`, `recurring-task.md`,
      `local-ui.md`. Check the rest for the same wording before finishing.
- [ ] Check the search command finds what Grep finds today on the same board.
- [ ] Check a default board behaves exactly as it does now: same commands, same files,
      same output.
- [ ] Say in the guide that a card can still be opened by hand on a file backend, and that
      on other backends the script is the only way in.
