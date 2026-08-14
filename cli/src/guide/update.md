# Updating the board

Updating is two things, and nothing else: **a newer `akb`, then a repaired board.** There
is no third step where the skill is re-installed to pick up a fixed flow — the flows ship
inside the command, so a newer command is a newer set of flows everywhere at once.

## 1. A newer command

```
npm install -g ai4kanban@latest
```

`akb update` can't do this one to itself — replacing the file that is running is how you
get half a command — so it checks npm and names this line when it is behind.

No global install? `npx --yes ai4kanban@latest <command>` is the same command, fetched
each time.

## 2. A repaired board

```
akb update
```

Run it from the project root. It does the whole mechanical part:

- rewrites the installed `SKILL.md` (the note) in whichever of `.claude/skills/kanban/`
  (Claude Code) and `.agents/skills/kanban/` (Codex) is already there, wholesale, which also
  clears out what older versions left beside it: the `references/` folder of copied flows,
  a skill-folder `config.md`, and the command's own `kanban.mjs`. The note is the whole
  skill now — the command comes from npm, so the update is two deletions to commit. It never
  adds a folder that isn't there: the skill is an extra a project opts into, so a project
  without one is not broken, and `akb skill install` is how it is added,
- adds what an older version never wrote: `config.md`, `modules.md`, `releases.md` (empty —
  the board never guesses a ship order), a memory path for every module on the map, the
  goal's `reviewed:` field,
- clears the paragraph older versions seeded into `docs/kanban/memory/goal.md` — the file
  starts empty now — and never leaves a goal that is already written asking to be written,
- moves a memory set still sitting at the board root into `docs/kanban/memory/`,
- drops a leftover `docs/kanban/memory/<module>/goal.md` that says nothing the root goal
  doesn't (the goal lives at `docs/kanban/memory/goal.md` only),
- rescues a filled-in `config.md` left inside an old skill folder to
  `docs/kanban/config.md`,
- prints which version you moved from and to, with a link to everything that changed
  between those two releases.

**The one rule: `docs/kanban/` is yours; the two installed files are upstream's and get
overwritten wholesale. Never merge the two.** It is safe to run twice, and it never edits
your cards, your config, or your memory.

## Then read what it printed

Anything the command can't decide comes back under **Needs your attention**. Each line is
yours to finish:

- **A new config setting.** Add that one line to `docs/kanban/config.md` and ask the user
  only for the new value. Leave the rest of the config alone.
- **A blank `docs/kanban/modules.md`.** Write it per `akb guide module-map`, then run
  `akb update` again so every module gets a memory path.
- **A per-module `goal.md` that says something the root goal doesn't.** Fold that line into
  `docs/kanban/memory/goal.md`, then delete the module copy.
- **A `docs/kanban/config.from-skill.md`.** An old skill folder held a config that differs
  from the board's. Fold anything worth keeping into `docs/kanban/config.md`, then delete it.
- **A missing agent folder.** Only one of the two is here, or neither. `akb skill install`
  writes them if you want that agent to see the board too — it is never added behind the
  user's back.

Leave the project-wide notes and the cards alone — don't move notes into the module paths,
and don't hand-add `modules:` lines to cards.

## Plugin install (the note lives in the plugin cache)

The plugin cache is read-only, so the note comes from the marketplace instead:

```
/plugin marketplace update kanban
/plugin install kanban@kanban
```

Then run `akb update` anyway — it repairs the board, which the plugin never touches.

## Verify

```
akb board peek
akb board version
```

Tell the user to review `git diff` before committing. The board app updates separately —
it says when a newer one is out and links the download; it never updates itself.
