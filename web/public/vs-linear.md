# AI4Kanban vs. Linear

> Linear is a polished project-management workspace where people and agents coordinate.
> AI4Kanban is a repo-local planning board that an agent refines from rough idea to
> build-ready task. This is not a cheaper Linear clone; it is a different planning model.

- **AI4Kanban** — Plain Markdown in your repo. The agent owns the planning loop.
- **Linear** — A hosted team workspace. People and agents plan, build, and review together.

## 01 · The short version — Linear has agents. The difference is where planning lives.

Linear is not just an issue tracker with an AI add-on. Linear Agent can work across
workspace context, its agent platform lets teams delegate issues to coding agents, its
MCP server connects external agents, and Coding Sessions can run Claude Code or Codex and
return a pull request for review.

The reason to choose AI4Kanban is narrower: you want the **agent to own the planning
loop inside the repo**. A rough request becomes questions, decisions, dependencies, and a
build-ready card. The board and its memory stay as reviewable Markdown beside the code.

## 02 · Head to head — AI4Kanban vs. Linear

A check marks the clearer fit for that row; a dash means the choice depends on how you
work. Linear wins at team coordination, portfolio planning, integrations, and built-in
agent execution. AI4Kanban wins at repo-local refinement, portability, and keeping the
planning memory in git.

| Dimension | AI4Kanban | Linear | Edge |
| --- | --- | --- | --- |
| Best fit | Solo developers and small teams whose coding agent drives the work. | Product and engineering teams coordinating people, projects, and agents. | Trade-off |
| Source of truth | Markdown in the project repo, versioned with the code. | A shared Linear workspace reached through its apps, API, or MCP. | AI4Kanban |
| From rough idea to ready task | A repeated refine-and-resolve loop answers what it can, records the rest, and stops only when the card is concrete. | Linear Agent can draft, summarize, update, and help scope work; issue quality still drives coding-session results. | AI4Kanban |
| Agent model | Your existing harness reads and writes the board; Claude Code, Codex, Cursor, OpenCode, and DeepSeek Harness are wired up today. | Linear Agent plus installable app users, delegated issues, agent guidance, and a hosted MCP server. | Trade-off |
| Coding and review | The chosen harness implements the ready card; review stays in that harness and git workflow. | Coding Sessions run Claude Code or Codex in the cloud, open a PR, and put diffs and review in Linear. | Linear |
| Human collaboration | Small-team git collaboration; concurrent board editing is not its strength. | Real-time workspace with members, assignees, comments, private teams, guests, and permissions. | Linear |
| Planning breadth | Cards, dependencies, priority, ROI, releases, and module memory. | Issues, projects, cycles, initiatives, milestones, timelines, triage, insights, and customer requests. | Linear |
| Setup | Install into a repo with one prompt; the board itself needs no account, database, or remote service. | Create a workspace; connect integrations and agent access as the team needs them. | AI4Kanban |
| Portability | Clone the repo and the board, decisions, and history come with it; it works offline. | Data lives in Linear; admins can export workspace issue data as CSV and use the API. | AI4Kanban |
| Price | Apache-2.0 and free; you pay only for the coding-agent tools you choose. | Free: 250 issues and 2 teams. Basic: $10/user/month billed yearly. Business: $16/user/month billed yearly. Coding Sessions also use AI credits. | Trade-off |

## 03 · The real difference — Repo memory vs. team workspace

**AI4Kanban — the repo plans with you.** The board is part of the project. The agent
reads the code, past decisions, rejected ideas, and shipped work before it changes the
plan. It keeps refining until the open questions are answered or clearly handed to you.
The useful planning memory is committed with the code and follows every clone.

**Linear — the workspace coordinates everyone.** Issues belong to teams; projects can
span teams; cycles, milestones, initiatives, timelines, documents, comments, and customer
requests create shared context. Linear Agent and coding agents work inside that permissioned
workspace. It is substantially better when many people must see and steer the same work.

These can coexist, but running both means choosing which one owns task state. For a solo
developer, two sources of truth are usually more process than value.

## 04 · Trade-offs — Where each one wins

### AI4Kanban

- **Turns rough asks into ready work** — The agent questions, researches, splits, and
  resolves a card in a loop instead of treating the first issue description as the spec.
- **Planning memory lives beside the code** — Decisions, rejected ideas, dependencies,
  and cards are plain, diffable files the next agent run reads by default.
- **Bring your own harness** — The board is not tied to Linear Agent or one coding-agent
  integration. Claude Code, Codex, Cursor, OpenCode, and DeepSeek Harness work today; the file format is open
  to any harness.
- **No board SaaS to administer** — No workspace, seats, auth, database, or sync layer for
  the planning surface itself.

### Linear

- **A real system for a human team** — Concurrent editing, ownership, permissions,
  comments, private teams, guests, notifications, and a polished interface.
- **Agents and execution are built in** — Linear Agent, app users, MCP, delegated issues,
  Coding Sessions, diffs, and pull-request review share the same workspace context.
- **Deep product planning** — Projects, cycles, initiatives, milestones, timelines,
  triage, insights, and customer requests go far beyond a small repo board.
- **Integrations and searchable context** — GitHub, GitLab, Slack, Teams, support tools,
  APIs, webhooks, and workspace search connect the rest of a company's work.

## 05 · The call — Which should you use?

**Reach for AI4Kanban when**

- A solo developer or small team drives work through a coding agent.
- Your input starts vague and the planning loop is the bottleneck.
- You want tasks and durable decisions in git beside the code.
- You want to choose the harness instead of adopting a board's agent runtime.

**Stay with Linear when**

- Multiple people need to create, assign, discuss, and update work at the same time.
- You rely on cycles, initiatives, timelines, triage, customer requests, or reporting.
- You want delegated cloud coding sessions and diff review inside the project tool.
- You need company-wide integrations, permissions, security controls, and support.

### Bottom line

Linear is the stronger **team system**. AI4Kanban is the sharper **repo-local planning
loop**. If coordination across people is the bottleneck, stay with Linear. If a coding
agent keeps receiving fuzzy work and losing the decisions behind it, put the board in the
repo and let the agent refine it there.

---

Install AI4Kanban · https://github.com/ai4kanban/ai4kanban

Research checked 2026-08-01: Linear pricing, Linear Agent, AI Agents, Coding Sessions,
MCP server, Teams, Projects, Cycles, Timeline, and data export in the official Linear docs.
