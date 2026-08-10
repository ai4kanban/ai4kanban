---
title: Make one install serve Cursor and Windsurf too
track: skill
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: [skill]
questions: []
---

Install puts the skill where Claude Code and Codex look. A Cursor or Windsurf user
installs it and their agent never finds it, so the board looks broken on day one. Being
agent-agnostic is a promise on our goal — make install keep it.

## Scope
- One install command serves every agent we claim to support. It asks nothing.
- For each agent, put the skill where that agent actually looks — the folder or rules file
  it reads, in the shape it expects.
- Install only where an agent is actually set up in the repo, so a Claude-only project
  does not get four stray folders.
- Update refreshes every place install wrote, the same way it does today.
- Say which agents are supported in the README and on the site, so the claim matches what
  ships.

## Todo
- [ ] Work out where each agent we support looks for a skill or rules file.
- [ ] Have install write to each of them, and only for agents set up in the repo.
- [ ] Have update refresh every place install wrote.
- [ ] Test the board end to end in each agent — add a card, refine it, archive it.
- [ ] Name the supported agents in the README and on the site.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; their `init` auto-detects 13+ editor
  profiles and writes each one's rules file, and `rules add` covers the rest. One install,
  every agent. Ours writes two folders.
