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
    runningHere: "这里有任务正在运行",
    forget: "把这个项目移出列表——磁盘上的文件不受影响",
  },
  update: {
    available: (version) => `**AI4Kanban ${version}** 已发布。应用不会自动更新——你想升级时再取。`,
    download: "下载",
    skip: "不再提示这个版本",
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
  },
  command: {
    install: "安装",
    repair: "修复",
    writeAgain: "重新写入",
    writing: "写入中…",
    failed: "命令未能安装",
    donePath: "完成。新开一个终端，运行 `akb version`。",
    doneSymlink:
      "完成。在终端里运行 `akb version`——单独输入 `akb` 会在你当前所在的项目上打开这个应用。",
    state: {
      installed: (path) => `已安装在 ${path}。`,
      dangling: (path, points) => `已安装在 ${path}，但它指向的应用已不存在——${points}。`,
      foreign: (path, holder) => `${path} 被${holder}占用——这需要你自己处理。`,
      foreignNpm: (path, holder) =>
        `${path} 被${holder}占用——从 npm 安装的 \`akb\` 也会落在同一个路径，这需要你自己处理。`,
      holderUnknown: "某个不是本应用写入的东西",
      absent: "未安装——你的终端里没有本应用提供的 `akb`。",
    },
  },
  notFound: {
    title: "这个任务不在看板上。",
    leaving: (seconds) => `${seconds} 秒后返回看板…`,
    back: "返回看板",
  },
  guide: {
    failed: "指南未能加载——",
    readOnGitHub: "在 GitHub 上阅读",
    failedEnd: "。",
    reading: "正在读取指南…",
  },
};

export default zh;
