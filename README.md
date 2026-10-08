<div align="center">

# <img src="https://cdn.ai4kanban.dev/readme/logo-mark-v1.svg" width="40" align="top" alt=""> AI4Kanban

**You review what matters. Agents do the rest.**<br>See the drafts and set the direction before agents build.

[![Download for macOS](https://img.shields.io/badge/macOS-24231f?style=for-the-badge&logo=apple&logoColor=white)](https://ai4kanban.dev/download) [![Download for Windows](https://img.shields.io/badge/Windows-24231f?style=for-the-badge&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTAgMy40IDkuNiAydjkuNEgwem0xMC44LTEuNUwyNCAwdjExLjRIMTAuOHpNMCAxMi42aDkuNlYyMkwwIDIwLjZ6bTEwLjggMEgyNFYyNGwtMTMuMi0xLjl6Ii8%2BPC9zdmc%2B)](https://ai4kanban.dev/download) [![Download for Linux](https://img.shields.io/badge/Linux-24231f?style=for-the-badge&logo=linux&logoColor=white)](https://ai4kanban.dev/download)

[![release](https://img.shields.io/github/v/release/ai4kanban/ai4kanban?style=flat-square&color=dd4f1e)](https://github.com/ai4kanban/ai4kanban/releases/latest) [![license](https://img.shields.io/github/license/ai4kanban/ai4kanban?style=flat-square&color=57534e)](LICENSE) [![downloads](https://img.shields.io/github/downloads/ai4kanban/ai4kanban/total?style=flat-square&color=57534e)](https://github.com/ai4kanban/ai4kanban/releases) [![installs](https://img.shields.io/endpoint?url=https%3A%2F%2Ft.ai4kanban.dev%2Fv1%2Finstalls&style=flat-square&color=57534e)](https://ai4kanban.dev/download)

[Website](https://ai4kanban.dev) · [Blog](https://ai4kanban.dev/blog) · English | [简体中文](README-zh.md)

</div>

AI4Kanban helps you move more work forward at once. Agents first draft the parts you need to decide on, then finish the task once you've reviewed them. They also remember your preferences and suggest follow-up work.

## The problem we solve

AI agents have already made one person 10× more productive. AI4Kanban aims to multiply that by **another 10×**.

A good agent does a well-defined task well. But as execution gets faster, a new bottleneck appears: people can't plan fast enough. To keep more work moving at once, you have to keep coming up with ideas, pin down requirements, and turn them into plans agents can carry out.

That is the problem AI4Kanban solves.

<p align="center">
<img src="https://cdn.ai4kanban.dev/readme/bottleneck-en-v1.gif" width="680" alt="The bottleneck moves from execution to planning">
</p>

## How we solve it

### 1. Draft first, then build

To move many things at once, you can't watch every detail. Your attention belongs on the key points: the parts that must follow your judgment, not the agent's.

AI4Kanban drafts these parts first, so you can tell whether the direction is right before anything gets built.

| Helper agent | What it covers | What you review first |
| --- | --- | --- |
| `ui-designer` | Screen layout and interaction | UI mockups |
| `prompt-writer` | Skills, agent prompts, and other model instructions | Prompt diffs |
| `copywriting` | Promotional copy for the website, README, and release notes | Copy drafts |
| `email-planner` | New or changed emails | Email previews on desktop and mobile |

These are some of the helper agents. See the [agent docs](https://ai4kanban.dev/docs/agents) for the full list.

You review only these key points. Once the direction is set, agents handle the remaining details within the bounds you gave them.

### 2. Specialist agents that keep learning

Different work needs different checks. AI4Kanban comes with 5 workflows and 10+ agents, each handling its own part.

For example, the UI designer drafts mockups. It remembers every revision you ask for and applies it to later designs. The more you work together, the better it knows your preferences, so you don't have to repeat yourself.

### 3. Agents follow up on the details

When one person drives many tasks at once, some design or testing work is bound to slip. AI4Kanban's background agents review progress regularly and suggest follow-up work, and the QA agent tests recent changes to find problems from a user's point of view.

You don't have to catch every gap yourself. Agents find them, make suggestions, and leave the next step to you.

### 4. The foundation: task management and agent scheduling

Coordinating multiple agents takes task management and agent scheduling. AI4Kanban handles task breakdown, priorities, task lifecycle management, scheduled tasks, notifications, parallel runs in Git worktrees, and conflict resolution.

With that groundwork handled, you can spend more of your attention on ideas, direction, and key decisions.

![AI4Kanban at a glance](https://cdn.ai4kanban.dev/readme/overview-grid-v9.png)

## Quick start

1. [Download the desktop app](https://ai4kanban.dev/download) and open your project. The board lives in your project's `docs/kanban/`.
2. Write down an idea. Agents start planning and send you the drafts and questions to review.
3. Once you've reviewed the drafts, agents build it, then suggest follow-up work worth doing.

Prefer the command line? Run `npx ai4kanban@latest install` in your project.

## Supported harnesses

![The 8 harnesses AI4Kanban supports](https://cdn.ai4kanban.dev/readme/harnesses-v1.png)

- **8 popular harnesses**: Don't see yours? Open an issue to let us know.
- **Your own subscriptions**: Every harness runs on your computer. We charge no additional token fees.
- **A model for each role**: Choose the harness and model for each agent.

## License

- The desktop app, the `akb` CLI, the board UI, and the Cloud service are all licensed under [Apache-2.0](LICENSE).
- [`web/`](web/) carries its own [source-available license](web/LICENSE). You can read and audit the code, but it is not an open-source license and does not permit deployment or redistribution.

## Contact us

Questions or problems? Open an issue or email [support@ai4kanban.dev](mailto:support@ai4kanban.dev).
