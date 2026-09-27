// Chinese copy for the pricing page. Mirrors `en.ts` key for key.
import type { PricingCopy } from "./types";

const zh: PricingCopy = {
  meta: {
    title: "AI4Kanban 定价 — 免费版、Pro 与种子伙伴",
    description: "AI4Kanban 免费开源。Pro 增加演示文稿和产品视频工作流，按年付费折合每月 $10。",
  },
  hero: {
    eyebrow: "定价",
    title: "免费开启，Pro 更进一步",
    lead: "所有方案都在你自己的电脑上运行，使用你自己的编码 Agent。",
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
    rows: ["演示文稿工作流", "产品视频工作流", "每月 5,000 AI 积分，配音每秒用 1 积分", "优先支持"],
    button: "购买 Pro",
  },
  board: {
    tags: { coding: "编码", email: "邮件", slides: "演示文稿", video: "视频" },
    tasks: {
      coding: ["添加深色模式", "修复登录跳转", "导出为 CSV", "加快搜索"],
      email: ["欢迎邮件", "版本更新邮件"],
      slides: ["投资人月报", "团建分享稿"],
      video: ["发布演示视频", "新手引导视频"],
    },
  },
  seed: {
    name: "种子伙伴",
    body: "与我们分享经你脱敏的会话，帮助改进 AI4Kanban。获得接纳后享 6 个月 Pro，到期不自动收费。",
    button: "加入候补名单",
  },
  training: { name: "培训", button: "了解培训" },
};

export default zh;
