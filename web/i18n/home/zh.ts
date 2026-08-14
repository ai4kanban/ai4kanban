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
    ctaDownload: "下载看板应用",
    ctaGithub: "查看 GitHub ↗",
    shots: {
      board: { label: "Board", alt: "AI4Kanban 本地看板界面：Board 视图" },
      queue: { label: "Queue", alt: "AI4Kanban 本地看板界面：Queue 视图" },
      frontAria: "{view} 视图（当前）",
      flipAria: "切换到 {view} 视图",
    },
  },

  compare: {
    title: "从记录任务到自主规划",
    lead: "传统看板只能记录和跟踪任务，输入全靠人工。AI4Kanban 能够结合项目远景目标和过往的决策记忆，自主规划任务并推进执行。",
    columns: { classic: "传统看板", kanban: "AI4Kanban" },
    rows: [
      {
        dimension: "输入",
        classic: "人工撰写的详细任务",
        kanban: "远景目标，模糊需求",
      },
      {
        dimension: "主要作用",
        classic: "记录和跟踪任务",
        kanban: "自主规划并推进任务",
      },
      {
        dimension: "你的职责",
        classic: "手动看板维护",
        kanban: "只需决策与验收",
      },
    ],
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
    context: ["决策记忆", "需求任务", "项目模块", "运行记录"],
    otherAgents: "其他 Agent",
    storage: "项目数据",
    outputsLabel: "迭代结果",
    outputs: ["产品改进", "版本迭代"],
  },

  start: {
    title: "从看板应用开始",
    lead: "下载、打开、指向一个项目即可。无需预先安装任何东西 —— 不需要 Node，不需要 npx，也不需要终端。它会先问三件只有你能回答的事，一屏一个；然后读取代码库，建立项目目标与模块记忆，并创建首批任务。",
    notes: ["自主规划", "本地优先", "不绑定 Agent"],
    cta: "下载应用",
    firstOpen:
      "安装包还没有签名，所以 macOS 会拦下第一次打开：从 `.dmg` 里把应用拖进“应用程序”，再点过那条“无法验证”的警告即可。下载页有每一步，也有 Windows 和 Linux 的说明。",
    terminal: {
      title: "或者在终端里装",
      body: "在项目根目录下敲一条命令。它只建出 `docs/kanban/` 这块看板，别的什么都不写。",
      promptNote:
        "更想让编码 Agent 全程代劳？把安装提示词交给它：它会读仓库、定下 track、跑这条命令，并把剩下的设置一路做完。",
      promptLink: "查看安装提示词",
    },
  },
};

export default zh;
