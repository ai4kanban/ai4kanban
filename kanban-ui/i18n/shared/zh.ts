// 简体中文 —— the words more than one screen uses, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const zh: SharedCopy = {
  close: "关闭",
  viewLarger: "放大查看",
  cancel: "取消",
  save: "保存",
  saving: "保存中…",
  delete: "删除",
  copy: "复制",
  copied: "已复制",
  none: "—",
  stop: "。",
  contextWindow: (used, limit) => `上下文窗口 ${used}/${limit}`,
};

export default zh;
