// 简体中文 —— the sentences the server writes itself, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { MessagesCopy } from "./types";

const zh: MessagesCopy = {
  rules: {
    none: "这个看板没有可用的运行规则来读取它——PATH 上没有 `akb`。",
    noneLookedIn: (paths) =>
      `这个看板没有可用的运行规则来读取它——PATH 上没有 \`akb\`，${paths} 也都不存在。`,
    tooOld: (path) => `${path} 处的运行规则对这个看板来说太旧了。`,
    installIt: "运行 `npm install -g ai4kanban` 安装一份。",
    tooOldForCloud: "这个项目里的运行规则太旧，无法登录 Cloud。",
    tooOldForChat: "这个看板的运行规则太旧，无法进行对话。",
    tooOldForHandChecks: "这个看板的运行规则早于人工验收项的编辑功能。",
    tooOldForScores: "这个看板的运行规则早于规划质量分。",
    tooOldForMemory: "这个看板所用的运行规则太旧，无法读取它的记忆。",
    tooOldForArchive: "这个看板所用的运行规则太旧，无法读取它的归档。",
    tooOldForDrafts: "这个看板所用的运行规则太旧，无法读取这个选题的稿件。",
    updateIt: "运行 `npm install -g ai4kanban` 升级它。",
  },
  tooOld: {
    autoDelivery: "这个看板的运行规则早于自动交付——请运行 `npm install -g ai4kanban`。",
    diffApproval: "这个看板的运行规则早于差异批准——请运行 `npm install -g ai4kanban`。",
    aiReview: "这个看板的运行规则早于 AI 评审设置——请运行 `npm install -g ai4kanban`。",
    silenceLimit: "这个看板的运行规则早于静默上限——请运行 `npm install -g ai4kanban`。",
    deliveries: "这个看板的运行规则早于交付流程——请运行 `npm install -g ai4kanban`。",
    worktrees: "这个看板的运行规则早于交付 worktree——请运行 `npm install -g ai4kanban`。",
    flowRule: "这个项目里的运行规则太旧，无法保存流程规则",
    language: "这个看板的运行规则早于语言设置——请运行 `npm install -g ai4kanban`。",
    skillInstall: "这个项目里的运行规则太旧，无法安装 skill",
    specAgentSwitch: "这个项目里的运行规则太旧，无法开关规格 Agent",
    specAgentSetting: "这个项目里的运行规则太旧，无法设置规格 Agent",
    usageReporting: "这个看板的运行规则早于使用情况上报设置——请运行 `npm install -g ai4kanban`。",
  },
  actions: {
    noSuchCard: "这不是本看板上的卡片。",
    emptyChat: "请先写点什么再发送。",
    goalFirst: "请先写下项目目标——之后每一步都以它为依据来规划",
    nothingTicked: "没有勾选任何卡片",
  },
  run: { noProcess: "未能为这次运行启动进程" },
  chat: {
    busy: "这段对话还在回复上一条消息。",
    sendFailed: "消息发送失败。",
    clearFailed: "对话未能清空。",
    pickFailed: "未能更改此对话使用的智能体或模型。",
  },
  mockup: {
    notAMockup: (src) => `${src}——原型图应是 docs/kanban/.mockups/ 下的 .tsx、.html 或 .txt 文件`,
    outside: (src) => `${src}——原型图只从 docs/kanban/.mockups/ 读取，而这个路径指向了它之外`,
    missing: (src) => `${src}——这台机器上没有这个文件（原型图不纳入 git）`,
    notDrawn: (src, why) => `${src}——这张原型图无法绘制：${why}`,
    importsOther: (id) => `它导入了 "${id}"，而原型图只能导入 React`,
    cannotImport: (id) => `无法导入 "${id}"`,
    noDefault: "它没有默认导出任何组件",
    tooSlow: (seconds) => `它没能在 ${seconds} 秒内完成绘制`,
    noStylesheet: "应用旁边没有 Tailwind 的样式表——看板无法为原型图上样式",
  },
};

export default zh;
