// 简体中文 —— the welcome tour, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { TourCopy } from "./types";

const zh: TourCopy = {
  dialog: "功能导览",
  noteLabel: "会多花 token 吗？",
  skip: "跳过",
  back: "上一步",
  next: "下一步",
  done: "开始使用",
  pages: [
    {
      title: "执行之前，先看草稿",
      pain: "想法太多消化不完，人成了交付瓶颈？",
      value: "让 Agent 先把想法变成草稿——一张 UI 原型比功能文档直接得多。",
      note: "每个任务会多花些 token 做规划和草稿，让你花最少的精力审批。用不上的规划 Agent 可在「配置 → 工作流 → 软件开发」里停用。",
    },
    {
      title: "专注主线，支线交给 Agent",
      pain: "从 0 到 1 容易，查缺补漏难。",
      value: "让 Agent 告诉你该补什么，你去想更大的问题。",
      note: "后台会定期花 token 找遗漏，省下你盯细节的时间。不需要的话，在「配置 → 看板」暂停「建议后续任务」。",
    },
    {
      title: "不止写代码",
      pain: "一人团队，开发之外没空做营销？",
      value: "把工作都放上看板，视频、图文轮播、博客、邮件同时推进。",
    },
    {
      title: "越用越懂你",
      pain: "AI 总犯同样的错，屡教不改？",
      value: "记忆天然按 Agent 和模块切分，取用更精准，占用的上下文更少。",
      note: "定期总结对话、整理记忆会花少量 token，让之后的规划更准。可在「配置 → 看板」暂停「回顾对话」和「整理记忆」。",
    },
    {
      title: "让 Agent 替你当用户",
      tag: "实验性",
      pain: "想知道用户的真实体验如何？",
      value: "让 Agent 模拟用户走遍各个场景和功能，给出客观反馈。",
      note: "后台会定期花 token，以用户身份试用已完成的功能。可在「配置 → 工作流 → 软件开发 → 定期运行」里停用。",
    },
  ],
  draft: { idea: "加一个深色模式", spec: "功能文档", skip: "不用再读", approve: "批准", approved: "开始构建" },
  gaps: {
    main: "深色模式",
    done: "已完成",
    found: "Agent 发现 3 处遗漏",
    rows: ["设置页预览没适配深色", "邮件模板没适配深色", "主题切换缺少测试"],
    add: "加入",
    added: "已加入",
  },
  flows: { doing: "进行中", done: "已完成", cards: ["深色模式", "产品演示视频", "小红书轮播图", "上线博客", "更新通知邮件"] },
  memory: {
    says: ["确认按钮别用红色", "设置项都放进『配置』"],
    agents: "Agent",
    modules: "模块",
    files: ["ui-designer", "copywriting", "local-ui", "site"],
  },
  qa: {
    signup: "注册",
    email: "邮箱",
    export: "导出",
    steps: ["注册", "登录", "导出"],
    label: "质检反馈",
    feedback: "手机上『导出』按钮被底栏挡住了",
  },
  replay: { note: "五页看懂 AI4Kanban 能为你做什么。", button: "重新查看" },
};

export default zh;
