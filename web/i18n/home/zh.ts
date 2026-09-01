// 简体中文 — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const zh: HomeCopy = {
  meta: {
    title: "AI4Kanban — 自主规划、随决策成长的项目看板",
    description:
      "一个由 Agent 主导的项目看板。它从项目目标出发，持续明确任务、澄清需求、安排顺序并推进执行，用项目记忆保留每一次产品决策。",
  },

  hero: {
    title: "一块由 Agent 自主规划的项目看板。",
    lead: "它结合项目目标、代码和记忆，管理任务从规划到完成的全过程；你只做产品取舍与最终验收。",
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
        title: "明确任务",
        body: "结合目标、代码和模块记忆，判断接下来该做什么。",
      },
      {
        title: "澄清需求",
        body: "能从代码和记忆中确认的问题，Agent 自己处理；只把必须由你决定的产品取舍交给你。",
      },
      {
        title: "推进执行",
        body: "需求明确到可以开工后，Agent 按任务中写明的范围和步骤推进。",
      },
      {
        title: "记录决策",
        body: "把产品决策写回项目记忆，供下一次规划和开发继续使用。",
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
    lead: "下载应用，打开后选择项目。应用会逐屏询问三个问题，然后读取代码库，建立项目目标和模块记忆，并创建首批任务。",
    notes: ["自主规划", "本地优先", "不绑定 Agent"],
    cta: "下载",
    firstOpen:
      "安装包没有签名，macOS 会拦截首次打开：从 `.dmg` 中拖入应用，再确认警告即可。下载页提供 macOS、Windows 和 Linux 的完整步骤。",
    command:
      "应用内置 `akb` CLI，并在打开项目时写入编码 Agent 所需的 skill。两者都不用单独安装。",
  },
};

export default zh;
