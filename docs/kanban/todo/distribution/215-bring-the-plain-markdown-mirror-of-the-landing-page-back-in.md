---
title: Bring the plain-Markdown mirror of the landing page back in line
track: distribution
priority: med
roi: med
status: ready
release: 0.6.1
blocked_by: []
related: []
modules: [site]
questions: []
---

`web/public/index.md` is the plain-Markdown copy of the landing page we serve to AI
crawlers, and it still describes the page we replaced: a table of `/kanban ...` commands,
an indie-hacker preset, and memory files the board does not have. Anything that reads it
instead of the site learns the wrong thing about us.

## Scope
- The landing page's English copy is `web/i18n/home/en.ts`. The mirror follows it.
- The mirror carries the page's sections, in the page's order, under the page's headings:
  the opening pitch, "From task tracking to autonomous planning", "Keep work moving",
  "Learns as you build", "Drive continuous product iteration", and "Start with the board
  app".
- Drop the `01 ·` … `05 ·` numbering from the headings.
- The mirror's title and the line under it carry the same meaning as the page's title and
  its opening pitch.
- The two links at the top of the mirror are the page's two buttons: download the app, and
  GitHub.
- Write the page's comparison of a traditional board with AI4Kanban as a Markdown table.
- Write the page's picture of the memory files as a file tree in a code block.
- Write the page's picture of continuous iteration as a list: the external inputs, the
  project data it reads, and the outcomes.
- Delete the sections the page no longer has: the `/kanban ...` command table, the
  board-UI button list, the indie-hacker preset, and the features section (recurring
  tasks, group tasks, project memory, metrics).
- Name no `memory.md` and no `archive.md` anywhere in the mirror.
- Where the memory section names files, name the ones the board writes: `readme.md`,
  `decisions.md`, `rejected.md`, `redesign.md`, and `goal.md` at the board root.
- Keep the setup section's current wording: the board app first, the `npx` command under
  it, the setup prompt as a plain link, and installing the coding-agent skill as a
  separate optional step.
- Move the setup section to the end, where the page puts it.
- In `web/public/llms.txt`, rewrite the one-line description at the top to match the
  mirror's new opening.
- In `web/public/llms.txt`, rewrite the home page's link title and its summary to match
  the mirror's new sections.
- Write the mirror in English.
- Add a rule to `web/design.md`: changing the landing copy also means updating
  `web/public/index.md` and `web/public/llms.txt`.
- Out of scope: the same wrong memory file names on the `/vs-*` comparison pages — #216.

## Todo
- [ ] List where the mirror disagrees with the landing copy in `web/i18n/home/en.ts`.
- [ ] Rewrite the mirror to match, section by section.
- [ ] Rewrite the project description, the home link title, and the home summary in
      `web/public/llms.txt`.
- [ ] Check every link, file, and command the new mirror names still exists.
- [ ] Write the sync rule into `web/design.md`.

## Decided by the agent
- **Does the mirror keep content the page dropped, like recurring tasks and group
  tasks?**: No. The mirror is the landing page in plain text, not a fuller doc. Putting
  those features back in front of crawlers means writing a page, not padding the mirror.
- **Is the coding-agent skill retired?**: No. `akb skill install` still ships. What the
  page dropped is `/kanban ...` as the way in, so the mirror must not read as if the skill
  were gone.
- **Why does `web/design.md` get a rule?**: Nothing ties the landing copy to the mirror
  today, which is how the mirror drifted this far.
