import type { VsOrcaCopy } from "./types";

const zh: VsOrcaCopy = {
  meta: {
    title: "AI4Kanban vs. Orca：细节放权，主导权仍在你手中",
    socialTitle: "AI4Kanban vs. Orca",
    description:
      "已经在并行运行编码智能体？了解 Orca 与 AI4Kanban 的区别：自己掌握执行细节，或让智能体主导细节、由你把握方向。",
    social:
      "Orca 在编码智能体上增加一层较薄的功能；AI4Kanban 提供现成的团队，让智能体主导执行细节，由你掌握方向和关键决定。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs. Orca",
    lead: "已经在并行运行多个编码智能体？Orca 把这些会话集中到一个工作区；AI4Kanban 更进一步，让智能体主导执行细节，由你定方向、做关键决定。",
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
    title: "AI4Kanban：你定方向，细节交给智能体",
    lead: "AI4Kanban 面向愿意让智能体主导执行细节、自己掌握大方向和关键决定的用户。专业智能体、工作流和记忆开箱即用，不用自己设计智能体角色和分工，也不用反复调 Prompt。你参与规划讨论、审阅关键草稿；智能体补全细节并推进执行。",
    drafts: {
      title: "关键部分先看草稿，再批准执行",
      body: "担心 AI 在 UI、Prompt 或文案上自由发挥？先看草稿，再批准执行。草稿可以是图片、图表、HTML/TSX、diff 或 storyboard。草稿审阅在动手实现之前，用来确认方向；交付后的代码审阅照常进行。",
      art: ["草稿", "批准", "执行"],
    },
    memory: {
      title: "把决定带到下一项工作",
      body: "每个智能体都有针对自身场景设计的记忆配方，学习你对这类任务的偏好和决策，智能体之间也能共享记忆。完成一项主线工作后，智能体会提出跟进项，帮你补缺补漏。",
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
      points: ["定方向、做关键决定", "审阅重要草稿", "让智能体主导执行细节"],
      goalLabel: "目标",
      goal: "在并行编码的基础上，效率再提升 10 倍",
    },
  },
  start: {
    title: "开始使用 AI4Kanban",
    body: "下载 AI4Kanban，精准规划，快速交付。",
    cta: "下载 AI4Kanban",
  },
};

export default zh;
