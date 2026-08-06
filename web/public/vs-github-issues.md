# AI4Kanban vs. GitHub Issues

> AI4Kanban is not designed to replace GitHub Issues. The two tools address
> different bottlenecks. GitHub Issues is a shared, durable system of record that
> supports public collaboration; AI4Kanban is a private, local workspace that an
> agent can operate directly. The right choice depends on what is slowing you
> down.

- **AI4Kanban** — Plain Markdown stored in your repository, giving agents a fast
  local board they can read and update directly.
- **GitHub Issues** — A hosted database accessed through an API, designed to
  serve as a shared system of record for a team or community.

## 01 · The short version — Why not just use GitHub Issues?

You can. Nearly everything AI4Kanban does can also be accomplished with GitHub
Issues and the `gh` CLI or a GitHub MCP server. The meaningful difference is the
operational cost.

For an agent, completing the same task through GitHub Issues usually involves
**more data**, **more tool calls**, **greater token usage**, and **additional
network latency**. It may also require **more explicit prompting** before the
agent reaches for a remote tool. AI4Kanban does not offer GitHub's breadth of
collaboration and integrations; instead, it prioritizes direct, fast local
access. For a solo developer who works primarily with an agent, that speed can be
the more valuable resource.

## 02 · Head to head — AI4Kanban vs. GitHub Issues

The table below compares the two tools across fourteen dimensions. A check marks
a clear win; a dash marks a trade-off that comes down to what you need. AI4Kanban
is strongest in speed and local access, while GitHub Issues is better suited to
scale and multi-person collaboration.

| Dimension | AI4Kanban | GitHub Issues | Edge |
| --- | --- | --- | --- |
| Storage | Plain Markdown files in your repository, versioned with Git. | Hosted by GitHub and accessed through its interfaces and API. | AI4Kanban |
| Offline access | Fully available because the board is stored on disk. | Issue data requires a network connection and authentication. | AI4Kanban |
| How an agent reads it | Directly through filesystem tools such as Read, Grep, and Glob. | Through the gh CLI or remote MCP calls. | AI4Kanban |
| Token usage per lookup | Typically low because grep can return only the matching content. | Typically higher because the agent must process tool definitions and JSON responses. | AI4Kanban |
| Latency | Local disk access is effectively immediate. | Each request must wait for a network response. | AI4Kanban |
| Setup | Installed through a prompt; the core consists of a skill file and a small script. | Requires a GitHub account, authentication, and CLI or MCP configuration. | AI4Kanban |
| Platform dependency | No hosted platform dependency; the board is plain text and travels with the repository. | Data remains in GitHub unless it is exported or migrated. | AI4Kanban |
| Metadata | Intentionally focused on essentials such as priority and effort. | Rich fields for labels, milestones, assignees, and projects. | Trade-off |
| Concurrent use | No concurrency control; two people can create the same task number, such as #1894. | Server-assigned IDs safely support concurrent use. | GitHub Issues |
| Decision history | Retains the decisions that affect future work, such as why an idea was rejected and what has shipped. | Preserves the complete history of comments, edits, and activity. | GitHub Issues |
| Completing work | A card is archived after all of its task items are complete. | Issues can close automatically through linked pull requests and workflows. | Trade-off |
| Search at scale | grep is fast on a small board but becomes less convenient as the board grows. | Indexed full-text search and saved filters are designed for larger datasets. | GitHub Issues |
| External contributors | Contributors can participate by committing Markdown, but there is no lightweight filing interface. | On public repositories, contributors can open issues, comment, and react without submitting code. | GitHub Issues |
| Transparency | Every card remains visible in the repository; only the memory hub is reduced to essential information. | Issues are easy to share and can support the public workflow expected by open-source communities. | Trade-off |

## 03 · Trade-offs — Where each tool is stronger

Neither tool is universally better. AI4Kanban is optimized for a developer and an
agent moving work forward quickly. GitHub Issues is optimized for keeping many
people and systems in sync.

