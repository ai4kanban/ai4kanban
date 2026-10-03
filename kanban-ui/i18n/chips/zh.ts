// 简体中文 —— the chips a card wears, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { ChipsCopy } from "./types";

const zh: ChipsCopy = {
  level: { high: "高", med: "中", low: "低" },
  roi: (level) => `ROI ${level}`,
  status: {
    ready: "待执行",
    readyLong: "可以开始执行",
    implementing: "执行中",
    implementingLong: "正在执行",
  },
  pending: "排队中",
  schedule: {
    action: { implement: "执行", refine: "细化" },
    waiting: (action, ids) => `${action} · 等待 ${ids}`,
    queued: (action) => `${action} · 排队中`,
  },
  needsPro: "需要 Pro",
  needsProHint: {
    upgrade: (action) => `${action}已排队，升级到 Pro 后自动开始`,
    signIn: (action) => `${action}已排队，登录 Pro 账号后自动开始`,
  },
  discussing: "讨论中",
  discussingHint: "对话正在回复，回复结束前卡片暂不可操作。",
  failed: "未完成",
  failedHint: "这张卡片上次运行未完成，点开查看原因。",
  group: "任务组 · 打开查看子任务",
  blockedOne: (ids) => `阻塞：${ids} 尚未完成`,
  blockedMany: (ids) => `阻塞：${ids} 尚未完成`,
  releaseStale: (version) => `${version} 不在版本列表中`,
  question: { needsYou: "待你决定", new: "新" },
};

export default zh;
