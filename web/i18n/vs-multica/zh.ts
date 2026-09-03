import type { VsMulticaCopy } from "./types";

const zh: VsMulticaCopy = {
  meta: {
    title: "AI4Kanban vs. Multica：AI 项目管理，还是多智能体平台",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "AI4Kanban 是开箱即用的 AI 项目管理方案；Multica 是用于搭建和运营多个智能体的通用工作平台。",
    social:
      "两者都能让智能体执行任务，但服务的场景不同：一个管项目，一个搭建智能体团队。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nMultica",
    lead: "两者都能让智能体执行任务。**AI4Kanban 是一套开箱即用的 AI 项目管理方案；Multica 是一个通用的多智能体工作平台。**",
    ours: {
      name: "AI4Kanban",
      body: "人提供方向、想法和关键判断；智能体负责发现任务、澄清需求、安排优先级、执行工作，并把项目经验写回记忆。",
    },
    theirs: {
      name: "Multica",
      body: "你创建多个智能体，为它们配置职责、Skills 和运行环境，再统一管理分工、执行、重试、评审和团队协作。",
    },
    oursDiagramAlt: "你说想做什么，看板自己规划并推进；没有需要你创建、命名或调度的智能体。",
    theirsDiagramAlt:
      "Multica 给的是平台不是团队：每个智能体都要你自己创建，跑完之后的分派、监控和重试也都回到你手上。",
    oursDiagramTop: "你说想要做什么",
    oursDiagramBottom: "看板自己规划、自己推进 — 不用配置智能体",
    theirsDiagramTop: "每个智能体都要你自己创建",
    theirsDiagramBottom: "之后的分派、盯进度、重试也都归你",
  },
  boundary: {
    heading: { eyebrow: "定位", title: "两种产品，解决两种问题" },
    lead: "AI4Kanban 帮助人和 AI 一起管理项目。Multica 帮助团队创建、组织和运行多个智能体。",
    stages: {
      discover: "人给方向",
      refine: "智能体澄清",
      prioritize: "共同推进",
      assign: "创建智能体",
      run: "配置团队",
      review: "运营任务",
    },
    oursLabel: "AI4Kanban",
    theirsLabel: "Multica",
    oursJob: "把项目管起来",
    theirsJob: "把智能体跑起来",
  },
  backlog: {
    heading: { eyebrow: "默认能力", title: "两边各自带了什么？" },
    lead: "两者装好都能直接用，但完整的东西不一样：AI4Kanban 自带项目管理，Multica 自带运行智能体的一整套设施。",
    ours: {
      label: "AI4Kanban",
      title: "项目管理，装好就能跑",
      items: [
        "一套人和 AI 共用的工作方式",
        "一块管完卡片全生命周期的看板",
        "存在仓库里的项目记忆",
      ],
    },
    theirs: {
      label: "Multica",
      title: "智能体设施，装好就能跑",
      items: [
        "智能体身份、Instructions 和 Skills",
        "Squad、聊天和任务队列",
        "自动化、重试和运行历史",
      ],
    },
  },
  comparison: {
    heading: { eyebrow: "关键对比", title: "先看这五项" },
    lead: "{check} 表示更适合该场景；**短横线**表示各有取舍。",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "产品定位",
        kanban: "面向人和 AI 协作的项目管理方案，自带完整工作流程。",
        multica: "面向多智能体团队的通用工作平台，角色和流程由用户定义。",
      },
      backlog: {
        dimension: "主动管理项目",
        kanban: "智能体会读取项目和记忆，主动提出、完善和安排任务。",
        multica: "可以通过 Agent、Skill 和 Autopilot 实现，但需要自行配置。",
      },
      refinement: {
        dimension: "需求澄清",
        kanban: "结合代码和项目记录补齐背景，只把需要取舍的问题交给人。",
        multica: "没有现成的项目澄清流程，需要写进 Agent Instructions 或 Skill。",
      },
      memory: {
        dimension: "长期记忆",
        kanban: "保存项目决策、否决原因和改版经验，供下次规划直接使用。",
        multica: "Skills 保存做事方法，评论和运行历史保存执行过程。",
      },
      execution: {
        dimension: "执行管理",
        kanban: "可以启动 Claude Code、Codex、Cursor、OpenCode、DeepSeek Harness、ZCode 或 Grok Build 执行卡片，并管理任务从提出到归档的完整状态。",
        multica: "可以并行运行多个智能体，并提供排队、重试、重放、成本统计、评审门禁，以及 PR 和 CI 关联。",
      },
      teams: {
        dimension: "团队协作",
        kanban: "本地优先，适合个人开发者和通过 git 协作的小团队。",
        multica: "提供多人工作区、角色、Squad、评论、权限和通知。",
      },
      storage: {
        dimension: "部署与存储",
        kanban: "卡片和记忆都在仓库内，无需数据库、账户或看板服务器。",
        multica: "使用 PostgreSQL、服务端和本地守护进程，可选择托管或自行部署。",
      },
      license: {
        dimension: "许可证",
        kanban: "Apache-2.0，允许商业使用、托管和嵌入。",
        multica: "源码可见；托管服务和商业嵌入受 Multica License 限制。",
      },
    },
  },
  memory: {
    heading: { eyebrow: "长期记忆", title: "两边记住的东西不同" },
    lead: "两边都会在多次运行之间留下记录，但记的东西不一样。",
    ours: {
      eyebrow: "项目判断",
      title: "为什么这样决定",
      examples: ["decisions.md", "rejected.md", "redesign.md"],
      question: "为什么不再提出想法 X？",
      answer: "`rejected.md` 保存了否决原因；没有新证据时，这个想法不会再次出现。",
    },
    theirs: {
      eyebrow: "工作方法",
      title: "智能体该怎么做",
      examples: ["Instructions", "SKILL.md", "运行历史"],
      question: "智能体应该怎样做安全评审？",
      answer: "挂载一个包含步骤、文件和要求的 Skill。",
    },
    note: "",
  },
  horizon: {
    heading: { eyebrow: "自行搭建", title: "用 Multica 做同类项目管理，还缺什么？" },
    lead: "用 Multica 也能搭一个项目经理智能体。创建 Agent 是快的那一步；真正要你回答的是下面四个问题，而且项目一变就得重新回答。",
    visionLabel: "仍需自己搭",
    visionTitle: "项目管理的做事方式",
    items: [
      "怎样理解项目目标",
      "怎样找出值得做的事",
      "怎样把含糊的需求问清楚",
      "两次运行之间记住什么",
    ],
    note: "",
  },
  wins: {
    heading: { eyebrow: "各自强项", title: "按你的问题来选" },
    lead: "AI4Kanban 胜在具体、完整、开箱即用；Multica 胜在通用、灵活，适合运营多个智能体。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Multica",
    ours: {
      upstream: {
        title: "项目管理开箱即用",
        body: "不用先设计项目经理 Agent。安装后，人和智能体就能按同一套方法规划、澄清和执行。",
      },
      rejectionMemory: {
        title: "不会反复提出已否决的方向",
        body: "过去的决定会影响下一轮规划，减少重复讨论。",
      },
      repoNative: {
        title: "所有内容都在 git 里",
        body: "卡片和记忆可读、可 diff，不需要额外运行看板服务。",
      },
    },
    theirs: {
      operations: {
        title: "完整的执行控制",
        body: "排队、重试、重放、评审、成本统计，以及 PR 和 CI 关联都已提供。",
      },
      teams: {
        title: "适合多人和多个智能体协作",
        body: "工作区、角色、Squad、评论、权限和通知集中在同一平台。",
      },
      runtimeReach: {
        title: "支持更多智能体运行环境",
        body: "可通过本地守护进程连接多种智能体 CLI；AI4Kanban 目前支持 Claude Code、Codex、Cursor、OpenCode、DeepSeek Harness、ZCode 和 Grok Build。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "选择建议", title: "直接怎么选？" },
    oursHeading: "选择 AI4Kanban，如果你",
    theirsHeading: "选择 Multica，如果你",
    ours: [
      "想直接使用一套人和 AI 协作的项目管理方法。",
      "需要智能体参与规划、澄清和执行整个任务生命周期。",
      "希望项目决策和否决原因影响后续规划。",
      "偏好仓库原生、无需额外服务的轻量方案。",
    ],
    theirs: [
      "需要创建和运营多个职责不同的智能体。",
      "需要多人、多智能体共享工作区、Issue 和运行记录。",
      "需要重试、重放、成本统计、PR 或 CI 集成。",
      "愿意自己定义项目管理 Agent、Skills 和工作流程。",
    ],
    verdict:
      "想要一套**现成的 AI 项目管理方案**，选 AI4Kanban。想要一个**搭建和运营多智能体团队的通用平台**，选 Multica。两者都支持智能体执行任务，分别适合项目管理和多智能体运营。",
    note: "",
  },
};

export default zh;
