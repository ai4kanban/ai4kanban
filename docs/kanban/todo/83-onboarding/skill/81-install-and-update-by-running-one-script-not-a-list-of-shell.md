---
title: Install and update by running one script, not a list of shell commands
track: skill
priority: high
roi: high
status: todo
blocked_by: []
related: [80, 83]
modules: [skill, site]
questions:
  - "[user] What is the script written in? (a) Node — one `install.mjs`, run by the Node 18+ we already require, same on macOS, Linux and Windows, same language as `kanban.mjs`. (b) a shell script, which is shorter but needs a Windows twin. Recommend (a): we already require Node and nothing else, so the script adds no new requirement."
  - "[user] How does the user get the script? (a) `npx ai4kanban-setup` — we already publish `ai4kanban-ui` on npm, so this is one command and nothing is downloaded by hand. (b) `curl https://ai4kanban.dev/install.sh | sh`. Recommend (a): the agent already knows npx from the UI, and piping a web page into a shell is the kind of command a careful user blocks."
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
  two commands.
- Install: get the skill into the project's skill folders, scaffold the board, stamp the
  installed version.
- Update: fetch the newer skill, overwrite the skill folder wholesale, re-stamp, and run
  the repair steps `update.md` lists today. `docs/kanban/` is never touched.
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
- Where does it live? With the skill, so an installed project already has the update
  command without fetching anything first — the same promise `update.md` makes today.

## Todo
- [ ] Write the script with an `install` command: copy the skill in, scaffold the board,
      stamp the version.
- [ ] Add an `update` command: fetch, overwrite the skill folder, re-stamp, run the repair
      steps, report anything that needs the agent's judgement.
- [ ] Make both safe to run twice, and make them print what they did.
- [ ] Cut the shell steps out of `INSTALL_PROMPT.txt` and leave the agent's part.
- [ ] Rewrite `skill/references/update.md` around the one command.
- [ ] Update the quick start in `README.md`, `README-zh.md`, and the site copy.
- [ ] Install into a fresh repo with default agent settings and count the approval prompts.
      One is the target.
- [ ] Run the update on that repo twice and check the board is untouched.
