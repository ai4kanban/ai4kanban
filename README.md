<div align="center">

# <img src="https://cdn.ai4kanban.dev/readme/logo-mark-v1.svg" width="40" align="top" alt=""> AI4Kanban

**An agent workspace for indie hackers**<br>Review the drafts. Agents do the rest.

[![Download for macOS](https://img.shields.io/badge/macOS-24231f?style=for-the-badge&logo=apple&logoColor=white)](https://ai4kanban.dev/download) [![Download for Windows](https://img.shields.io/badge/Windows-24231f?style=for-the-badge&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTAgMy40IDkuNiAydjkuNEgwem0xMC44LTEuNUwyNCAwdjExLjRIMTAuOHpNMCAxMi42aDkuNlYyMkwwIDIwLjZ6bTEwLjggMEgyNFYyNGwtMTMuMi0xLjl6Ii8%2BPC9zdmc%2B)](https://ai4kanban.dev/download) [![Download for Linux](https://img.shields.io/badge/Linux-24231f?style=for-the-badge&logo=linux&logoColor=white)](https://ai4kanban.dev/download)

[![release](https://img.shields.io/github/v/release/ai4kanban/ai4kanban?style=flat-square&color=dd4f1e)](https://github.com/ai4kanban/ai4kanban/releases/latest) [![license](https://img.shields.io/github/license/ai4kanban/ai4kanban?style=flat-square&color=57534e)](LICENSE) [![downloads](https://img.shields.io/github/downloads/ai4kanban/ai4kanban/total?style=flat-square&color=57534e)](https://github.com/ai4kanban/ai4kanban/releases) [![installs](https://img.shields.io/endpoint?url=https%3A%2F%2Ft.ai4kanban.dev%2Fv1%2Finstalls&style=flat-square&color=57534e)](https://ai4kanban.dev/download)

[Website](https://ai4kanban.dev) · [Blog](https://ai4kanban.dev/blog) · English | [简体中文](README-zh.md)

</div>

AI4Kanban brings coding and marketing workflows into one agent workspace. Agents draft the parts that need your judgment—UI, copy, video scripts and more—for you to review and refine. Once you approve the drafts, agents take care of implementation and the details you delegate, so you can ship more features and publish more marketing content. Independent tasks move forward in parallel, with your project context and preferences carried into the next task.

[![Watch the AI4Kanban demo](https://cdn.ai4kanban.dev/home/hero-demo-poster-v1.jpg)](https://cdn.ai4kanban.dev/home/hero-demo-v1.mp4)

## Build and market your product

As an indie hacker, you need to build a product and get people to use it. Marketing can take as much time and attention as development—or more. Shipping more features and publishing more content, quickly and reliably, is hard when every detail needs your attention.

## How AI4Kanban helps

### 1. A specialist team for coding and marketing

![Six workflows and their specialist agent teams](https://cdn.ai4kanban.dev/readme/workflow-teams-en-v2.png)

AI4Kanban comes with **6 workflows and 10+ specialist agents** for the work indie hackers do every day. Each agent owns a specific part of a workflow, such as UI design or copywriting. No need to assemble an agent team before you start.

The agents share your project context, while each specialist learns from your feedback in its own area. Design preferences stay with the design agent; wording preferences stay with the copy agent. Each can build on that experience in later tasks, so you spend less time repeating yourself.

| Workflow | What agents deliver |
| --- | --- |
| Coding | Software changes, from UI updates to new features |
| Slide deck | A PowerPoint deck with one image per slide; slide elements are not editable |
| Product video | A finished product video and cover image |
| Carousel post | Images for each slide and captions for each platform |
| Blog post | A complete article with images and links |
| Video clone | A recreated video and reusable template based on a reference made with code; footage, illustrations and logos use placeholders |

See the [agent docs](https://ai4kanban.dev/docs/agents) for the full team.

### 2. Set the standard in the draft, then delegate

A feature can meet every requirement and still have an awkward UI. A video can be produced exactly as requested, yet have a stiff script that sounds AI-generated.

AI4Kanban identifies the parts of a task that need your judgment and brings in the right specialists to draft them. Review and refine the UI, copy or script until it meets your standards. Agents then build from what you approved.

This gives you a clear division of work: you shape the parts that need your care and precision; agents take on the execution and the details you choose to delegate. You can put your attention where it matters and leave the rest to agents.

### 3. Break requests into tasks you can ship independently

AI4Kanban breaks a request into tasks and identifies which can run independently. Agents can work on those tasks in parallel, with separate Git worktrees for coding. Prioritize urgent tasks and ship them as they're ready. Lower-priority work can continue without holding up the whole request.

### 4. Spot useful follow-up work

After completing a main task, agents suggest follow-up work to address gaps. The QA agent also reviews recent software changes from a user's perspective. You decide which suggestions to act on.

![AI4Kanban at a glance](https://cdn.ai4kanban.dev/readme/overview-grid-v9.png)

## Quick start

1. [Download the desktop app](https://ai4kanban.dev/download) and open your project. Your board is stored in your project's `docs/kanban/` directory. [Connect a supported tool](https://ai4kanban.dev/docs/connectors) using your own subscription or API key.
2. Describe what you want to do and choose a workflow. Agents break down the work and bring in the specialists it needs.
3. Review and refine any drafts that need your judgment, then approve them. Set task priorities and let agents carry out the work.

Follow the [first-card walkthrough](https://ai4kanban.dev/docs/first-card) to take your first task from idea to completion.

Prefer the command line? Run `npx ai4kanban@latest install` in your project.

## Use the tools and models you prefer

![The 8 harnesses AI4Kanban supports](https://cdn.ai4kanban.dev/readme/harnesses-v1.png)

- **8 supported tools**: Claude Code, Codex, Cursor, OpenCode, Kimi Code, DeepSeek Harness, ZCode and Grok Build. See [setup instructions](https://ai4kanban.dev/docs/connectors).
- **Your own subscriptions or API keys**: Agent runs use the tools on your computer. AI4Kanban charges no additional token fees.
- **Choose a model for each agent**: Set the tool and model each agent uses.

## License

- The desktop app, the `akb` CLI, the board UI, and the Cloud service are all licensed under [Apache-2.0](LICENSE).
- [`web/`](web/) has a separate [source-available license](web/LICENSE). The code is available to read and audit. This is not an open-source license; it does not grant permission to deploy or redistribute the code.

## Contact us

Questions or problems? Open an issue or email [support@ai4kanban.dev](mailto:support@ai4kanban.dev).
