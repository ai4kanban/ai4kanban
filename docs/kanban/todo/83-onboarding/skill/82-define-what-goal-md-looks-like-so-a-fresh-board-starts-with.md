---
title: Define what goal.md looks like so a fresh board starts with a usable goal
track: skill
priority: med
roi: high
status: todo
blocked_by: []
related: [81, 83]
modules: [skill, local-ui]
questions:
  - "[user] Does the install flow draft a first goal for me? (a) The agent reads the repo and writes a draft goal into goal.md, marks it `reviewed: weak`, and asks me to correct it — the board is useful from minute one, but the agent has written words I never said. (b) The agent only fills the template and tells me to write the goal myself — SKILL.md's rule today. Recommend (a) with the draft clearly marked as a draft: an empty goal makes every proposal unjudgeable, and correcting a draft is easier than facing a blank file."
  - "[user] Are the template's sections fixed headings the agent reads, or just guidance? (a) Fixed headings (`## Goal`, `## Horizon`, `## Roadmap`) that flows can look up by name. (b) Plain guidance text I can ignore or reshape. Recommend (b): this repo's own goal.md is free prose with checkboxes and works well; fixed headings would break it."
---

Give `goal.md` a real template that shows the user what to write, so a fresh board comes
out of setup with a goal the agent can plan against instead of an empty placeholder.

## Today
- A new board seeds `goal.md` with three lines of prose and `_(not filled in yet — the
  user writes this.)_`. It tells the user the file matters but not what a good one holds.
- Setup never brings it up. The install prompt fills `config.md` and the module map, then
  proposes the first three tasks — against a goal file that is still the placeholder.
- So every new board starts at `reviewed: weak`. The goal bar nags from day one, and the
  first proposals are judged against nothing.
- There are two copies of the template and they already disagree. The script's says
  "the long-term goal, the horizon it aims at, and the roadmap of what comes next"; the
  UI's says "one short statement". The user sees a different file depending on where
  they open it.

## Scope
- Decide what a good `goal.md` holds, and write it as the template: what to say, roughly
  how long, and one short worked example the user can copy the shape of.
- Keep it about direction, not this week's work — the template should make that line clear,
  since cards on the board are the other thing.
- Make the two copies one source of truth: the script's seed and the UI's starting text
  must be the same words.
- Put a step in the install prompt for the goal, so setup ends with a filled goal rather
  than a placeholder. Order it before the first proposals — those are only as good as the
  goal they are judged against.
- Say in the skill what makes a goal `strong` vs `weak`, so the agent's `reviewed:` call
  isn't guesswork.

## What the user sees
- After setup, `goal.md` holds their own direction in their own words, and the goal bar is
  quiet because there is a real goal to plan against.
- Opening the goal in the UI and in the file shows the same thing.

## Todo
- [ ] Write the new template: what a goal holds, how long, and a short example.
- [ ] Replace the seed in the script with it.
- [ ] Make the UI's starting text the same words, so the two can't drift again.
- [ ] Add the goal step to the install prompt, before the first proposals.
- [ ] Write down what makes a goal strong or weak, so `reviewed:` is a rule not a guess.
- [ ] Run setup on a fresh repo and check it ends with a real goal and a quiet goal bar.
