// 简体中文 —— the window's own chrome, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { ChromeCopy } from "./types";

const zh: ChromeCopy = {
  window: {
    title: "AI4Kanban",
    description: "本地看板——把工作交给 Agent 去做。",
  },
  header: { home: "全部卡片", github: "在 GitHub 上查看 AI4Kanban" },
  resize: { rail: "调整侧栏宽度", chat: "调整对话宽度", bell: "调整通知栏宽度" },
  cardLink: {
    notHere: "这张卡片所属的看板不在这台机器上。请到那台机器上打开，或在这里打开该文件夹。",
  },
  projects: {
    heading: "项目",
    reading: "正在读取你的项目…",
    onlyThisOne: "目前只有这一个。",
    openFolder: "打开文件夹…",
    badge: (boardDir) => `${boardDir}——点击查看你的项目`,
    missing: (path) => `${path}——文件夹已不存在`,
    missingLabel: "文件夹已不存在",
    openHere: "已在此窗口打开",
    openWindow: "在新窗口中打开",
    runningHere: "这里有任务正在运行",
    forget: "把这个项目移出列表——磁盘上的文件不受影响",
  },
  boards: {
    heading: "看板",
    badge: (boardDir) => `${boardDir}——点击查看这个项目的看板`,
    openHere: "已在此窗口打开",
    openWindow: "在新窗口中打开",
    work: { product: "工程看板", marketing: "营销看板" },
    alpha: "实验中",
    alphaHint: "营销看板仍在实验阶段，随时可能变化。",
  },
  update: {
    ready: (version) => `v${version} 已下载 · 点击重启更新`,
    restart: "重启更新",
    failed: "更新失败",
    failedWhy: (reason) => `更新失败 · ${reason}`,
    reason: {
      network: "网络连接中断",
      timeout: "连接超时",
      server: "更新服务暂不可用",
      disk: "磁盘空间不足",
      permission: "没有写入权限",
      checksum: "更新包校验失败",
      readOnly: "应用位于只读位置",
      noBuild: "没有适配这台电脑的安装包",
      notInstallable: "这份副本无法自动更新",
      unknown: "",
    },
  },
  app: {
    notice:
      "**AI4Kanban 有桌面应用。** 同一个看板，装在一个窗口里，什么都不用先装——不需要 Node，不需要 npx，也不需要一直开着终端。继续在浏览器里用同样可以，我们也会一直支持。",
    get: "获取应用",
    hide: "在重新打开这个标签页前不再提示",
  },
  noBoard: {
    pickAnother: "打开另一个项目…",
    make: "在这里创建看板",
    making: "正在创建看板…",
    makeFailed: "看板创建失败",
    discard: "选错文件夹了",
    discardHint: "删掉刚创建的看板，把文件夹恢复原样，再选一个",
    discarding: "正在删除…",
    discardFailed: "看板删除失败",
  },
  command: {
    install: "安装",
    repair: "修复",
    writing: "写入中…",
    failed: "命令未能安装",
    donePath: "完成。新开一个终端，运行 `akb version`。",
    doneSymlink:
      "完成。在终端里运行 `akb version`——单独输入 `akb` 会在你当前所在的项目上打开这个应用。",
  },
  phone: {
    tabs: { nav: "看板导航", board: "看板", find: "查找", memory: "记忆", more: "更多" },
    more: {
      board: "看板",
      atTheComputer: "在电脑上完成",
      atTheComputerBlurb: "查看运行、阅读差异、选择 Agent 与对话，都需要一个窗口。",
      runs: "运行",
      diffs: "差异",
      configuration: "配置",
      chat: "对话",
    },
  },
  notFound: {
    title: "这个任务不在看板上。",
    leaving: (seconds) => `${seconds} 秒后返回看板…`,
    back: "返回看板",
  },
  guide: {
    failed: "指南未能加载——",
    readOnline: "在官网阅读",
    failedEnd: "。",
    reading: "正在读取指南…",
  },
};

export default zh;
