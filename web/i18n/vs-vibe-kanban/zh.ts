// 简体中文 — the Vibe Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsVibeCopy } from "./types";

const zh: VsVibeCopy = {
  meta: {
    title: "AI4Kanban vs. Vibe Kanban：两种智能体工作方式",
    socialTitle: "AI4Kanban vs. Vibe Kanban",
    description:
      "对比 AI4Kanban 和 Vibe Kanban 如何管理任务、运行编码智能体和检查结果，帮你快速选出更合适的工具。",
    social:
      "两者都能运行编码智能体：AI4Kanban 管理项目直到任务完成，Vibe Kanban 让多个任务分开开发。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nVibe Kanban",
    lead: "两者都能规划任务并运行编码智能体。AI4Kanban 帮你从想法一路推进到完成；Vibe Kanban 让多个任务在独立环境中开发，并集中检查结果。",
    ours: {
      name: "AI4Kanban",
      body: "从提出想法到实现和归档，都记录在仓库的 Markdown 中；也能从本地界面启动智能体。",
    },
    theirs: {
      name: "Vibe Kanban",
      body: "每个任务在独立 worktree 中运行，并在一个界面里查看 diff、预览和 PR。",
    },
  },
  summary: {
    heading: {
      eyebrow: "现状",
      title: "Vibe Kanban 还能用，但现在只能在本地运行",
    },
    lead: "Bloop 于 2026 年 4 月关闭后，Vibe Kanban 终止订阅和远程服务，转为完全本地运行。项目仍以 Apache-2.0 许可证开放，并交由社区维护。",
    panel:
      "本地工作区仍可运行智能体、查看 diff 和预览应用。不过，今后需要在本地使用，更新和支持也主要由社区负责。",
  },
  comparison: {
    heading: { eyebrow: "核心比较", title: "六个最重要的区别" },
    lead: "{check} 表示这一项更强；**横杠**表示各有取舍。两者都能运行智能体，区别主要在任务怎么管理、代码怎么分开，以及结果怎么检查。",
    ourLabel: "AI4Kanban",
    theirLabel: "Vibe Kanban",
    rows: {
      whatFor: {
        dimension: "主要解决什么",
        kanban: "把想法变成任务，管理依赖，交给智能体实现，并把过程留在仓库里。",
        vibe: "让多个任务在独立环境中执行，并在一个界面里检查和交付。",
      },
      orchestration: {
        dimension: "多个任务同时开发",
        kanban: "能启动智能体实现任务，但目前不使用 worktree；多个实现会修改同一个工作目录。",
        vibe: "每个任务使用独立的 git worktree，可以同时开发而不互相覆盖。",
      },
      review: {
        dimension: "检查结果",
        kanban: "本地界面能查看运行日志和未提交的改动，但没有行内评论、实时预览，也不能直接创建 PR。",
        vibe: "内置行内 diff 和实时预览，还可以直接创建 pull request。",
      },
      planning: {
        dimension: "准备任务",
        kanban: "补全需求、整理依赖，并结合项目背景把任务准备到可以直接实现。",
        vibe: "可以安排和跟踪 issue，但更擅长后续的执行和检查。",
      },
      onDisk: {
        dimension: "数据存储",
        kanban: "Markdown 与代码一同保存在仓库并进入版本控制。",
        vibe: "数据保存在本地 SQLite 数据库中。",
      },
      runsAs: {
        dimension: "数据和运行方式",
        kanban: "卡片保存在仓库的 Markdown 中。可以只用命令行，也可以启动可选的本地界面；不需要数据库或导出。",
        vibe: "需要运行本地应用；数据保存在 SQLite 中，每个任务会创建一个 worktree。",
      },
      setup: {
        dimension: "怎么安装",
        kanban: "安装技能文件和一个小型辅助脚本。",
        vibe: "运行 `npx vibe-kanban`，再配置要使用的智能体命令行工具。",
      },
      whichAgents: {
        dimension: "支持哪些智能体",
        kanban: "技能可由能运行 shell 的编码智能体使用；本地界面目前支持 Claude Code 和 Codex。",
        vibe: "已支持 Claude Code、Codex、Gemini 等多种命令行工具。",
      },
      lockIn: {
        dimension: "以后怎么迁移",
        kanban: "看板跟着仓库走，不需要额外导出。",
        vibe: "开源、可自托管，也支持导出数据。",
      },
      maintenance: {
        dimension: "维护状态",
        kanban: "目前仍在积极维护。",
        vibe: "Bloop 关闭后，项目转由开源社区维护。",
      },
    },
  },
  purpose: {
    heading: { eyebrow: "工作方式", title: "都能运行智能体，但各有侧重" },
    lead: "AI4Kanban 负责把项目**持续推进**；Vibe Kanban 负责让任务**分开开发、集中检查**。",
    ours: {
      name: "AI4Kanban：持续推进项目",
      is: "智能体可以提出、细化并实现任务，过程和决策都保存在 Markdown 看板中。",
      isnt: "本地界面可以启动智能体，但目前不会为任务创建独立 worktree，也不能直接创建 PR。",
    },
    theirs: {
      name: "Vibe Kanban：分开开发，集中检查",
      is: "智能体在独立 worktree 中运行，你可以在同一处查看 diff、实时预览和 PR。",
      isnt: "它更关注每次开发任务，不负责长期保存项目背景和决策。",
    },
    note: "真正的区别，是任务怎么保存、代码怎么分开，以及结果怎么检查。",
  },
  wins: {
    heading: { eyebrow: "优势", title: "各自更擅长什么" },
    lead: "AI4Kanban 更适合持续管理项目；Vibe Kanban 更适合同时开发多个任务。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Vibe Kanban",
    ours: {
      nothingRunning: {
        title: "数据就在仓库里",
        body: "本地界面可以不用；看板不依赖数据库，也无需导出。",
      },
      planning: {
        title: "把任务想清楚",
        body: "把粗略想法补全成可以确认、可以直接实现的任务。",
      },
      outlives: {
        title: "跟着仓库走",
        body: "任务和规划都进入 git，克隆仓库就能一起带走。",
      },
      anyAgent: {
        title: "不只支持一个智能体",
        body: "技能不绑定单一工具；本地界面目前支持 Claude Code 和 Codex。",
      },
    },
    theirs: {
      parallel: {
        title: "任务互不干扰",
        body: "每个实现任务使用独立 worktree，不会覆盖其他任务的代码改动。",
      },
      reviewInPlace: {
        title: "集中检查",
        body: "在同一工作区查看 diff、应用预览和 pull request。",
      },
      boardUi: {
        title: "专用界面",
        body: "适合启动任务、监控进度和切换工作区。",
      },
      support: {
        title: "支持更多智能体",
        body: "直接支持 Claude Code、Codex、Gemini 等多种命令行工具。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "选择建议", title: "哪一个更适合你？" },
    oursHeading: "选 AI4Kanban，如果你需要",
    theirsHeading: "选 Vibe Kanban，如果你需要",
    ours: [
      "让智能体从提出任务一路做到实现和归档。",
      "把任务、依赖、项目背景和决策保存在 git 与 Markdown 中。",
      "使用 Claude Code 或 Codex，并可从可选的本地 UI 发起运行。",
    ],
    theirs: [
      "让多个实现任务在独立 worktree 中同时开发。",
      "在一个界面中查看 diff 和实时预览。",
      "在一个地方管理 worktree、运行过程和 pull request。",
    ],
    verdict:
      "想让智能体**持续管理并推进整个项目**，选 **AI4Kanban**；想让多个任务**分开开发，并集中检查代码**，选 **Vibe Kanban**。",
    note: "两者都会运行智能体，区别在于你想怎么管理任务和代码。",
  },
};

export default zh;
