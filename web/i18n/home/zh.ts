// 简体中文 — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const zh: HomeCopy = {
  meta: {
    title: "先看草稿，再让 agent 动手 | AI4Kanban",
    description: "AI4Kanban 为看板上的任务准备关键草稿。你把关重点，agent 完成细节，一个人也能推进更多事。",
    socialTitle: "先看草稿，再往下做",
    social: "先审草稿再执行的 AI 看板：关键处先出草稿，其余交给 agent 完成。",
    schema:
      "AI4Kanban 是开源、本地优先的 AI 看板。它为任务准备关键草稿——UI 原型、文案稿、分镜、配图——你先定好方向，再由专业 agent 在约定范围内完成后续工作。覆盖产品开发与内容创作，连接 Claude Code、Codex 等 8 种工具，在你的电脑上运行，使用你自己的订阅。",
  },

  hero: {
    eyebrow: "独立创业者的 Agent 工作台",
    title: "先看草稿\n其余交给 Agent",
    lead: "从开发到营销，AI4Kanban 挑出任务中需要你把关的部分，提前做成草稿。你改好关键部分，Agent 完成后续工作，让你不必每件事都亲自盯、来回改。",
    ctaDownload: "下载",
    ctaGithub: "查看 GitHub ↗",
    image: "AI4Kanban 演示看板的录屏：规划任务、审阅卡片上的草稿，再交给 agent 完成。",
  },

  drafts: {
    title: "关键部分先看草稿，方向不对现在就改。",
    lead: "agent 把关键部分做成草稿，放在任务卡片上。先看、先改，再开始后续工作。",
    kinds: [
      { label: "UI 原型", body: "预览页面布局与交互。" },
      { label: "文案稿", body: "确认信息与措辞。" },
      { label: "分镜", body: "查看每个镜头的画面与旁白。" },
      { label: "配图", body: "确认每张图呈现的内容。" },
    ],
    closing: "你不用把每个细节都规定好。关键草稿确认后，agent 在约定范围内完成后续工作。",
  },

  agents: {
    title: "这次提过的意见，下次不用再说。",
    body: [
      "设计 agent 准备原型，文案 agent 打磨措辞，脚本 agent 准备创作方案。AI4Kanban 内置 5 种工作流和 10+ 个专业 agent，按任务分工，记住与你的合作中明确的偏好和决策。",
      "比如，你要求文案「标题直接一点」，文案 agent 会把这条意见用于之后的草稿。下一项任务从已有共识继续，不用每次从头解释。",
    ],
    pro: "产品视频、幻灯片、轮播帖和博客文章需要 Pro。",
    image: "你提一次意见，agent 记住，之后的每份草稿都照做。",
  },

  followUps: {
    title: "让 agent 替你查缺补漏",
    body: [
      "任务多了，不必靠你一个人找出每处遗漏。后台 agent 定期检查进展，QA agent 从用户视角测试最近的改动。",
      "遗漏的错误状态、缺少的测试，都可以成为跟进建议，回到看板上等你判断。你决定接受、修改还是拒绝，再让 agent 继续推进。",
    ],
    image: "QA agent 发现一处遗漏，递给你一条跟进，由你接受或忽略。",
  },

  parallel: {
    title: "多项工作一起推进，关键决定交给你。",
    body: [
      "产品改动、发布文章、介绍视频，不必一件做完再开始下一件。互不依赖的任务交给 agent 同时推进；你在卡片上看关键草稿、做决定，把注意力留给下一件值得做的事。",
      "任务拆解、优先级、进度跟进和通知，由 AI4Kanban 安排，你不用在多个对话之间来回协调。",
    ],
    shots: {
      board: { label: "Board", alt: "AI4Kanban 本地看板界面：Board 视图" },
      card: { label: "Card", alt: "AI4Kanban 本地看板界面：卡片详情与需求" },
      frontAria: "{view} 视图（当前）",
      flipAria: "切换到 {view} 视图",
    },
  },

  tools: {
    title: "继续用你熟悉的 AI 工具。",
    body: "连接 Claude Code、Codex 等工具，在你的电脑上运行，使用自己的订阅。支持 8 种工具，每个 agent 可单独选择工具和模型；AI4Kanban 不额外收取 token 费用。",
  },

  start: {
    title: "写下一个想法，先看看草稿。",
    lead: "打开项目，写下你想做的事。从第一份关键草稿开始，定好方向，把后续工作交给 agent。",
    cta: "下载",
    firstOpen:
      "当前构建未签名，macOS 会拦截首次打开：先把应用从 `.dmg` 拖入，再在警告中点击继续。下载页提供 macOS、Windows 和 Linux 的完整步骤。",
    command: "偏好命令行？在项目里运行 `npx ai4kanban@latest install`。",
  },
};

export default zh;
