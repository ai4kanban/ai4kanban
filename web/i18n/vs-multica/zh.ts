import type { VsMulticaCopy } from "./types";

const zh: VsMulticaCopy = {
  meta: {
    title: "AI4Kanban vs. Multica——决定做什么，还是调度智能体团队",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "从任务发现、需求澄清、决策记忆、智能体执行、团队协作、基础设施和许可证等维度比较 AI4Kanban 与 Multica。",
    social:
      "两者都把编码智能体放上看板。AI4Kanban 决定哪些工作应该存在；Multica 决定由哪个智能体执行。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nMultica",
    lead: "两款产品都把编码智能体放上看板。真正的分界在于**智能体何时介入**：AI4Kanban 在上游判断并完善任务；Multica 接手已经存在的 Issue，负责执行运营。",
    ours: {
      name: "AI4Kanban",
      body: "位于仓库内的规划循环。智能体主动提出工作、完善模糊想法、排列看板，并记住此前的决策。",
    },
    theirs: {
      name: "Multica",
      body: "面向人类与智能体团队的项目运营系统。分配 Issue 后，由它排队、调度、观察、重试并完成评审。",
    },
    oursDiagramAlt: "AI4Kanban 读取项目，把尚未成形的想法变成就绪卡片。",
    theirsDiagramAlt: "Multica 接收就绪的 Issue，并把它调度给智能体运行时。",
    oursDiagramTop: "读取项目 · 发现工作",
    oursDiagramBottom: "模糊想法 → 就绪卡片",
    theirsDiagramTop: "就绪 Issue + 负责人",
    theirsDiagramBottom: "调度 · 执行 · 评审",
  },
  boundary: {
    heading: { eyebrow: "分界线", title: "同一块看板，就绪状态的两侧。" },
    lead: "看板只是表层。AI4Kanban 聚焦**任务就绪之前**的决策；Multica 聚焦**任务就绪之后**的执行机制。两款产品可以在交接点相连，但不是同一个系统。",
    stages: {
      discover: "发现",
      refine: "澄清",
      prioritize: "排序",
      assign: "分配",
      run: "执行",
      review: "评审",
    },
    oursLabel: "AI4Kanban · 决定工作",
    theirsLabel: "Multica · 运营工作",
    handoffLabel: "就绪",
    principle:
      "**Multica 决定由哪个智能体执行任务。AI4Kanban 决定哪些任务应该存在。**这是回答“它们不就是同一个想法吗？”最简洁也最有用的一句话。",
  },
  backlog: {
    heading: { eyebrow: "待办池测试", title: "进入 Todo 之前会发生什么？" },
    lead: "Multica 自己的任务模型把分界说得很具体：处于 **Backlog 的 Issue 不会触发智能体**。在有人确认这项工作真实存在并将其向前移动之前，它只是停车场。对 AI4Kanban 而言，未就绪的看板恰恰是智能体开展规划的地方。",
    ours: {
      label: "Backlog 处于活动状态",
      title: "智能体完善卡片",
      body: "智能体先阅读代码和模块记忆，再判断请求是否应成为工作。",
      steps: [
        "主动提出或记录一个不完整的想法",
        "补齐上下文并暴露真正需要决策的问题",
        "按价值与依赖关系排列可构建卡片",
      ],
      state: "智能体已唤醒",
    },
    theirs: {
      label: "Backlog 处于停放状态",
      title: "智能体等待 Todo",
      body: "由人填写 Issue 描述和验收标准；只有工作获准进入后，分配才会启动执行。",
      steps: [
        "由人编写或确认 Issue",
        "由人将 Backlog → Todo",
        "守护进程排队并调度负责人",
      ],
      state: "智能体休眠中",
    },
    note: "Multica 确实提供 quick-create，但它只是一次性的转录器：把自由文本整理为 Issue 后立即退出。它不会检查代码库、提出问题，也不会记录假设。",
  },
  comparison: {
    heading: { eyebrow: "正面对比", title: "比较已交付产品，而不是宣传标题" },
    lead: "{check} 表示该维度下更明确的选择；**短横线**表示架构取舍。本页充分承认 Multica 已经交付的运营平台，同时把它与未来愿景分开。",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "产品从哪里开始",
        kanban: "从任务之前开始：检查项目、主动提出工作，并判断什么应该进入看板。",
        multica: "从任务存在之后开始：接收 Issue、负责人、优先级和执行说明。",
      },
      backlog: {
        dimension: "Backlog 行为",
        kanban: "智能体主动完善未就绪卡片，也能提出无人要求的新工作。",
        multica: "一个停车场。Backlog 中的 Issue 不会唤醒已分配的智能体。",
      },
      refinement: {
        dimension: "从模糊想法到方案",
        kanban:
          "循环澄清会读取代码和记忆、明确标出假设，并只询问仍未解决的产品问题。",
        multica:
          "描述是自由文本；系统要求人提供文件、约束、预期结果和验收标准。",
      },
      memory: {
        dimension: "什么会持续积累",
        kanban: "项目决策、改版教训、已交付工作和否决原因共同影响下一次提案。",
        multica: "可复用 Skills 保存工作方法；Issue 活动和运行历史保存执行过程。",
      },
      execution: {
        dimension: "运行运营",
        kanban:
          "把实现交给所选编码工具；本身不提供重试、重放、Token 成本或智能体团队层。",
        multica:
          "提供排队、调度、流式输出、计量、重试、重放、评审门禁，以及 PR 和 CI 关联。",
      },
      teams: {
        dimension: "人类与智能体团队",
        kanban: "本地优先，适合个人开发者或通过 git 协作的小团队。",
        multica: "多人工作区、角色、Squad、收件箱、评论、权限和通知。",
      },
      storage: {
        dimension: "存储与基础设施",
        kanban: "仓库内的 Markdown；无需数据库、账户、看板服务器或 MCP。",
        multica:
          "PostgreSQL + pgvector、Go 服务、本地守护进程、OAuth，以及托管或自托管部署。",
      },
      license: {
        dimension: "许可证",
        kanban: "Apache License 2.0，允许商业使用、托管和嵌入。",
        multica:
          "采用源码可见的 Multica License，对托管服务和商业嵌入设有限制。",
      },
    },
  },
  memory: {
    heading: { eyebrow: "两种记忆", title: "如何做，与为何这样决定" },
    lead: "两个系统都会积累知识，但方向不同。Multica Skills 教智能体**如何完成某类工作**；AI4Kanban 的模块记忆记录**这个项目做过哪些决定、排除了什么**。",
    ours: {
      eyebrow: "项目判断",
      title: "AI4Kanban 记住否决",
      body: "智能体在提出或澄清工作之前会读取精简的仓库文件。目的不是保留完整对话，而是避免下一次规划重复旧错误。",
      examples: ["rejected.md", "redesign.md", "memory.md"],
      question: "为什么看板不再提出想法 X？",
      answer:
        "`rejected.md` 保存想法及其否决理由，除非新证据改变决策，否则它不会再次出现。",
    },
    theirs: {
      eyebrow: "工作方法",
      title: "Multica 记住操作手册",
      body: "Skills 是手写或导入的 `SKILL.md` 文件包，可在智能体间共享。Issue 评论和执行历史说明某次运行发生了什么，但已完成工作不会自动变成决策记忆。",
      examples: ["SKILL.md", "评论", "运行历史"],
      question: "这个智能体应该如何执行安全评审？",
      answer: "挂载一个可复用 Skill，其中包含这类工作的流程、文件和指令。",
    },
    note: "区别在于流程与判断。操作手册可以改善执行；否决记录则能阻止错误工作再次被提出。",
  },
  horizon: {
    heading: { eyebrow: "愿景与现状", title: "重叠正在扩大" },
    lead: "Multica 的 `VISION.md` 已经向上游延伸。它描述的智能体会结构化意图、收集上下文、显式表达不确定性，并让决策与结果保持关联。这比 Multica 当前产品更接近 AI4Kanban 已经在实践的主张。",
    shippedLabel: "当前已交付",
    visionLabel: "已声明方向",
    shippedTitle: "执行一个 Issue",
    shippedBody:
      "Backlog 保持等待。守护进程让负责人读取 Issue 并完成任务。澄清发生在代码产生之后，通过评审与修改完成。",
    visionTitle: "完善工作意图",
    visionBody:
      "未来的智能体将把意图转化为结构化工作，并区分已知事实与仍需决定的问题。",
    marker: "关注这段距离",
    note: "这是实际的竞争威胁，但不能因此把尚未交付的能力算作现有功能。诚实的比较应以已交付对已交付，同时明确指出它公开声明的方向。",
  },
  wins: {
    heading: { eyebrow: "取舍", title: "各自明显领先的地方" },
    lead: "这不是功能数量比赛。AI4Kanban 有意保持更小，并更早介入工作生命周期；任务进入执行后，Multica 的覆盖面明显更广。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Multica",
    ours: {
      upstream: {
        title: "智能体参与决定做什么",
        body: "它从项目上下文主动提出工作，把粗略请求变成可构建卡片，并在执行前按价值和依赖关系排序。",
      },
      rejectionMemory: {
        title: "被否决的想法保持否决",
        body: "决策与改版记忆会影响后续规划，因此智能体不会反复推销项目已经排除的方向。",
      },
      repoNative: {
        title: "整个规划层都装在 git 里",
        body: "卡片和记忆都是代码旁可读、可 diff 的文件，无需运营看板服务，并采用纯 Apache-2.0 条款。",
      },
    },
    theirs: {
      operations: {
        title: "成熟的执行控制平面",
        body: "运行重放、重试、评审门禁、PR 与 CI 关联、Token 计量、Webhook、附件和多种运营视图都已交付。",
      },
      teams: {
        title: "为多人协作而生",
        body: "工作区、角色、Squad、串联讨论、通知、权限和持久智能体身份，可支撑真正的人类与智能体组织。",
      },
      runtimeReach: {
        title: "更广泛的运行时支持",
        body: "Multica 支持约二十种智能体 CLI，并通过本地守护进程和云运行时连接。AI4Kanban 目前接入 Claude Code 和 Codex。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "结论", title: "应该选择哪一个？" },
    oursHeading: "选择 AI4Kanban，如果",
    theirsHeading: "选择 Multica，如果",
    ours: [
      "瓶颈是判断和完善正确的工作，而不是调度执行。",
      "希望智能体从代码与项目记忆中主动提出任务。",
      "希望否决原因和设计决策影响后续规划。",
      "偏好无需看板基础设施的小型仓库原生系统。",
      "纯 Apache-2.0 条款对你构建的产品很重要。",
    ],
    theirs: [
      "任务已经存在，瓶颈是如何可靠地执行。",
      "多个人和具名智能体需要同一个共享运营工作区。",
      "需要重试、重放、成本计量、PR 与 CI 关联或评审门禁。",
      "需要广泛的智能体运行时、Squad、聊天、Webhook 和移动端。",
      "愿意运营或购买基于服务器的平台。",
    ],
    verdict:
      "选择 AI4Kanban，在工作就绪前**决定并完善要做的事**。选择 Multica，在工作就绪后**分配并运营执行**。如果两者都需要，交接点很清楚：让 AI4Kanban 产出获批卡片，再为执行创建 Multica Issue。",
    note: "两者可以互补，但不要为同一个任务状态维护两个实时事实源。应选择明确的交接点。",
  },
};

export default zh;
