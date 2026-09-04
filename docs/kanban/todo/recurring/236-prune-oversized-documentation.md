---
title: Prune oversized documentation
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: []
modules: []
last_run: 2026-08-29 19:08
questions:
  - The board's whole user guide lives in kanban-ui/README.md, the deprecated npm package's README, and most readers now arrive through the desktop app. Move it to docs/guides/ and leave the package README as a deprecation notice, or keep it where docs/kanban/memory/local-ui/decisions.md settled it?
  - question: "[user] kanban-ui/README.md says the chat rail never writes your project's code and sends every job to a run; cli/README.md says the chat does the printed flow in the conversation by default. Both describe the same akb chat session, so one is wrong. Which does the chat actually do?"
    mode: single
    options:
      - cli/README.md is right — chat is the skill in a session and does the work there; correct the kanban-ui/README.md bullet
      - kanban-ui/README.md is right — the app's rail always hands work to a run; correct cli/README.md instead
      - Both are right because the app's rail and akb chat differ — say so in each file
    recommend: [1]
verify:
  - Read the shortened docs/guides/daily-loop.md (581 -> 402 lines) end to end and confirm nothing you rely on was cut — the deep mechanics now defer to kanban-ui/README.md.
  - The plain-text mockup style moved out of daily-loop.md into kanban-ui/README.md 'Mockups on a card' — check it reads right where it landed.
  - AGENTS.md was overwritten from CLAUDE.md so the two match again; AGENTS.md had drifted, missing the ascii-diagram line. Confirm you want them identical.
  - docs/kanban/memory/skill/readme.md cites cli/README.md for the DeepSeek Harness --dsh-path rule, which that file does not carry. Memory is out of this card's scope — fix it in a memory prune.
---

Shrink this project's hand-written documentation back to what helps readers find setup and
everyday workflows.

## The documents

The set is small enough to keep listed here, so the pass starts from this table instead of
rediscovering it. Each row names the reader a document serves and the job it does; that is
the standard its rewrite is measured against.

| Document | Reader | Job |
| --- | --- | --- |
| `README.md`, `README-zh.md` | someone meeting the project on GitHub | say what AI4Kanban is, then send them to the download and the daily loop. The Chinese file mirrors the English one — change both together |
| `cli/README.md` | someone on the npm page | install and update the CLI, and say what the command owns |
| `kanban-ui/README.md` | anyone using the board's pages, in the app or in the deprecated npm package | the whole user guide to the board — what every column, panel, button and setting does. Open with the deprecation notice and the app download, then teach the pages |
| `desktop/README.md` | someone running the app | which build to download, and what it still needs on the machine |
| `docs/guides/daily-loop.md` | a user driving a board that already exists | the everyday rhythm — what to say, and which button does the same thing. Defer mechanics to `kanban-ui/README.md` rather than restating them |
| `docs/guides/connectors.md` | a user picking which coding agent runs the board | what each agent reports back, what it costs, and which plan to buy |
| `docs/guides/what-makes-a-good-goal.md` | a user writing `docs/kanban/memory/goal.md` | advice, not a format, on a goal the board can plan against. `kanban-ui/public/guides/` holds the one-paragraph copy the app shows — keep it one paragraph |
| `PUBLISHING.md` | the maintainer cutting a release | what ships where, and in what order |
| `web/design.md`, `kanban-ui/design.md` | a contributor changing a page or a panel | the visual and interaction rules each app is held to |
| `cloud/README.md` | a contributor changing the Cloud service | how the Worker, the schema and the checks fit together, and how to run them |
| `AGENTS.md`, `CLAUDE.md` | an agent or contributor working in this checkout | the checks to run and the local conventions. Same content for two agents — keep the files identical |

Out of scope: everything under `docs/kanban/`, since cards and memory have their own flows;
what the CLI ships to agents — the flow guides in `cli/src/guide/`, the skill note in
`skill/SKILL.md`, the spec-agent briefs in `cli/src/spec/`, and the templates in
`cli/src/templates/`; agent instructions under `.claude/`; release-plan documents such as
`notify-plan.md`, which track work in flight rather than serve a reader; site copy and blog
posts under `web/public/` and `web/blogs/`; and generated files, vendored docs, changelogs,
and API references.

## Process

1. **Reconcile the table first**: confirm every listed document still exists, add a row for
   any new hand-written reader-facing one, and correct a job that no longer matches what
   the document does. Do this before touching prose.
2. **Rewrite against the stated job**: take the documents that have grown hard to scan and
   rewrite each as topics that give the shortest complete path through its common tasks,
   judged against its row. Merge repeated explanations so each behavior is explained once,
   in one place.
3. **Cut what no longer earns its place**: drop stale behavior, implementation detail,
   release history, and step-by-step stories. Replace detail with a link only after
   confirming the destination covers it. Keep unique user-facing behavior, runnable
   commands, prerequisites, compatibility notes, deprecation notices, and safety warnings.
4. **Move narrow material out, don't fragment it**: when a large block is genuinely needed
   but serves a narrower task or audience, give it its own reference document and leave a
   short, descriptive link in the README. Each reference gets one subject and keeps its
   prerequisites and context with it. Never split prose just to lower a README's line count.
   Before moving a document or a whole section to another file, check the owning module's
   `decisions.md` — where a document lives is often already settled there. If it is, leave
   it where it is and raise the move as a question instead.
5. **Verify and report**: check every changed link, heading anchor, and command example,
   then read the diff for requirements lost along the way. Report each document's
   before/after line count and what was merged, moved, or removed. Every document you
   touched should end materially shorter and easier to navigate, without making readers
   chase links for the common path.
