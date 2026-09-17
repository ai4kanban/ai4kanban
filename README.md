<div align="center">

# <img src="https://cdn.ai4kanban.dev/readme/logo-mark-v1.svg" width="40" align="top" alt=""> AI4Kanban

**You set the direction. AI leads the team.**<br>From product development to content marketing,<br>your AI project manager leads your agents so you can take on bigger projects.

[![Download for macOS](https://img.shields.io/badge/macOS-24231f?style=for-the-badge&logo=apple&logoColor=white)](https://ai4kanban.dev/download) [![Download for Windows](https://img.shields.io/badge/Windows-24231f?style=for-the-badge&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTAgMy40IDkuNiAydjkuNEgwem0xMC44LTEuNUwyNCAwdjExLjRIMTAuOHpNMCAxMi42aDkuNlYyMkwwIDIwLjZ6bTEwLjggMEgyNFYyNGwtMTMuMi0xLjl6Ii8%2BPC9zdmc%2B)](https://ai4kanban.dev/download) [![Download for Linux](https://img.shields.io/badge/Linux-24231f?style=for-the-badge&logo=linux&logoColor=white)](https://ai4kanban.dev/download)

[![release](https://img.shields.io/github/v/release/ai4kanban/ai4kanban?style=flat-square&color=dd4f1e)](https://github.com/ai4kanban/ai4kanban/releases/latest) [![license](https://img.shields.io/github/license/ai4kanban/ai4kanban?style=flat-square&color=57534e)](LICENSE) [![downloads](https://img.shields.io/github/downloads/ai4kanban/ai4kanban/total?style=flat-square&color=57534e)](https://github.com/ai4kanban/ai4kanban/releases) [![installs](https://img.shields.io/endpoint?url=https%3A%2F%2Ft.ai4kanban.dev%2Fv1%2Finstalls&style=flat-square&color=57534e)](https://ai4kanban.dev/download)

[Website](https://ai4kanban.dev) · [Blog](https://ai4kanban.dev/blog) · English | [简体中文](README-zh.md)

</div>

One person. A whole team behind you. AI4Kanban is your AI project manager: it assigns work to your agents, tracks progress, and reviews results. You focus on direction and key decisions, with more room to take on bigger projects.

## Our philosophy

Make every task demand less of your time and attention.

Our goal is to help you manage 10× larger AI agent teams and take on projects 10× the size. That means AI taking on coordination, follow-ups, and reviews alongside execution, leaving you free to focus on direction, key decisions, and final approval.

Our early adopters report 3–6× higher development productivity.

## How it works

<p align="center">
<img src="https://cdn.ai4kanban.dev/readme/vibe-vs-kanban-coding-v1.jpg" width="560" alt="Vibe coding, the middle of the curve, and kanban coding">
</p>

1. Think of AI4Kanban as your project manager. It coordinates your agents so you don’t have to babysit them.

2. AI4Kanban turns each rough idea into a card. The `refine` workflow clarifies the requirements, breaks down the task, and produces a plan.

3. If a plan gets too long or has too many open questions, the card is broken into subtasks. Those can be broken down further until each card describes a concrete, actionable task.

4. The agent tests the plan by asking questions, much like [grill-me](https://github.com/mattpocock/skills) or [wayfinder](https://github.com/mattpocock/skills). It raises questions, finds answers, and repeats until it sees no major gaps. Decisions about taste, product direction, or business priorities come back to you.

5. Agents work out most product details themselves, usually leaving just 2–3 questions for you per task. If the request itself is clear enough, they may not need to ask you anything.

6. Each card has two parts: a human brief with only what needs your attention, and an agent execution plan.

7. You bring the ideas, make the choices, and review a short brief. AI does the rest.

![AI4Kanban at a glance](https://cdn.ai4kanban.dev/readme/overview-grid-v4.png)

## A fully automated coding factory (experimental)

You can delegate the remaining human decisions to AI, too.

- For decisions about taste and business direction, configure a Decider Agent with your most capable model—such as Claude Fable or GPT-6 xhigh—to make the call for you.

- A Gater Agent reviews ready cards for potential problems and overlooked details, then decides whether implementation can begin.

- Enable reflection to have agents review completed work and suggest other product improvements, including ideas outside the original task’s scope.

- You can even automate requirements gathering. Have agents pull feature requests from Reddit threads, competitor analyses, market reports, team discussions, and meeting notes into the triage inbox. Agents review these ideas and add the most promising ones to the board.

![From external inputs to release iterations](https://cdn.ai4kanban.dev/readme/automation-inputs-v1.png)

**Warning:** Bad decisions can become part of project memory and lead to more bad decisions. For production software, we recommend keeping human approval at critical steps.

## Your team’s shared brain

- Every decision is saved in project memory. Planning agents read it as needed.

- New projects usually start with one module that holds all project memory. As modules grow and evolve independently, their memory is auto-splitted, so each module’s changes and decisions affect only its own memory.

- Everyone on the team works from the same board and has access to the same project memory.

## Harness-agnostic

- We support 8 harnesses. Don’t see yours? Open an issue to help us prioritize support.

![The 8 harnesses AI4Kanban supports](https://cdn.ai4kanban.dev/readme/harnesses-v1.png)

- Harnesses run on your computer using your own AI subscriptions. We charge no additional token fees.

- Choose a harness and model for each agent to match the demands of its role.

- We recommend at least one $200/month AI subscription. With AI4Kanban, you will hit the usage limits very effectively 😉.

- If you subscribe to both OpenAI and Claude, we recommend Fable for planning, GPT for discussion, and Opus for coding.

- You can also work with the board through the skill and CLI, or build a custom UI that fits your workflow.

## Stay up to date without watching every run

- You don’t need to watch your coding agents work. AI4Kanban keeps you posted and notifies you when it needs a decision.

- Notifications contain just what you need to know.

- Get notifications on your desktop or in Slack. More IM integrations are planned.

## License

- The desktop app, the `akb` CLI, the board UI, and the Cloud service are all licensed under [Apache-2.0](LICENSE).

- [`web/`](web/) carries its own [source-available license](web/LICENSE). You can read and audit the code, but the license does not permit deployment or redistribution.

## Solo developers, scale your brain

Founders are told to focus on marketing and distribution. But it can take 3–12 months to build a product users want. Until then, many projects remain demos or very niche tools that aren’t developed enough to compete. How can marketing help at that stage?

AI4Kanban aims to help solo developers and small businesses:

- Build a production-ready product in 2–3 weeks.
- Make 500 commits per person in 30 days.
- Ship a major release every week.

Launch sooner with a coherent product that users can use from start to finish, so their feedback tells you whether the idea works—not just what’s broken or missing.

If you’re using AI4Kanban and struggling to ship at that pace, we’d be happy to help with a 60-minute onboarding session. Contact us at [support@ai4kanban.dev](mailto:support@ai4kanban.dev).
