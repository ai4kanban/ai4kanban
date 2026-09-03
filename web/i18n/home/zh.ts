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
    title: "让编码 Agent 自己交付，不用你全程盯着。",
    lead: "AI4Kanban 把模糊想法变成可开工的任务，交给你的 Agent 执行，只在需要产品决策时找你。",
    ctaDownload: "下载",
    ctaGithub: "查看 GitHub ↗",
    shots: {
      board: { label: "Board", alt: "AI4Kanban 本地看板界面：Board 视图" },
      card: { label: "Card", alt: "AI4Kanban 本地看板界面：卡片详情与需求" },
      frontAria: "{view} 视图（当前）",
      flipAria: "切换到 {view} 视图",
    },
  },

  loop: {
    title: "持续推进",
    lead: "给出一个目标或模糊想法，Agent 会读取代码与项目记忆，明确接下来要做什么，逐步澄清需求、拆分任务、安排依赖和优先级，再推进执行。",
    steps: [
      {
        title: "明确任务与依赖",
        body: "Agent 能够将大目标拆解成边界清晰的卡片，自动决定哪些任务可以并行、哪些必须等待，让每个任务都能在独立的上下文中完成。",
      },
      {
        title: "澄清需求",
        body: "Agent 能够将模糊需求补全为可落地的计划。大部分问题会根据项目记忆和代码库自行回答；只有涉及品味、商业方向、风险和成本的取舍，才交由你决策。",
      },
      {
        title: "推进执行",
        body: "你可以并行调度多个 Agent 完成已就绪的任务。每项交付都在独立的 Git worktree 中进行，确保变更隔离；合入前如有冲突，会触发独立的解冲突流程。",
      },
      {
        title: "在实施前完成关键决策",
        body: "支持自定义 Spec Skills，也内置技术选型技能和 UI 设计技能：前者帮助比较技术方案，后者提供多套可运行的界面方案供你选择。",
      },
      {
        title: "仅在必要时请求审批",
        body: "AI4Kanban 会在后台持续推进任务，只在需要产品取舍或确认交付时向你汇报。它像一位项目经理，始终尽量少占用你的注意力。",
      },
    ],
  },

  memory: {
    title: "越用越懂",
    lead: "聊天会结束，产品决策会留下。AI4Kanban 保存项目目标，并按模块记录已完成的功能、产品决策、否决理由和设计教训，在规划新任务和澄清需求时重新使用。",
    cards: [
      {
        title: "不用反复说明",
        body: "已经明确的偏好与约束，直接用于下一次任务规划。",
      },
      {
        title: "不再重复踩坑",
        body: "已否决的方向和已发现的设计问题不会被重复建议。",
      },
      {
        title: "从当前进度继续",
        body: "规划新任务时，先读取已经完成的功能和当前代码。",
      },
    ],
    tree: {
      goal: "项目目标",
      module: "每个模块一份",
      readme: "已完成的功能",
      decisions: "产品决策",
      rejected: "否决理由",
      redesign: "设计教训",
    },
  },

  iterate: {
    title: "持续驱动产品迭代",
    lead: "把外部信息转化为需求，持续推进产品和版本迭代。",
    inputsLabel: "外部输入",
    inputs: ["用户反馈", "竞品调研", "行业报告", "Reddit 讨论"],
    internalLabel: "内部输入",
    internal: ["产品路线图"],
    board: {
      columns: ["可以开工", "尚未就绪"],
      ready: "就绪",
    },
    storage: "项目数据",
    outputsLabel: "迭代结果",
    outputs: ["产品改进", "版本迭代"],
  },

  start: {
    title: "从桌面应用开始",
    lead: "下载应用，打开一个项目，回答三个问题。它会读取代码库，写下项目目标和模块记忆，并提出第一批任务。",
    notes: ["自主规划", "本地优先", "不绑定 Agent"],
    cta: "下载",
    firstOpen:
      "当前构建未签名，macOS 会拦截首次打开：先把应用从 `.dmg` 拖入，再在警告中点击继续。下载页提供 macOS、Windows 和 Linux 的完整步骤。",
    command:
      "应用自带 `akb` 命令行，并在你打开项目时自动添加编码 Agent 的技能。两者都不需要单独安装。",
  },
};

export default zh;
