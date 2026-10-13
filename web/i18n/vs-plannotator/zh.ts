import type { VsPlannotatorCopy } from "./types";

const zh: VsPlannotatorCopy = {
  meta: {
    title: "AI4Kanban vs. Plannotator：先看草稿，同时推进多项任务",
    socialTitle: "AI4Kanban vs. Plannotator",
    description:
      "Plannotator 让你批注编码智能体的计划、文档和代码。AI4Kanban 内置 UI 设计、文案等专业智能体，先出关键草稿供你确认，再并行推进多项任务。了解两者的草稿审阅、代码审阅、任务管理和记忆能力，选择适合你的工作方式。",
    social:
      "Plannotator 帮你在编码智能体会话中审计划、文档与代码；AI4Kanban 帮你先确认关键草稿，再由专业智能体并行交付多项任务，记住偏好和决策并提出跟进项。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs. Plannotator",
    lead: "Plannotator 让你批注编码智能体的计划、文档和代码。AI4Kanban 用看板组织多项任务：内置的专业智能体先出关键草稿供你确认，再在后台并行执行。",
  },
  both: {
    title: "两者都支持",
    items: ["执行前审阅计划", "将批注回传智能体", "接入多种编码智能体", "查看代码 diff", "免费开源"],
  },
  theirs: {
    title: "Plannotator：在智能体会话中审阅",
    intro:
      "Plannotator 通过钩子和命令接入你正在使用的编码智能体。支持计划钩子的接入会自动打开本地浏览器审阅页；你可以批准计划或批注打回，再看计划 diff 确认改了哪里，由原会话继续执行。",
    more: [
      {
        title: "不只审阅计划",
        body: "可以批注 Markdown、文件夹、URL、HTML 草稿或智能体的上一条消息，也可以审阅本地代码改动与 GitHub PR、GitLab MR。审阅中可向 AI 提问，或运行 AI 代码审阅，让建议出现在 diff 上。",
      },
      {
        title: "分享审阅内容",
        body: "通过链接让其他人批注计划，再导入反馈。小内容放在 URL 片段中，大内容与 HTML 使用加密短链。开源版链接分享仍可用，但已进入弃用支持；团队协作转向 Workspaces，官网目前仍标为即将推出。",
      },
    ],
    links: ["了解 Plannotator", "Plannotator README"],
  },
  ours: {
    title: "AI4Kanban：先看关键草稿，同时推进多项任务",
    lead: "AI4Kanban 用看板组织编码智能体的工作，内置 UI 设计、文案、竞品调研等专业智能体。你参与规划、确认关键草稿后，智能体在后台执行；互不依赖的任务可以同时推进。",
    drafts: {
      title: "先看你可能想改的部分",
      body: "担心 AI 在界面、Prompt 或文案上自由发挥？需要你拍板的部分先出草稿，确认后智能体按草稿构建。除计划和 HTML 外，还能预览图片、图表与分镜；其余细节由智能体直接完成。",
      art: ["草稿", "确认", "执行"],
    },
    parallel: {
      title: "同时推进多项任务",
      body: "看板把任务、依赖和进展放在一起。需求确定后，互不依赖的任务并行执行，你能从卡片查看日志和代码 diff，执行阶段不用时刻盯着每个会话。",
      art: ["登录页", "定价文案", "API 修复"],
    },
    memory: {
      title: "下次少些重复说明",
      body: "每个智能体都有针对自身工作设计的记忆，学习你的偏好和决策，智能体之间也能共享记忆。完成一项主线工作后，智能体自主提出跟进项，帮你补缺补漏。",
      art: { agents: ["UI 设计", "文案"], shared: "共享 · 项目背景" },
    },
    custom: "你也可以创建自定义智能体和工作流。",
    tipLabel: "提示",
    tip: "软件开发工作流免费；博客、社交轮播、演示文稿和产品视频工作流需 Pro。",
  },
  compare: {
    title: "哪些能力开箱即用",
    head: "能力",
    yes: "有",
    no: "无",
    how: {
      label: "工作方式",
      theirs: "你在当前智能体会话里打开审阅页",
      ours: "你从任务卡启动智能体，在后台执行",
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
      agents: { label: "内置的专业智能体和工作流" },
      memory: { label: "偏好和决策记忆，可跨智能体共享" },
      followUps: { label: "完成主线任务后主动提出跟进项" },
    },
    note: "只比较内置能力。Plannotator 的本地历史与 Obsidian、Bear 导出用于保存审阅记录，不等同于智能体在后续任务中沿用的偏好记忆。",
  },
  decision: {
    title: "哪种方式适合你？",
    theirs: {
      name: "选 Plannotator",
      body: "你希望围绕正在使用的编码智能体审计划、文档与代码，逐次确认修订；还需要 PR 审阅或分享批注。",
    },
    ours: {
      name: "选 AI4Kanban",
      body: "你希望同时推进多项任务：先审阅 UI、文案等关键草稿，再让智能体执行，并在后续任务中沿用你的偏好和决策。",
    },
  },
  start: {
    title: "准备同时推进多项任务？",
    body: "下载 AI4Kanban，精准规划，快速交付。",
    cta: "下载 AI4Kanban",
  },
};

export default zh;
