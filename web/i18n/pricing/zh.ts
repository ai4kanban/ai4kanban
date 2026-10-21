// Chinese copy for the pricing page. Mirrors `en.ts` key for key.
import type { PricingCopy } from "./types";

const zh: PricingCopy = {
  meta: {
    title: "AI4Kanban：方案与定价",
    description: "AI4Kanban 全部工作流免费。Pro 提供模板，让成品更精致，另含 AI 积分和新想法自动筛选；按年付费折合每月 $10。",
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
      { text: "全部 6 种工作流", more: { list: ["编码", "演示文稿", "产品视频", "社交帖子", "博客文章", "视频克隆"] } },
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
      "全部 Pro 模板",
      "新想法自动筛选",
      "AI 配音、图像和音乐生成",
      {
        text: "每月 5,000 AI 积分",
        cue: "消耗标准",
        more: {
          note: "配音、图像和音乐共用每月 5,000 AI 积分。",
          table: [
            ["配音", "1 积分 / 秒"],
            ["图像", "320 积分 / 张"],
            ["音乐", "160 积分 / 首"],
          ],
        },
      },
      "优先支持",
    ],
    button: "免费试用 7 天",
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
