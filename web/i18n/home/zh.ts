// 简体中文 — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const zh: HomeCopy = {
  meta: {
    title: "独立开发者的 Agent 工作台 | AI4Kanban",
    description: "AI4Kanban 内置开发与营销的专业 agent，把需要你把关的关键部分先做成草稿。你确认后，agent 完成后续工作，让你少花时间检查成品、反复修改。",
    socialTitle: "先看草稿，其余交给 Agent",
    social: "开发与营销，各有专业 agent。你先审关键部分的草稿，确认后把后续工作交出去，少花时间检查和修改成品。",
    schema:
      "AI4Kanban 是面向独立开发者的开源、本地优先 Agent 工作台。内置 6 种开发与内容创作工作流，由对应的专业 agent 分工协作，共享项目背景。agent 先把需要用户把关的关键部分做成草稿，再按确认的内容完成后续工作，减少用户事后检查和修改的负担。独立任务可并行推进，偏好和决策延续到后续任务，交付后主动提出跟进建议。使用用户自己的 AI 工具和订阅。",
  },

  hero: {
    eyebrow: "独立开发者的 Agent 工作台",
    title: "先看草稿\n其余交给 Agent",
    lead: "从开发到营销，AI4Kanban 挑出任务中需要你把关的部分，提前做成草稿。你改好关键部分，Agent 完成后续工作，让你不必每件事都亲自盯、来回改。",
    ctaDownload: "下载",
    ctaGithub: "查看 GitHub ↗",
    image: "AI4Kanban 演示看板的录屏：规划任务、审阅卡片上的草稿，再交给 agent 完成。",
  },

  review: {
    title: "关键部分由你把关\n后续交给 agent",
    lead:
      "AI4Kanban 把想法中需要你把关的部分先做成草稿，让你能具体审阅、反复修改。确认后，agent 按草稿完成后续工作，你可以继续处理其他事务。",
    scene: {
      label:
        "你把想法交给 AI4Kanban，它整理成草稿供你把关；你确认后，AI4Kanban 把草稿连同上下文交给 agent 接手后续工作。",
      idea: "上线 Pro 套餐",
      you: "你",
      board: "AI4Kanban",
      agent: "Agent",
      review: "你把关",
      build: "agent 接手",
    },
  },

  workflows: {
    title: "产品要开发，营销也要跟上",
    lead:
      "从产品开发到轮播帖、SEO 博客和视频，AI4Kanban 内置 6 种工作流，分别把界面原型、正文与配图、分镜等内容先交给你把关，再由 agent 完成后续工作。",
    items: [
      { label: "软件开发", image: "软件开发草稿：关键页面的 UI 原型。" },
      { label: "博客文章", image: "博客文章草稿：文章正文与配图。" },
      { label: "产品视频", image: "产品视频草稿：包含画面与旁白的分镜。" },
      { label: "幻灯片", image: "幻灯片草稿：逐页内容与版式预览。" },
      { label: "轮播帖", image: "轮播帖草稿：逐页文案与内容大纲。" },
      { label: "视频克隆（代码生成的视频）", image: "视频克隆草稿：原片拆解与复刻分镜。" },
    ],
    links: { demo: "体验演示", all: "查看全部 agent 与工作流" },
  },

  parallel: {
    title: "多项工作并行推进",
    body: [
      "产品开发和营销任务放在同一看板。互不依赖的任务可以同时推进；有前后依赖的，按顺序接着做。",
      "每张卡片保留自己的草稿、决定与进度。需要你判断时回到卡片上处理，执行细节交给 agent，不用在多个对话之间反复交接。",
    ],
    shots: {
      board: { label: "Board", alt: "AI4Kanban 本地看板界面：Board 视图" },
      card: { label: "Card", alt: "AI4Kanban 本地看板界面：卡片详情与需求" },
      frontAria: "{view} 视图（当前）",
      flipAria: "切换到 {view} 视图",
    },
  },

  agents: {
    title: "下次不用从头解释",
    body: [
      "你确认的偏好和决策会留给后续任务。每个 agent 按自己的工作记忆相关内容，也能与其他 agent 共享。",
      "下一份草稿从已有共识继续，让你把时间用在这次真正要改的地方。",
    ],
    image: "你提一次意见，agent 记住，之后的每份草稿都照做。",
  },

  followUps: {
    title: "做完一项，继续补缺补漏",
    body: [
      "完成一项主线工作后，agent 会主动提出跟进建议，帮你发现遗漏和后续值得做的事。",
      "建议回到看板，由你接受、修改或拒绝，再决定是否推进。",
    ],
    image: "QA agent 发现一处遗漏，递给你一条跟进，由你接受或忽略。",
  },

  tools: {
    title: "继续用你熟悉的 AI 工具",
    body:
      "连接 Claude Code、Codex 等 8 种工具，在你的电脑上运行，使用自己的订阅。每个 agent 可单独选择工具和模型；AI4Kanban 不额外收取 token 费用。",
  },

  start: {
    title: "从第一项工作开始",
    lead: "下载桌面应用，打开项目，写下你想做的事。先审需要你把关的草稿，确认后把后续工作交给 agent。",
    cta: "下载",
    firstOpen:
      "当前构建未签名，macOS 会拦截首次打开：先把应用从 `.dmg` 拖入，再在警告中点击继续。下载页提供 macOS、Windows 和 Linux 的完整步骤。",
    command: "偏好命令行？在项目里运行 `npx ai4kanban@latest install`。",
  },
};

export default zh;
