---
title: Run each implement in its own git worktree and merge it back to main
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: [16, 45]
modules: [local-ui]
questions:
  - "[user] When does the work merge into main — as soon as the run finishes, or only after you read the diff and click Archive?"
  - "[user] A run never commits today; a worktree merge needs commits. May the agent commit inside its own worktree, and who writes the commit message?"
  - "[user] What should happen when the merge into main conflicts — keep the worktree and tell the user, or something else?"
  - "[agent] Which runs get a worktree — only implement, or every action that writes files (refine, resolve, propose, archive), since those rewrite the same cards and README?"
  - "[agent] The board itself (docs/kanban/) is in git. Do card and README writes stay on main so the UI sees them at once, while only code goes in the worktree?"
  - "[agent] A new worktree only holds the last commit, so it does not have the user's uncommitted code edits. Does the run build on the last commit alone, or must the worktree carry the current working tree?"
  - "[agent] .claude/ is gitignored and the skill folder is an untracked symlink, so a fresh worktree has no kanban.mjs and no /kanban skill. How does a run inside a worktree reach them?"
  - "[agent] Where does the worktree live — inside the repo or outside it?"
  - "[agent] The worktree carries its own old copy of docs/kanban/ that the agent can see and edit by mistake. Remove it from the worktree, or just declare it off-limits and guard the merge?"
  - "[agent] A worktree has no node_modules, so a run cannot typecheck or lint its own work there. How does a run in a worktree check what it built?"
  - The run is spawned with cwd in the worktree, but the board it must write is outside that folder. What makes the repo-root board reachable and writable for that run?
---

Give each implement run its own git worktree so two runs never write the same files, and
merge the work back into main when the task is done.

## Scope

- Today every run is spawned in the repo root (`cwd: repoRoot()` in
  `kanban-ui/lib/registry.ts`). Two runs at once write the same working tree, so their
  changes mix and can overwrite each other.
- This card changes that: before an implement run starts, the UI creates a worktree for
  that card. The run is spawned inside it. Its code changes stay there.
- One worktree per card, named after the card id, on its own branch.
- When the task is done, the work is merged into main and the worktree is removed.
- The user still reviews the diff. Nothing here makes the agent decide the work is good.
- The board pages do not change shape: same card page, same run log, same buttons.

## Why it matters

