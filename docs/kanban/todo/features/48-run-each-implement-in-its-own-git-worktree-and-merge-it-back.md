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
- If their code is dirty when they click, the run says so in its log and works in the repo
  root like today. A second Implement while that one is going is refused with a plain
  message: the working tree is busy, commit or stash and try again.
- Clicking Implement again on a card that already has a worktree picks up the same folder
  and branch. Nothing in it is thrown away.

## Todo

- [ ] Get the user's call on the three questions left — when the merge happens, whether the
      agent may commit in its own worktree, and what a conflict does. They decide the rest.
- [ ] Add a small worktree helper in `kanban-ui/lib/`: look a card's worktree up, make one
      when it is missing, and remove it. Reuse always beats rebuild — never force a delete
      over work that is still in there.
- [ ] Make a new worktree at `.worktrees/<id>-<slug>/` on its own branch, leave
      `docs/kanban/` out of it, and link in the skill folder and both `node_modules`
      folders so the run has the `/kanban` skill and can typecheck what it wrote.
- [ ] Add `.worktrees/` to `.gitignore` — without it the repo reads dirty and every run
      falls back to the repo root.
- [ ] Spawn implement runs with `cwd` in the card's worktree, and give the run write access
      to the repo root as well, or every board write it makes is refused.
- [ ] Put the repo root path in the implement prompt in full, and say every board command
      and card edit happens there — the script reads the board from the folder it runs in.
- [ ] Give a group run one worktree named after the root card, and show that path on the
      root and on every subtask page.
- [ ] Handle a repo that is not clean or has no main branch — say why in the run log and
      fall back to the repo root rather than failing silently. Refuse a second implement
      run while a fallback run is live, with a message saying to commit or stash.
- [ ] Fall back to the repo root the same way when the configured agent is not Claude Code,
      and say that reason in the run log.
- [ ] Make archive and reject remove the card's worktree only when it is clean. When work is
      left in it, keep it and write the branch and the full path into the run log, because
      the card page is about to disappear.
- [ ] Merge back at the point the user settles, from the repo root, run by the UI and not by
      the agent — then remove the worktree.
- [ ] Report the merge result on the card page — branch, path, merged or waiting.
- [ ] Leave the worktree in place on a failed merge, and never delete a worktree that still
      has uncommitted changes.
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
  tracked) but no `.claude/skills/`, so the agent starts with no ai4kanban skill — tested.
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

- **Give the run the repo root in full, and let it write there** — the prompt names the repo
  root path and says every board command and every card edit happens in that folder, and the
  spawn adds that folder to what the run is allowed to write.
  Both halves are needed, and both were tested. The script takes the board from the folder it
  is run in and nowhere else, so with the working folder in the worktree every board command
  died with "missing docs/kanban/next-id" — the same error whether the script was named by a
  short path or a full one. Putting the repo root in front of the command fixed it: the same
  command then read card 48 fine. The failure is loud, not silent, which is good: a run that
  forgets can't quietly write a second board.
  Writing is the half that is easy to miss. A run whose folder is the worktree is writing
  outside it when it touches the board. Tested: with edits allowed only inside the run's own
  folder, a write to a file in the repo root was refused with "requested permissions to write
  to ..., but you haven't granted it yet". Naming the repo root as an extra allowed folder made
  the same write pass. This never came up before because today the board is inside the run's
  folder.
  No new setting on the script. It has no board-path option, and giving it one would make the
  skill care who called it. The prompt and the spawn are enough.
  One trap: the allow-a-folder flag takes a list, so the prompt must not sit right after it —
  tested, the prompt was eaten as a folder name.

