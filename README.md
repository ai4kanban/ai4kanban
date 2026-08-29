<div align="center">

# AI4Kanban

### A project board that plans autonomously and learns from every decision.

**English** · [简体中文](README-zh.md)

[Download](https://ai4kanban.dev/download) · [Website](https://ai4kanban.dev) · [Guide](docs/guides/daily-loop.md)

<img src="https://cdn.ai4kanban.dev/og-image-v5.jpg" alt="AI4Kanban — a project board that plans autonomously" width="720">

</div>

Coding agents can now implement clear requirements reliably. The bottleneck is moving
upstream to project management: deciding what to build next, turning rough ideas into
workable requirements, and coordinating priorities and dependencies across a growing
product.

AI4Kanban is a project-management agent built around a Kanban board. It combines project
goals, code, and long-term memory to propose work, clarify requirements, plan execution,
and move tasks through their complete lifecycle.

The board preserves context that code alone does not: product decisions, rejected
directions, delivered features, and design lessons. That context carries into each new
planning cycle, so the system becomes more useful as the project evolves.

## What it does

- **Plans work proactively.** The agent uses project goals, code, and memory to determine
  what should happen next and propose concrete tasks.
- **Clarifies requirements in a loop.** It questions rough ideas, answers what it can from
  project context, and continues until the work is ready to begin.
- **Coordinates the task lifecycle.** It breaks down work, manages dependencies and
  priorities, plans releases, and sends ready tasks to coding agents.
- **Carries a card all the way to landed.** One Implement click builds the work in a git
  worktree of its own, reviews it against what the card asked for, corrects what review
  found, and lands it as one commit on your branch.
- **Reaches you when you are away from the machine.** Reviews that are ready and questions
  only you can answer collect in the app's notification center and arrive in Slack, where
  the card is approved and the questions answered from the message itself.
- **Keeps product judgment with people.** Product direction, taste, and consequential
  tradeoffs remain human decisions; routine details are handled from project context.
- **Builds long-term project memory.** Decisions, completed work, rejected ideas, and
  design lessons inform future planning instead of disappearing with a chat session.
- **Stays local and agent-agnostic.** The board is Markdown under `docs/kanban/` and works
  with Claude Code, Codex, Cursor, OpenCode, DeepSeek Harness, and ZCode.

## Get started

1. **[Download and install the desktop app](https://ai4kanban.dev/download).** No prior
   Node.js, npm, or terminal setup is needed. The app includes the `akb` CLI and adds the
   coding-agent skills automatically when a project is opened.
2. **Open a project folder.** Confirm the project summary and tracks, set the project goal,
   and choose the coding agent that will run the board.
3. **Select Finish setup.** AI4Kanban reads the repository, creates project memory, maps
   the modules, and proposes the first tasks.

Current builds are unsigned, so the operating system may show a warning on first launch.
The [download page](https://ai4kanban.dev/download) provides the exact steps for macOS,
Windows, and Linux. Starting agent runs also requires one of the supported coding agents to
be installed and authenticated on the machine.

After setup, work from the desktop app or ask the coding agent directly:

```text
what's next?
propose new tasks
refine #4
review the board
implement #4
```

The desktop app, coding agent, and bundled `akb` CLI all operate on the same board. For
terminal use, run `akb` after installing the app; do not install the npm package separately.

The app reads in English and Simplified Chinese and opens in the language the machine is set
to. The board is written in the language you pick — cards, open questions, and the lines to
check included.

## Learn more

- [Daily workflow](docs/guides/daily-loop.md)
- [Writing a useful project goal](docs/guides/what-makes-a-good-goal.md)
- [What each coding agent can and can't do](docs/guides/connectors.md)
- Run `akb help` for the bundled CLI reference.
- Explore this repository's own board in [`docs/kanban/`](docs/kanban/).

## License

[Apache License 2.0](LICENSE). Free to use, modify, and redistribute.

The public site in [`web/`](web/) is the exception: it is source-available for
reading only, under its own [license](web/LICENSE).
