# AI4Kanban — the AI project manager for coding agents

> Ship without babysitting coding agents. AI4Kanban turns rough ideas into
> build-ready work, runs it through your agents, and asks only for product
> decisions.

- Download: https://ai4kanban.dev/download
- View on GitHub: https://github.com/ai4kanban/ai4kanban

## Coding got fast. Product decisions became the bottleneck.

Agents build clear requirements reliably. Vague ones turn into drift, rework, and a
queue of long agent conversations nobody has time to read. AI4Kanban sits above your
coding agents: it settles what to build before anything runs, and brings back only
what a person has to decide.

## From a rough idea to a landed change

- **Start with a rough idea** — Describe the outcome in a sentence. AI4Kanban reads
  your codebase, breaks the goal into bounded tasks, and orders them by dependency so
  independent work can run in parallel.
- **Approve only what needs you** — Routine details are answered from the code and
  from project memory. Taste, business direction, risk, and cost come back as a short
  question with a recommended answer. Every answer becomes project memory, so the next
  plan asks less of you.
- **Let the agents run** — Ready tasks run in the background, each in its own Git
  worktree, and conflicts get a resolution pass before anything lands. You hear about
  it when a delivery is waiting for approval.

## Learns your project, stays in your repository

Product decisions, rejected directions, and design lessons outlive the conversation
that produced them, so autonomy grows and review shrinks as the project goes on.

- **Apache-2.0** — Open source. Free to use, modify, and redistribute.
- **Local-first** — The board and its memory are Markdown under `docs/kanban/`,
  versioned in Git.
- **Your coding agent** — Claude Code, Codex, Cursor, OpenCode, Kimi Code,
  DeepSeek Harness, and ZCode.

## Start with the desktop app

Download the app, open a project, and answer three questions. It reads the codebase,
writes the project goal and module memory, and proposes the first tasks.

Builds are unsigned, so macOS blocks the first open: drag the app in from the `.dmg`,
then click through the warning. The download page has the full steps for macOS,
Windows, and Linux.

The app includes the `akb` CLI and adds the coding-agent skills when you open a
project. Neither is meant to be installed on its own.

Download the app: https://ai4kanban.dev/download

---

AI4Kanban · https://github.com/ai4kanban/ai4kanban