### AI4Kanban

- **Efficient local access** — No MCP calls and no network dependency. The agent
  searches local Markdown instead of paging through a remote API, which reduces
  token usage and latency and avoids authentication interruptions during a task.
- **Fits how agents already work** — Agents tend to use filesystem tools before
  searching a remote issue tracker. A Markdown board is available in the
  environment they already understand, so it requires less prompting and leaves
  less room for the agent to infer task state incorrectly.
- **Portable and available offline** — The board is a set of plain files in Git.
  It continues to work without a network connection or when GitHub is
  unavailable. There is no SaaS dependency or platform lock-in; cloning the
  repository brings the entire board with it.
- **Memory designed for the next decision** — AI4Kanban keeps the information
  that should guide future work: why an idea was rejected, what has shipped, and
  what remains between the current state and the goal. This helps the agent make
  useful forward-looking proposals instead of repeating completed or discarded
  work.

### GitHub Issues

- **Designed for team coordination** — Server-assigned IDs, safe concurrent
  updates, and assignees make GitHub Issues suitable for multi-person workflows.
  AI4Kanban has no coordinating database, so two people can independently create
  task #1894 and produce a conflict.
- **Accessible to a wider community** — Issues can be public and shared by URL,
  while external contributors can file reports, comment, and react. GitHub Issues
  is the better home when open participation matters more than local speed.
- **Complete activity history** — AI4Kanban deliberately compresses old
  information, reducing an archived card to a one-line summary. GitHub Issues
  retains comments, edits, and cross-references as part of the issue record.
- **Mature integrations** — GitHub Issues works with pull-request closing rules,
  commit links, projects, labels, milestones, indexed search, and a broad
  ecosystem of third-party tools.

## 04 · The key difference — Why agents work well with files

The practical difference becomes clear when an agent performs the work. Ask it to
"find my high-priority open tasks" and the two tools require substantially
different paths.

**you › agent + GitHub MCP** (multiple calls)

```
› find my high-priority open issues
⚙ list_issues(state:open, labels:high)
← 4.2 KB JSON — 18 issues with every field
⚙ paginate, filter, summarize…
← refresh authentication · process rate-limit headers · retry
∑ several tool calls · kilobytes of JSON · network access each time
```

**you › agent + AI4Kanban** (one call)

```
› find my high-priority open tasks
⚙ grep -rl "Priority: high" docs/kanban/todo
← three file paths
← done — one call, no network
∑ one tool call · a few paths · entirely local
```

Those extra operations accumulate. Asking what to do next, archiving a task, and
reviewing the board all require another remote interaction when the source is
GitHub Issues. When both options are available, models also tend to choose
familiar, low-friction filesystem tools unless they are explicitly directed to
use the remote tracker.

## 05 · Choosing between them — Which tool should you use?

**Use AI4Kanban when**

- You work alone or with one or two trusted collaborators.
- You primarily drive work through an agent in the terminal.
- You value forward progress and concise decision memory more than a complete
  activity log.
- You want the board to remain in Git, available offline and easy to move.

**Use GitHub Issues when**

- You are building in public and process transparency matters.
- Several people need to update the backlog concurrently.
- Your workflow depends on pull-request and CI integrations, projects, or
  milestones.
- You want external contributors to file issues and participate in discussions.

### Bottom line

AI4Kanban and GitHub Issues are not direct substitutes. GitHub Issues provides a
**shared system of record**; AI4Kanban provides a **fast local board that an
agent can operate directly**. If coordination between people is the bottleneck,
use GitHub Issues. If the bottleneck is how efficiently you and an agent can move
work forward, use AI4Kanban.

Many solo developers use both: GitHub Issues as the public issue tracker and
AI4Kanban as the private workspace their agent uses each day.

---

Install AI4Kanban · https://github.com/ai4kanban/ai4kanban
