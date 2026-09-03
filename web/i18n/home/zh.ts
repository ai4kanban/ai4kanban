// 简体中文 — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const zh: HomeCopy = {
  meta: {
    title: "面向编码 Agent 的 AI 项目经理 | AI4Kanban",
    description:
      "AI4Kanban 把模糊想法变成可执行的计划，调度编码 Agent 完成任务，只把需要人来判断的产品决策交回给你。",
    schema:
      "AI4Kanban 是一个开源、本地优先、面向编码 Agent 的 AI 项目经理。它把模糊的产品想法拆解成带依赖关系的任务，在后台协调执行，保留项目中的产品决策，只在需要人的判断或最终验收时才打断开发者。",
  },

  hero: {
    eyebrow: "面向编码 Agent 的 AI 项目经理",
    title: "把模糊的想法变成上线的软件——不用盯着 Agent。",
    lead: "AI4Kanban 规划工作，交给你的编码 Agent 执行，只在需要产品决策和验收时找你。",
    ctaDownload: "下载",
    ctaGithub: "查看 GitHub ↗",
    flow: [
      "你的一句模糊想法",
      "一份按依赖排好的计划",
      "只有你能拍板的那一个决定",
      "Agent 在后台继续跑",
    ],
    flowAlt:
      "一句模糊的想法被拆成按依赖排序的计划，其中一个产品决策交回给人回答，其余工作由编码 Agent 在后台完成。",
  },

  why: {
    title: "编码变快了，产品决策成了瓶颈。",
    body: "需求清晰时，Agent 能稳定交付；需求含糊时，换来的是方向漂移、返工，以及一堆没人有时间看完的 Agent 对话。AI4Kanban 位于编码 Agent 之上：动手之前先把要做什么定下来，只把必须由人决定的部分交回给你。",
  },

  steps: {
    title: "从一句模糊想法到一次合入",
    items: [
      {
        title: "从一句模糊的想法开始",
        body: "用一句话说明你想要的结果。AI4Kanban 会读取代码库，把目标拆成边界清晰的任务，并按依赖关系排序，让互不相关的工作可以并行推进。",
      },
      {
        title: "只把该你定的交给你",
        body: "常规细节由代码库和项目记忆自行回答；涉及品味、商业方向、风险和成本的取舍，会以一个带推荐答案的简短问题交回给你。你的每一次回答都会写入项目记忆，下一次规划要问你的就更少。",
      },
      {
        title: "让 Agent 自己跑起来",
        body: "已就绪的任务在后台执行，每项交付都在独立的 Git worktree 中进行；合入前如有冲突，会先走一轮解冲突。只有交付等待验收时，你才会收到通知。",
      },
    ],
  },

  trust: {
    title: "记住你的项目，也留在你的仓库里",
    lead: "产品决策、未采纳的方向和设计经验不会随对话结束而消失，项目越往后走，Agent 越自主，需要你审阅的部分越少。",
    items: [
      {
        title: "Apache-2.0",
        body: "开源。可自由使用、修改和再分发。",
      },
      {
        title: "本地优先",
        body: "看板和项目记忆都是 `docs/kanban/` 下的 Markdown 文件，用 Git 管理版本。",
      },
      {
        title: "你选的编码 Agent",
        body: "支持 Claude Code、Codex、Cursor、OpenCode、Kimi Code、DeepSeek Harness 和 ZCode。",
      },
    ],
  },

  start: {
    title: "从桌面应用开始",
    lead: "下载应用，打开一个项目，回答三个问题。它会读取代码库，写下项目目标和模块记忆，并提出第一批任务。",
    cta: "下载",
    firstOpen:
      "当前构建未签名，macOS 会拦截首次打开：先把应用从 `.dmg` 拖入，再在警告中点击继续。下载页提供 macOS、Windows 和 Linux 的完整步骤。",
    command:
      "应用自带 `akb` 命令行，并在你打开项目时自动添加编码 Agent 的技能。两者都不需要单独安装。",
  },
};

export default zh;