- Auto-implement (#16) and the group run (#45) both start runs with nobody watching. Once
  more than one run can be live, a shared working tree is a real risk, not a theory.
- Even with one run at a time, the user's own uncommitted edits sit in the same tree as
  the agent's. A worktree keeps them apart.

## What the user does

- Clicks Implement, same as today. Nothing new to click.
- While it runs, their own working tree is untouched — they can keep editing.
- When the run ends, the card page says where the work is: the branch and worktree path,
  and whether it merged into main or is waiting.
- If the merge does not go through, the card page says so and the worktree stays, so the
  user can go in and finish it by hand.

## Todo

- [ ] Answer the open questions — the merge point, commits, and conflicts decide the rest.
- [ ] Add a small worktree helper in `kanban-ui/lib/`: create, look up, and remove a
      worktree for a card id.
- [ ] Spawn implement runs with `cwd` set to the card's worktree instead of the repo root.
- [ ] Handle a repo that is not clean or has no main branch — say why in the run log, and
      fall back to the repo root rather than failing silently.
- [ ] Decide and build where board writes go (see the open question), so the UI never reads
      a stale board while a run is live.
- [ ] Merge back at the point the open question settles, then remove the worktree.
- [ ] Report the merge result on the card page — branch, path, merged or waiting.
- [ ] Leave the worktree in place on a failed merge, and never delete a worktree that still
      has uncommitted changes.
- [ ] Add the worktree folder to `.gitignore` if it sits inside the repo.
- [ ] Update `kanban-ui/README.md` — where a run's code now lives and how it gets
      into main.
- [ ] Fix the Vibe Kanban comparison copy (`web/public/vs-vibe-kanban.md` and the matching
      page content), which today tells readers we never spin up worktrees.
- [ ] Update `docs/kanban/memory/local-ui/decisions.md`, which today says runs use no
      branches and no worktrees.

## Pushback

- This reverses a settled call. `docs/kanban/memory/local-ui/decisions.md` says a run
  never commits and uses "no branches, no worktrees, no pull requests — that is the model
  we point at vibe-kanban for". Card #16 repeats it. The site's vs-vibe-kanban pages say
  the same thing to readers. Shipping this makes that copy wrong, so the copy has to change
  with it.
- A worktree only helps if the agent commits. An uncommitted worktree cannot be merged. So
  this card cannot stay inside today's "a run never commits" rule.
- The board is in git too. If a run edits cards inside its worktree, the UI keeps reading
  main and shows an old board until the merge lands. This needs an answer before any code.
- The gain is small while only one run happens at a time. The honest trigger for this card
  is #16 and #45, not today's usage.

## Decided by the agent

- **Which runs get a worktree** — only implement. Every other action writes board files and
  nothing else, and the UI already keeps them apart: one lock per card, plus one shared lock
  for create, propose, archive and reject (`kanban-ui/lib/registry.ts`).
  A worktree would only hide their work, because the UI reads and writes the board in the
  repo root (`repoRoot()` in `kanban-ui/lib/paths.ts`), so a card refined in a worktree would
  look unchanged until the merge.

- **The board stays in the repo root** — only code goes in the worktree. A new worktree holds
  the last commit, and a run never commits, so the card the run is about is often missing or
  old in there. Card #48 itself is not committed yet.
  So the run gets two places: the worktree is its working folder for code, and the repo root
  is the one board. It reads the card, ticks its todos, writes the memory files, and runs
  `kanban.mjs` there. One process can do this — the working folder only decides where plain
  file names point, and the board path is given in full.
  Nothing in the worktree's own `docs/kanban/` is touched, so no card is written twice and a
  merge never drags an old board back. `next-id` and `metrics.csv` also stay one copy, so two
  runs can't hand out the same id.

- **The run builds on the last commit** — a worktree is a checkout, so that is all it can hold.
  We never copy the user's uncommitted edits into it. The card lets the user keep editing while
  the run goes, so a copy is out of date a second later, and the same edits would then sit in
  two places.
  Dirty code also breaks the merge, not only the start. Main is checked out in the repo root,
  so the merge runs there, and git refuses to merge a file the user has edited. A dirty board
  does not block it — both were tested.
  So an implement run gets a worktree only when the code is clean. Board files don't count,
  because they stay in the repo root. When code is dirty, write the reason in the run log and
  run in the repo root, like today.

- **Link the skill into the worktree** — `kanban.mjs` is not a problem. It reads the board from
  the folder it is run in, and board commands run in the repo root, so the run keeps using the
  repo root's copy, like today.
  The `/kanban` skill does break. A fresh worktree has `.claude/commands/` (that one file is
  tracked) but no `.claude/skills/`, so the agent starts with no kanban skill — tested.
  Fix: when the worktree is made, add one symlink `<worktree>/.claude/skills/kanban` pointing at
  the repo root's skill folder. `.claude/` is gitignored, so `git status` in the worktree stays
  empty and the link dies with the worktree. Tested: the skill loads again.
  Nothing else is missing. `CLAUDE.md` is tracked. This repo has no `.claude/settings.json` and
  no `.mcp.json`, and permissions and MCP come from the user's own config, which does not depend
  on the folder.
  One real gap is left: `node_modules` is gitignored, so a fresh worktree cannot run typecheck or
  lint until packages are installed there.

- **The worktree lives inside the repo** — one folder, `.worktrees/<id>-<slug>/`, sitting next to
  `docs/` and `kanban-ui/`. Easy to find, one folder to clean up, and a short path to show on the
  card page.
  It does not become a second board. The UI only ever reads `docs/kanban/todo/` under the repo root,
  so the old copy inside the worktree is never opened and no card shows up twice — checked in
  `kanban-ui/lib/board.ts` and `kanban-ui/lib/edit.ts`.
  The dot in the name keeps it out of file search: `rg` skips a hidden folder, tested. The UI dev
  server only watches `kanban-ui/`, so a new worktree never makes it rebuild.
  The `.gitignore` line is a must, not a maybe. Without it `git status` lists `.worktrees/` as
  untracked, so the code looks dirty and the next run would fall back to the repo root, and
  `git add .` warns about an embedded git repository. One line fixes both — tested.
  A temp folder is out: the OS can wipe it while the work is still unmerged.

- **The worktree has no board in it** — when the worktree is made, one extra git command
  (sparse-checkout) leaves `docs/kanban/` out of it. The folder is simply not there.
  Then a wrong read fails with "no such file" instead of returning an old card, and file
  search finds nothing to confuse the agent — tested. Git still keeps the board files in the
  branch, so `git add -A` and `git commit -am` skip them and a merge leaves the board alone —
  tested.
  Deleting the folder by hand is the trap: git then sees 37 deleted files, `git commit -am`
  puts them all in the commit, and the merge wiped the whole board — tested. It only failed
  loudly when the user happened to have edited a board file.
  The prompt still says the board is in the repo root, because the run has to write it there.
  The cost is small: git 2.25 or newer, and one line (`extensions.worktreeConfig`) stays in
  the repo's git config after the worktree is gone.

- **Link `node_modules` in too** — the same trick as the skill link. When the worktree is made,
  add one symlink for each folder that has packages: `<worktree>/kanban-ui/node_modules` and
  `<worktree>/web/node_modules` point at the repo root's. Then the run checks its own code
  where it wrote it.
  Tested: `npx tsc --noEmit` passes in the worktree in under 2 seconds, and it does catch a real
  type error. A full `next build`, which type-checks as well, passes in 6 seconds.
  It is free and it stays clean. Each folder's `.gitignore` already ignores `node_modules`, so
  `git status` in the worktree stays empty and the link dies with the worktree — tested.
  It is also the right packages, not luck: a worktree is only used when the code is clean, so
  the worktree's `package-lock.json` is the same file as the root's.
  Installing in the worktree instead works too, but costs 6 seconds and 463 MB per folder, every
  run. Checking from the repo root is out: pointing `tsc` at the worktree gave 498 fake "cannot
  find module 'react'" errors and buried the one real error among them — tested.
  Two things to get right. If the run changes `package.json`, the link is wrong, so install for
  real in the worktree instead. And the check command in `CLAUDE.md` does not work anywhere in
  this repo — there is no `pnpm` and no `typecheck` script, and `npm run lint` stops on a
  question because there is no eslint config, which would hang an unattended run. Tell the run
  to use `npx tsc --noEmit`.
