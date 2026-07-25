---
title: Move archived task files to a hidden folder instead of deleting them
track: skill
priority: med
roi: med
status: ready
blocked_by: []
related: []
modules: [skill]
questions: []
---

When a task is finished, move its card file into a hidden dot folder instead of deleting it, so the finished work is kept and can still be read or diffed in git.

## Scope
Today `cmdRemove` in `kanban.mjs` deletes the card with `fs.rmSync` (a file, or the whole folder for a group root). Change archive so it moves the card into a hidden folder instead of removing it.

- Add a hidden archive folder (e.g. `docs/kanban/.archive/`) that the script creates on first use.
- On `archive`, move the card file (or the group folder) into the hidden folder instead of deleting it. Keep the id-prefixed filename — ids are never reused, so names never collide.
- Keep the rest of `cmdRemove` unchanged: still strip the README entry (the card is no longer open), still bump the `completed` metric, still tick the subtask in its group root.
- Recurring cards still never archive — no change there.
- Update the command's console output to say "moved to <hidden folder>" instead of "removed".

## Todo
- [ ] Add a helper that ensures the hidden archive folder exists.
- [ ] Change the archive path in `cmdRemove` to move the file/folder there instead of `fs.rmSync`.
- [ ] Update the console message for archive to report the new location.
- [ ] Update `kanban.mjs` help/header comments so archive is described as "move to hidden folder", not "remove".
- [ ] Check the local UI and any references that describe archive as deletion, and update them.
- [ ] Add the hidden folder to `.gitignore` or not — decide with open question 1 (kept in git = readable history).

## Decided by the agent

- **Does `reject` also move to the hidden folder?** No. Only `archive` moves the card; `reject` keeps deleting it. A rejection already writes its reason into `rejected.md`, but `archive` only writes to `readme.md` for user-facing changes — so a finished internal-only card leaves no trace today. That is the gap this fills. Keeping rejects out also means the folder means one thing: finished work.
- **Where does the folder live, and does it mirror the track subpath?** `docs/kanban/.archive/`, next to `todo/`, and flat — no track folders inside. `todo/` means open tasks, and everything that walks the board reads every folder under `todo/` without skipping dot-names, so a folder there would show up as a track column in the UI and archived cards would look open. Outside `todo/` it needs no guards. Flat is enough: ids are never reused so names never collide, and each card still names its track in its own frontmatter.
- **Is the folder kept in git?** Yes — no `.gitignore` entry. Reading and diffing finished cards in git is the whole point. Worth saying out loud because the other dot paths under `docs/kanban/` (`.sessions/`, `.sessions.json`) are ignored.
- **Is `.archive/` part of the project memory?** No. Nothing reads it — not propose, not refine, not review. It is a git history store, not a sixth memory file. `readme.md` plus the published docs stay the only record of shipped work.
- **What happens to a group task?** Its whole folder moves as one. Subtasks archived earlier are already flat files in `.archive/`, so a group's pieces end up split apart there. That is fine — the id in each filename ties them back.
- **A card with that id is already in `.archive/`?** Stop with a clear error; never overwrite. Ids are never reused, so this only happens if someone moved a file by hand.
- **Does the local UI need a behavior change?** No. It lists cards under `todo/`, and after archive the card is gone from `todo/`, so "go home after archive" still works. Only its wording is wrong.
- **Out of scope** — pruning old archived cards, a UI view to browse them, and changing the "no longer on the board" warning to say "archived". None are needed to keep finished cards.

### Extra steps

The concrete version of the plan's last two todos. Todo 6 is answered above: no `.gitignore` entry.

- [ ] Stop with a clear error if `.archive/` already holds that id, instead of overwriting.
- [ ] Add `.archive/` to the layout tree in `skill/SKILL.md`, and say no flow reads it. Line 52's "there is no separate archive" is about the memory set — keep that true.
- [ ] Fix the two "removes the card file" lines in `skill/SKILL.md`: the `archive` entry in the command list, and "Finish a task". Leave the `reject` line as it is.
- [ ] Fix the archive dialog text in the local UI — it still says the note goes into `archive.md` (that file is gone) and that the card is removed.
- [ ] Update `docs/guides/daily-loop.md` — "Finish a task" says archive removes the card.
- [ ] Update the landing copy in `web/public/index.md` ("compresses it into the archive, removes the card"). Doc only; the matching line in the landing page code waits for the user's go-ahead.
