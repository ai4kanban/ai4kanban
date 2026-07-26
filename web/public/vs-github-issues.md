# Kanban skill vs. GitHub Issues

> Not a replacement — a different tool for a different bottleneck. GitHub Issues
> is a shared, durable, public system of record. The kanban skill is a private,
> local, agent-native working surface. Pick by what's actually slowing you down.

- **Kanban skill** — Plain Markdown in your repo. The agent's fast local
  scratch-board.
- **GitHub Issues** — A database behind an API. The shared, public system of
  record.

## 01 · The short version — So why not just use GitHub Issues?

You can. Almost everything the kanban skill does, you could do with GitHub Issues
plus the `gh` CLI or a GitHub MCP server. The difference is what it costs to get
there.

The same task on GitHub Issues means **more noise**, **more turns**, **more
tokens**, **higher latency**, and **heavier prompting** to get the agent to reach
for it at all. The kanban skill trades GitHub's reach for local speed — and for a
solo builder driving an agent, speed is usually the thing in short supply.

## 02 · Head to head — Kanban skill vs. GitHub Issues

Fourteen dimensions. A check is a clear win; a dash is a deliberate trade-off
that just comes down to what you need. The kanban skill takes the speed and
locality rows; GitHub Issues takes the scale and collaboration ones.

| Dimension | Kanban skill | GitHub Issues | Edge |
| --- | --- | --- | --- |
| Storage | Plain Markdown in your repo, in git. | GitHub's database, behind an API. | Kanban skill |
| Works offline | Yes — it's just files on disk. | No — needs network and auth. | Kanban skill |
| How an agent reads it | Native fs tools: Read, Grep, Glob. | gh CLI or MCP round-trips. | Kanban skill |
| Token cost per lookup | Low — grep returns only the matching lines. | High — JSON payloads and tool schemas. | Kanban skill |
| Latency | Local disk, effectively instant. | A network round-trip per call. | Kanban skill |
| Setup | One prompt: a skill file and a small script. | Account, auth token, MCP config. | Kanban skill |
| Vendor lock-in | None — the board travels with the repo. | Lives on GitHub. | Kanban skill |
| Metadata | Minimal by design: priority + effort — all a solo builder needs. | Labels, milestones, assignees, projects — for coordinating a team. | Trade-off |
| Concurrency | None — id clashes if two people add #1894. | Server-assigned ids, safe for teams. | GitHub Issues |
| Decision history | Pruned to the decisions that steer the next task — why an idea was rejected, what shipped — so the agent proposes forward, never re-doing done or dead work. | Full comment history and edits kept, nothing dropped. | GitHub Issues |
| Closing out work | Archive the task once its items are checked off. | Auto-closes issues from linked PRs and CI. | Trade-off |
| Search at scale | grep — quick on a small board, unwieldy as it grows. | Indexed full-text search and saved filters. | GitHub Issues |
| External contributors | Possible, but only by committing to the Markdown — no lightweight filing. | Anyone can file, comment, and react without a commit. | GitHub Issues |
| Transparency | Every card stays visible in the repo — only the memory hub is pruned to essentials. | Public and linkable — the open-source default. | Trade-off |

## 03 · Trade-offs — Where each one wins

Neither is strictly better. The kanban skill optimizes for one agent moving fast;
GitHub Issues optimizes for many people staying in sync.

### Kanban skill

- **Token-light and instant** — No MCP, no network. The agent greps local
  Markdown instead of paging a remote API — fewer tokens, lower latency, no auth
  to refresh mid-task.
- **Agents actually use it** — Agents are reluctant to search GitHub Issues; they
  reach for filesystem tools by default. A Markdown board meets them where they
  already are — less prompting, fewer hallucinated task states.
- **Offline and yours** — Plain files in git. Works on a plane, works when GitHub
  is down. No SaaS dependency, no vendor lock-in — clone the repo and the whole
  board comes with you.
- **Memory tuned for proposing** — It records the decisions that steer the next
  task: why an idea was rejected, what got shipped, the gap to the goal. So the
  agent proposes forward — not re-doing done work or re-floating what you killed.

### GitHub Issues

- **Built for teams** — Server-assigned ids, safe concurrent edits, assignees.
  The kanban skill has no database — two people can both mint #1894 and conflict.
- **Transparency and reach** — Public and linkable, with external contributors
  filing, commenting, and reacting. The right home when openness matters more
  than raw speed.
- **Full context, forever** — The kanban skill deliberately compresses — an
  archived card shrinks to a line. On GitHub every comment, edit, and cross-link
  stays intact.
- **Deep integration** — Auto-closing from PRs, commit links, project boards,
  labels, milestones, and a whole ecosystem of third-party tools and indexed
  search at scale.

## 04 · The crux — Why agents prefer files

The real difference shows up when an agent does the work. Ask the same thing —
"find my high-priority open tasks" — and the two paths barely rhyme.

**you › agent + GitHub MCP** (many turns)

```
› find my high-priority open issues
⚙ list_issues(state:open, labels:high)
← 4.2 KB JSON — 18 issues, every field
⚙ paginate, filter, summarize…
← auth refresh · rate-limit headers · retries
∑ several tool calls · KBs of JSON · network each time
```

**you › agent + kanban skill** (one turn)

```
› find my high-priority open tasks
⚙ grep -rl "Priority: high" docs/kanban/todo
← three file paths
← done — one call, no network
∑ one tool call · a few paths · all local
```

It compounds. Every "what's next?", every archive, every board review pays the
round-trip tax on GitHub Issues — and models, left to choose, quietly avoid the
remote tool and reach for the files instead.

## 05 · The call — Which should you use?

**Reach for the kanban skill when**

- You work solo, or with a tight, trusted pair.
- You drive the work through an agent in the terminal.
- You care about moving forward more than a paper trail.
- You want the board in git — offline and portable.

**Reach for GitHub Issues when**

- You're building in the open and transparency matters.
- Multiple people manipulate the backlog at once.
- You lean on PR/CI links, project boards, and milestones.
- You need outside contributors to file and discuss.

### Bottom line

They aren't really competitors. GitHub Issues is the **shared system of record**;
the kanban skill is the **agent's fast local scratch-board**. If your bottleneck
is coordination across people, use GitHub Issues. If it's throughput with an
agent, use the kanban skill.

Plenty of solo builders run both — GitHub Issues as the public tracker, the
kanban skill as the private surface their agent drives every day.

---

Install the kanban skill · https://github.com/dist0com/ai4kanban
