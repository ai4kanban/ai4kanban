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
---

Give each implement run its own git worktree so two runs never write the same files, and
merge the work back into main when the task is done.

## Today
- Every run is spawned in the repo root (`cwd: repoRoot()` in `kanban-ui/lib/registry.ts`).
  Two runs at once write the same working tree, so their changes mix.
- The user's own uncommitted edits sit in that same tree as the agent's.
- Auto-implement (#16) and the group run (#45) both start runs with nobody watching, so
  more than one live run stops being a theory.

## The design

- Only implement runs get a worktree. Every other action writes board files and nothing
  else, and the UI already keeps those apart with one lock per card plus one shared lock.
- One worktree per card at `.worktrees/<id>-<slug>/`, on its own branch. `.worktrees/` must
  go in `.gitignore` — without it the repo reads dirty and every run falls back to the root.
- **The board stays in the repo root; only code goes in the worktree.** A worktree holds the
  last commit, and a run never commits, so the card would be old or missing in there. The run
  gets two places: the worktree for code, the repo root for the board.
- Leave `docs/kanban/` out of the worktree with sparse-checkout, so a wrong read fails with
  "no such file" instead of returning an old card. Do not delete the folder by hand — git
  then records the board as deleted and the merge wipes it.
- The prompt names the repo root path in full and says every board command and card edit
  happens there. The spawn must also allow writing that folder, or every board write the run
  makes is refused. The allow-a-folder flag takes a list, so the prompt must not follow it
  directly.
- The worktree needs two symlinks to work: `.claude/skills/kanban` → the repo root's skill
  folder (a fresh worktree has no skill, so the agent loses `/kanban`), and
  `kanban-ui/node_modules` + `web/node_modules` → the repo root's, so the run can typecheck
  what it wrote. If the run changes `package.json`, install in the worktree for real instead.
- Tell the run to check with `npx tsc --noEmit`. The command in `CLAUDE.md` does not work
  here — no `pnpm`, no `typecheck` script, and `npm run lint` stops on a question, which
  would hang an unattended run.
- A worktree is only used when the code is clean. We never copy the user's uncommitted edits
  into it; dirty code breaks the merge too, since main is checked out in the repo root.
- Reuse a worktree, never rebuild it. Look it up first and only make one when it is missing.
  The normal leftover is uncommitted work, and "start fresh" could only mean forcing a delete
  over it. The run log says which worktree it reused and what commit it was made from.
- A group run gets one worktree, named and branched after the root card. The root owns the
  run, and it is the only id every subtask shares.
- The UI runs the merge, not the agent — main is checked out in the repo root, a killed run
  never reaches a merge step of its own, and the UI is the side that always sees a run end.
- This reverses a settled call: `docs/kanban/memory/local-ui/decisions.md` and the site's
  vs-vibe-kanban copy both say we use no branches and no worktrees. Both change with this.

## What the user does

- Clicks Implement, same as today. Nothing new to click, and the board pages keep their shape.
- While it runs, their own working tree is untouched — they can keep editing.
- When the run ends, the card page says where the work is: the branch, the worktree path, and
  whether it merged into main or is waiting.
- If the merge does not go through, the worktree stays and the card page says so.
- If their code is dirty when they click, the run says so in its log and works in the repo
  root like today. A second Implement while that one is live is refused with a plain message:
  the working tree is busy, commit or stash and try again. Waiting instead would leave a card
  showing "implementing" with an empty log for as long as the tree stays dirty.
- Clicking Implement again on a card that already has a worktree picks up the same folder and
  branch. Nothing in it is thrown away.

## Scope out

- No worktree manager panel. Each worktree belongs to one card, and that card's page shows
  its path and whether the work merged. Reading what is inside one is card #50's job.
- Nothing here makes the agent decide the work is good. The user still reviews the diff.

## Todo

- [ ] Get the user's call on the three questions left — when the merge happens, whether the
      agent may commit in its own worktree, and what a conflict does. They decide the rest.
- [ ] Add a small worktree helper in `kanban-ui/lib/`: look a card's worktree up, make one
      when it is missing, and remove it. Never force a delete over work still in there.
- [ ] Make the worktree at `.worktrees/<id>-<slug>/` on its own branch, sparse-checkout
      `docs/kanban/` out of it, and link in the skill folder and both `node_modules` folders.
- [ ] Add `.worktrees/` to `.gitignore`.
- [ ] Spawn implement runs with `cwd` in the card's worktree, and give the run write access to
      the repo root as well.
- [ ] Put the repo root path in the implement prompt in full, and say every board command and
      card edit happens there.
- [ ] Give a group run one worktree named after the root card, and show that path on the root
      and on every subtask page.
- [ ] Handle a repo that is not clean or has no main branch: say why in the run log and fall
      back to the repo root. Refuse a second implement run while a fallback run is live.
- [ ] Fall back to the repo root the same way when the configured agent is not Claude Code —
      the write-access flag is Claude-only, so a worktree there gives a run that cannot write
      the board at all. Say that reason in the run log.
- [ ] Make archive and reject remove the card's worktree only when it is clean. When work is
      left, keep it and write the branch and the full path into the run log, because the card
      page is about to disappear.
- [ ] Merge back at the point the user settles, from the repo root, run by the UI — then
      remove the worktree.
- [ ] Report the merge result on the card page — branch, path, merged or waiting.
- [ ] Leave the worktree in place on a failed merge, and never delete one that still has
      uncommitted changes.
- [ ] Update `kanban-ui/README.md` — where a run's code now lives, how it gets into main, and
      that "runs in your repo root" no longer covers a Claude Code implement run.
- [ ] Fix the Vibe Kanban comparison copy (`web/public/vs-vibe-kanban.md` and the matching
      page content), which today tells readers we never spin up worktrees.
- [ ] Update `docs/kanban/memory/local-ui/decisions.md`, which today says runs use no branches
      and no worktrees.
