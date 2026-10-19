import type { TemplatesCopy } from "./types";

const zh: TemplatesCopy = {
  meta: {
    title: "AI4Kanban：模板",
    description: "按分类浏览模板，查看图片及来源，对照原作与复刻结果，再通过 AI4Kanban 使用模板。",
  },
  title: "模板",
  lead: "按分类浏览。",
  categories: {
    ui: { name: "界面", title: "界面模板", back: "返回界面模板" },
    video: { name: "视频", title: "视频模板", back: "返回视频模板" },
    prop: { name: "道具", title: "道具", back: "返回道具" },
    motion: { name: "动效", title: "动效", back: "返回动效" },
  },
  tabs: "分类",
  pages: "分页",
  prev: "上一页",
  next: "下一页",
  back: (title) => `返回${title}`,
  all: "全部分类",
  free: "免费",
  pro: "Pro",
  original: "原作",
  recreation: "复刻",
  originalVideo: "原视频",
  recreationVideo: "复刻视频",
  keyframe: "关键帧",
  preview: "预览",
  pause: "暂停",
  pieceNote: "需在视频模板中使用，不能单独运行。",
  play: "播放",
  noPreview: "暂无预览",
  tags: "标签",
  use: "使用这个模板",
  useLead: "粘贴到 AI4Kanban，再补上你的主题。",
  prompt: (category, name) => {
    switch (category) {
      case "video":
        return `用 AI4Kanban 的视频模板「${name}」做：<写下你的产品和视频要展示的内容>`;
      case "ui":
        return `用 AI4Kanban 的界面模板「${name}」设计：<写下要做的页面或界面>`;
      case "prop":
        return `用 AI4Kanban 做一个视频，用上道具「${name}」：<写下视频的主题和内容>`;
      case "motion":
        return `用 AI4Kanban 做一个视频，用上动效「${name}」：<写下视频的主题和内容>`;
      default:
        return `用 AI4Kanban 的 ${category} 模板「${name}」做：<写下你想做的内容>`;
    }
  },
  copyPrompt: "复制提示词",
  copied: "已复制",
  source: "来源",
  site: "原站",
  reference: "参考",
  captured: "采集时间",
  originalWork: "原创模板",
  loading: "正在加载模板…",
  unavailable: "模板加载失败。",
  retry: "重试",
  empty: "暂无模板。",
  missing: "找不到这个模板。",
  videoFailed: "视频无法播放。",
  openYouTube: "在 YouTube 打开",
  openOriginal: "打开原始链接",
  detailTitle: (title) => `${title} | AI4Kanban 模板`,
};

export default zh;
