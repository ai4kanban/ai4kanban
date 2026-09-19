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
    tooOldForMemory: "这个看板所用的运行规则太旧，无法读取它的记忆。",
    tooOldForArchive: "这个看板所用的运行规则太旧，无法读取它的归档。",
    tooOldForSignals: "这个看板所用的运行规则太旧，无法使用待筛选。",
    updateIt: "运行 `npm install -g ai4kanban` 升级它。",
  },
  tooOld: {
    autoDelivery: "这个看板的运行规则早于自动交付——请运行 `npm install -g ai4kanban`。",
    diffApproval: "这个看板的运行规则早于差异批准——请运行 `npm install -g ai4kanban`。",
    aiReview: "这个看板的运行规则早于交付评审设置——请运行 `npm install -g ai4kanban`。",
    silenceLimit: "这个看板的运行规则早于静默上限——请运行 `npm install -g ai4kanban`。",
    deliveries: "这个看板的运行规则早于交付流程——请运行 `npm install -g ai4kanban`。",
    worktrees: "这个看板的运行规则早于交付 worktree——请运行 `npm install -g ai4kanban`。",
    resumeDelivery: "这个看板的运行规则早于交付接续——请运行 `npm install -g ai4kanban`。",
    agents: "这个项目里的运行规则太旧，无法读写这个看板的 Agent",
    language: "这个看板的运行规则早于语言设置——请运行 `npm install -g ai4kanban`。",
    skillInstall: "这个项目里的运行规则太旧，无法安装 skill",
    specAgentSwitch: "这个项目里的运行规则太旧，无法开关规格 Agent",
    specAgentSetting: "这个项目里的运行规则太旧，无法设置规格 Agent",
    runtimes: "这个看板的运行规则早于命名运行时——请运行 `npm install -g ai4kanban`。",
    usageReporting: "这个看板的运行规则早于使用情况上报设置——请运行 `npm install -g ai4kanban`。",
    memoryPruner: "这个看板的运行规则早于记忆整理 Agent——请运行 `npm install -g ai4kanban`。",
    cardSweeper: "这个看板的运行规则早于定期整理搁置卡片——请运行 `npm install -g ai4kanban`。",
    dismissalReviewer: "这个看板的运行规则早于回顾忽略记录——请运行 `npm install -g ai4kanban`。",
  },
  actions: {
    noSuchCard: "这不是本看板上的卡片。",
    emptyChat: "请先写点什么再发送。",
    noPlan: "这次讨论还没有可以据以写卡片的方案。",
    onePlan: "直接开做只能用一份方案；多份方案请用“开始规划”。",
  },
  run: { noProcess: "未能为这次运行启动进程" },
  chat: {
    busy: "这段对话还在回复上一条消息。",
    sendFailed: "消息发送失败。",
    clearFailed: "对话未能清空。",
    pickFailed: "未能更改此对话使用的智能体或模型。",
  },
  mockup: {
    notAMockup: (src, exts) => `${src}——素材的写法是 .assets/<卡片号>/<名字>，后缀为 ${exts}`,
    outside: (src) => `${src}——素材只从本卡片的素材目录读取，而这个路径指向了它之外`,
    missing: (src) => `${src}——这台电脑上没有这个文件`,
    notDrawn: (src, why) => `${src}——这份素材无法显示：${why}`,
    cannotImport: (id) => `它导入了 "${id}"，这里无法使用——请把它一并复制到素材目录，或改用不依赖它的画法`,
    noSuchFile: (id) => `它导入了 "${id}"，但素材目录里没有这个文件`,
    outsideFolder: (id) => `它导入了 "${id}"，而素材只能读取自己目录下的文件`,
    tooManyFiles: (files) => `它牵连的文件超过了 ${files} 个`,
    noDefault: "它没有默认导出任何组件",
    tooSlow: (seconds) => `它没能在 ${seconds} 秒内完成绘制`,
    noStylesheet: "缺少绘制这个画面所需的样式",
  },
};

export default zh;
