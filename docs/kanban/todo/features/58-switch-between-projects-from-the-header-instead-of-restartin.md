---
title: Switch between projects from the header instead of restarting the server
track: features
priority: med
roi: med
status: todo
blocked_by: [55]
related: [55]
modules: [local-ui]
questions:
  - "[user] Where does the list of projects live? It cannot sit in a board (docs/kanban/ui.config.json) because it spans boards. A file in the user home folder is the obvious place, but that breaks the rule that files in the repo are the only source of truth."
  - "[user] How does a project get on the list: the user types or picks a path in the UI, or only by launching the server once with --board <dir>?"
  - "[user] Is the switch global to the server (one active project at a time, background auto-refine follows it) or per browser tab (two tabs, two projects)?"
  - "[user] Does auto-refine keep running for every project on the list, or only for the one you are looking at?"
---

One UI server drives one repo today. Let it hold several projects and switch between
them, so a user with more than one board does not stop and restart the server.

## Today
- The board path is a process-wide constant. `lib/paths.ts` caches `repoRoot()` in a module
  variable and every other path is built from it, so nothing can point at a second board
  until that changes.
- The run registry and the auto-refine dispatcher are both pinned to that one root.
- So most of the work here is under the header, not in it. The switcher is the small part.
- Do #55 first — this card is blocked by it. #55 moves the UI off direct file access in the
  very files this card threads a board root through, so doing this first means doing that
  work twice.

## Scope

- Turn the header's path badge into a project switcher. It shows the project you are on
  now; clicking it lists the others and switches to one. Same spot, same quiet look — this
  replaces the badge, it does not add a control next to it.
- The switcher is labelled with the folder name, with the resolved path on hover. Two
  projects with the same folder name both gain the parent folder (`work/kanban`,
  `oss/kanban`). Not a name from `docs/kanban/config.md` — that line is a free-text
  placeholder most boards never fill in.
- Keep a list of projects the server knows. A project is a folder that holds `docs/kanban/`.
- Make the board path a value the server looks up per request, then follow it through
  `lib/registry.ts` (run logs and `.sessions.json` live under the board), `lib/config.ts`
  and `lib/agent.ts` (they read `ui.config.json` from the board), `lib/board.ts`,
  `lib/modules.ts` and `app/actions.ts`. A run must also spawn the agent with the right
  `cwd` — a run started on project A must not write into project B.
- A run in flight keeps writing to the project it started on, even if the user switches
  while it runs.
- Starting the server with no `--board` and one project behaves exactly as it does now.

## Rules to follow

- **A project is its board folder's true path**, worked out once when it joins the list.
  Cleaning up the path text is not enough — it leaves a symlink pointing elsewhere, and on
  a Mac the same folder in different capitals reads as two. Resolve at add time only, so a
  project on an unreachable drive shows as broken instead of hanging the page.
- **A card is its project plus its number, never the number alone.** A run keeps its own id
  and records the project it started on.
- **Every lock is per project** — the per-card lock, the one-create-at-a-time rule and the
  board-index lock. Each only protects one board's `next-id`, README and `metrics.csv`.
  Global locks would make project B wait on project A, and would wrongly refuse work on
  B #5 while A #5 runs.
- **Each project's runs and logs stay under its own board**, thirty per project. One shared
  list written into whichever board is current would let project A's file swallow project
  B's runs, and a busy project would evict a quiet one's history.
- **The runs panel spans every project**, each row saying which project. It is the one place
  to browse runs and any run can be stopped from it — a run the panel hides is a run you
  cannot watch or stop. Reading is cheap: the server reads a project's saved runs once, at
  start and when it joins, then keeps them in memory. The poll never re-reads another
  project's files.
- **The project goes in the URL as the first segment**: `/kanban`, cards at `/kanban/58`.
  Card numbers repeat across boards, so a bookmark to `/58` would open a different card once
  the active project changed. Same-named projects fold the parent into that one segment
  (`/work-kanban/58`), so a card is always the second segment. This holds whether the switch
  ends up global or per tab.
- **A bare `/` goes to the board the server started with**, never a picker — that keeps the
  single-project promise for free. A URL naming a project not on the list fails clearly,
  with the switcher there to pick a real one; landing elsewhere quietly could have the user
  act on the wrong board's #58.
- **A project with no skill installed is not broken.** The agent finds the skill several
  ways — copied in, plugin, or user-level — so the project path proves nothing. Mark a
  project broken only when the board is gone or `docs/kanban/todo/` is missing, and never
  check for the skill.

## Scope out
- No custom project labels. The naming rule above already tells projects apart, and a rename
  would need somewhere to live — the same open question as the list itself.
- No per-project filter in the runs panel. Every row already names its project, which is
  enough to scan a flat list.

## Todo

- [ ] Write down what a "project" is for the server: its true resolved path, worked out once
      when it joins, its label, and where the list is stored. Adding a board already on the
      list switches to the entry that is there.
- [ ] Make `lib/paths.ts` resolve the board per request instead of caching one root.
- [ ] Move every other module that builds a path off the single cached root.
- [ ] Pass the right project into each agent run, including its `cwd`, and keep a running run
      on the project it started on.
- [ ] Make every lock per project: the per-card lock, the one-create-at-a-time rule, and the
      board-index lock.
- [ ] Record on every run the project it started on, and keep each project's run list and log
      files under that project's own board, thirty each.
- [ ] Read a project's saved runs once, when the server starts and when the project joins,
      then show every project's runs in one list, newest first, project on each row.
- [ ] Run the start-up cleanup once per project instead of once per server, and judge whether
      a card is busy only against that project's own runs.
- [ ] Put the project in the URL as the first segment, folding the parent folder in when two
      projects share a folder name.
- [ ] Make a bare `/` land on the board the server started with.
- [ ] Show a clear "not on the list" page when the URL names a project that is not there.
- [ ] Replace the header badge with the switcher: current project, list of others, click to
      switch, folder name as the label with the parent folder on a clash and the resolved
      path on hover.
- [ ] Add a way to put a project on the list and take one off.
- [ ] Show a broken or missing project clearly instead of failing the page.
- [ ] Decide what the auto-refine dispatcher does with more than one project, and build that.
- [ ] Check the single-project case is unchanged: start in a repo, no extra setup, same board.
- [ ] Update `kanban-ui/README.md`: what the switcher does, how a project gets on the list,
      how to remove one. Update `skill/references/local-ui.md` only if the way you start the
      server changes — that file covers installation, not usage.
