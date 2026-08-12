---
title: Ship the recommend-tech-stack agent, which picks the library or service
track: skill
priority: med
roi: med
status: ready
release: ""
blocked_by: [187]
related: [186]
modules: [skill]
questions: []
---

The second agent. When a card needs an outside library, tool, or service, it comes back
with the candidates weighed and one recommended — instead of the first name the planning
pass remembered.

## Scope
- Write the `recommend-tech-stack` prompt: read the card, work out what has to be picked,
  and compare the real options.
- It answers with two or three candidates, each with one line for what it gives us and one
  for what it costs — licence, upkeep, weight, lock-in. One is recommended, with the reason.
- It looks up what it recommends instead of trusting memory, so a dead or renamed package
  never reaches the card.
- It says when the answer is to build it ourselves, or to keep what the project already
  uses. Adding a dependency is not the default.
- It writes its `## By \`recommend-tech-stack\` agent` section and nothing else.

## Todo
- [ ] Write the `recommend-tech-stack` prompt: what it compares and what it must report.
- [ ] Make it answer in two or three candidates with the trade-offs and one recommended.
- [ ] Make it check each candidate is real and still maintained before naming it.
- [ ] Let "use what we already have" or "write it ourselves" be an answer.
- [ ] Run it on a real card that needs a library and check the section is enough to build
      from.
- [ ] Document what the recommend-tech-stack agent fills in.

## Decided by the agent
- **It checks before it names** — a library recommended from memory can be abandoned,
  renamed, or gone. A wrong pick costs more than the run that would have caught it.
- **Not adding a dependency is a valid answer** — otherwise every card that asks the agent
  comes back with something new to install.
