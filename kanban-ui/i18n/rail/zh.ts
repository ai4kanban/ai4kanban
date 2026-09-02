// 简体中文 —— the rail, the memory pages, the goal and Insights, mirroring `en.ts`
// key for key. Writing rules: `i18n/index.ts`.
import type { RailCopy } from "./types";

const zh: RailCopy = {
  search: "查找卡片",
  clearSearch: "清空搜索",
  matching: "匹配的卡片",
  openCards: "待办卡片",
  allCards: "全部卡片",
  matches: "匹配结果",
  noMatches: "没有匹配的卡片。",
  runningRow: (label) => `${label}——运行中`,
  running: "运行中",
  close: (label) => `关闭${label}`,
  memory: {
    heading: "记忆",
    show: "Agent 关于这个项目记住了什么",
    hide: "隐藏项目记忆",
    project: "项目",
    modules: "模块",
    empty: "关于这个模块还没有记下任何内容。",
    files: {
      readme: "已交付的能力",
      decisions: "已定下的决策",
      redesign: "设计上的教训",
      rejected: "被否决的想法",
    },
  },
  archive: {
    row: "归档",
    title: "归档",
    meta: (folder, count) => `${folder} · ${count} 张卡片`,
    empty: "还没有归档任何卡片。卡片完成后会被移到这里，也在这里查看。",
    list: "已归档的卡片",
    undated: "在看板开始记录归档日期之前完成",
    card: { label: "归档", release: "版本", archived: "归档于" },
  },
  memoryPage: {
    unwritten:
      "这里还没有写下任何内容。每当有工作完成、有决策定下、有想法被否决，Agent 都会补上一行——这个文件会随着看板的使用逐渐充实。",
    menu: "对这个文件的操作",
    copyPath: "复制路径",
    copyRelative: "复制相对路径",
    copied: (what) => `${what}已复制`,
    path: "路径",
    relativePath: "相对路径",
  },
  goal: {
    open: "目标",
    openHint: "这个看板是为什么而存在的",
    title: "目标",
    reading: "正在读取 goal.md…",
    editTitle: "填写目标",
    guideTitle: "什么样的目标是好目标",
    guideLine:
      "用你自己的话写项目要去往何处：你想要什么、大致多久、接下来大概做什么。写得粗略、简短都没关系，之后也可以改——Agent 绝不会替你起草目标。",
    saveFailed: "目标保存失败",
  },
  insights: {
    open: "统计",
    title: "统计",
    tabDaily: "每日进度",
    tabQuality: "规划质量",
    daily: {
      reading: "正在读取 metrics.csv…",
      empty:
        "还没有记录任何活动。第一次创建、归档或否决卡片时，看板会往 `metrics.csv` 写入一行。",
      completed: "已完成",
      created: "已创建",
      rejected: "已否决",
      totals: (days, completed, created, rejected) =>
        `最近 ${days} 天——**已完成 ${completed}**、**已创建 ${created}**、**已否决 ${rejected}**。`,
      chart: (days) => `最近 ${days} 天的看板每日活动：完成、创建和否决的卡片数。`,
    },
    quality: {
      reading: "正在读取 record.csv…",
      empty:
        "还没有规划记录。看板每定下一个问题、提出一张卡片或关闭一个版本，都会往 `record.csv` 写入一行——三项分数正是由这些行算出来的。",
      chart: "按版本统计的规划质量。用左右方向键在版本之间切换；下方的读数给出该版本的三项分数。",
      stillOpen: " · 尚未关闭",
      axisOpen: " · 进行中",
      notEnough: "样本不足",
      needed: (floor) => `——还需要 ${floor} 个`,
      percent: (value) => `${value}%`,
      cards: (ids) => `卡片 ${ids}`,
      noCards: "暂无卡片",
    },
  },
};

export default zh;
