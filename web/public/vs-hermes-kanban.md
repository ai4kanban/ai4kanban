# AI4Kanban vs. Hermes Agent Kanban

> Built-in specialist workflows and draft approval put your judgment before the
> build, so you correct less afterwards.

## Specialist agents and workflows, ready to use

- **AI4Kanban** — Built-in agents and workflows cover software development,
  blogs, social carousels, slide decks and product videos. You can also create
  your own.
- **Hermes Kanban** — Workers are Hermes profiles you set up with a model and
  skills. No built-in specialist workflows for UI design, copywriting or content
  production.

**Both support**

- **Task breakdown and dependencies** — AI4Kanban splits work into cards and
  subtasks, with dependencies controlling execution order. Hermes Kanban breaks
  a one-line task into child tasks and runs a child once its parents are done.
- **Parallel runs in git worktrees** — AI4Kanban runs independent cards side by
  side, each in its own git worktree. Hermes Kanban runs tasks in parallel, with
  a git worktree per task.

## Review key drafts before implementation

- **AI4Kanban** — Choose the UI, prompts, copy or other key parts you want to
  review. Agents prepare drafts you can preview and edit, then build from what
  you approve.
- **Hermes Kanban** — Tasks start from a text spec. Its docs describe no preview
  and approval of key drafts before execution.

**Both support**

- **A written spec** — AI4Kanban cards hold the scope and build steps. Hermes
  Kanban can rewrite a task into a goal, approach and acceptance criteria.
- **Feedback on the task** — AI4Kanban takes your changes in the card chat and
  updates the plan. Hermes Kanban takes your notes to the worker in task
  comments.

## Settle the requirements first, then stop watching

Watching less doesn’t mean lower quality: drafts, questions and key-point
summaries keep the result on track.

- **AI4Kanban** — It doesn’t start blind. It first asks the questions that
  matter and pins down what the delivery must meet, then builds. You approve the
  key points and leave the details to agents, so you don’t have to watch every
  run, and you can ship more work in a day.
- **Hermes Kanban** — Light planning, fast execution: work starts as soon as it
  is broken down, the bar is adjusted along the way, and fixes are made in the
  worktree. That is a valid way to work, but it relies on you checking in as it
  runs, which limits how much work you can ship in a day.

**Both support**

- **Agents that learn as they work** — AI4Kanban’s specialist agents note the
  drafts you send back or overrule, and finished cards are reviewed for
  decisions and preferences. Each Hermes profile keeps memory notes and writes
  its own skills from what it learns, including your corrections.
- **Task history** — AI4Kanban keeps plans, conversations and run records on the
  card. Hermes Kanban keeps a comment thread and run history on the task.

## 01 · Key differences — Compare the details

A ✓ marks the stronger side on each row.

| Dimension | AI4Kanban | Hermes Kanban | Edge |
| --- | --- | --- | --- |
| Built-in agents and workflows | Built-in specialist agents and workflows for development and content. Create your own. Content workflows require Pro. | General-purpose Hermes profiles you set up. No built-in specialist workflows for UI design, copywriting or content production. | AI4Kanban |
| Before work starts | Planning settles what it can and asks you what is still open. Nothing is built until you start it. | A model breaks the task into a task graph without asking you; child tasks start on their own unless you turn that off. | AI4Kanban |
| Key draft review before execution | Image, diagram, HTML/TSX, diff and storyboard drafts. Approved content becomes part of the execution requirements. | A text spec with goal, approach and acceptance criteria. No draft preview before execution in its docs. | AI4Kanban |
| Questions for you | Asked while planning or mid-build, each with options and a recommended answer; only dependent work waits, and it continues once you answer. | A worker pauses the whole task with a written reason; you comment, unblock it, and the worker starts again. | AI4Kanban |
| What agents remember | Each specialist agent notes the drafts you send back or overrule; finished cards are reviewed for decisions and preferences. | Each profile keeps memory notes and writes its own skills from what it learns, including your corrections. | Even |
| Work after delivery | Agents review what shipped and suggest follow-up work with reasons; a QA agent tests recent changes daily. Suggestions wait in triage for your decision. | Workers create child tasks to split up work in progress. Follow-up after delivery is a new task you create. | AI4Kanban |
| Merging parallel work | Each finished build is rebased and merged in turn; an agent resolves conflicts. | Worktrees are kept after the task. Merging back is not documented; conflicts go to a separate reconciliation task. | AI4Kanban |
| Recurring work | Scheduled agents run on a cadence you set. | One-off scheduled starts. Recurring work needs your own cron job. | AI4Kanban |
| Running Claude Code or Codex | Claude Code, Codex, Cursor, OpenCode and other coding agents run the work directly, on your own subscriptions; choose one per agent. | Workers are Hermes agents; a bundled skill lets one call Claude Code or Codex from the terminal. | AI4Kanban |
| Board and interface | A desktop app for cards, drafts, conversations and run status. | A CLI, a web dashboard and a Desktop app plugin. | Even |
| Checking the work | Claude Code or Codex run tests and check the requirements as they build; AI4Kanban adds no second review pass, to avoid over-testing. | A reviewer profile checks each acceptance criterion and runs tests, sending work back until it passes. | Even |
| Control from chat apps | Notifications, Slack and Lark need Cloud, which is in invite-only preview. | Manage the board with /kanban from Telegram, Discord, Slack, WhatsApp, Signal and more, with task notifications. | Hermes Kanban |
| Recovery from failed runs | Provider errors are retried automatically. A stopped run waits for you to resume it. | Heartbeats reclaim stalled tasks, and a task that keeps failing is put on hold. | Hermes Kanban |
| API and extensions | A CLI that coding agents call. No public API. | A REST and WebSocket API, plus plugin hooks for task events. | Hermes Kanban |

## 02 · Recommendation — Which should you choose?

**Choose AI4Kanban if you**

- Want built-in specialist agents and workflows, or to create your own.
- Want to approve key UI, prompt or copy drafts before full execution.
- Want agents to suggest follow-up work after each delivery.

**Choose Hermes Kanban if you**

- Already run Hermes Agent and want the board inside it.
- Want to manage tasks from Telegram, Slack, Discord or other chat apps.
- Want automatic recovery of stalled tasks and an API to build on.

### Bottom line

Choose AI4Kanban for **specialist workflows, draft approval before the build and
suggested follow-up work**; choose Hermes Kanban for **chat-app control,
automatic recovery and an API**.

Compared against the Hermes Agent v0.21.6 documentation, checked October 2026.

---

Install AI4Kanban · https://github.com/ai4kanban/ai4kanban
