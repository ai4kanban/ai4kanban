import type { VsOrcaCopy } from "./types";

const zh: VsOrcaCopy = {
  meta: {
    title: "AI4Kanban vs. Orca：先审草稿，执行细节交给 agent",
    socialTitle: "AI4Kanban vs. Orca",
    description:
      "对比 AI4Kanban 与 Orca 的会话操控、专业工作流、草稿审阅，以及执行阶段需要承担的协调工作。",
    social:
      "对比 AI4Kanban 与 Orca 的会话操控、专业工作流、草稿审阅，以及执行阶段需要承担的协调工作。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs. Orca",
    lead: "对比 AI4Kanban 与 Orca 的会话操控、专业工作流、草稿审阅，以及执行阶段需要承担的协调工作。",
  },
  both: {
    title: "两者都支持",
    items: ["接入多种编码智能体", "多个并行会话", "Git worktree 隔离", "审阅代码 diff"],
  },
  orca: {
    title: "Orca：在编码智能体上增加一层较薄的功能",
    intro:
      "Orca 在编码智能体上增加一层较薄的功能，把并行会话、终端、worktree、编辑和审阅集中到一个工作区，保留使用编码智能体的原有体验。",
    introLink: "了解 Orca",
    introEnd: "。",
    body: [
      "它适合希望自行管理各个智能体会话、参与执行细节的用户，例如分配任务、审阅修改和合并代码。给每个智能体多少自主权，仍由你决定。",
      "它的 CLI 编排提供任务、派发和审批节点。任务说明和具体流程由你或你的协调智能体编写。",
    ],
  },
  codex: {
    title: "Codex 桌面应用已经提供",
    lead: "Orca 增加的部分能力，Codex 桌面应用等编码工具本身已经提供。",
    items: ["并行会话与 worktree", "diff 与 PR 审阅", "浏览器", "手机操控与 SSH"],
    agents:
      "Codex 只运行 OpenAI 的模型；Orca 可运行 Codex、Claude Code 等命令行编码智能体。",
    sources: {
      worktrees: "Codex worktree",
      review: "代码审阅",
      browser: "浏览器",
      remote: "远程连接",
      orcaFeatures: "Orca 功能",
    },
  },
  compare: {
    yes: "有",
    no: "没有",
    rows: {
      planning: "智能体与你一起规划每个任务，只请你做关键决定",
      team: "现成的专业智能体和工作流",
      drafts: "执行前审阅草稿：图片、HTML/TSX、storyboard",
      memory: "记住你的偏好，智能体之间共享记忆",
      tools: "内置浏览器、SSH 与手机操控",
    },
  },
  ours: {
    title: "AI4Kanban：先审草稿，执行细节交给 agent",
    lead: "专业 agent 把需要你审阅的界面、文案或脚本做成草稿。关键部分确认后，由对应工作流完成后续任务。开发、博客、视频都有内置工作流，独立任务可并行推进。",
    drafts: {
      title: "关键部分先看草稿，再批准执行",
      body: "需要你判断的部分先出草稿。你在卡片上审阅、修改，agent 按确认的版本继续，在约定范围内完成其余细节。关键部分提前改好，减少后续返工。",
      art: ["草稿", "批准", "执行"],
    },
    memory: {
      title: "把决定带到下一项工作",
      body: "每个 agent 记住与自身工作相关的偏好和决策，也能与其他 agent 共享项目背景，让后续任务从已有共识继续。完成一项主线工作后，agent 自主提出跟进项，由你接受、修改或拒绝。",
      art: {
        agents: ["UI 设计", "文案"],
        shared: "共享 · 项目背景",
      },
    },
    custom: "你也可以创建自己的智能体和工作流。",
    tipLabel: "提示",
    tip: "软件开发工作流免费；博客、社交轮播、演示文稿和产品视频工作流需 Pro。",
  },
  decision: {
    title: "你希望怎样工作？",
    ifYou: "如果你希望",
    theirs: {
      name: "选 Orca",
      points: ["自行管理每个编码智能体会话", "深入参与执行细节"],
      onlyLabel: "仅 Orca 提供",
      only: ["内置浏览器", "SSH 远程工作", "手机操控", "同一提示词发给多个智能体"],
      link: "查看 Orca 功能",
    },
    ours: {
      name: "选 AI4Kanban",
      points: [
        "直接使用开发、博客、视频的专业 agent 和工作流",
        "在草稿里改好关键部分，再让 agent 完成后续工作",
        "agent 沿用已明确的偏好，减少后续任务的重复修改",
      ],
      goalLabel: "目标",
      goal: "开发与营销一起推进，减少返工",
    },
  },
  start: {
    title: "开始使用 AI4Kanban",
    body: "下载 AI4Kanban，精准规划，快速交付。",
    cta: "下载 AI4Kanban",
  },
};

export default zh;
