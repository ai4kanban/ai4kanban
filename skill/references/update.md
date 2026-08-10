# Updating the skill

Pull a newer version of ai4kanban into a project that already has it. `${KB}` below
is the script invocation from SKILL.md's "The script" section.

**The one rule: `docs/kanban/` is yours; the skill folder (`SKILL.md`, `kanban.mjs`,
`references/`) is upstream's and gets overwritten wholesale. Never merge the two.**

## The command

Run this from the project root:

```
npx --yes ai4kanban@latest update
```

It does the whole mechanical part:

- overwrites every skill folder it finds — `.claude/skills/kanban/` (Claude Code) and
  `.agents/skills/kanban/` (Codex) — with the new version, wholesale,
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

It is safe to run twice, and it never edits your cards, your config, or your memory.

## Then read what it printed

Anything the command can't decide comes back under **Needs your attention**. Each line is
yours to finish:

- **A new config setting.** Add that one line to `docs/kanban/config.md` and ask the user
  only for the new value. Leave the rest of the config alone.
- **A blank `docs/kanban/modules.md`.** Write it per `references/module-map.md`, then run
  the update command again so every module gets a memory path.
- **A per-module `goal.md` that says something the root goal doesn't.** Fold that line into
  `docs/kanban/memory/goal.md`, then delete the module copy.
- **A `docs/kanban/config.from-skill.md`.** An old skill folder held a config that differs
  from the board's. Fold anything worth keeping into `docs/kanban/config.md`, then delete it.

Leave the project-wide notes and the cards alone — don't move notes into the module paths,
and don't hand-add `modules:` lines to cards.

## Plugin install (skill lives in the plugin cache)

The plugin cache is read-only, so the skill comes from the marketplace instead:

```
/plugin marketplace update kanban
/plugin install kanban@kanban
```

Then run `npx --yes ai4kanban@latest update` anyway — it repairs the board, which the
plugin never touches.

## Verify

```
${KB} peek
${KB} version
```

Tell the user to review `git diff` before committing. The board app updates separately —
it says when a newer one is out and links the download; it never updates itself.
