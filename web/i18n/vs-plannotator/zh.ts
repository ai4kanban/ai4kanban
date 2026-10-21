import type { VsPlannotatorCopy } from "./types";

const zh: VsPlannotatorCopy = {
  meta: {
    title: "AI4Kanban vs. Plannotator：从关键草稿到任务交付",
    socialTitle: "AI4Kanban vs. Plannotator",
    description:
      "对比 AI4Kanban 与 Plannotator 的草稿与代码审阅、专业工作流、并行任务，以及确认后的工作如何继续。",
    social:
      "对比 AI4Kanban 与 Plannotator 的草稿与代码审阅、专业工作流、并行任务，以及确认后的工作如何继续。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs. Plannotator",
    lead: "对比 AI4Kanban 与 Plannotator 的草稿与代码审阅、专业工作流、并行任务，以及确认后的工作如何继续。",
  },
  both: {
    title: "两者都支持",
    items: ["执行前审阅计划", "将批注回传 agent", "接入多种编码 agent", "查看代码 diff", "免费开源"],
  },
  theirs: {
    title: "Plannotator：在 agent 会话中审阅",
    intro:
      "Plannotator 通过钩子和命令接入你正在使用的编码 agent。支持计划钩子的接入会自动打开本地浏览器审阅页；你可以批准计划或批注打回，再看计划 diff 确认改了哪里，由原会话继续执行。",
    more: [
      {
        title: "不只审阅计划",
        body: "可以批注 Markdown、文件夹、URL、HTML 草稿或 agent 的上一条消息，也可以审阅本地代码改动与 GitHub PR、GitLab MR。审阅中可向 AI 提问，或运行 AI 代码审阅，让建议出现在 diff 上。",
      },
      {
        title: "分享审阅内容",
        body: "通过链接让其他人批注计划，再导入反馈。小内容放在 URL 片段中，大内容与 HTML 使用加密短链。开源版链接分享仍可用，但已进入弃用支持；团队协作转向 Workspaces，官网目前仍标为即将推出。",
      },
    ],
    links: ["了解 Plannotator", "Plannotator README"],
  },
  ours: {
    title: "AI4Kanban：从关键草稿到完成任务",
    lead: "专业 agent 把需要你审阅的界面、文案或脚本做成草稿。关键部分确认后，由对应工作流完成后续任务。开发、博客、视频都有内置工作流，独立任务可并行推进。",
    drafts: {
      title: "先看你可能想改的部分",
      body: "需要你判断的部分先出草稿。你在卡片上审阅、修改，agent 按确认的版本继续，在约定范围内完成其余细节。关键部分提前改好，减少后续返工。",
      art: ["草稿", "确认", "执行"],
    },
    parallel: {
      title: "同时推进多项任务",
      body: "开发与营销任务放在同一看板，每张卡片保留草稿、决策与进度。需求明确后，独立任务可并行，有依赖的任务按顺序推进。",
      art: ["登录页", "定价文案", "API 修复"],
    },
    memory: {
      title: "下次少些重复说明",
      body: "每个 agent 记住与自身工作相关的偏好和决策，也能与其他 agent 共享项目背景，让后续任务从已有共识继续。完成一项主线工作后，agent 自主提出跟进项，由你接受、修改或拒绝。",
      art: { agents: ["UI 设计", "文案"], shared: "共享 · 项目背景" },
    },
    custom: "你也可以创建自定义 agent 和工作流。",
    tipLabel: "提示",
    tip: "所有内置和自建工作流均可免费使用。",
  },
  compare: {
    title: "哪些能力开箱即用",
    head: "能力",
    yes: "有",
    no: "无",
    how: {
      label: "工作方式",
      theirs: "你在当前 agent 会话里打开审阅页",
      ours: "你从任务卡启动 agent，在后台执行",
    },
    rows: {
      plans: { label: "执行前审阅计划、回传反馈" },
      html: { label: "HTML 草稿预览" },
      images: { label: "图片与分镜草稿审阅" },
      planDiff: { label: "显示计划修订差异" },
      askAi: { label: "审阅时向 AI 提问", theirs: "在审阅页提问", ours: "在卡片中对话" },
      codeDiff: { label: "查看代码 diff", ours: "交付的 Diff 页" },
      aiReview: { label: "AI 在代码 diff 上提出审阅意见" },
      prs: { label: "GitHub PR、GitLab MR 审阅" },
      share: { label: "分享审阅链接", theirs: "开源版已进入弃用支持" },
      board: { label: "带依赖与并行执行的任务看板" },
      agents: { label: "内置的专业 agent 和工作流" },
      memory: { label: "偏好和决策记忆，可跨 agent 共享" },
      followUps: { label: "完成主线任务后主动提出跟进项" },
    },
    note: "只比较内置能力。Plannotator 的本地历史与 Obsidian、Bear 导出用于保存审阅记录，不等同于 agent 在后续任务中沿用的偏好记忆。",
  },
  decision: {
    title: "哪种方式适合你？",
    theirs: {
      name: "选 Plannotator",
      body: "你希望围绕正在使用的编码 agent 审计划、文档与代码，逐次确认修订；还需要 PR 审阅或分享批注。",
    },
    ours: {
      name: "选 AI4Kanban",
      body: "在任务卡片上审关键草稿，再交给 agent 完成后续工作。开发与营销都有内置工作流，独立任务可以并行推进。后续任务沿用你的偏好，减少重复修改。",
    },
  },
  start: {
    title: "准备同时推进多项任务？",
    body: "下载 AI4Kanban，精准规划，快速交付。",
    cta: "下载 AI4Kanban",
  },
};

export default zh;
