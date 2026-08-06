// 简体中文 — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const zh: VsHermesCopy = {
  meta: {
    title:
      "AI4Kanban vs. Hermes Agent Kanban — 轻量文件式看板 vs. 持久化运行时",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description:
      "ai4kanban 的文件式看板与 Nous Research 的 Hermes Agent Kanban 相比如何：两个高度重叠的智能体看板，一边是能在任何智能体（包括 Hermes）上运行、可 diff 的纯文件，一边是许多具名智能体共同领取任务的持久化 SQLite 队列。",
    social:
      "两个高度重叠的智能体看板。ai4kanban 是轻量的文件式看板，任何智能体（包括 Hermes）都能运行；Hermes 则把同一套看板与一条多智能体共享的持久化队列打包在一起。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "两个面向智能体的看板，重叠之处不少。差别在于看板处在技术栈的哪一层：ai4kanban 是一层精简的*看板层*，你可以在它之上运行任何智能体；Hermes Agent Kanban 则把那一层熔进了自己的运行时。",
    ours: {
      name: "AI4Kanban",
      body: "你仓库里的纯 Markdown 看板。运行时、执行乃至维护都叠在其上，换掉智能体，看板照旧。",
    },
    theirs: {
      name: "Hermes Agent Kanban",
      body: "看板、调度器与具名智能体是一个整体运行时，持久、开箱即用，但看板拆不下来。",
    },
    oursDiagramAlt:
      "看板是底下那层 Markdown 文件；智能体运行时、执行和维护是叠在上面、可替换的一层。",
    theirsDiagramAlt:
      "一个整体的 Hermes 运行时，SQLite 看板、调度器和具名智能体都熔在里面。",
    taskLayer: "任务层 · 执行 + 维护",
    boardLayer: "看板 · Markdown 文件（git）",
    runtimeLabel: "Hermes 运行时",
  },
  summary: {
    heading: { eyebrow: "长话短说", title: "那为什么不直接用 Hermes Kanban？" },
    lead: "问得好，两者确实高度重叠：都是智能体用来规划与执行的看板。因此可以把 ai4kanban 看作**Hermes Kanban 的轻量替代**：同样的看板思路，去掉打包进来的运行时。差别在更下面一层。",
    oursHeading: "AI4Kanban — 由文件组成的看板",
    theirsHeading: "Hermes Kanban — 运行时里面的看板",
    ours: [
      "你仓库里的纯 Markdown，每一次任务与需求的改动都是一份可评审的 diff。",
      "没有任何基础设施：无需安装，也无需常驻。",
      "执行交给你本就在用的环境：Claude Code、Codex、Cursor，甚至 Hermes。",
    ],
    theirs: [
      "位于 ~/.hermes/kanban.db 的持久化 SQLite 队列，由许多具名智能体与人共享。",
      "调度器把就绪的任务分派给智能体，并能恢复崩溃的运行。",
      "绑定 Hermes / Nous 技术栈及其 kanban_* 工具。",
    ],
    whenLabel: "什么时候用 ai4kanban",
    when: "当你希望看板**与代码一同被版本管理**、当你打算留在本就在用的环境里、或者当你不想为了一块任务板去运维一个运行时，就选 ai4kanban。当**你已经在深度使用 Hermes**时，就选 Hermes Kanban，它的看板能直接接上你配好的调度器、具名 profile 与聊天端控制。说到底两者都是持久化队列：ai4kanban 的队列是 git 里的文件，Hermes 的是 SQLite 里的行。",
  },
  harness: {
    heading: { eyebrow: "运行环境支持", title: "哪些智能体能跑这块看板？" },
    lead: "这是最清楚的一处差别。ai4kanban 的看板就是纯文件，所以**任何能读仓库的智能体都能运行**，包括 Hermes 自己。Hermes Kanban 的看板藏在运行时的 `kanban_*` 工具之后，因此只有 Hermes 能。",
    oursSub: "任何能读文件的智能体",
    theirsSub: "只有 Hermes",
    supported: "支持",
    notSupported: "不支持",
    note: "……而且 ai4kanban 这一行还能继续往下列：Windsurf、OpenCode、Gemini CLI，任何会读文件的都行。Hermes Kanban 则没有给别的智能体留门。",
  },
  comparison: {
    heading: { eyebrow: "正面对比", title: "AI4Kanban vs. Hermes Kanban" },
    lead: "{check} 表示明确胜出；**横杠**表示这是一处取舍。ai4kanban 赢在简单与可迁移，Hermes 赢在持久共享队列与规模，其余打平。",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      whatItIs: {
        dimension: "它是什么",
        kanban: "一层文件式看板，看板就是你仓库里的纯 Markdown。",
        hermes: "Hermes 智能体运行时的一个看板功能，一块持久化的 SQLite 看板。",
      },
      infrastructure: {
        dimension: "基础设施",
        kanban: "自身没有，看板就是你仓库里的纯 Markdown 文件。",
        hermes: "一个常驻网关、一个 SQLite 数据库，外加一个调度循环。",
      },
      whereBoardLives: {
        dimension: "看板存在哪",
        kanban:
          "在你的仓库里，纳入版本管理，每一次任务与需求的改动都是一份可评审的 diff。",
        hermes:
          "在 ~/.hermes/kanban.db 这个 SQLite 库里；改动写入事件日志，而非 diff。",
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
        dimension: "崩溃恢复",
        kanban: "没有逐任务的队列；中途中断的任务会在下一次定时运行时重跑。",
        hermes:
          "持久队列会自动接管进行中的工作：领取 TTL、心跳、过期领取回收、重试。",
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
        dimension: "规模与触达",
        kanban: "一块单人看板；规模变大之后 grep 便不再好用。",
        hermes:
          "能扩展到跨多块看板的许多智能体，多租户，可从 Discord / Slack / 邮件 / 短信控制。",
      },
    },
  },
  memory: {
    heading: { eyebrow: "记忆 vs. 审计", title: "两块看板各自记住什么" },
    lead: "本质差别：ai4kanban 的记忆是**规划的输入**，它存在是为了让下一次提议更聪明。Hermes 的日志是**执行的产出**，它存在是为了让过去能被回放。",
    ours: {
      heading: "AI4Kanban",
      verdict: "记住结论，其余的忘掉。",
      body: "四个小文件，**刻意做了精简**：`archive.md`（交付了什么）、`rejected.md`（我们否决了什么，为什么）、`redesign.md`（不该重犯的设计失误）、`memory.md`（过去的扫描学到了什么）。智能体在提议或写卡之前会全部读一遍；完整的历史交给 git。",
      q: "想法 X 为什么不在看板上？",
      a: "`rejected.md` 里的一行：这个想法，以及它被否决的原因。被否决的想法就此终结。",
    },
    theirs: {
      heading: "Hermes Kanban",
      verdict: "记住每一个事件，什么都不概括。",
      body: "每一次状态流转都落进一份**只追加的日志**；每一次尝试都留着退出码与完整的工作进程输出。这是为审计与崩溃恢复设计的，不是为了指引下一个想法。",
      q: "42 号任务昨晚发生了什么？",
      a: "`claimed → crashed → reclaimed → completed`，还带着每次尝试的日志可以翻阅。",
    },
    note: "筛选过的记忆让智能体下一次更聪明；审计日志让过去可以被还原。谁也替代不了谁。",
  },
  autonomy: {
    heading: { eyebrow: "自主程度", title: "该给智能体多大的自主权？" },
    lead: "Hermes Kanban 承诺的是**“丢一句话，然后走人”**，完全自主。ai4kanban 是**智能体辅助**，而且起点比 plan mode 更早：你把一个半成形的想法存进看板，`refine` 把它变成具体的需求，你批准之后才会写下第一行代码。",
    stops: {
      traditional: {
        level: "无自主",
        term: "人来驱动",
        heading: "传统看板",
        detail:
          "每个任务都要你自己想出来、自己拆开，Trello 或 Jira 只负责记录。",
      },
      kanban: {
        level: "半自主",
        term: "智能体辅助",
        heading: "AI4Kanban",
        detail:
          "每一次 `refine` 都会挖出缺失的部分，把需求补齐。动工之前由你过目。",
      },
      hermes: {
        level: "完全自主",
        term: "丢完就忘",
        heading: "Hermes Kanban",
        detail:
          "扔进一句话，出来一棵任务树：自动拆解，无人值守一路做到完。Claude Code 的 `/goal` 押的是同一个赌注。",
      },
    },
    scaleLeft: "全部你来规划",
    scaleMiddle: "智能体规划，你批准",
    scaleRight: "全部智能体规划",
    worstCaseLabel: "各档位的最坏情况",
    worstCaseTheirs:
      "**丢完就忘：**早期一个细小的误解，长成一整棵错误的任务树，而且真的被做了出来，token 也随之烧掉。",
    worstCaseOurs:
      "**智能体辅助：**一张写错的 Markdown 卡片，在你审阅时即被发现，尚未开始任何开发。",
    note: "一次 refine 会补上缺失的步骤、把顺带冒出的想法拆成独立卡片、勾掉已经落地的待办，再把需要品味判断的部分留成问题交给你。问题清空之后，这张卡片翻转为**ready**：读一遍，然后开工。",
  },
  gui: {
    heading: { eyebrow: "两个仪表盘", title: "看板图形界面" },
    lead: "两边都带网页看板，但扮演的角色不同。ai4kanban 的看板是**你操控智能体的控制面**，卡片上的操作会发起运行。Hermes 的看板是**通向调度器的实时窗口**，它显示整个机队此刻在做什么。",
    ours: {
      heading: "AI4Kanban — 本地看板",
      body: "架在 Markdown 文件之上的本地网页看板。卡片上的操作（*实现、审查、归档*）会把工作交给智能体，你能看着它的日志流回来，中途还可以人工介入。",
      alt: "ai4kanban 的本地网页看板：浅色界面，带 Blockers、UI、Skill、Docs、Distribution 各列和一个 Create task 按钮。",
    },
    theirs: {
      heading: "Hermes Kanban — 调度器实时视图",
      body: "一个实时追踪事件日志的看板：可以在列之间拖拽，侧边抽屉里有运行历史与退出状态徽章，同一块看板还能从 Discord、Slack 或短信里操控。",
      alt: "Hermes Agent 的看板仪表盘：深色界面，带 Triage、Todo、Scheduled、Ready 各列和一条编排工具栏。",
    },
  },
  wins: {
    heading: { eyebrow: "取舍", title: "各自赢在哪里" },
    lead: "谁也不是绝对更好。ai4kanban 优化的是一块自身不带任何基础设施的轻量文件式看板；Hermes Kanban 优化的是一条持久共享的工作队列，让许多智能体无人值守地运行。运行环境本身的能力，例如并行运行、编排、仪表盘，两边都有，因此这里不再列出。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Hermes Kanban",
    ours: {
      noInfra: {
        title: "自身不带任何基础设施",
        body: "没有数据库，没有网关，没有守护进程。除了你本就在跑的智能体，看板只是几个 Markdown 文件：无需额外安装，也无需常驻，在飞机上照样可用。",
      },
      diffable: {
        title: "可 diff、可版本化的文件",
        body: "看板住在仓库里、随仓库而走，用你自己那套版本管理即可。每一次任务与需求的改动都是一份可评审的 diff：项目之外没有 SQLite，没有要查询的事件日志，也不会被绑死在某一套智能体技术栈上。",
      },
      selfPruning: {
        title: "会自我精简的记忆",
        body: "它记下某个想法为何被否决、什么已经交付，让智能体向前提议，而不是把废弃的工作又端出来。它只保留会影响下一个任务的东西，而不是一份完整的审计日志。",
      },
      onePrompt: {
        title: "一句话就装好",
        body: "一个技能文件加一个脚本，没有 profile 需要配置，也没有调度器需要调参。它能落在任何会读文件的智能体已经站立的地方，Hermes 也算。",
      },
    },
    theirs: {
      manyAgents: {
        title: "一块看板，许多具名智能体",
        body: "一块持久的看板，多个具名智能体，还有人，在其上领取任务、交接工作。调度器轮询就绪任务，为每个任务拉起指定的智能体。ai4kanban 的看板则由你当下所处的那一个运行环境驱动。",
      },
      selfHealing: {
        title: "会自愈的任务队列",
        body: "队列会跨越崩溃盯住每个任务：领取 TTL、心跳、过期领取回收、重试与熔断。一个工作进程可以中途挂掉，看板会把任务收回并重试。ai4kanban 的文件同样持久，但中断的运行只能等待下一次定时。",
      },
      autoDecompose: {
        title: "自动拆解任务",
        body: "丢进一个粗略的任务，调度器的 LLM 拆解器就把它展开成一张子任务图，每个子任务分派给专职智能体，无需手工拆分。ai4kanban 则是把一张卡片拆成待办项与一张需要人工照料的任务图。",
      },
      fleetReach: {
        title: "机队规模与触达",
        body: "为跨多块看板的许多智能体而生，多租户，可从 Discord、Telegram、Slack、邮件与短信控制。ai4kanban 则是一块留在你仓库与终端里的精简单人看板。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "怎么选", title: "你该用哪一个？" },
    oursHeading: "这些情况选 ai4kanban",
    theirsHeading: "这些情况选 Hermes Kanban",
    ours: [
      "你想要一块文件式看板，每一次任务与需求的改动都是一份可评审的 diff。",
      "你不想让它自带基础设施：纯文件，可离线，可带走，不锁定。",
      "你想让它与智能体无关：Claude Code、Cursor，甚至 Hermes 自己。",
      "你独自开发，比起打包好的引擎更看重一块精简的看板。",
    ],
    theirs: [
      "你已经在深度使用 Hermes，profile、网关与聊天端控制都配好了。",
      "你想要一块持久看板，让许多具名智能体，还有人，一起共享。",
      "你想要一条能跨崩溃自动接管进行中任务的队列。",
      "你想让调度器自动拆解任务并分派给专职智能体。",
      "你要在多块看板与多个聊天平台上跑机队级的工作量。",
    ],
    verdict:
      "它们的重叠比名字看上去多得多，两者都是智能体看板。分歧在于打包了什么：ai4kanban 是一块**把自动化交给你的运行环境的文件式看板**；Hermes Agent Kanban 是同一块看板**外面裹了一条持久共享的工作队列**。如果你想要一块许多智能体共享、还能扛住崩溃的看板，选 Hermes；如果你想要一块待在仓库里、需要时才扩展的精简看板，选 ai4kanban。",
    note: "它们甚至可以并排放着：ai4kanban 作为在 git 里做规划与取舍的轻量场所，Hermes 作为在你想清楚之后跑重活、跑共享工作的持久队列。",
  },
};

export default zh;
