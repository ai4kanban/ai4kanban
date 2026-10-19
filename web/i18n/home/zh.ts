// 简体中文 — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const zh: HomeCopy = {
  meta: {
    title: "独立开发者的 Agent 工作台 | AI4Kanban",
    description:
      "从开发到营销，AI4Kanban 把需要你判断的部分做成草稿。你审阅、修改并确认后，agent 接手后续执行，让你不必每个细节都亲自盯。",
    socialTitle: "不用每个细节都亲自盯",
    social: "需要你判断的部分先审草稿，后续执行交给 agent。从开发到营销，让你少操心执行细节。",
    schema:
      "AI4Kanban 是面向独立开发者的开源、本地优先 Agent 工作台。6 种内置工作流及自定义工作流明确哪些内容由用户把关、哪些工作由 agent 执行。用户先确认草稿，再由 agent 完成后续工作，使用用户自己的 AI 工具。",
  },

  hero: {
    eyebrow: "独立开发者的 Agent 工作台",
    title: "不用每个细节\n都亲自盯",
    lead: "从开发到营销，AI4Kanban 把需要你判断的部分做成草稿。你审阅、修改并确认后，agent 接手后续工作。",
    ctaDownload: "下载",
    ctaGithub: "查看 GitHub ↗",
    image: "在 AI4Kanban 中规划任务、审阅草稿，再把工作交给 agent。",
  },

  handoff: {
    title: "关键部分由你把关\n其余交给 agent",
    body: [
      "AI4Kanban 帮你澄清想法。每种工作流都把需要你确认的部分做成草稿，供你审阅、修改，再由 agent 完成后续工作。互不依赖的任务会同时推进。",
    ],
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
    title: "不同的工作，各有合适的工作流",
    lead: "从 6 种内置开发与内容工作流开始。每种工作流都明确你需要审阅什么，再由 agent 接手。也可以创建自己的 agent 和工作流。",
    items: [
      {
        label: "软件开发",
        body: "审阅需要你参与的界面和文案，agent 按确认的方案完成开发。",
        image: "关键页面的界面原型。",
      },
      {
        label: "视频复刻（代码生成的视频）",
        body: "审阅原片拆解和复刻分镜，agent 复刻视频并制作可复用模板。",
        image: "原片拆解与复刻分镜。",
      },
      {
        label: "产品视频",
        body: "审阅脚本和分镜，agent 完成视频与封面。",
        image: "包含画面与旁白的分镜。",
      },
      {
        label: "幻灯片",
        body: "审阅逐页内容和版式，agent 制作每页以图片呈现的 PowerPoint 文件。",
        image: "逐页内容与版式预览。",
      },
      {
        label: "轮播帖",
        body: "审阅逐页文案和内容大纲，agent 制作页面图片与平台发布文案。",
        image: "逐页文案与内容大纲。",
      },
      {
        label: "博客文章",
        body: "审阅大纲、正文与配图，agent 完成整篇文章。",
        image: "文章正文与配图。",
      },
    ],
    links: { demo: "体验演示", all: "查看全部 agent 与工作流" },
  },

  tools: {
    title: "继续用你熟悉的 AI 工具",
    body:
      "连接 Claude Code 等 8 种工具，在你的电脑上运行，使用自己的订阅。每个 agent 可单独选择工具和模型；AI4Kanban 不额外收取 token 费用。",
  },

  start: {
    title: "从下一个想法开始",
    lead: "下载桌面应用，打开项目，一起澄清你想做的事。",
    cta: "下载",
    firstOpen: "macOS 应用尚未签名。如果首次打开时被拦截，请按下载页的步骤操作。",
  },
};

export default zh;
