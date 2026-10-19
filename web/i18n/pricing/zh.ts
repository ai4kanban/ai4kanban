// Chinese copy for the pricing page. Mirrors `en.ts` key for key.
import type { PricingCopy } from "./types";

const zh: PricingCopy = {
  meta: {
    title: "AI4Kanban：方案与定价",
    description: "AI4Kanban，独立开发者的 Agent 工作台。软件开发免费；Pro 提供幻灯片、产品视频、轮播帖、博客文章和视频克隆工作流，按年付费折合每月 $10。",
  },
  hero: {
    eyebrow: "定价",
    title: "方案与定价",
    lead: "所有方案都在你自己的电脑上运行，使用你自己的 AI 工具。",
  },
  billing: { monthly: "按月", yearly: "按年", save: "省 33%" },
  free: {
    name: "免费版",
    price: "$0",
    tagline: "Apache 2.0 开源。",
    rows: [
      "支持 8 种 AI 编码工具",
      "含 8 个 Agent 的编码工作流",
      "不限同时运行的任务数",
      "无限自定义工作流和 Agent",
      "邮件支持",
    ],
    button: "下载",
  },
  pro: {
    name: "Pro",
    yearly: { price: "$120", per: "/ 年", sub: "折合每月 $10，按年收费" },
    monthly: { price: "$15", per: "/ 月" },
    leadIn: "包含免费版全部功能，另加：",
    rows: [
      "幻灯片工作流",
      "产品视频工作流",
      "轮播帖工作流",
      "博客文章工作流",
      "视频克隆工作流",
      "新想法自动筛选，你只需决定拿不准的几条",
      "每月 5,000 AI 积分，配音每秒用 1 积分，生成图像每张用 320 积分，生成音乐每首用 160 积分",
      "优先支持",
    ],
    button: "购买 Pro",
  },
  seed: {
    name: "种子伙伴",
    body: "与我们分享经你脱敏的会话，帮助改进 AI4Kanban。获得接纳后享 6 个月 Pro，到期不自动收费。",
    button: "加入候补名单",
  },
  custom: {
    name: "定制 Agent",
    price: "$15",
    per: "/ 个 Agent",
    body: "把你的流程交给为它量身定制的 Agent。",
    button: "描述你的流程",
  },
  training: { name: "培训", button: "了解培训" },
};

export default zh;
