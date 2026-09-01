<div align="center">

# AI4Kanban

### A project board that plans autonomously and learns from every decision.

**English** · [简体中文](README-zh.md)

[Download](https://ai4kanban.dev/download) · [Website](https://ai4kanban.dev) · [Guide](https://ai4kanban.dev/docs/daily-loop)

<img src="https://cdn.ai4kanban.dev/og-image-v6.jpg" alt="AI4Kanban — a project board that plans autonomously" width="720">

</div>

Coding agents can now turn well-defined requirements into working code reliably. The
bottleneck is shifting from coding to planning and decision-making: deciding what to build
next, turning rough ideas into actionable requirements, and coordinating priorities and
dependencies as a product grows.

AI4Kanban is a project-management agent with a Kanban interface. It combines project goals,
the codebase, and long-term memory to propose work, clarify requirements, plan execution,
and move tasks from idea to delivery.

The board records context that code alone cannot fully preserve: product decisions,
rejected directions, delivered features, and design lessons. Each planning cycle draws on
this history, keeping future decisions grounded in the project.

## What it does

- **Plans the next steps proactively.** The agent uses project goals, the codebase, and
  long-term memory to determine what should happen next and propose concrete tasks.
- **Turns rough ideas into ready-to-build tasks.** The agent identifies missing details,
  handles routine decisions from project context, and asks only the questions that require
  your judgment. It continues until the work is ready to begin.
- **Coordinates the task lifecycle.** It breaks down work, manages dependencies and
  priorities, plans releases, and sends ready tasks to coding agents.
- **Delivers each card to your branch.** One Implement click builds the work in an isolated
  git worktree, checks it against the card, fixes issues found during review, and lands it
  as a single commit on your branch.
- **Notifies you when your input is needed.** Reviews awaiting approval and questions only
  you can answer appear in the app's notification center and in Slack. Approve the task or
  answer the question directly from the message.
- **Keeps product judgment with people.** Product direction, design preferences, and major
  tradeoffs remain human decisions; routine details are handled from project context.
- **Builds long-term project memory.** Decisions, completed work, rejected ideas, and
  design lessons inform future planning instead of disappearing with a chat session.
- **Keeps the board local and your choice of agent open.** The board is stored as Markdown
  files under `docs/kanban/`. AI4Kanban supports Claude Code, Codex, Cursor, OpenCode,
  DeepSeek Harness, and ZCode.

## See it work

<img src="https://cdn.ai4kanban.dev/loop-task-graph-v1.jpg" alt="A group card with its subtask map: five cards wired by dependency arrows" width="820">

**Define tasks and dependencies** — the agent uses the goal, code, and module memory to
decide what comes next, then splits large goals into bounded cards whose explicit
dependencies decide what runs in parallel and what waits.

<img src="https://cdn.ai4kanban.dev/loop-clarify-v1.jpg" alt="A card's open questions, each with recommended and alternative answers" width="820">

**Clarify requirements** — anything answerable from the code and project memory is resolved
silently. Only the product tradeoffs that need your judgment reach you, each with a
recommended answer.

<img src="https://cdn.ai4kanban.dev/loop-execute-v1.jpg" alt="The runs panel: implement, review, and resolve sessions with their run log" width="820">

**Execute** — ready cards go to your coding agent. Ten or more tasks can share one board;
each delivery builds in its own git worktree, and conflicts trigger a dedicated resolution
pass before landing.

<img src="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg" alt="A ui-design agent's report with two working mockups attached to the card" width="820">

**Settle key decisions before implementation** — Spec Agents inspect the code and research
external dependencies first. For UI work they attach several working mockups to the card,
so you pick the direction before any code is written.

<img src="https://cdn.ai4kanban.dev/loop-approval-v1.jpg" alt="A Slack notification asking to approve a card, with Implement and Open card buttons" width="820">

**Request approval only when necessary** — work continues in the background. A notification
arrives only when a product decision or acceptance review needs you, and answering it
resumes the task on its project machine.

## Get started

1. **[Download and install the desktop app](https://ai4kanban.dev/download).** No prior
   Node.js, npm, or terminal setup is needed. The app includes the `akb` CLI and adds the
   coding-agent skills automatically when a project is opened.
2. **Open a project folder.** Choose the coding agent that will run the board, then let it
   read the repository and tell you what it thinks the project is — confirm or correct it in
   a sentence. The project goal is the one thing it asks for in your own words.
3. **Select Finish setup.** AI4Kanban reads the repository, creates project memory, maps the
   modules, and proposes the first tasks.

Current builds are unsigned, so the operating system may show a warning on first launch.
The [download page](https://ai4kanban.dev/download) provides the exact steps for macOS,
Windows, and Linux. Before starting a task, install one of the supported coding agents and
complete its sign-in or API key setup.

After setup, work from the desktop app or ask the coding agent directly:

```text
what's next?
propose new tasks
refine #4
review the board
implement #4
```

The desktop app, coding agent, and bundled `akb` CLI all operate on the same board. To use
the terminal, install the desktop app and run `akb`; there is no separate npm package to
install.

The app supports English and Simplified Chinese and follows your system language by default.
The board also uses the language you choose, including cards, open questions, and acceptance
criteria.

## Learn more

- [Daily workflow](https://ai4kanban.dev/docs/daily-loop)
- [Writing a useful project goal](https://ai4kanban.dev/docs/what-makes-a-good-goal)
- [What each coding agent can and can't do](https://ai4kanban.dev/docs/connectors)
- Run `akb help` for the bundled CLI reference.
- Explore this repository's own board in [`docs/kanban/`](docs/kanban/).

## License

[Apache License 2.0](LICENSE). Free to use, modify, and redistribute.

The public site in [`web/`](web/) is the exception: it is source-available for
reading only, under its own [license](web/LICENSE).
