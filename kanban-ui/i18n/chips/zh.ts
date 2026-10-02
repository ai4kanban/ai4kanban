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
  schedule: {
    action: { implement: "开发", refine: "澄清" },
    waiting: (action, ids) => `${action} · 等待 ${ids}`,
    queued: (action) => `${action} · 排队中`,
  },
  needsPro: "需要 Pro",
  needsProHint: {
    upgrade: (action) => `${action}已排队，升级到 Pro 后自动开始`,
    signIn: (action) => `${action}已排队，登录 Pro 账号后自动开始`,
  },
  discussing: "讨论中",
  discussingHint: "聊天正在回话——这一轮回话结束前卡片冻结。",
  failed: "未完成",
  failedHint: "这张卡上次的运行没跑完，点开查看原因。",
  group: "任务组——打开卡片查看子任务",
  blockedOne: (ids) => `阻塞——${ids} 尚未完成`,
  blockedMany: (ids) => `阻塞——${ids} 尚未完成`,
  releaseStale: (version) => `${version}——不在版本列表中`,
  question: { needsYou: "待你决定", new: "新" },
};

export default zh;
