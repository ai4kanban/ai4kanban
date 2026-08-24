# AI4Kanban vs. Vibe Kanban

> Vibe Kanban runs and reviews multiple coding agents in parallel. AI4Kanban
> helps one agent turn ideas into well-defined work, using plain Markdown in
> your repository. The products overlap at the board, but they are designed for
> different stages of the development process.

- **AI4Kanban** — A file-based workflow for planning and refining work with an
  agent.
- **Vibe Kanban** — A local application for running and reviewing multiple
  agents.

## 01 · The short version — Bloop closed. Vibe Kanban continues.

Bloop, the company behind Vibe Kanban, closed in April 2026. Paid subscriptions
ended, remote services were retired, and the product moved to a fully local
model. Vibe Kanban remains available under the Apache-2.0 license and is now
maintained by its community.

Choose AI4Kanban if you want the **planning board** without a database or
long-running application. Choose Vibe Kanban if you need to **run several agents
in parallel** and review their output in one interface. AI4Kanban is not a
replacement for Vibe Kanban's orchestration features.

## 02 · Head to head — AI4Kanban vs. Vibe Kanban

A check marks the stronger option for a specific requirement. A dash indicates
a design choice rather than a clear advantage. AI4Kanban favors planning and
portability; Vibe Kanban favors parallel execution and integrated review.

| Dimension | AI4Kanban | Vibe Kanban | Edge |
| --- | --- | --- | --- |
| Primary purpose | Define, refine, and organize work with an agent inside the repository. | Run multiple coding agents in parallel and review their output. | Trade-off |
| Multi-agent orchestration | Each delivery builds on a branch in a git worktree of its own, so several run side by side without touching your working copy. | A core capability, with each agent isolated in its own git worktree. | Vibe Kanban |
| Review of agent output | Handled by your agent, development environment, or code-review tools. | Built in, with inline diffs, live previews, and pull-request workflows. | Vibe Kanban |
| Planning and refinement | A guided refinement loop turns an initial idea into an actionable task. | Focused on queuing and tracking execution rather than refining requirements. | AI4Kanban |
| Data storage | Plain Markdown stored and versioned with your repository. | A local SQLite database in a config directory. | AI4Kanban |
| Runtime | No service or application. The board consists of files. | A local web application with a Rust backend and web interface. | AI4Kanban |
| Setup | Install a skill file and a small helper script with one prompt. | Run `npx vibe-kanban`, then install and authenticate each agent CLI. | AI4Kanban |
| Agent compatibility | Works with any agent that can read and write files in the repository. | Supports integrated CLIs such as Claude Code, Codex, Gemini, and others. | Trade-off |
| Portability | The Markdown board travels with the repository and needs no export. | Self-hosted under Apache-2.0, with data export available. | AI4Kanban |
| Maintenance | Actively maintained. | Community-maintained since Bloop closed in April 2026. | AI4Kanban |

## 03 · The real difference — Plan the work or run the agents

The products support different stages of the workflow. AI4Kanban helps you
decide **what to build** and prepare the task. Vibe Kanban helps you **execute
that work across multiple agents** and review the results.

**AI4Kanban — plan and refine.** Your agent reads and updates a Markdown board
in the repository. A refinement loop develops an initial idea into a specific,
reviewable task that you approve before implementation begins. It does not
provide a diff viewer or pull-request workflow. Those responsibilities remain
with your agent or development environment.

**Vibe Kanban — execute and review.** A local application runs several coding
agents concurrently in separate git worktrees. Its interface brings task
execution, diff review, and live preview into one workspace. It is designed to
manage agent runs, not to develop an incomplete idea into a detailed
implementation plan.

If you primarily used Vibe Kanban to organize tasks, AI4Kanban offers a simpler,
repository-native alternative. If parallel execution and integrated review
matter most, Vibe Kanban remains the closer fit.

## 04 · Trade-offs — Where each one wins

Neither product is universally better. AI4Kanban prioritizes a lightweight,
portable planning workflow. Vibe Kanban prioritizes coordinated execution and
review across multiple agents.

### AI4Kanban

- **No service to maintain** — The board is plain Markdown in your repository.
  There is no web application, database, or background service to operate.
- **Structured task refinement** — The refinement loop identifies missing
  details and turns a rough idea into a concrete task for approval before
  implementation begins.
- **Portable by design** — Plans are stored in git alongside the code they
  describe. Clone the repository and the board comes with it, without a
  migration or export step.
- **Works with any file-capable agent** — Any agent that can work with
  repository files can use the board, including Claude Code, Codex, Cursor, and
  future tools.

### Vibe Kanban

- **Runs many agents at once** — Vibe Kanban distributes tasks across several
  coding agents, isolating each run in its own git branch and worktree.
- **Execution and review in one place** — Inline diff review, live application
  previews, and pull-request workflows let you inspect agent output without
  leaving the workspace.
- **Purpose-built visual interface** — The web interface is designed for
  starting tasks, monitoring progress, and moving between workspaces while
  agents are running.
- **Broad agent integrations** — Multiple agent CLIs are supported out of the
  box, including Claude Code, Codex, Gemini, and others.

## 05 · The call — Which should you use?

**Choose AI4Kanban when**

- You want an agent to plan and refine work directly in the repository.
- You prefer Markdown in git to a separate application and database.
- You want the board to work with any file-capable coding agent.
- Clear requirements matter more to you than parallel execution.

**Choose Vibe Kanban when**

- You want to run several coding agents concurrently in isolated worktrees.
- You need inline diff review and live preview in one interface.
- Coordinating and reviewing agent runs is your primary bottleneck.
- You are comfortable using a community-maintained open-source project.

### Bottom line

Choose AI4Kanban for a **repository-native planning workflow** with no separate
runtime. Choose Vibe Kanban for **multi-agent execution and integrated review**.
The right choice depends on whether planning the work or coordinating its
execution is the larger constraint.

Bloop's closure changed how Vibe Kanban is maintained, but not the fundamental
distinction between the two products.

---

Install AI4Kanban · https://github.com/ai4kanban/ai4kanban
