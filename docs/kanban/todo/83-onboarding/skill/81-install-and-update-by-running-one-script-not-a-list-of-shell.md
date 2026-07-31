---
title: Install and update by running one script, not a list of shell commands
track: skill
priority: high
roi: high
status: todo
blocked_by: []
related: [80, 83]
modules: [skill, site]
questions: []
---

Let one script do the install and the update, so the agent runs one command instead of a
list of shell commands the user has to approve one by one.

## Today
- Install is a page of prose. The agent reads `INSTALL_PROMPT.txt` and runs `git clone`,
  `mkdir -p`, `cp -R`, and a `printf` that writes a version file — four separate commands,
  each one a separate approval.
- Update is the same shape in `skill/references/update.md`: clone, a `git log`, another
  `cp -R`, another `printf`.
- On the default agent settings none of those are allowed. The user gets a row of prompts
  in the middle of their very first minute with the product, and every prompt is a place to
  give up.
- Prose also drifts. The same copy-in steps are written twice, in the install prompt and in
  the update doc, and they have already fallen out of step — the install prompt copies the
  skill to one folder, while we decided it should land in both the Claude Code and the Codex
  skill folder.

## Scope
- Write one script that does the mechanical part of install and of update. Same script,
  two commands: `npx ai4kanban install` and `npx ai4kanban update`.
- The script is Node — one file, run by the Node 18+ we already require, the same on
  macOS, Linux and Windows.
- It ships as its own npm package, `ai4kanban`, with the skill folder inside it. The user
  clones nothing and downloads nothing by hand, and gets the exact version they asked for.
- Install: get the skill into the project's skill folders, scaffold the board, stamp the
  installed version.
- Update: overwrite the skill folder wholesale, re-stamp, and run the repair steps
  `update.md` lists today. `docs/kanban/` is never touched.
- The script says what it did in plain words, and is safe to run twice.
- Keep the parts a script can't do in the prompt: reading the repo, filling in
  `docs/kanban/config.md`, writing the module map, proposing the first tasks. Those stay
  the agent's job, and the prompt gets shorter because the shell steps leave it.
- Point the install prompt, both READMEs, `skill/references/update.md`, and the site's
  quick start at the one command.
- A plugin install stays as it is — its cache is read-only and `/plugin install` already
  does the copying. The script covers the copied install and the board setup.

## What the user does
- Runs one command to get set up, and one command to update. Approves it once instead of
  approving four things in a row.

## Decided by the agent
- Does the script replace the install prompt? No. It replaces the shell steps inside it.
  The prompt is still what the user pastes, because the repo analysis and the config are
  the parts that need an agent.
- One script or two? One, with an `install` and an `update` command. They share the fetch,
  the copy, and the version stamp, so two files would be two copies of the same code.
- Does the update script make its own decisions? No. It does the mechanical steps and
  prints what changed; anything that needs a judgement call — a new config setting, an old
  memory layout — it reports and leaves to the agent.
- Why npm and not `curl … | sh`? npm needs nothing hosted, no Windows twin, and no shell
  pipe — the kind of command a careful user blocks. A shell script would still call Node to
  do the work, so it is plumbing that buys nothing.
- Why its own package and not a second command on `ai4kanban-ui`? The UI is optional and
  ships a built Next.js app. Setup must work for someone who never wants the UI.
- Where does the script live? In the package only, not inside the skill folder. `npx`
  fetches the newest copy on demand, so a copy sitting in the skill folder would be a stale
  one that has to fetch anyway. (This replaces the earlier call to ship it with the skill.)
- What does the version stamp hold? The package version, not a git SHA. `update` compares
  it with the published version, so nothing needs a git clone to tell you what changed.

## Todo
- [ ] Write the script with an `install` command: copy the skill into both skill folders,
      scaffold the board, stamp the version.
- [ ] Add an `update` command: overwrite the skill folder, re-stamp, run the repair steps,
      report anything that needs the agent's judgement.
- [ ] Make both safe to run twice, and make them print what they did.
- [ ] Publish it as the `ai4kanban` npm package with the skill folder inside, so
      `npx ai4kanban install` is the whole first command.
- [ ] Add the new package to the release steps in `PUBLISHING.md` and to
      `scripts/sync-version.mjs`, so it ships on every release with the one version.
- [ ] Cut the shell steps out of `INSTALL_PROMPT.txt` and leave the agent's part.
- [ ] Rewrite `skill/references/update.md` around the one command.
- [ ] Update the quick start in `README.md`, `README-zh.md`, and the site copy.
- [ ] Install into a fresh repo with default agent settings and count the approval prompts.
      One is the target.
- [ ] Run the update on that repo twice and check the board is untouched.
