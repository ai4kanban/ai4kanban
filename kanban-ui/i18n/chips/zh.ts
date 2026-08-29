// 简体中文 —— the chips a card wears, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { ChipsCopy } from "./types";

const zh: ChipsCopy = {
  level: { high: "高", med: "中", low: "低" },
  roi: (level) => `ROI ${level}`,
  status: {
    ready: "待开发",
    readyLong: "可以开始开发",
    implementing: "开发中",
    implementingLong: "正在开发",
  },
  pending: "排队中",
  group: "任务组——打开卡片查看子任务",
  blockedOne: (ids) => `阻塞——${ids} 尚未完成`,
  blockedMany: (ids) => `阻塞——${ids} 尚未完成`,
  releaseStale: (version) => `${version}——不在版本列表中`,
  cadence: {
    every: "每",
    at: "于",
    count: "重复间隔",
    time: "时间",
    minutes: "分钟",
    hours: "小时",
    days: "天",
    none: "不重复",
  },
  question: { needsYou: "待你决定", new: "新" },
};

export default zh;