- **One worktree, named after the root** — a group run is one process with one working folder,
  so one worktree is all it can have. It is named and branched after the root card id.
  The root already owns the run: one session, one log, one badge, and the run locks the root
  and every subtask (#45). The root id is the only id all of them share, and a subtask card
  already lives inside the root's folder on the board.
  Each subtask page shows that same worktree path, the same way it already shows the same log.

- **Reuse the worktree, never rebuild it** — look the card's worktree up first and only make one
  when it is missing. A re-run is a continue: same folder, same branch, left exactly as it is.
  It is not reset and not rebased behind the user's back.
  The reason is the work inside it. A run does not commit today, so the normal leftover is
  uncommitted edits, and throwing those away is the one thing this card must not do.
  Git agrees — tested. Making it again with the same branch fails ("a branch named ... already
  exists"), and even at a fresh path git refuses ("already checked out at ..."). Removing it
  fails too while it holds changes ("contains modified or untracked files, use --force"). So
  "start fresh" can only mean forcing a delete over the user's work.
  The run log says it is reusing the worktree and which commit it was made from, so an old base
  is visible rather than a surprise at merge time.

- **The UI runs the merge** — the agent may commit inside its own worktree (still an open
  question above); putting the work into main is the UI's step, not the run's.
  Three reasons. Main is checked out in the repo root, not in the worktree, so the merge happens
  outside the folder the run works in. A run can end failed, or be stopped (#49), and a run that
  was killed never reaches a merge step of its own — the UI is the only side that always sees a
  run end, since it closes the log, stamps the duration and puts the card's stage back. And the
  merge is one plain git command with no judgment in it, which is the kind of thing the UI
  already runs itself.
  Only the timing waits on the user (the first question). The owner is the same either way: if
  the merge happens when the run ends, the UI does it as the session closes; if it happens at
  Archive, the UI does it around the archive run.

- **Refuse the second run, don't share the root again** — while one run is falling back to the
  repo root, a second implement run is refused with a plain message: the working tree is busy,
  commit or stash and try again.
  It has to be refused, because it would always be a second fallback: the first run makes the
  tree dirtier as it works, so the second one can never pass the clean check either. That is the
  exact mixing this card exists to stop.
  Waiting is worse than refusing. Nothing says when the tree will be clean, so a queued run
  would sit on the card showing "implementing" with an empty log for as long as the user leaves
  it dirty. Refusing is also what the UI already does — a second run on a card, or a second
  create, gets a message straight back.
  Nothing gets stuck. The user's way out is one commit or one stash, and then the worktree path
  works again. Background runs cope on their own: the dispatcher skips a card it can't start and
  tries again the next minute.

- **No worktree manager in this card** — out of scope. Each worktree belongs to one card, and
  that card's page already shows its path and whether the work merged, so the board is the list.
  The pile does not grow on its own: a worktree goes when its work merges, and when its card is
  archived or rejected with nothing uncommitted left in it. What survives is a card still on the
  board whose work did not merge, which is the one case the card page is there to report.
  Looking inside a worktree is card #50's job — it reads a run's changed files from the run's
  worktree. A panel here would say the same thing twice.
  It also fits the house rules: this card's scope says the pages keep their shape, and extra
  browsing panels have been turned down before. Anything truly stray is one `git worktree list`
  away, and we never force-delete a worktree that still holds work.

- **An archived or rejected card leaves its worktree alone** — the folder and its branch stay
  when anything is still uncommitted in there. Archive and reject only remove a worktree that
  is clean.
  The reason is that the work is nowhere else. Uncommitted files live in that folder only —
  git holds no copy, and the branch is still sitting on the same commit as main when the run
  committed nothing (tested). Deleting the folder loses the work for good, and a rejected card
  is often the case where the user still wants to read what the agent wrote.
  Git already works this way: `git worktree remove` refuses a folder with modified or untracked
  files and tells you to pass `--force` — tested. We never pass it.
  Nothing points at it once the card is gone, so the last run says it out loud: before it
  finishes, the archive or reject run checks the card's worktree, and if work is left it writes
  the branch name and the full worktree path into its log, so the user reads it on the spot and
  the runs panel keeps it.
  After that, git is the index. `git worktree list` still names the folder and the branch, and
  the folder name carries the card id. Ids are never reused (`next-id` only counts up), so a
  leftover can never clash with a later card.
  Leaving it costs nothing. `.worktrees/` is gitignored, so the repo root's `git status` stays
  clean, and `git worktree prune` does not touch it because the folder is still there — tested.
  It waits until the user deals with it.

- **Only a Claude Code command gets a worktree** — any other configured command runs in the repo
  root, exactly like today.
  A run in a worktree still has to write the board in the repo root, and that needs the
  "allow this extra folder" flag, which is a Claude Code flag. Without it the write is refused.
  So a worktree for another connector would buy a run that cannot tick a todo or update its own
  card — worse than today, not better.
  This follows the rule the code already uses, it is not a new one. `kanban-ui/lib/agent.ts` adds
  its flags only when the binary is `claude`, and never pushes a Claude-only flag onto a
  configured command; the resume handoff is gated the same way, and another connector simply does
  not get the button. `decisions.md` says the same for the group run: only Claude Code can do it,
  another connector falls back.
  The fallback already exists on this card. Dirty code also drops the run back to the repo root
  with a line in the run log. This is the same line with a different reason: no worktree because
  the configured agent is not Claude Code.
  One doc line changes with it: `kanban-ui/README.md` says today the agent "runs in your repo
  root", which stays true for every connector except a Claude Code implement run.
