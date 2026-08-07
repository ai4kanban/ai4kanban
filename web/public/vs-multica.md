# AI4Kanban vs. Multica

> Both products put coding agents on a kanban board. The real boundary is when
> the agent enters the story: AI4Kanban decides and develops the task before it
> is ready; Multica assigns and operates the task after it is ready.

- **AI4Kanban** — A planning loop in your repository. The agent proposes work,
  develops vague ideas, orders the board, and remembers earlier decisions.
- **Multica** — A project-operations system for human and agent teams. Assign an
  issue, then queue, dispatch, observe, retry, and review the run.

## 01 · The dividing line — Same board. Opposite sides of ready.

A kanban board is only the surface. The lifecycle makes the actual boundary
visible:

| Before ready — AI4Kanban | After ready — Multica |
| --- | --- |
| Discover work | Assign the issue |
| Refine the requirement | Run the agent |
| Prioritize by value and dependency | Review the result |

**Multica decides which agent runs a task. AI4Kanban decides which tasks should
exist.** That is the shortest useful answer to “aren't these the same idea?”

## 02 · The backlog test — What happens before Todo?

Multica's own task model makes the boundary concrete: an issue in **Backlog does
not trigger an agent**. It is a parking lot until a person decides the work is
real and moves it forward.

**AI4Kanban — Backlog is active**

1. Propose or capture an incomplete idea.
2. Read the code and module memory, resolve context, and expose the real
   decisions.
3. Produce a build-ready card ordered by value and dependency.

**Multica — Backlog is parked**

1. A person writes or accepts the issue, including the relevant files,
   constraints, outcome, and acceptance criteria.
2. A person moves the issue from Backlog to Todo.
3. The daemon queues and dispatches the assignee.

Multica does include quick-create, but it is a one-shot transcriber: it formats
free text into an issue and exits. It does not inspect the codebase, ask a
question, or record an assumption.

## 03 · Head to head — The shipped products, not the headlines

| Dimension | AI4Kanban | Multica | Edge |
| --- | --- | --- | --- |
| Where the product starts | Before the task: inspect the project, propose work, and decide what belongs on the board. | After the task exists: accept an issue, assignee, priority, and execution instructions. | AI4Kanban |
| Backlog behavior | The agent actively develops unready cards and can propose work nobody requested. | A parking lot. An issue in Backlog does not wake an assigned agent. | AI4Kanban |
| From vague idea to spec | A repeated refine loop reads code and memory, makes assumptions explicit, and asks only unresolved product questions. | Descriptions are free text; the human is told to provide files, constraints, outcomes, and acceptance criteria. | AI4Kanban |
| What compounds | Project decisions, redesign lessons, shipped work, and rejection reasons shape the next proposal. | Reusable Skills preserve working methods; issue activity and run history preserve execution provenance. | AI4Kanban |
| Run operations | Hands implementation to the chosen coding harness; no native retry, replay, token-cost, or fleet layer. | Queues, dispatches, streams, meters, retries, replays, gates review, and links pull requests and CI. | Multica |
| People and agent teams | Local-first and best for one developer or a small team collaborating through git. | Multiplayer workspaces, roles, squads, inboxes, comments, permissions, and notifications. | Multica |
| Storage and infrastructure | Markdown in the repository; no database, account, board server, or MCP dependency. | PostgreSQL + pgvector, a Go server, local daemon, OAuth, and hosted or self-hosted deployment. | Trade-off |
| License | Apache License 2.0, including commercial use, hosting, and embedding. | A source-available Multica License with restrictions on hosted services and commercial embedding. | AI4Kanban |

## 04 · Two kinds of memory — How to do it vs. why we decided it

Both systems accumulate knowledge, but on different axes.

**AI4Kanban — project judgment.** Compact repository files are read before the
agent proposes or refines work:

- `rejected.md` records an idea and why it was declined, so it stays out unless
  new evidence changes the decision.
- `redesign.md` records design mistakes and directions to avoid.
- `memory.md` records useful module findings for the next planning pass.

This memory answers: **“Why did the board stop proposing idea X?”**

**Multica — working method.** Skills are hand-authored or imported `SKILL.md`
bundles shared across agents. Issue comments and execution history show what
happened to a run, but completed work does not automatically become decision
memory.

This knowledge answers: **“How should this agent perform a security review?”**

The distinction is procedure vs. judgment. A playbook can improve execution; a
rejection record can stop the wrong work from being proposed again.

## 05 · Vision vs. shipped — The overlap is coming closer

Multica's `VISION.md` reaches upstream. It describes agents that structure
intent, gather context, make uncertainty explicit, and keep decisions connected
to outcomes. That is much closer to AI4Kanban's current thesis than Multica's
current product is.

| Shipped today | Declared direction |
| --- | --- |
| **Execute an issue.** Backlog waits. The daemon tells the assignee to read the issue and complete it. Refinement happens after code exists, through review and revision. | **Develop the intent.** Future agents are meant to turn intent into structured work and separate known facts from decisions still needed. |

This is a real competitive threat, not a reason to credit unshipped features.
The honest comparison is shipped vs. shipped, with the declared direction named
plainly.

## 06 · Trade-offs — Where each one is plainly ahead

### AI4Kanban

- **The agent helps decide the work** — It proposes from project context, turns
  rough asks into buildable cards, and orders them by value and dependency
  before execution begins.
- **Rejected ideas stay rejected** — Decision and redesign memory shape later
  planning, so the agent does not keep pitching a direction the project already
  ruled out.
- **The whole planning layer fits in git** — Cards and memory are readable,
  diffable files beside the code, with no board service to operate and plain
  Apache-2.0 terms.

### Multica

- **A serious execution control plane** — Run replay, retries, review gates, PR
  and CI linkage, token metering, webhooks, attachments, and multiple
  operational views are already shipped.
- **Built for multiplayer work** — Workspaces, roles, squads, threaded
  discussion, notifications, permissions, and persistent agent identities
  support a real human-and-agent organization.
- **Far broader runtime support** — Multica supports roughly twenty agent CLIs
  through local daemons and cloud runtimes. AI4Kanban wires up Claude Code and
  Codex today.

## 07 · The call — Which should you use?

**Choose AI4Kanban when**

- Your bottleneck is deciding and refining the right work, not dispatching it.
- You want an agent to propose tasks from code and project memory.
- You want rejection reasons and design decisions to shape future planning.
- You prefer a small, repository-native system with no board infrastructure.
- Plain Apache-2.0 terms matter for what you are building.

**Choose Multica when**

- The tasks already exist and your bottleneck is running them reliably.
- Multiple people and named agents need one shared operational workspace.
- You need retries, replay, cost metering, PR and CI linkage, or review gates.
- You want broad agent-runtime support, squads, chat, webhooks, and mobile
  access.
- You are comfortable operating or buying a server-backed platform.

### Bottom line

Choose AI4Kanban to **decide and develop the work before it is ready**. Choose
Multica to **assign and operate the work after it is ready**. If you need both,
the clean seam is simple: let AI4Kanban produce the approved card, then create
the Multica issue for execution.

The two can complement each other, but do not keep two live sources of truth for
the same task state. Pick a clear handoff point.

---

Install AI4Kanban · https://github.com/ai4kanban/ai4kanban

Research checked 2026-08-07 against Multica's repository, product site, docs,
changelog, `VISION.md`, shipped prompts, and migration history.
