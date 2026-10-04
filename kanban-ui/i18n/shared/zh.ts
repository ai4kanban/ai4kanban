// 简体中文 —— the words more than one screen uses, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const zh: SharedCopy = {
  close: "关闭",
  viewLarger: "放大查看",
  cancel: "取消",
  save: "保存",
  saving: "正在保存…",
  delete: "删除",
  copy: "复制",
  copied: "已复制",
  none: "—",
  stop: "。",
  contextWindow: (used, limit) => `上下文窗口 ${used}/${limit}`,
  became: { open: "→ 已写成", done: "已完成", dropped: "已放弃" },
  pro: { mark: "Pro", upgrade: "升级到 Pro", signIn: "登录以使用 Pro", locked: "Pro 工作流，升级后可用" },
};

export default zh;
