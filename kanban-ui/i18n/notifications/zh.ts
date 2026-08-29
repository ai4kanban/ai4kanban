// 简体中文 —— the notification bell and its rail, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { NotificationsCopy } from "./types";

const zh: NotificationsCopy = {
  bell: "通知",
  bellUnread: (unread) => `通知——${unread} 条未读`,
  title: "通知",
  close: "关闭通知",
  silenced: "已静音",
  silencedTip: "这台机器上所有看板的系统通知都已静音。",
  newCount: (unread) => `${unread} 条新消息`,
  markAllRead: "全部标为已读",
  justNow: "刚刚",
  minutesAgo: (m) => `${m} 分钟前`,
  hoursAgo: (h) => `${h} 小时前`,
  daysAgo: (d) => `${d} 天前`,
  unavailable: "这里无法使用通知",
  signedOut: {
    title: "尚未登录 Cloud",
    body: "登录后，这个看板的卡片就会开始填充通知。在你登录之前，没有任何数据离开这台机器。",
    hint: "配置 → 通知",
  },
  noRelease: {
    title: "没有进行中的版本",
    body: "通知只跟踪一个进行中的版本。可以从顶栏的版本选择器开一个。",
  },
  empty: {
    title: "没有待处理事项",
    body: "需要你处理的卡片会出现在这里，完成后再保留 30 天。",
  },
  unreachable: (why) => `无法连接 Cloud：${why}。以下是我们最后一次拿到的记录。`,
  unsent: (changes) => `Cloud 数据不同步：有 ${changes} 项改动始终没有送达。以这个看板为准。`,
  boardGone: (board) => `${board} 已不在这台机器上。`,
  closed: {
    title: "你跟踪的版本已经关闭。",
    body: "在你选定新的跟踪对象之前，通知不会再有新内容。",
    all: "全部版本",
    failed: "该版本无法跟踪",
  },
};

export default zh;
