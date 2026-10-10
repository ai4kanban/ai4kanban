# AI4Kanban vs. Orca

> Already running several coding agents in parallel? Orca brings those sessions
> into one workspace. AI4Kanban goes further: agents lead the execution details
> while you set the direction and make the key decisions.

**What both support**

- Multiple coding agents
- Parallel sessions
- Isolated Git worktrees
- Code diff review

## 01 · Orca: a thin layer around coding agents

Orca adds a thin layer around coding agents, bringing parallel sessions,
terminals, worktrees, editing and review into one workspace while preserving the
experience of using those agents. [Explore Orca](https://onorca.dev/).

It suits users who want to direct individual agent sessions and stay involved in
execution details, from assigning tasks to reviewing and merging changes. How
much autonomy each agent has is still up to you.

Its CLI orchestration provides tasks, dispatch and approval gates. You or your
coordinating agent write the task specifications and define the process.

### Already in the Codex desktop app

Some of what Orca adds is already in coding tools such as the Codex desktop app.
Codex runs OpenAI's models; Orca runs Codex, Claude Code and other CLI coding
agents.

- Parallel sessions and worktrees
- Diff and PR review
- Browser
- Mobile control and SSH

Sources: [Codex worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)
· [Code review](https://learn.chatgpt.com/docs/code-review)
· [Browser](https://learn.chatgpt.com/docs/browser)
· [Remote connections](https://learn.chatgpt.com/docs/remote-connections)
· [Orca features](https://github.com/stablyai/orca)

## 02 · AI4Kanban: you set the direction, agents handle the details

AI4Kanban is for people who are comfortable letting agents lead execution
details while retaining control of direction and key decisions. Specialist
agents, workflows and memory are ready to use, so you don't have to design agent
roles or tune their prompts yourself. You discuss the plan and review key
drafts; agents work out the details and carry the work through.

| | AI4Kanban | Orca |
| --- | --- | --- |
| Agents plan each task with you and ask only for key decisions | Included | Not included |
| Ready-made specialist agents and workflows | Included | Not included |
| Draft review before execution: images, HTML/TSX, storyboards | Included | Not included |
| Memory of your preferences, shared across agents | Included | Not included |
| Built-in browser, SSH and mobile control | Not included | Included |

### Review key drafts before execution

Worried about AI taking too many liberties with a UI, prompt or piece of copy?
Review a draft before approving execution. Drafts can be images, diagrams,
HTML/TSX, diffs or storyboards. Draft review comes before implementation to
confirm the direction; reviewing the delivered code still happens as usual.

### Carry decisions into the next task

Each agent has a memory recipe for its own job, learning your preferences and
decisions for that kind of task. Agents can share memory. After a main piece of
work is finished, they suggest follow-ups to help fill gaps and catch omissions.

You can also create your own agents and workflows.

> Tip: The software development workflow is free. Blog, social carousel, slide
> deck and product video workflows require Pro.

## 03 · Which way do you want to work?

**Choose Orca if you want to**

- Manage each coding-agent session yourself
- Stay closely involved in execution details

Only in Orca: Browser, SSH remote work, Mobile control, One prompt to several
agents. [See Orca's features](https://github.com/stablyai/orca)

**Choose AI4Kanban if you want to**

- Set the direction and make key decisions
- Review important drafts
- Let agents lead the execution details

The goal: Another 10× gain in efficiency beyond parallel coding.

---

Download AI4Kanban. Plan with precision, ship at speed. · https://ai4kanban.dev/download
