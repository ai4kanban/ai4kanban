// 简体中文 — mirrors `en.ts` key for key. See that file for the inline markup
// rules (`code`, **bold**, *italic*, \n).
//
// Wording follows docs/kanban/memory/goal.md: 自主拆解、循环澄清、需求、决策可追溯、
// 自进化、交付闭环。书面语，不用口语化的说法。
//
// Product names (AI4Kanban, Claude Code, GitHub Issues, Hermes Agent Kanban,
// Vibe Kanban), file names, track names and shell commands stay as they are.
import type { SiteCopy } from "./types";

const zh: SiteCopy = {
  shared: {
    nav: {
      install: "安装",
      usage: "怎么用",
      boardUi: "看板界面",
      features: "功能",
      recipes: "任务模板",
      compare: "对比",
      compareMore: "更多对比即将上线…",
      github: "GitHub ↗",
    },
    footer: {
      license: "Apache License 2.0",
      origin: "最初是为以下项目打造的技能：",
    },
    code: {
      copy: "复制",
      copied: "已复制",
      copyAria: "复制到剪贴板",
      copiedAria: "已复制",
    },
    language: { label: "语言" },
    vs: "vs",
    bottomLine: "结论",
    cta: { install: "安装 ai4kanban", github: "在 GitHub 上查看 ↗" },
  },

  home: {
    meta: {
      title: "AI4Kanban — 与你共同成长的 AI 项目管理",
      description:
        "面向 Claude Code 的 AI 项目管理：一个技能，加一个本地看板界面。给它一个模糊想法，智能体会自主拆解、循环澄清，直到每个细节都明确到可以动手。看板是纯 Markdown，全部留在 git 里。",
      social:
        "给它一个模糊想法。智能体会自主拆解，能自行决断的就直接决断，其余的交由你澄清，并在后台持续推进，直到每个细节都明确到可以动手。",
    },
    hero: {
      badge: "Claude Code 技能 + 本地看板界面",
      title: "与你共同成长的\nAI 项目管理。",
      lead: "给它一个模糊想法。智能体会自主拆解，能自行决断的就直接决断，其余的交由你澄清，并在后台持续推进，直到每个细节都明确到可以动手。看板是 `docs/kanban/` 下的纯 Markdown：全部留在 git 里，无需数据库，也无需 MCP。",
      ctaInstall: "一句话完成安装",
      ctaGithub: "在 GitHub 上查看",
    },
    quickview: {
      caption: "看板在终端中的呈现，也就是 git 里的那些文件。",
      taskView: "任务名",
      fileView: "文件路径",
      frontAria: "{view}视图（当前）",
      flipAria: "切换到{view}视图",
    },
    features: {
      breakDown: {
        title: "自主拆解",
        body: "智能体解读一个想法，将其拆解为多个子任务；夹带进来的无关需求会被单独拆出，另立一张卡片。",
      },
      clarify: {
        title: "循环澄清",
        body: "智能体首先对想法自主提问：凡是凭记忆和常识能解答的，直接决策，其余请你介入澄清。此流程不断重复，直到它提不出更多疑问。",
      },
      alwaysOn: {
        title: "7×24 推进",
        body: "拆解与澄清在后台持续进行，直到一个模糊想法变成一份明确的需求。",
      },
      traceable: {
        title: "决策可追溯",
        body: "一份需求是如何被一步步细化的，你随时可以回溯。",
      },
      proposes: {
        title: "自主提出任务",
        body: "智能体基于各模块的记忆提出功能提案。你的否决会被记录，此后不再出现同类提案。",
      },
      selfEvolving: {
        title: "自进化",
        body: "每一次人工介入都会被记录，成为后续自主决策的参照。记忆按项目模块分别组织。",
      },
      orders: {
        title: "依赖与优先级",
        body: "它不止于拆解任务，还负责排定优先级——识别任务间的依赖，权衡价值与成本，确保工作以正确的顺序推进。",
      },
      lifecycle: {
        title: "交付闭环",
        body: "职责不止于把需求澄清，而是覆盖任务的完整生命周期——提出、澄清、执行、归档，因此看板始终反映项目的真实进展。",
      },
    },
    featuresNote:
      "AI4Kanban 为小微团队而设计。得益于新模型的能力，今天的编码智能体已经能把明确的需求高完成度地翻译成代码；但如果需求本身不明确，它只会在错误的假设上做错误的开发。AI4Kanban 依靠持续积累的记忆，在你提出模糊想法时沿着过去的决策轨迹自主判断，最终产出可落地的明确需求。",
    install: {
      heading: { eyebrow: "安装", title: "一句话完成安装" },
      lead: "在项目根目录下，对 Claude Code（或任何能执行 shell 命令的智能体）说：",
      note: "智能体先读一遍你的代码库，然后跑一条命令 `npx ai4kanban install`，把技能装进项目并搭好看板。配置由它填，项目目标问你一句——整个设置只问这一件事——再从目标里定下最初的决策，建好头十个任务。以后升级同样只要一条命令：`npx ai4kanban update`。",
    },
    board: {
      heading: { eyebrow: "用法", title: "在 Claude Code 里使用 AI4Kanban" },
      lead: "安装完成后，用日常语言指挥它：",
      terminal: "you › claude",
      rows: {
        whatsNext: {
          say: '"/kanban 接下来做什么？"',
          does: "读取看板与你的信息源，提出 3 个新任务",
        },
        addTask: {
          say: '"/kanban 加个任务：…"',
          does: "审阅这个想法，写成卡片，并加入索引",
        },
        refine: {
          say: '"/kanban refine #4"',
          does: "审查 4 号卡片，将其向具体推进一步",
        },
        review: {
          say: '"/kanban 检查一下看板"',
          does: "逐张检查卡片是否清晰、重复，或其实已经完成",
        },
        done: {
          say: '"/kanban #4 做完了"',
          does: "压缩写入归档，并移除该卡片",
        },
        badIdea: {
          say: '"/kanban #4 是个馊主意"',
          does: "将原因记入 rejected.md，此后不再重复提出",
        },
      },
    },
    ui: {
      heading: { eyebrow: "看板界面", title: "一个能在浏览器里打开的本地看板" },
      lead: "与其一问一答，不如直接看：一条命令即可在同一批 Markdown 文件之上打开看板——完整阅读一个任务，无需在 IDE 目录树里翻找；点击即可执行，无需把同样的提示词再打一遍。",
      optional:
        "看板界面是可选的，安装过程不会额外安装任何东西。需要时对 Claude 说一句即可：",
      started: "Claude 会启动预编译好的服务，仅在本地运行，无需任何构建。",
      actionsLead: "卡片上的每个按钮都会把一步操作交给智能体，无需打字：",
      actions: {
        implement: { label: "实现", body: "把这张卡片交给 Claude 执行" },
        edit: { label: "编辑", body: "修改卡片内容，暂不执行" },
        refine: { label: "细化", body: "把停滞的卡片向前推进一步" },
        resolve: { label: "答疑", body: "回答卡片上待定的问题" },
        archive: { label: "归档", body: "把已完成的卡片收起来" },
        reject: { label: "否决", body: "废弃这张卡片并写明原因" },
      },
      shots: {
        board: {
          label: "看板视图",
          alt: "ai4kanban 的本地网页看板：Blockers、UI、Skill、Docs、Distribution 各列排着 Markdown 卡片，带 #编号、优先级和 ROI 徽章，以及子任务进度条。",
        },
        detail: {
          label: "卡片详情",
          alt: "本地看板里的任务详情页：标题，实现 / 审查 / 编辑 / 否决 操作，一行元数据显示分类、优先级、ROI、待办和阻塞项，以及卡片正文全文。",
        },
      },
      frontAria: "{view}（当前）",
      flipAria: "切换到{view}",
    },
    presets: {
      heading: { eyebrow: "预设", title: "独立开发者预设" },
      lead: "无人监督时埋头开发一整天，是单干最典型的陷阱。这个预设把你的时间分成三份：获客、验证需求、开发产品。Claude 会让新任务在三者之间均衡分布，而不是全部堆在一侧。",
      tracks: {
        growth: {
          body: "让用户看见你：发帖、私信、上线首发。Claude 会给出值得一试的路径，并替你把文案写好。",
        },
        validation: {
          body: "在投入开发之前，先确认市场是否需要：抛出一个诚恳的问题、提供试用，并把结论沉淀下来。",
        },
        building: {
          body: "守住 MVP：只有当一件事能放大你的产出、加固产品，或用户明确提出时，才动手开发。",
        },
      },
      note: "`indie-hacker` 预设还增加了两道审查关卡——护城河测试与信任测试，以及一套在开工前先去 Reddit 或 X 上验证市场的方法。安装时可以替换为你自己的分类与权重。",
    },
    advanced: {
      heading: {
        eyebrow: "功能",
        title: "用 Markdown 做项目管理，而不是一张平铺清单",
      },
      lead: "平铺的待办清单终究只是一张清单。这里有四件清单做不到的事：周期性工作、大任务的子任务、对已完成之事的记忆，以及一份吞吐量统计。",
      recurring: {
        title: "周期性任务",
        body: "有些工作不是做一次就结束的。把这类工作各作为一张卡片放进 `docs/kanban/todo/recurring/`（这类卡片永不归档），再用 Claude Code 的 `/loop` 按你设定的节奏运行，例如每天早上一次。",
        examples: {
          competitors: {
            label: "盯竞品",
            body: "追踪对手上线与改动了什么，标出值得回应的部分。",
          },
          listening: {
            label: "听社区",
            body: "抓取 Reddit 或 Slack 上的新帖，把真正重要的浮出来。",
          },
          boardReview: {
            label: "查看板",
            body: "清理待办中过期、重复或实际已完成的卡片。",
          },
        },
        ladderLead:
          "并非每件工作都需要同样的自动化程度。一张卡片可以停在任意一级：从你亲手完成，到交给 Claude，再到脚本自行运行：",
        ladder: {
          ask: { label: "你亲手完成" },
          agent: { label: "交给 Claude 完成" },
          script: { label: "一条命令完成，无需人工" },
        },
        ladderNote:
          "每件工作都尽量往上推一级：有些注定需要亲力亲为，有些最终会自行运转。",
      },
      group: {
        title: "任务组",
        body: "一个大到无从下手的任务，往往就一直搁在那里。当一张卡片装不下它时，它会升级为一个**任务组**：独立的文件夹，一份用于跟踪的 `root.md`，以及每个部分各自一张卡片。每个部分有各自的编号，并以 *Blocked by* 和 *Related* 串联，因此你始终知道下一个该做哪一个。",
      },
      memory: {
        title: "项目记忆",
        body: "用看板推进工作是一个循环：每一轮，Claude 从三个来源中挖掘新任务向你提出，由你决策，再把结果沉淀进记忆中枢——于是下一轮从上一轮的终点继续，而不是从头再来。",
        hubLabel: "docs/kanban/：存放你反馈的中枢",
        files: {
          memory: {
            body: "每次扫描的笔记会传递给下一次，每个来源各带一条水位线，因此只会重读发生变化的部分。",
          },
          archive: {
            body: "已交付的工作被压缩成一行。提出新任务前它会先读这里，因此不会重复建议已经完成的事。",
          },
          rejected: {
            body: "被你否决的想法连同原因一并留存，因此不会被再次提起。",
          },
          redesign: {
            body: "你纠正过的设计失误会沉淀为一条笔记，下一张卡片不会重蹈覆辙。",
          },
        },
        loop: {
          aria: "这个循环：先提议，然后你拍板，再学习，接着重新开始。",
          centerCaption: "读取与写入",
          stepLabel: "第",
          stages: {
            propose: {
              label: "提议",
              body: "从三个来源中找出既未交付、也未被搁置的工作：",
            },
            decide: {
              label: "你拍板",
              body: "执行、跳过，或调整方案。回复 Claude 几个字即可。",
            },
            learn: {
              label: "学习",
              body: "把结果与你的反馈沉淀进中枢，下一轮的起点因此更准。",
            },
          },
          sources: {
            project: {
              label: "你的项目",
              body: "代码库、看板、文档、团队聊天。它会把已有的信息串联成值得做的工作。",
            },
            outside: {
              label: "外部世界",
              body: "Reddit、Slack、你的 CRM。周期性任务会引入新的信号，并把发现写进看板。",
            },
            you: {
              label: "你",
              body: "你给出的方向与反馈都留存在看板中，因此一个好判断不会丢失，也不会被追问第二遍。",
            },
          },
        },
      },
      metrics: {
        title: "任务指标",
        body: "每张归档的卡片就是一个交付单位，因此你的速度只是 git 中紧挨着代码的一个数字，无需再与外部工具同步。",
        chart: {
          aria: "十二天的每日吞吐量：总计、完成、新建、否决的任务数。",
          series: {
            total: "总计",
            completed: "完成",
            created: "新建",
            rejected: "否决",
          },
          caption:
            "`metrics.csv` 每天一行：完成、新建、否决，以及三者之和。由脚本自动维护，你无需手动干预。",
        },
      },
    },
  },

  vsGithub: {
    meta: {
      title: "AI4Kanban vs. GitHub Issues — 不同的工作，不同的工具",
      socialTitle: "AI4Kanban vs. GitHub Issues",
      description:
        "ai4kanban 的文件式看板与 GitHub Issues 相比如何：本地 Markdown 对远程 API、token 成本、智能体使用体验、团队协作，以及各自的适用场景。",
      social:
        "它不是替代品，而是针对另一个瓶颈的另一件工具。一场关于速度、token、智能体与团队的正面较量。",
    },
    hero: {
      badge: "对比",
      title: "AI4Kanban vs.\nGitHub Issues",
      lead: "它不是替代品，而是针对另一个瓶颈的另一件工具。GitHub Issues 是一份共享、持久、公开的权威记录；ai4kanban 是一块私有、本地、为智能体而生的工作台。取决于你真正的瓶颈在哪里。",
      ours: {
        name: "AI4Kanban",
        body: "你仓库里的纯 Markdown。智能体手边那块飞快的本地草稿板。",
      },
      theirs: {
        name: "GitHub Issues",
        body: "一个藏在 API 之后的数据库。共享、公开的权威记录。",
      },
    },
    summary: {
      heading: { eyebrow: "长话短说", title: "那为什么不直接用 GitHub Issues？" },
      lead: "完全可以。ai4kanban 做的事，几乎都能用 GitHub Issues 配合 `gh` CLI 或一个 GitHub MCP server 完成。区别在于代价。",
      panel:
        "同一件事放到 GitHub Issues 上，意味着**更多噪音**、**更多来回**、**更多 token**、**更高延迟**，还需要**更强的提示**才能让智能体真正去用它。ai4kanban 以 GitHub 的覆盖面换取本地的速度；而对一个独自驱动智能体的人来说，稀缺的往往正是速度。",
    },
    comparison: {
      heading: { eyebrow: "正面对比", title: "AI4Kanban vs. GitHub Issues" },
      lead: "十四个维度。{check} 表示明确胜出；**横杠**表示这是一处有意的取舍，取决于你需要什么。ai4kanban 拿下**速度与本地化**那几行；GitHub Issues 拿下**规模与协作**那几行。",
      ourLabel: "AI4Kanban",
      theirLabel: "GitHub Issues",
      rows: {
        storage: {
          dimension: "存储",
          kanban: "你仓库里的纯 Markdown，存于 git。",
          issues: "GitHub 的数据库，藏在 API 之后。",
        },
        offline: {
          dimension: "能否离线",
          kanban: "可以，它本就是磁盘上的文件。",
          issues: "不能，需要网络与鉴权。",
        },
        agentReads: {
          dimension: "智能体如何读取",
          kanban: "原生文件工具：Read、Grep、Glob。",
          issues: "gh CLI 或 MCP 往返调用。",
        },
        tokenCost: {
          dimension: "每次查询的 token 成本",
          kanban: "低：grep 只返回命中的那几行。",
          issues: "高：JSON 载荷加上工具 schema。",
        },
        latency: {
          dimension: "延迟",
          kanban: "本地磁盘，近乎瞬时。",
          issues: "每次调用一趟网络往返。",
        },
        setup: {
          dimension: "上手成本",
          kanban: "一句提示词：一个技能文件加一个脚本。",
          issues: "账号、鉴权令牌、MCP 配置。",
        },
        lockIn: {
          dimension: "厂商锁定",
          kanban: "没有，看板随仓库而走。",
          issues: "只活在 GitHub 上。",
        },
        metadata: {
          dimension: "元数据",
          kanban: "刻意做得极简：优先级 + 工作量，单干所需的就这些。",
          issues: "标签、里程碑、指派人、项目板，为协调团队而生。",
        },
        concurrency: {
          dimension: "并发",
          kanban: "没有并发控制，两人同时新增会撞上同一个编号 #1894。",
          issues: "编号由服务端分配，团队使用是安全的。",
        },
        history: {
          dimension: "决策历史",
          kanban:
            "只保留会影响下一个任务的决定：某个想法为何被否决、什么已经交付。因此智能体始终向前提议，不会重做已完成或已废弃的工作。",
          issues: "完整保留评论历史与编辑记录，一条不漏。",
        },
        closing: {
          dimension: "收尾",
          kanban: "任务项全部勾选后归档该任务。",
          issues: "关联的 PR 与 CI 会自动关闭 issue。",
        },
        search: {
          dimension: "规模化搜索",
          kanban: "grep：看板小的时候很快，规模变大后力不从心。",
          issues: "带索引的全文搜索与保存好的过滤器。",
        },
        contributors: {
          dimension: "外部贡献者",
          kanban: "可以，但只能提交 Markdown，没有轻量的提单入口。",
          issues: "任何人都能提单、评论、点表情，无需提交代码。",
        },
        transparency: {
          dimension: "透明度",
          kanban: "每张卡片都留在仓库中可见，只有记忆中枢会被精简到只剩要点。",
          issues: "公开且可链接，是开源世界的默认选择。",
        },
      },
    },
    wins: {
      heading: { eyebrow: "取舍", title: "各自赢在哪里" },
      lead: "谁也不是绝对更好。ai4kanban 为一个智能体跑得快而优化；GitHub Issues 为一群人保持同步而优化。",
      oursHeading: "AI4Kanban",
      theirsHeading: "GitHub Issues",
      ours: {
        tokenLight: {
          title: "省 token，几乎没有延迟",
          body: "无需 MCP，不走网络。智能体 grep 的是本地 Markdown，而不是翻阅远程 API 的分页：token 更少、延迟更低，也不会在任务中途遭遇需要刷新的鉴权。",
        },
        agentsUseIt: {
          title: "智能体真的会用它",
          body: "智能体并不情愿去检索 GitHub Issues，它们默认伸手去拿文件系统工具。Markdown 看板恰好就在它们已经站立的地方：提示更少，臆造出来的任务状态也更少。",
        },
        offline: {
          title: "离线，而且属于你",
          body: "git 里的纯文件。飞机上能用，GitHub 宕机也能用。不依赖 SaaS，没有厂商锁定，克隆仓库，整块看板便随之而来。",
        },
        memory: {
          title: "为提议而调校的记忆",
          body: "它记下的是会影响下一个任务的决定：某个想法为何被否决、什么已经交付、离目标还差多少。因此智能体始终向前提议，不会重做已完成的工作，也不会重提你砍掉的东西。",
        },
      },
      theirs: {
        teams: {
          title: "为团队而生",
          body: "服务端分配编号、并发编辑安全、可以指派人。ai4kanban 没有数据库，两人可能同时创建出 #1894 而冲突。",
        },
        transparency: {
          title: "透明与触达",
          body: "公开且可链接，外部贡献者能提单、评论、点表情。当开放比纯粹的速度更重要时，这里才是对的归处。",
        },
        fullContext: {
          title: "全部上下文，永久保留",
          body: "ai4kanban 是刻意做压缩的，归档的卡片会缩成一行。在 GitHub 上，每一条评论、每一次编辑、每一个交叉链接都原样留存。",
        },
        integration: {
          title: "深度集成",
          body: "PR 自动关闭、提交链接、项目板、标签、里程碑，还有一整个第三方工具生态和能撑住规模的索引搜索。",
        },
      },
    },
    ergonomics: {
      heading: { eyebrow: "关键所在", title: "智能体为什么偏爱文件" },
      lead: "真正的差别要等智能体动手时才显现。同一句话——**“找出我那些高优先级的未完成任务”**——两条路径几乎毫无相似之处。",
      issues: {
        title: "you › agent + GitHub MCP",
        chip: "多轮往返",
        lines: [
          "找出我那些高优先级的未关闭 issue",
          "list_issues(state:open, labels:high)",
          "4.2 KB JSON — 18 个 issue，字段全带上",
          "翻页、过滤、汇总…",
          "刷新鉴权 · 限流响应头 · 重试",
        ],
        footer: "多次工具调用 · 数 KB 的 JSON · 每次都要走网络",
      },
      kanban: {
        title: "you › agent + ai4kanban",
        chip: "一轮完成",
        lines: [
          "找出我那些高优先级的未完成任务",
          'grep -rl "Priority: high" docs/kanban/todo',
          "三个文件路径",
          "完成，一次调用，不走网络",
        ],
        footer: "一次工具调用 · 几个路径 · 全在本地",
      },
      note: "这笔账还会不断累加：每一次“接下来做什么？”、每一次归档、每一次看板检查，在 GitHub Issues 上都要缴一遍往返税。而模型只要有得选，就会绕开那个远程工具，转向文件。",
    },
    decision: {
      heading: { eyebrow: "怎么选", title: "你该用哪一个？" },
      oursHeading: "这些情况选 ai4kanban",
      theirsHeading: "这些情况选 GitHub Issues",
      ours: [
        "你独自开发，或只有一两位彼此信任的搭档。",
        "你在终端里通过智能体推进工作。",
        "比起留档，你更看重推进。",
        "你希望看板留在 git 里：可离线，可带走。",
      ],
      theirs: [
        "你在公开构建，透明度很重要。",
        "多人会同时改动待办列表。",
        "你很依赖 PR/CI 关联、项目板与里程碑。",
        "你需要外部贡献者能提单、能讨论。",
      ],
      verdict:
        "它们并非竞争关系。GitHub Issues 是**共享的权威记录**；ai4kanban 是**智能体手边那块飞快的本地草稿板**。如果你的瓶颈是人与人之间的协调，选 GitHub Issues；如果瓶颈是你与智能体协作的产出速度，选 ai4kanban。",
      note: "不少独立开发者两者并用：GitHub Issues 作为公开的跟踪器，ai4kanban 作为智能体每天打交道的私有工作面。",
    },
  },

  vsHermes: {
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
  },

  vsVibe: {
    meta: {
      title: "AI4Kanban vs. Vibe Kanban — 规划看板 vs. 智能体驾驶舱",
      socialTitle: "AI4Kanban vs. Vibe Kanban",
      description:
        "随着 Bloop 在 2026 年 4 月关停，Vibe Kanban 也停摆了。ai4kanban 的文件式看板相比如何：一块待在你仓库里的轻量规划看板，对上一个并行运行许多编码智能体的驾驶舱，以及有哪些东西能延续下来。",
      social:
        "Vibe Kanban 背后的公司关停了。一块待在仓库里的规划看板，对上一个智能体编排驾驶舱：诚实的差别，以及有哪些东西能延续下来。",
    },
    hero: {
      badge: "对比",
      title: "AI4Kanban vs.\nVibe Kanban",
      lead: "Vibe Kanban 是一个并行运行许多编码智能体的驾驶舱，而它背后的公司 Bloop 已于 2026 年 4 月关停。ai4kanban 是一块规划看板，你的智能体把它当作仓库里的纯文件来编辑。两者解决的是不同的瓶颈。下面是诚实的差别，以及真正能延续下来的东西。",
      ours: {
        name: "AI4Kanban",
        body: "你仓库里的纯 Markdown。一块由你的智能体编辑的规划看板。",
      },
      theirs: {
        name: "Vibe Kanban",
        body: "一个本地网页应用。一个并行运行许多智能体的驾驶舱。",
      },
    },
    summary: {
      heading: {
        eyebrow: "长话短说",
        title: "Vibe Kanban 停摆了，接下来去哪？",
      },
      lead: "Vibe Kanban 背后的公司 Bloop 于 2026 年 4 月关停。付费计划被取消并退款，云端功能下线，项目彻底转为本地运行。它以 Apache-2.0 开源留存下来，但原仓库自 2026 年 4 月底起再无新提交，因此它的未来如今压在社区 fork 身上，而不是当初做出它的那支团队。",
      panel:
        "如果你在 Vibe Kanban 里看重的是那块**看板**——一个能安静地把工作排好、打磨清楚再交给编码智能体的地方——ai4kanban 会以 git 里的纯文件把它给你，没有会关停的公司，也没有需要常驻的服务。如果你看重的是那台**并行运行许多智能体的引擎**，先说清楚：ai4kanban 不是那个东西，我们宁可现在就讲明，也不想让你读到第三节才发现。",
    },
    comparison: {
      heading: { eyebrow: "正面对比", title: "AI4Kanban vs. Vibe Kanban" },
      lead: "十个维度。{check} 表示明确胜出；**横杠**表示这是一处有意的取舍，取决于你需要什么。ai4kanban 拿下**轻量与规划**那几行；Vibe Kanban 拿下**并行智能体与代码评审**那几行，那是它真正的强项，我们直说。",
      ourLabel: "AI4Kanban",
      theirLabel: "Vibe Kanban",
      rows: {
        whatFor: {
          dimension: "用来做什么",
          kanban:
            "一块由你的智能体在仓库里编辑的规划看板，把工作排好、打磨清楚。",
          vibe: "一个驾驶舱，用来并行运行许多编码智能体并审查它们的产出。",
        },
        orchestration: {
          dimension: "并行智能体编排",
          kanban: "没有，你驱动一个智能体；看板本身不运行智能体。",
          vibe: "它的核心强项：许多智能体同时运行，各自待在隔离的 git worktree 里。",
        },
        review: {
          dimension: "智能体产出的评审",
          kanban: "不归它管，diff 由你的运行环境显示。",
          vibe: "内置：行内 diff 评审、实时预览，还能处理 pull request。",
        },
        planning: {
          dimension: "规划与细化",
          kanban: "一个 refine 循环把粗略的想法变成一个可以开工的具体任务。",
          vibe: "很弱，看板主要用于排队与跟踪智能体的运行。",
        },
        onDisk: {
          dimension: "在磁盘上是什么",
          kanban: "你仓库里的纯 Markdown，存于 git。",
          vibe: "配置目录里的一个本地 SQLite 数据库。",
        },
        runsAs: {
          dimension: "以什么形式运行",
          kanban: "就是文件，没有服务，也没有需要常驻的东西。",
          vibe: "一个你启动后需要常驻的本地网页应用（Rust 后端 + 网页界面）。",
        },
        setup: {
          dimension: "上手成本",
          kanban: "一句提示词：一个技能文件加一个脚本。",
          vibe: "npx vibe-kanban，外加每个智能体 CLI 都要安装并登录。",
        },
        whichAgents: {
          dimension: "哪些智能体能运行",
          kanban: "任何能读文件的智能体：Claude Code、Codex、Cursor，还有更多。",
          vibe: "它接好的那些智能体 CLI：Claude Code、Codex、Gemini 等。",
        },
        lockIn: {
          dimension: "厂商锁定",
          kanban: "没有，看板就是随仓库而走的文件。",
          vibe: "Apache-2.0 且可自托管，关停前还发布了一版数据导出。",
        },
        maintenance: {
          dimension: "谁在维护",
          kanban: "在积极维护。",
          vibe: "Bloop 于 2026 年 4 月关停；原仓库此后停滞。",
        },
      },
    },
    purpose: {
      heading: { eyebrow: "真正的差别", title: "规划看板 vs. 编排驾驶舱" },
      lead: "这两件工具处在循环里的不同位置。一个是你决定**做什么**的地方；另一个是你**运行那些去做的智能体**的地方。把其中一个当成另一个，正是失望的由来，所以这里直说。",
      ours: {
        name: "AI4Kanban — 计划",
        is: "一块你的智能体在仓库里当作纯 Markdown 来读写的看板。你存下一个粗略的想法，一个 refine 循环把它打磨成一个可以开工的任务，你批准之后才会写代码。工作内容就住在 git 里，紧挨着它要改的代码。",
        isnt: "它不运行智能体、不开 worktree，也不 diff 它们的产出，那是你的运行环境的职责。它是地图，不是引擎。",
      },
      theirs: {
        name: "Vibe Kanban — 引擎",
        is: "一个本地网页应用，同时运行许多编码智能体，各自隔离在自己的 git worktree 里，然后让你在一个地方审查它们的 diff、预览应用。它的价值在于并行智能体运行带来的吞吐量。",
        isnt: "它并非为了把半成形的想法打磨成需求而造，看板主要用于排队与跟踪运行，细化的能力很弱。",
      },
      note: "不少人用 Vibe Kanban 只是为了那块看板。如果你正是如此，ai4kanban 是它更轻的一个家：git 里的文件，没有需要常驻的东西。如果你用它是为了并行驱动智能体，那就盯着社区 fork；ai4kanban 不会替代那台引擎。",
    },
    wins: {
      heading: { eyebrow: "取舍", title: "各自赢在哪里" },
      lead: "谁也不是绝对更好。ai4kanban 优化的是一块比任何工具都活得久的轻量文件式看板；Vibe Kanban 优化的是同时运行并审查许多智能体。",
      oursHeading: "AI4Kanban",
      theirsHeading: "Vibe Kanban",
      ours: {
        nothingRunning: {
          title: "没有需要常驻的东西",
          body: "看板就是你仓库里的纯 Markdown：没有网页应用，没有数据库，没有服务。除了你本就在跑的智能体，什么都不用装，也没有什么会掉线。",
        },
        planning: {
          title: "是规划，不只是排队",
          body: "一个 refine 循环会挖出缺失的部分，把粗略的想法变成一张你先批准、再写代码的具体卡片。Vibe Kanban 的看板主要是给智能体运行排队。",
        },
        outlives: {
          title: "比任何公司活得久",
          body: "没有 SaaS，没有打包进来的运行时，也没有会停滞的仓库。看板就是 git 里的文件，克隆仓库它便随你而走。Bloop 关停，正是这件事要躲开的风险。",
        },
        anyAgent: {
          title: "任何智能体，随时可换",
          body: "它就是文件，所以任何能读文件的智能体都能驱动它：Claude Code、Codex、Cursor，以及你下一个会换到的任何东西。你不会被绑在某个工具支持的 CLI 清单上。",
        },
      },
      theirs: {
        parallel: {
          title: "同时运行许多智能体",
          body: "这就是它存在的全部理由：把工作扇出给多个编码智能体并行完成，每个都隔离在自己的 git 分支与 worktree 里，绝不互相踩踏。ai4kanban 压根不运行智能体。",
        },
        reviewInPlace: {
          title: "执行与评审在同一个地方",
          body: "行内 diff 评审、内置浏览器预览应用，还有 pull request 处理，全在驾驶舱里。你不用离开看板就能盯住并引导智能体的产出。",
        },
        boardUi: {
          title: "一个真正的看板界面",
          body: "一块为驱动智能体运行而造的网页看板：发起一个任务、看着它干活、在工作区之间切换。它是为编排量身打造的，不是一个你去 grep 的普通文件。",
        },
        support: {
          title: "广泛的智能体支持",
          body: "多智能体编排的首发者，开箱即接好了许多智能体 CLI：Claude Code、Codex、Gemini 等等。",
        },
      },
    },
    decision: {
      heading: { eyebrow: "怎么选", title: "你该用哪一个？" },
      oursHeading: "这些情况选 ai4kanban",
      theirsHeading: "这些情况选 Vibe Kanban",
      ours: [
        "你想要一块由智能体直接在仓库里编辑的规划看板。",
        "你想要零基础设施：git 里的文件，没有需要运行、需要常驻的东西。",
        "你不愿把自己的看板拴在一个可能关停的产品上。",
        "你一次只驱动一个智能体，比起并行更看重一份清楚的计划。",
      ],
      theirs: [
        "你想并行运行许多编码智能体，各自隔离。",
        "你想在一个驾驶舱里做行内 diff 评审与实时预览。",
        "编排与审查智能体运行才是你真正的瓶颈。",
        "Bloop 关停之后，你能接受依赖一个社区 fork。",
      ],
      verdict:
        "它们解决的是不同的瓶颈。Vibe Kanban 是一个运行许多智能体的**编排驾驶舱**；ai4kanban 是一块由一个智能体在你仓库里编辑的**规划看板**。如果你爱的是 Vibe Kanban 那块用来排活的看板，ai4kanban 会以比任何公司都活得久的纯文件形式把它给你。如果你爱的是它那台并行智能体引擎，ai4kanban 不是，我们宁可直说。",
      note: "Bloop 关停之后，那块看板才是值得不带任何公司继续往前带的部分，而 ai4kanban 正是这个东西。",
    },
  },

  vsLinear: {
    meta: {
      title: "AI4Kanban vs. Linear — 仓库内的 AI 项目管理",
      socialTitle: "AI4Kanban vs. Linear",
      description:
        "比较 ai4kanban 与 Linear app：一个是面向编码智能体、运行在仓库内的规划循环，另一个是包含智能体平台、项目与问题跟踪的团队工作区。",
      social:
        "Linear 是更强的团队系统，ai4kanban 是更专注的仓库内规划循环。看看双方在智能体、价格与工作方式上的适用场景。",
    },
    hero: {
      badge: "对比",
      title: "AI4Kanban vs.\nLinear",
      lead: "Linear 是一套成熟的项目管理工作区，让人和智能体在里面协作。ai4kanban 则是一块仓库内的规划看板，由智能体把粗略想法反复细化到可以开工。它不是一个更便宜的 Linear，而是另一种规划方式。",
      ours: {
        name: "AI4Kanban",
        body: "仓库里的纯 Markdown，由智能体负责完整的规划循环。",
      },
      theirs: {
        name: "Linear",
        body: "托管的团队工作区，人和智能体一起规划、开发与评审。",
      },
    },
    summary: {
      heading: {
        eyebrow: "简单说",
        title: "Linear 也有智能体，差别在于规划住在哪里",
      },
      lead: "Linear 早已不是加了一点 AI 的问题跟踪器。Linear Agent 能使用整个工作区的上下文；智能体平台可以把问题委派给编码智能体；MCP server 能接入外部智能体；Coding Sessions 还能运行 Claude Code 或 Codex，再把 pull request 带回工作区评审。",
      panel:
        "选择 ai4kanban 的理由更窄：你希望**智能体在仓库里负责规划循环**。一个粗略需求会变成问题、决策、依赖关系和可直接开工的卡片。看板及其记忆以可审查的 Markdown 留在代码旁边。",
    },
    comparison: {
      heading: { eyebrow: "正面对比", title: "AI4Kanban vs. Linear" },
      lead: "{check} 表示这一项更适合哪一方；**横线**表示取决于你的工作方式。Linear 胜在**团队协作、产品组合规划、集成和内置的智能体执行**；ai4kanban 胜在**仓库内细化、可移植性，以及 git 里的规划记忆**。",
      ourLabel: "AI4Kanban",
      theirLabel: "Linear",
      rows: {
        bestFit: {
          dimension: "最适合谁",
          kanban: "由编码智能体推动工作的独立开发者和小团队。",
          linear: "需要协调成员、项目与智能体的产品和工程团队。",
        },
        sourceOfTruth: {
          dimension: "事实来源",
          kanban: "项目仓库里的 Markdown，与代码一起做版本控制。",
          linear: "共享的 Linear 工作区，通过应用、API 或 MCP 访问。",
        },
        refinement: {
          dimension: "从粗略想法到可开工任务",
          kanban: "refine 与 resolve 循环自行回答能回答的问题，记录其余问题，直到卡片足够具体才停止。",
          linear: "Linear Agent 可以起草、总结、更新并帮助界定工作；Coding Sessions 的结果仍取决于问题本身写得是否清楚。",
        },
        agentModel: {
          dimension: "智能体模式",
          kanban: "由你现有的运行环境读写看板；目前已接好 Claude Code 和 Codex。",
          linear: "Linear Agent 加上可安装的 app user、问题委派、智能体指南和托管的 MCP server。",
        },
        execution: {
          dimension: "编码与评审",
          kanban: "你选择的运行环境负责实现 ready 卡片，评审留在该运行环境与 git 工作流中。",
          linear: "Coding Sessions 在云端运行 Claude Code 或 Codex、创建 PR，并把 diff 与评审放进 Linear。",
        },
        collaboration: {
          dimension: "人类协作",
          kanban: "适合小团队通过 git 协作，不擅长多人同时编辑看板。",
          linear: "实时工作区，包含成员、负责人、评论、私有团队、访客与权限。",
        },
        portfolio: {
          dimension: "规划广度",
          kanban: "卡片、依赖、优先级、ROI、release 和模块记忆。",
          linear: "问题、项目、cycle、initiative、milestone、timeline、triage、insight 与客户请求。",
        },
        setup: {
          dimension: "安装",
          kanban: "一条 prompt 装进仓库；看板本身不需要账号、数据库或远程服务。",
          linear: "创建工作区，再按团队需要连接集成并配置智能体权限。",
        },
        portability: {
          dimension: "可移植性",
          kanban: "克隆仓库，看板、决策和历史便一起带走；离线也能工作。",
          linear: "数据存放在 Linear；管理员可以把工作区问题导出为 CSV，也可以使用 API。",
        },
        pricing: {
          dimension: "价格",
          kanban: "Apache-2.0，免费；你只需为自己选择的编码智能体工具付费。",
          linear: "Free：250 个问题、2 个团队。Basic：年付每人每月 $10。Business：年付每人每月 $16。Coding Sessions 还会消耗 AI credits。",
        },
      },
    },
    model: {
      heading: { eyebrow: "真正的差别", title: "仓库记忆 vs. 团队工作区" },
      lead: "两款产品如今都支持智能体。关键问题是：**哪一份上下文拥有计划**，项目仓库，还是共享的公司工作区？",
      ours: {
        name: "AI4Kanban — 仓库与你一起规划",
        is: "智能体修改计划前，会先读代码、过去的决策、被否决的想法和已经交付的工作。它持续细化，直到所有开放问题得到回答，或明确交给你决定。",
        isnt: "它不是一套广泛的协作平台。有用的规划记忆会和代码一起提交，并跟随每一次克隆。",
      },
      theirs: {
        name: "Linear — 工作区协调所有人",
        is: "问题归属团队，项目可以跨团队；cycle、initiative、timeline、文档、评论和客户请求构成共享上下文。智能体也在这套有权限控制的工作区里行动。",
        isnt: "如果独立开发者真正的问题，只是把一个粗略需求变成可靠方案，那么它提供的系统往往远超所需。",
      },
      note: "两者可以并用，但你必须决定由谁拥有任务状态。对独立开发者而言，两份事实来源通常只会增加流程。",
    },
    wins: {
      heading: { eyebrow: "取舍", title: "各自赢在哪里" },
      lead: "Linear 胜在广度、协作与一体化执行。ai4kanban 胜在让智能体主导的规划保持本地、可检查，而且不会在两次运行之间丢失。",
      oursHeading: "AI4Kanban",
      theirsHeading: "Linear",
      ours: {
        roughToReady: {
          title: "把粗略需求变成可开工任务",
          body: "智能体会循环提问、研究、拆分和解决问题，而不是把第一版问题描述直接当成方案。",
        },
        repoMemory: {
          title: "规划记忆就在代码旁边",
          body: "决策、被否决的想法、依赖关系与卡片都是纯文本、可 diff 的文件，下一次智能体运行默认就会读取。",
        },
        anyHarness: {
          title: "使用你自己的运行环境",
          body: "看板不绑定 Linear Agent 或某一种编码集成。Claude Code 与 Codex 已经可用，开放的文件格式也欢迎任何运行环境。",
        },
        noSaas: {
          title: "无需管理看板 SaaS",
          body: "规划界面本身没有工作区、席位、认证、数据库或同步层。看板就是仓库的一部分。",
        },
      },
      theirs: {
        teamSystem: {
          title: "真正面向人类团队的系统",
          body: "多人同时编辑、明确归属、权限、评论、私有团队、访客、通知，以及成熟的界面。",
        },
        agentPlatform: {
          title: "智能体与执行都已内置",
          body: "Linear Agent、app user、MCP、问题委派、Coding Sessions、diff 与 pull request 评审共享同一套工作区上下文。",
        },
        planningDepth: {
          title: "深入的产品规划",
          body: "项目、cycle、initiative、milestone、timeline、triage、insight 和客户请求，远超一块小型仓库看板。",
        },
        integrations: {
          title: "集成与可搜索的上下文",
          body: "GitHub、GitLab、Slack、Teams、客服工具、API、webhook 与工作区搜索，把公司的其他工作连接起来。",
        },
      },
    },
    decision: {
      heading: { eyebrow: "怎么选", title: "你该用哪一个？" },
      oursHeading: "这些情况选 ai4kanban",
      theirsHeading: "这些情况继续用 Linear",
      ours: [
        "独立开发者或小团队通过编码智能体推动工作。",
        "输入通常很模糊，规划循环才是真正的瓶颈。",
        "你希望任务与长期决策以 git 文件留在代码旁边。",
        "你想自己选择运行环境，而不是采用看板自带的智能体运行时。",
      ],
      theirs: [
        "多人需要同时创建、分配、讨论和更新工作。",
        "你依赖 cycle、initiative、timeline、triage、客户请求或报告。",
        "你希望在项目管理工具内委派云端编码任务并评审 diff。",
        "你需要全公司的集成、权限、安全控制和支持。",
      ],
      verdict:
        "Linear 是更强的**团队系统**，ai4kanban 是更专注的**仓库内规划循环**。如果瓶颈是人与人之间的协调，继续用 Linear。如果编码智能体总在接收模糊工作，又不断遗失背后的决策，就把看板放进仓库，让智能体在那里把需求细化清楚。",
      note: "这是规划方式的改变，不是按功能逐项替换 Linear。",
    },
  },
};

export default zh;
