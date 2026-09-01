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
  answers most questions from the code and project memory, and leaves only taste, business
  direction, risk, and cost for human judgment.
- **Coordinates the task lifecycle.** It breaks large goals into bounded cards and decides
  which tasks can run in parallel and which must wait.
- **Supports custom Spec Agents.** Built-in agents compare technology choices and provide
  multiple working UI mockups, so key decisions are settled before implementation.
- **Delivers each card to your branch.** Ready tasks run in parallel across isolated git
  worktrees. Conflicts trigger a dedicated resolution pass before focused commits land on
  your branch.
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

One planning loop, from a rough goal to a landed commit. Click any shot for the full-size
version.

<table>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-task-graph-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-task-graph-v1.jpg" alt="A group card with its subtask map: five cards wired by dependency arrows" /></a><br/>
<sub><b>Define tasks and dependencies</b> — the agent breaks large goals into bounded cards, automatically deciding what can run in parallel and what must wait, so each task can be completed within its own context window.</sub>
</td>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-clarify-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-clarify-v1.jpg" alt="A card's open questions, each with recommended and alternative answers" /></a><br/>
<sub><b>Clarify requirements</b> — the agent turns rough requirements into an actionable plan. It answers most questions from project memory and the codebase, leaving only taste, business direction, risk, and cost for human judgment.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-execute-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-execute-v1.jpg" alt="The runs panel: implement, review, and resolve sessions with their run log" /></a><br/>
<sub><b>Execute</b> — run ready tasks in parallel across multiple agents. Each delivery uses its own git worktree to isolate changes, and conflicts trigger a dedicated resolution pass before landing.</sub>
</td>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg" alt="A ui-design agent's report with two working mockups attached to the card" /></a><br/>
<sub><b>Settle key decisions first</b> — create your own Spec Agents or use the built-ins: a technology-selection agent compares technical options, while a UI-design agent gives you multiple working mockups to choose from.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-approval-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-approval-v1.jpg" alt="A Slack notification asking to approve a card, with Implement and Open card buttons" /></a><br/>
<sub><b>Request approval only when necessary</b> — AI4Kanban keeps work moving in the background and reports back only for product decisions and delivery approval. Like a project manager, it keeps demands on your attention to a minimum.</sub>
</td>
<td width="50%" valign="top"></td>
</tr>
</table>

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
