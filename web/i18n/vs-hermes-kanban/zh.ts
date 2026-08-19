// 简体中文 — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const zh: VsHermesCopy = {
  meta: {
    title:
      "AI4Kanban vs. Hermes Agent Kanban — 项目规划层与智能体运行队列",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description:
      "简明比较 AI4Kanban 与 Hermes Agent Kanban：前者把可评审的规划留在代码仓库，后者在 Hermes 运行时中提供可恢复的多智能体任务队列。",
    social:
      "规划属于项目，还是属于运行时？快速了解 AI4Kanban 与 Hermes Agent Kanban 的核心差异。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "关键不在谁的功能更多，而在看板属于哪里：AI4Kanban 把规划留在代码仓库；Hermes Agent Kanban 把任务队列纳入 Hermes 运行时。",
    ours: {
      name: "AI4Kanban",
      body: "用 Markdown 保存任务与方案，随代码评审和迁移，不绑定执行它们的智能体。",
    },
    theirs: {
      name: "Hermes Agent Kanban",
      body: "用持久队列连接看板、调度器与具名智能体，统一处理分派和恢复。",
    },
    oursDiagramAlt:
      "Markdown 看板构成项目层，其上的智能体运行时负责执行与维护，并可随时替换。",
    theirsDiagramAlt:
      "单一 Hermes 运行时包含 SQLite 看板、调度器与具名智能体。",
    taskLayer: "任务层 · 执行 + 维护",
    boardLayer: "看板 · Markdown 文件（git）",
  },
  summary: {
    heading: { eyebrow: "简要结论", title: "真正的区别" },
    lead: "两款产品解决的问题大体相同，但所在层级不同。AI4Kanban 是**面向现有智能体环境的便携规划系统**；Hermes Kanban 是 **Hermes 内部的运行队列**，侧重多工作进程协作与中断恢复。",
    oursHeading: "AI4Kanban — 规划归属于项目",
    theirsHeading: "Hermes Kanban — 执行归属于运行时",
    ours: [
      "任务和方案以 Markdown 存放在仓库中，每次修改都能纳入评审和版本管理。",
      "看板自身无需数据库、网关或后台服务。",
      "Claude Code、Codex、Cursor、Hermes 或其他能够读写文件的智能体都可以执行任务。",
    ],
    theirs: [
      "~/.hermes/kanban.db 中的持久化 SQLite 队列由具名智能体与人共同使用。",
      "调度器分派就绪任务，并在运行中断后恢复工作。",
      "看板与 Hermes / Nous 技术栈及其 kanban_* 工具深度集成。",
    ],
    whenLabel: "如何选择",
    when: "如果你希望规划内容**与代码一同接受版本管理**、继续使用现有智能体环境，或不需要专门的编排服务，请选择 AI4Kanban。如果 **Hermes 已是你的主要运行环境**，并且你需要它的调度器、具名 profile、聊天端控制与恢复机制，请选择 Hermes Kanban。两者的持久化方式也不同：AI4Kanban 依靠文件与 git，Hermes 则把队列状态存入 SQLite。",
  },
  harness: {
    heading: { eyebrow: "兼容性", title: "谁能直接使用这块看板？" },
    lead: "AI4Kanban 使用普通项目文件，任何能读写仓库的智能体都能接入；Hermes Kanban 是 Hermes 运行时的一部分。",
    oursSub: "任何能读文件的智能体",
    theirsSub: "Hermes 运行时",
    supported: "支持",
    notSupported: "不支持",
    note: "图中仅列常见工具；其他能读写项目文件的智能体同样可以使用 AI4Kanban。",
  },
  comparison: {
    heading: { eyebrow: "核心差异", title: "四个问题，决定怎么选" },
    lead: "前两项关系到规划是否便携，后两项关系到执行是否需要运行时接管。",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      whatItIs: {
        dimension: "它是什么",
        kanban: "一层文件式看板，看板就是你仓库里的纯 Markdown。",
        hermes: "Hermes 智能体运行时的一个看板功能，一块持久化的 SQLite 看板。",
      },
      infrastructure: {
        dimension: "谁负责运行看板",
        kanban: "无需单独的看板服务；现有智能体直接读写仓库中的 Markdown。",
        hermes: "由 Hermes 运行时、网关、SQLite 数据库和调度器共同驱动。",
      },
      whereBoardLives: {
        dimension: "规划放在哪里",
        kanban:
          "任务与方案保存在代码仓库中，通过 git 版本管理，也能直接评审 diff。",
        hermes:
          "队列状态保存在 ~/.hermes/kanban.db，通过事件日志追踪，不随代码一起评审。",
      },
      setup: {
        dimension: "上手成本",
        kanban: "一句提示词：一个技能文件加一个脚本。",
        hermes: "安装 Hermes 运行时、配置 profile、把网关跑起来。",
      },
      parallelRuns: {
        dimension: "并行与定时运行",
        kanban:
          "由你的运行环境驱动：你一发起，Claude Code 便并行拉起子智能体；定时的工作放在 recurring/ 目录里。",
        hermes:
          "由运行时驱动：调度器自行捡起就绪的任务，并为每个任务拉起一个工作进程。",
      },
      crashRecovery: {
        dimension: "任务中断后如何恢复",
        kanban: "任务文件仍然保留，但需要重新发起执行，或等待下一次定时运行。",
        hermes:
          "持久队列通过心跳、领取超时、回收和重试，自动接管未完成任务。",
      },
      decomposition: {
        dimension: "任务拆解",
        kanban:
          "一张卡片拆成待办项与一张任务图，分组、阻塞、关联，依赖关系在书写时就已理清。",
        hermes:
          "调度器自动运行一个 LLM 拆解器，把一个任务展开成子任务图，分派给各自的专职智能体。",
      },
      reviewMemory: {
        dimension: "审查与记忆",
        kanban:
          "记忆被精简为“为何否决”与“交付了什么”，以便智能体向前提议；它是筛选后的结论，而非完整日志。",
        hermes: "保留完整的追加式事件日志与每次尝试的运行记录，供审计使用。",
      },
      dashboard: {
        dimension: "仪表盘界面",
        kanban:
          "一个本地网页看板，卡片上的操作（实现、审查、归档）会把工作交给智能体。",
        hermes: "一个实时网页看板，支持拖拽与侧边抽屉，还能从聊天应用里控制。",
      },
      scale: {
        dimension: "谁在共享这块看板",
        kanban: "更适合围绕一个仓库协作的个人或小团队，结构简单，迁移直接。",
        hermes:
          "更适合让大量具名智能体跨多块看板协作，并从不同通信渠道统一调度。",
      },
    },
  },
  memory: {
    heading: { eyebrow: "记忆 vs. 审计", title: "两种用途不同的历史记录" },
    lead: "AI4Kanban 保留**规划上下文**，让后续建议延续既有决策；Hermes 保留**执行记录**，方便运营者检查并还原运行过程。两者都重要，但服务于不同目的。",
    ours: {
      heading: "AI4Kanban",
      verdict: "保留决策，而非每一个事件。",
      body: "四个刻意保持精简的文件记录后续工作真正需要的信息，每个模块一份：`readme.md` 记录已交付内容，`decisions.md` 记录已定下的决策及理由，`rejected.md` 记录被否决的想法及理由，`redesign.md` 记录需要避免的设计失误。`goal.md` 单独放在记忆文件夹顶层。智能体会在提出或完善任务前读取这些文件，完整变更历史则由 git 保存。",
      q: "想法 X 为什么不在看板上？",
      a: "`rejected.md` 会记录这个想法及其被否决的理由，除非出现新的依据，否则不会再次提出。",
    },
    theirs: {
      heading: "Hermes Kanban",
      verdict: "保留完整的执行轨迹。",
      body: "每一次状态变更都会写入**只追加的日志**，每次尝试也会保留退出码与工作进程输出。这些细节用于审计和崩溃恢复，而非后续产品规划。",
      q: "42 号任务昨晚发生了什么？",
      a: "`claimed → crashed → reclaimed → completed`，每次尝试都有独立日志。",
    },
    note: "经过整理的记忆指导下一次决策，审计日志解释上一次执行。两者不能相互替代。",
  },
  autonomy: {
    heading: { eyebrow: "工作方式", title: "从人工审核到无人值守" },
    lead: "AI4Kanban 在实现前保留一道审核关口；Hermes Kanban 更适合把明确的请求直接交给系统持续执行。",
    stops: {
      traditional: {
        level: "无自主",
        term: "人来驱动",
        heading: "传统看板",
        detail: "人负责提出和拆解任务，看板只记录结果。",
      },
      kanban: {
        level: "经审核的自主模式",
        term: "智能体提议，人工批准",
        heading: "AI4Kanban",
        detail: "`refine` 补齐信息、整理方案，确认后再开始实现。",
      },
      hermes: {
        level: "完全自主",
        term: "无人值守执行",
        heading: "Hermes Kanban",
        detail: "系统把简短请求拆成任务树，并交给具名智能体持续执行。",
      },
    },
    scaleLeft: "全部你来规划",
    scaleMiddle: "智能体规划，你批准",
    scaleRight: "全部智能体规划",
    worstCaseLabel: "不同自主程度的风险",
    worstCaseTheirs:
      "**无人值守执行：**早期误解可能在人工介入前扩散到整棵任务树。",
    worstCaseOurs:
      "**实现前审核：**问题会先暴露在方案中，此时还没有产生实现成本。",
    note: "没有绝对更好的自主程度。需要高频人工判断时，审核关口更稳妥；工作边界清楚、恢复机制成熟时，无人值守执行更高效。",
  },
  gui: {
    heading: { eyebrow: "界面", title: "两块看板，服务于不同环节" },
    lead: "一个用于发起和审核项目工作，一个用于观察和控制运行中的任务队列。",
    ours: {
      heading: "AI4Kanban — 本地看板",
      body: "从卡片发起*实现、审查、归档*，查看输出，并在需要判断时介入。",
      alt: "AI4Kanban 的浅色本地网页看板，包含 Blockers、UI、Skill、Docs、Distribution 各列和 Create task 按钮。",
    },
    theirs: {
      heading: "Hermes Kanban — 调度器实时视图",
      body: "查看任务状态、运行历史和退出结果，并通过通信渠道操作共享队列。",
      alt: "Hermes Agent 的看板仪表盘：深色界面，带 Triage、Todo、Scheduled、Ready 各列和一条编排工具栏。",
    },
  },
  wins: {
    heading: { eyebrow: "取舍", title: "各自赢在哪里" },
    lead: "选择取决于你的运行方式。AI4Kanban 尽量减少基础设施，并让规划内容保持可迁移；Hermes Kanban 则提供一条持久共享队列，用于协调无人值守的执行。两者都能支持并行工作、编排与仪表盘，下面只列真正构成差异的能力。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Hermes Kanban",
    ours: {
      noInfra: {
        title: "无需运维看板服务",
        body: "看板不需要数据库、网关或守护进程。除了你已经使用的智能体，AI4Kanban 只是一组可以在本地和离线环境中工作的 Markdown 文件。",
      },
      diffable: {
        title: "与代码同行的规划内容",
        body: "看板纳入仓库的版本管理，并随项目一同迁移。任务与方案使用和代码相同的评审流程，无需外部数据库，也不依赖某一套智能体技术栈。",
      },
      selfPruning: {
        title: "面向后续决策的记忆",
        body: "AI4Kanban 记录被否决的想法、设计经验与已交付内容，让后续建议建立在既有决策之上。它有意保留规划信号，而不是完整执行日志。",
      },
      onePrompt: {
        title: "适配你现有的智能体环境",
        body: "一句安装提示词即可配置技能文件与小型脚本，无需管理 profile 或调度器设置。任何能够读取文件的智能体都可以使用，包括 Hermes。",
      },
    },
    theirs: {
      manyAgents: {
        title: "供具名智能体共享的队列",
        body: "多个具名智能体和人可以在同一块持久看板上领取并交接工作。调度器监控就绪任务，并为每项任务启动指定的智能体。",
      },
      selfHealing: {
        title: "自动恢复进行中的工作",
        body: "队列会跨越崩溃盯住每个任务：领取 TTL、心跳、过期领取回收、重试与熔断。一个工作进程可以中途挂掉，看板会把任务收回并重试。AI4Kanban 的文件同样持久，但中断的运行只能等待下一次定时。",
      },
      autoDecompose: {
        title: "自动拆解与分派",
        body: "调度器的 LLM 拆解器会把粗略请求转化为子任务图，并将各项工作分派给专职智能体。AI4Kanban 则通过反复完善和人工审核逐步形成方案。",
      },
      fleetReach: {
        title: "面向大规模多智能体运营",
        body: "Hermes Kanban 面向跨多块看板的大量智能体，支持多租户，并可通过 Discord、Telegram、Slack、邮件和短信控制。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "结论", title: "让看板留在最需要它的地方" },
    oursHeading: "选择 AI4Kanban，如果",
    theirsHeading: "选择 Hermes Kanban，如果",
    ours: [
      "你希望任务和方案跟随代码，通过 git 评审与迁移。",
      "你想保留现有智能体环境，不再维护一套看板服务。",
    ],
    theirs: [
      "Hermes 已是你的主要运行环境，需要多个具名智能体共享任务。",
      "你重视无人值守调度、自动恢复，以及跨看板的规模化运营。",
    ],
    verdict:
      "希望规划**跟随代码、独立于智能体运行时**，选择 AI4Kanban；需要**共享队列、自动恢复和多智能体调度**，选择 Hermes Agent Kanban。",
    note: "两者也可以组合：在 AI4Kanban 中完善并审核方案，再把获批任务交给 Hermes 执行。",
  },
};

export default zh;
