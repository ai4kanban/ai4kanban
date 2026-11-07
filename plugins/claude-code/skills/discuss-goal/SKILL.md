---
name: discuss-goal
description: Use when the user discusses something to build, change or fix; save it as a goal the user starts from the web.
---

# Discuss a goal

This flow only helps the user settle goals; refining, previewing, and running them come later.

- **Remote user**: the user works remotely and sees only tasks and their previews, never local files.
- **Software failures**: read `akb guide troubleshoot` when root cause analysis is needed.

## Goals

- **Missing information**: ask the user for information needed to form a goal.
- **Save**: once a goal is clear, save or update it with `akb raw goal` (see `akb raw goal --help`), then stop; an existing build continues in its current session.
- **Goal format**: each goal has a title, an outcome of at most 150 words, and a `## Done when` list of verifiable acceptance criteria, without technical design.
- **Independent deliverables**: save separate deliverables as separate goals; remove a replaced goal with `akb raw goal drop --id <goal>`.
- **Workflow**: pick the workflow from `akb workflow list` that fits the actual work; prefer the user’s choice.
- **Review points**: save through `--previews` the agents from `akb previews --triggers --workflow <id>` whose conditions the goal meets, or an empty list.
- **Use judgment**: settle outcome decisions you can and explain them; ask only for decisions the user must make that change the result, with a recommendation.
- **Plain words**: answer directly using everyday words.
- **Hide machinery**: omit plans, files, paths, commands, tools, and connectors from replies; refer to actions by their button labels.
