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
    title: "少些盯进度，多些交付。",
    lead: "把规划、跟进和协调交出去，把注意力留给产品该做成什么样。",
    steps: [
      {
        title: "模糊想法进，详细计划出。",
        body: "说出你想做什么。AI4Kanban 读取代码和项目记忆，补全需求，拆出任务并排好顺序，给你一份 Agent 可以直接执行的计划。",
      },
      {
        title: "开工前，做几道选择题。",
        body: "需要你判断的问题，都附上选项和推荐方案。在开始写代码前选定方向，趁修改成本还低，把关键取舍定下来。",
      },
      {
        title: "多项工作，同时推进。",
        body: "互不依赖的任务交给多个 Agent 并行执行，不必等一项做完才开始下一项。AI4Kanban 处理依赖、协调任务，省去你来回调度的时间。",
      },
      {
        title: "用你的方式，分析需求。",
        body: "想先比较技术方案，或试用一个可运行的界面原型？使用内置的规格 Agent，也可以添加自己的 Agent，让它们按你的方法把需求想清楚。",
      },
      {
        title: "细节交给 Agent，你来拍板。",
        body: "大部分细节由 Agent 根据代码和过往决策自行确定。任务在后台持续推进，产品取舍和交付审批通过应用或 Slack 交给你确认。",
      },
    ],
  },

  memory: {
    title: "越用越懂你",
    lead: "你的偏好、做过的选择、否决过的方向，都会成为下一次规划的依据。随着项目记忆积累，Agent 越来越了解你，你也不用反复解释。",
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
    title: "让反馈变成产品改进",
    lead: "用户反馈、竞品调研、行业讨论，都可以成为下一步改进的起点。AI4Kanban 结合你的产品目标，把这些信息转化为具体任务，交给 Agent 推进。",
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
