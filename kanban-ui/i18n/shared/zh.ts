// 简体中文 —— the words more than one screen uses, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const zh: SharedCopy = {
  close: "关闭",
  cancel: "取消",
  save: "保存",
  saving: "保存中…",
  delete: "删除",
  copy: "复制",
  copied: "已复制",
  none: "—",
  stop: "。",
  channelStatus: {
    none: "尚未撰写",
    draft: "初稿",
    ready: "待发",
    scheduled: "已排期",
    published: "已发布",
  },
  channelAt: (channel, status) => `${channel} —— ${status}`,
};

export default zh;
