// 简体中文 —— the notification bell and its rail, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { NotificationsCopy } from "./types";

const zh: NotificationsCopy = {
  bell: "通知",
  bellUnread: (unread) => `通知 · ${unread} 条未读`,
  title: "通知",
  close: "关闭通知",
  silenced: "已静音",
  silencedTip: "这台电脑上所有看板的系统通知都已静音。",
  filled: (cards) => `已有 ${cards} 张卡片待你处理`,
  tabs: { todo: "待处理", landed: "已完成" },
  tabNew: "有新记录",
  status: {
    question: "待你决定",
    readyForReview: "待审核",
    accepted: "启动中",
    waitingForServer: "等待电脑",
    running: "执行中",
    completed: "已完成",
    failed: "交付失败",
    cancelled: "已中止",
    interrupted: "已中断",
    stale: "不再等待",
  },
  newCount: (unread) => `${unread} 条新消息`,
  markAllRead: "全部标为已读",
  justNow: "刚刚",
  minutesAgo: (m) => `${m} 分钟前`,
  hoursAgo: (h) => `${h} 小时前`,
  daysAgo: (d) => `${d} 天前`,
  runStopped: "运行未完成",
  runStoppedBody: "这张卡片上的运行未完成，点开查看原因。",
  loadMore: "加载更多",
  loadingMore: "正在加载…",
  loadFailed: "加载失败",
  retry: "重试",
  end: "没有更多通知了",
  checking: "正在检查…",
  unavailable: "这里无法使用通知",
  off: {
    title: "通知已关闭",
    body: "可在「配置 → 通知」中开启。",
  },
  empty: {
    title: "没有待处理事项",
    body: "需要你处理的卡片会显示在这里：待审核、待你决定，或交付失败。",
  },
  emptyLanded: {
    title: "还没有完成记录",
    body: "交付完成后会记录在这里，保留 30 天。",
  },
  unreachable: (why) => `无法连接 Cloud：${why}。以下是最后一次获取的记录。`,
  unsent: (changes) => `Cloud 数据未同步：有 ${changes} 项改动未能送达，请以这个看板为准。`,
};

export default zh;
