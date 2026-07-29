// 简体中文 — mirrors `en.ts` key for key. See that file for the inline markup
// rules (`code`, **bold**, *italic*, \n).
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
      origin: "最初是为以下项目做的技能：",
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
      title: "AI4Kanban — 会跟着你一起成长的 AI 项目管理",
      description:
        "为 Claude Code 打造的 AI 项目管理。给它一个模糊的想法，智能体会把它拆开、反复追问，直到清楚得可以动手。纯 Markdown，就放在 git 里。",
      social:
        "给它一个模糊的想法。智能体会把它拆开，自己能定的就自己定，剩下的来问你，并且一直在后台推进，直到每个细节都清楚得可以动手。",
    },
    hero: {
      badge: "一个 Claude Code 技能",
      title: "会跟着你一起成长的\nAI 项目管理。",
      lead: "给它一个模糊的想法。智能体会把它拆开，自己能定的就自己定，剩下的来问你，并且一直在后台推进，直到每个细节都清楚得可以动手。看板就是 `docs/kanban/` 里的纯 Markdown：放在 git 里，不用数据库，也不用 MCP。",
      ctaInstall: "一句话完成安装",
      ctaGithub: "在 GitHub 上查看",
    },
    quickview: {
      caption: "看板在终端里的样子，就是 git 里的那几个文件。",
      taskView: "任务名",
      fileView: "文件路径",
      frontAria: "{view}视图（当前）",
      flipAria: "切换到{view}视图",
    },
    features: {
      breakDown: {
        title: "把工作拆开",
        body: "智能体读完一个想法，把它拆成子任务。夹带进来的无关需求，会被单独拆出来，另立一张卡。",
      },
      clarify: {
        title: "反复追问到清楚",
        body: "智能体先质疑这个想法。凭记忆和常识能定的，它自己定；剩下的来问你。它会一直循环，直到再也问不出问题。",
      },
      alwaysOn: {
        title: "全天候运转",
        body: "拆解和追问会一直在后台跑，直到这个想法变成一份清楚的方案。",
      },
      traceable: {
        title: "每个决定都有迹可循",
        body: "一份方案是怎么一步步成形的，你随时都能回头看。",
      },
      proposes: {
        title: "自己提任务",
        body: "智能体会从每个模块的记忆里翻出值得做的功能来提。你否掉一个，它会记下来，同类的想法不会再提第二次。",
      },
      selfEvolving: {
        title: "自我进化",
        body: "你每插手一次，那个判断都会被记下来，影响智能体之后的决定。记忆按项目模块分开存放。",
      },
      orders: {
        title: "安排先后顺序",
        body: "它不只是把任务拆开，还会找出依赖关系，把收益和投入放在一起权衡，让工作按正确的顺序推进。",
      },
      lifecycle: {
        title: "全程管到底",
        body: "方案清楚了并不算完。从提出、澄清、开发到归档，一张卡的整个生命周期它都盯着，所以看板上永远是项目真实的样子。",
      },
    },
    featuresNote:
      "AI4Kanban 是给小团队用的。今天的编码智能体拿到一份清楚的方案，已经能写出跑得起来的代码；可要是给它一个模糊的想法，它就会在错误的假设上造出错误的东西。AI4Kanban 记得你过去的决定，并据此把同一个模糊想法变成一份具体到能动手的方案。",
    install: {
      heading: { eyebrow: "安装", title: "一句话完成安装" },
      lead: "在你的项目根目录下，对 Claude Code（或任何能执行 shell 命令的智能体）说：",
      note: "智能体会把技能复制到 `.claude/skills/kanban/`，读你的代码库来填好配置，搭起看板，然后给你提出头三个任务。",
    },
    board: {
      heading: { eyebrow: "用法", title: "在 Claude Code 里使用 AI4Kanban" },
      lead: "装好之后，用平常的话指挥它：",
      terminal: "you › claude",
      rows: {
        whatsNext: {
          say: '"/kanban 接下来做什么？"',
          does: "读看板和你的资料源，提出 3 个新任务",
        },
        addTask: {
          say: '"/kanban 加个任务：…"',
          does: "审一遍这个想法，写成一张卡，加进索引",
        },
        refine: {
          say: '"/kanban refine #4"',
          does: "审查 4 号卡，再把它往具体推进一步",
        },
        review: {
          say: '"/kanban 检查一下看板"',
          does: "逐张检查卡片是否清楚、是否重复、是否其实已经做完",
        },
        done: {
          say: '"/kanban #4 做完了"',
          does: "压缩进归档，删掉这张卡",
        },
        badIdea: {
          say: '"/kanban #4 是个馊主意"',
          does: "把原因记进 rejected.md，以后不会再提",
        },
      },
    },
    ui: {
      heading: { eyebrow: "看板界面", title: "一个能在浏览器里打开的本地看板" },
      lead: "比起问，你更想直接看？一条命令就能在同一批 Markdown 文件上打开一个看板：完整读一个任务，不用在 IDE 目录树里翻文件；点一下就能动手，不用再把同样的提示词打进聊天框。",
      optional:
        "它是可选的，安装步骤不会多装任何东西。想用的时候，跟 Claude 说一声就行：",
      started: "Claude 会替你启动预编译好的服务，只在本地，什么都不用编译。",
      actionsLead: "每张卡上的按钮都会把一步操作交给智能体，不用打字：",
      actions: {
        implement: { label: "实现", body: "把这张卡交给 Claude 去做" },
        edit: { label: "编辑", body: "改这张卡，先别执行" },
        refine: { label: "细化", body: "把卡住的卡往前推一步" },
        resolve: { label: "答疑", body: "回答这张卡上待定的问题" },
        archive: { label: "归档", body: "把做完的卡收起来" },
        reject: { label: "否决", body: "丢掉这张卡并写明原因" },
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
      lead: "没人看着的时候埋头做一整天，是单干最经典的陷阱。这个预设把你的时间分成三份：找用户、验需求、做产品。Claude 会让新任务均摊到这三份上，而不是全堆在一边。",
      tracks: {
        growth: {
          body: "让用户看见你：发帖、私信、上线首发。Claude 会建议值得一试的路子，并帮你写好稿子。",
        },
        validation: {
          body: "在深入开发之前，先确认市场要不要。抛一个诚恳的问题、给个试用、把结论存下来。",
        },
        building: {
          body: "守住 MVP。只在能放大你的产出、能加固产品，或用户明确开口时才动手做。",
        },
      },
      note: "`indie-hacker` 预设还加了两道审查关卡：护城河测试和信任测试，外加一套在开工前先去 Reddit 或 X 上验证市场的方法。安装时可以换成你自己的分类和权重。",
    },
    advanced: {
      heading: {
        eyebrow: "功能",
        title: "用 Markdown 做项目管理，而不是一张平铺清单",
      },
      lead: "平铺的待办清单就只是一张清单。这套东西能做到清单做不到的四件事：周期性工作、大任务的子任务、做过什么的记忆，以及一份吞吐量统计。",
      recurring: {
        title: "周期性任务",
        body: "有些工作永远不是做一次就完。把每件这样的工作当成一张卡放进 `docs/kanban/todo/recurring/`（这类卡永远不会归档），再让 Claude Code 的 `/loop` 按你定的节奏跑它，比如每天早上一次。",
        examples: {
          competitors: {
            label: "盯竞品",
            body: "看看对手上线了什么、改了什么，把值得回应的挑出来。",
          },
          listening: {
            label: "听社区",
            body: "拉取 Reddit 或 Slack 上的新帖，把真正重要的浮上来。",
          },
          boardReview: {
            label: "查看板",
            body: "把待办里过期的、重复的、其实已经做完的卡清一遍。",
          },
        },
        ladderLead:
          "不是每件工作都需要同样的自动化程度。一张卡可以停在任何一级：从你亲手做，到 Claude 替你做，再到一个脚本自己跑：",
        ladder: {
          ask: { label: "你亲手做" },
          agent: { label: "Claude 替你做" },
          script: { label: "一条命令搞定，不用人" },
        },
        ladderNote:
          "每件工作能往上推多少就推多少：有些注定要亲力亲为，有些则会自己跑起来。",
      },
      group: {
        title: "任务组",
        body: "一个大到无从下手的任务，往往就那么一直躺着。当一张卡装不下它，它就会变成一个**任务组**：自己的一个文件夹，里面有一份用来跟踪的 `root.md`，以及每个部分各自一张卡。每个部分有自己的编号，并用 *Blocked by* 和 *Related* 串起来，所以你永远知道下一个该拿哪一个。",
      },
      memory: {
        title: "项目记忆",
        body: "用看板推进工作是一个循环。每一轮，Claude 从三个来源里挖出新任务提给你，你来拍板，它再把结果收进记忆中枢，于是下一轮是接着上一轮往前走，而不是重来一遍。",
        hubLabel: "docs/kanban/：存放你反馈的中枢",
        files: {
          memory: {
            body: "每次扫描的笔记会传给下一次，每个来源都带一条水位线，所以它只会重读变化过的部分。",
          },
          archive: {
            body: "做完的工作会缩成一行。提新任务前它会先读这里，所以不会再建议已经做完的事。",
          },
          rejected: {
            body: "你否掉的想法连同原因一起留着，所以它再也不会拿这些来烦你。",
          },
          redesign: {
            body: "你纠正过的设计失误会变成一条笔记，下一张卡就不会重蹈覆辙。",
          },
        },
        loop: {
          aria: "这个循环：先提议，然后你拍板，再学习，接着重新开始。",
          centerCaption: "读取与写入",
          stepLabel: "第",
          stages: {
            propose: {
              label: "提议",
              body: "从三个来源里找出还没做完、也没被搁置的工作：",
            },
            decide: {
              label: "你拍板",
              body: "做、跳过，或者改方案。回 Claude 几个字就够了。",
            },
            learn: {
              label: "学习",
              body: "把结果和你的反馈收进中枢，下一轮起点就更准。",
            },
          },
          sources: {
            project: {
              label: "你的项目",
              body: "代码库、看板、文档、团队聊天。它会把已有的东西串成值得做的工作。",
            },
            outside: {
              label: "外部世界",
              body: "Reddit、Slack、你的 CRM。周期任务会拉进新信号，把发现丢到看板上。",
            },
            you: {
              label: "你",
              body: "你自己的方向和反馈，都留在看板里，所以一个好判断不会丢，也不会被问第二遍。",
            },
          },
        },
      },
      metrics: {
        title: "任务指标",
        body: "每张归档的卡就是一个交付单位，所以你的速度就是 git 里紧挨着代码的一个数字，不用再同步一个外部工具。",
        chart: {
          aria: "十二天的每日吞吐量：总计、完成、新建、否决的任务数。",
          series: {
            total: "总计",
            completed: "完成",
            created: "新建",
            rejected: "否决",
          },
          caption:
            "`metrics.csv` 里每天一行：完成、新建、否决，以及三者之和。脚本会自动维护，你永远不用碰它。",
        },
      },
    },
  },

  vsGithub: {
    meta: {
      title: "AI4Kanban vs. GitHub Issues — 不同的活，用不同的工具",
      socialTitle: "AI4Kanban vs. GitHub Issues",
      description:
        "ai4kanban 的文件式看板和 GitHub Issues 比起来如何：本地 Markdown 对远程 API、token 成本、智能体使用体验、团队协作，以及各自该在什么时候用。",
      social:
        "不是替代品，而是给另一个瓶颈准备的另一件工具。一场关于速度、token、智能体和团队的正面较量。",
    },
    hero: {
      badge: "对比",
      title: "AI4Kanban vs.\nGitHub Issues",
      lead: "不是替代品，而是给另一个瓶颈准备的另一件工具。GitHub Issues 是一份共享、持久、公开的权威记录；ai4kanban 是一块私有、本地、为智能体而生的工作台。看你真正卡在哪里再挑。",
      ours: {
        name: "AI4Kanban",
        body: "你仓库里的纯 Markdown。智能体手边那块飞快的本地草稿板。",
      },
      theirs: {
        name: "GitHub Issues",
        body: "一个藏在 API 后面的数据库。共享、公开的权威记录。",
      },
    },
    summary: {
      heading: { eyebrow: "长话短说", title: "那为什么不直接用 GitHub Issues？" },
      lead: "可以啊。ai4kanban 做的事，几乎都能用 GitHub Issues 加上 `gh` CLI 或一个 GitHub MCP server 做到。区别在于代价。",
      panel:
        "同一件事放到 GitHub Issues 上，意味着**更多噪音**、**更多来回**、**更多 token**、**更高延迟**，还得**更用力地提示**才能让智能体愿意去用它。ai4kanban 拿 GitHub 的覆盖面换本地的速度；而对一个驱动着智能体单干的人来说，稀缺的通常正是速度。",
    },
    comparison: {
      heading: { eyebrow: "正面对比", title: "AI4Kanban vs. GitHub Issues" },
      lead: "十四个维度。{check} 表示明确胜出；**横杠**表示这是一处有意的取舍，只看你需要什么。ai4kanban 拿下**速度与本地化**那几行；GitHub Issues 拿下**规模与协作**那几行。",
      ourLabel: "AI4Kanban",
      theirLabel: "GitHub Issues",
      rows: {
        storage: {
          dimension: "存储",
          kanban: "你仓库里的纯 Markdown，存在 git 里。",
          issues: "GitHub 的数据库，藏在 API 后面。",
        },
        offline: {
          dimension: "能否离线",
          kanban: "能，不过是磁盘上的文件而已。",
          issues: "不能，需要网络和鉴权。",
        },
        agentReads: {
          dimension: "智能体怎么读",
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
          kanban: "本地磁盘，基本瞬时。",
          issues: "每次调用一趟网络往返。",
        },
        setup: {
          dimension: "上手成本",
          kanban: "一句话：一个技能文件加一个小脚本。",
          issues: "账号、鉴权令牌、MCP 配置。",
        },
        lockIn: {
          dimension: "厂商锁定",
          kanban: "没有，看板跟着仓库走。",
          issues: "只活在 GitHub 上。",
        },
        metadata: {
          dimension: "元数据",
          kanban: "刻意做得极简：优先级 + 工作量，单干需要的就这些。",
          issues: "标签、里程碑、指派人、项目板，为协调团队而生。",
        },
        concurrency: {
          dimension: "并发",
          kanban: "没有，两个人同时加 #1894 就撞号了。",
          issues: "编号由服务端分配，团队用着安全。",
        },
        history: {
          dimension: "决策历史",
          kanban:
            "只留下会影响下一个任务的决定：某个想法为什么被否、什么已经交付。所以智能体总是往前提，不会重做已完成或已死掉的活。",
          issues: "完整保留评论历史和编辑记录，一条都不丢。",
        },
        closing: {
          dimension: "收尾",
          kanban: "任务项全部打勾后归档这个任务。",
          issues: "关联的 PR 和 CI 会自动关闭 issue。",
        },
        search: {
          dimension: "规模化搜索",
          kanban: "grep：板子小的时候很快，长大了就难受。",
          issues: "带索引的全文搜索和保存好的过滤器。",
        },
        contributors: {
          dimension: "外部贡献者",
          kanban: "可以，但只能提交 Markdown，没有轻量的提单方式。",
          issues: "任何人都能提单、评论、点表情，不用提交代码。",
        },
        transparency: {
          dimension: "透明度",
          kanban: "每张卡都留在仓库里可见，只有记忆中枢会被精简到只剩要点。",
          issues: "公开且可链接，是开源世界的默认选择。",
        },
      },
    },
    wins: {
      heading: { eyebrow: "取舍", title: "各自赢在哪里" },
      lead: "谁也不是绝对更好。ai4kanban 是为一个智能体跑得快而优化的；GitHub Issues 是为一群人保持同步而优化的。",
      oursHeading: "AI4Kanban",
      theirsHeading: "GitHub Issues",
      ours: {
        tokenLight: {
          title: "省 token，快得没有感觉",
          body: "不用 MCP，不走网络。智能体是在 grep 本地 Markdown，而不是翻一个远程 API 的分页：token 更少、延迟更低，任务做到一半也不会碰上要刷新的鉴权。",
        },
        agentsUseIt: {
          title: "智能体是真的会用",
          body: "智能体不太愿意去搜 GitHub Issues，它们默认就伸手去拿文件系统工具。Markdown 看板正好长在它们已经站着的地方，提示更少，编造出来的任务状态也更少。",
        },
        offline: {
          title: "离线，而且是你的",
          body: "git 里的纯文件。飞机上能用，GitHub 挂了也能用。不依赖 SaaS，没有厂商锁定，克隆一下仓库，整块看板就跟着你走了。",
        },
        memory: {
          title: "为“提新任务”调过的记忆",
          body: "它记的是会影响下一个任务的决定：某个想法为什么被否、什么已经交付、离目标还差多少。所以智能体总是往前提，不会重做已完成的活，也不会重提你砍掉的东西。",
        },
      },
      theirs: {
        teams: {
          title: "为团队而生",
          body: "服务端分配编号、并发编辑安全、能指派人。ai4kanban 没有数据库，两个人可能同时造出 #1894 而撞车。",
        },
        transparency: {
          title: "透明与触达",
          body: "公开且可链接，外部贡献者能提单、评论、点表情。当开放比纯粹的速度更重要时，这里才是对的家。",
        },
        fullContext: {
          title: "全部上下文，永久保留",
          body: "ai4kanban 是刻意做压缩的，归档的卡会缩成一行。在 GitHub 上，每一条评论、每一次编辑、每一个交叉链接都原样留着。",
        },
        integration: {
          title: "深度集成",
          body: "PR 自动关闭、提交链接、项目板、标签、里程碑，还有一整个第三方工具生态和能撑住规模的索引搜索。",
        },
      },
    },
    ergonomics: {
      heading: { eyebrow: "关键所在", title: "智能体为什么偏爱文件" },
      lead: "真正的差别，要等智能体动手干活时才显出来。问同一句话：**“找出我那些高优先级的未完成任务”**，两条路径几乎毫无相似之处。",
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
        footer: "好几次工具调用 · 好几 KB 的 JSON · 每次都要走网络",
      },
      kanban: {
        title: "you › agent + ai4kanban",
        chip: "一轮搞定",
        lines: [
          "找出我那些高优先级的未完成任务",
          'grep -rl "Priority: high" docs/kanban/todo',
          "三个文件路径",
          "完事，一次调用，不走网络",
        ],
        footer: "一次工具调用 · 几个路径 · 全在本地",
      },
      note: "而且这笔账会越滚越大。每一次“接下来做什么？”、每一次归档、每一次看板检查，在 GitHub Issues 上都要交一遍往返税。而模型只要有得选，就会悄悄绕开那个远程工具，转头去找文件。",
    },
    decision: {
      heading: { eyebrow: "怎么选", title: "你该用哪一个？" },
      oursHeading: "这些情况选 ai4kanban",
      theirsHeading: "这些情况选 GitHub Issues",
      ours: [
        "你一个人干，或者只有一两个彼此信任的搭档。",
        "你是在终端里通过智能体推进工作的。",
        "比起留档，你更在乎往前走。",
        "你想让看板待在 git 里，能离线，能带走。",
      ],
      theirs: [
        "你在公开构建，透明度很重要。",
        "多个人会同时改动待办列表。",
        "你很依赖 PR/CI 关联、项目板和里程碑。",
        "你需要外部贡献者能提单、能讨论。",
      ],
      verdict:
        "它们其实不算竞争对手。GitHub Issues 是**共享的权威记录**；ai4kanban 是**智能体手边那块飞快的本地草稿板**。如果你的瓶颈是人和人之间的协调，用 GitHub Issues。如果瓶颈是你和智能体一起的产出速度，用 ai4kanban。",
      note: "不少独立开发者两个都用：GitHub Issues 当公开的跟踪器，ai4kanban 当智能体每天打交道的私有工作面。",
    },
  },

  vsHermes: {
    meta: {
      title:
        "AI4Kanban vs. Hermes Agent Kanban — 轻量文件式看板 vs. 持久化运行时",
      socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
      description:
        "ai4kanban 的文件式看板和 Nous Research 的 Hermes Agent Kanban 比起来如何：两个高度重叠的智能体看板，一边是能在任何智能体（包括 Hermes）上跑、可 diff 的纯文件，一边是许多具名智能体共同领取任务的持久化 SQLite 队列。",
      social:
        "两个高度重叠的智能体看板。ai4kanban 是轻量的文件式看板，任何智能体（包括 Hermes）都能跑；Hermes 把同一套看板和一条多智能体共享的持久化队列打包在一起。",
    },
    hero: {
      badge: "对比",
      title: "AI4Kanban vs.\nHermes Agent Kanban",
      lead: "两个面向智能体的看板，重叠的地方不少。差别在于看板处在技术栈的哪一层：ai4kanban 是一层精简的*看板层*，你可以在它上面跑任何智能体；Hermes Agent Kanban 则把那层看板熔进了自己的运行时。",
      ours: {
        name: "AI4Kanban",
        body: "你仓库里的纯 Markdown 看板。运行时、执行、甚至维护都叠在上面，换掉智能体，看板照旧。",
      },
      theirs: {
        name: "Hermes Agent Kanban",
        body: "看板、调度器和具名智能体是一个整体运行时，持久、开箱即用，但看板拆不下来。",
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
      lead: "问得好，两者确实重叠很多。都是智能体用来规划和干活的看板，所以可以把 ai4kanban 看成**Hermes Kanban 的轻量替代**：同一个看板思路，减掉打包进来的运行时。差别在下面那一层。",
      oursHeading: "AI4Kanban — 由文件组成的看板",
      theirsHeading: "Hermes Kanban — 运行时里面的看板",
      ours: [
        "你仓库里的纯 Markdown，每一次任务和方案的改动都是一个可评审的 diff。",
        "没有任何基础设施：不用装，也不用一直开着。",
        "执行交给你本来就在用的环境：Claude Code、Codex、Cursor，甚至 Hermes。",
      ],
      theirs: [
        "位于 ~/.hermes/kanban.db 的持久化 SQLite 队列，许多具名智能体和人一起共享。",
        "调度器把就绪的任务分给智能体，并能恢复崩溃的运行。",
        "绑定 Hermes / Nous 技术栈及其 kanban_* 工具。",
      ],
      whenLabel: "什么时候用 ai4kanban",
      when: "当你希望看板**和代码一起被版本管理**、当你打算留在本来就在用的环境里、或者当你不想为了一块任务板去运维一个运行时，就选这个技能。当**你已经在深度使用 Hermes**时，就选 Hermes Kanban，它的看板能直接接上你配好的调度器、具名 profile 和聊天端控制。说到底两者都是持久化队列：这个技能的队列是 git 里的文件，Hermes 的是 SQLite 里的行。",
    },
    harness: {
      heading: { eyebrow: "运行环境支持", title: "哪些智能体能跑这块看板？" },
      lead: "这是最清楚的一处差别。技能的看板就是纯文件，所以**任何能读仓库的智能体都能跑**，包括 Hermes 自己。Hermes Kanban 的看板藏在运行时的 `kanban_*` 工具后面，所以只有 Hermes 能。",
      oursSub: "任何能读文件的智能体",
      theirsSub: "只有 Hermes",
      supported: "支持",
      notSupported: "不支持",
      note: "……而且技能这一行还能一直往下列：Windsurf、OpenCode、Gemini CLI，任何会读文件的都行。Hermes Kanban 则没有给别的智能体留门。",
    },
    comparison: {
      heading: { eyebrow: "正面对比", title: "AI4Kanban vs. Hermes Kanban" },
      lead: "{check} 表示明确胜出；**横杠**表示是一处取舍。技能赢在简单和可迁移，Hermes 赢在持久共享队列和规模，其余打平。",
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
          kanban: "自己没有，看板就是你仓库里的纯 Markdown 文件。",
          hermes: "一个常驻网关、一个 SQLite 数据库，外加一个调度循环。",
        },
        whereBoardLives: {
          dimension: "看板存在哪",
          kanban:
            "在你仓库里，纳入版本管理，每一次任务和方案的改动都是一个可评审的 diff。",
          hermes:
            "在 ~/.hermes/kanban.db 这个 SQLite 库里；改动进的是事件日志，不是 diff。",
        },
        setup: {
          dimension: "上手成本",
          kanban: "一句话：一个技能文件加一个小脚本。",
          hermes: "装 Hermes 运行时、配好 profile、把网关跑起来。",
        },
        parallelRuns: {
          dimension: "并行与定时运行",
          kanban:
            "由你的运行环境驱动：你一发起，Claude Code 就会并行拉起子智能体；定时的活放在 recurring/ 目录里。",
          hermes:
            "由运行时驱动：调度器自己捡起就绪的任务，并为每个任务拉起一个工作进程。",
        },
        crashRecovery: {
          dimension: "崩溃恢复",
          kanban: "没有逐任务的队列，跑到一半挂掉的任务，下一次定时会重跑。",
          hermes:
            "持久队列会自动接管进行中的活：领取 TTL、心跳、过期领取回收、重试。",
        },
        decomposition: {
          dimension: "任务拆解",
          kanban:
            "一张卡拆成待办项和一张任务图，分组、阻塞、关联，依赖关系在写的时候就理清了。",
          hermes:
            "调度器自动跑一个 LLM 拆解器，把一个任务展开成子任务图，分派给各自的专职智能体。",
        },
        reviewMemory: {
          dimension: "审查与记忆",
          kanban:
            "记忆被精简成“为什么否掉”和“交付了什么”，好让智能体往前提，是筛选过的，不是完整日志。",
          hermes: "保留完整的追加式事件日志和每次尝试的运行记录，供审计用。",
        },
        dashboard: {
          dimension: "仪表盘界面",
          kanban:
            "一个本地网页看板，卡片上的操作（实现、审查、归档）会把活交给智能体。",
          hermes: "一个实时网页看板，支持拖拽和侧边抽屉，还能从聊天应用里控制。",
        },
        scale: {
          dimension: "规模与触达",
          kanban: "一块单人看板；板子长大之后 grep 就不好使了。",
          hermes:
            "能扩展到跨多块看板的许多智能体，多租户，可从 Discord / Slack / 邮件 / 短信控制。",
        },
      },
    },
    memory: {
      heading: { eyebrow: "记忆 vs. 审计", title: "两块看板各自记住什么" },
      lead: "本质差别：技能的记忆是**规划的输入**，它存在是为了让下一次提议更聪明。Hermes 的日志是**执行的产出**，它存在是为了让过去能被回放。",
      ours: {
        heading: "AI4Kanban",
        verdict: "记住结论，其余的忘掉。",
        body: "四个小文件，**故意做了精简**：`archive.md`（交付了什么）、`rejected.md`（我们否掉了什么，为什么）、`redesign.md`（不该重犯的设计失误）、`memory.md`（过去的扫描学到了什么）。智能体在提议或写卡之前会全部读一遍；完整的历史是 git 的活。",
        q: "想法 X 为什么不在看板上？",
        a: "`rejected.md` 里的一行：这个想法，以及它被否掉的原因。死掉的想法就让它死透。",
      },
      theirs: {
        heading: "Hermes Kanban",
        verdict: "记住每一个事件，什么都不概括。",
        body: "每一次状态流转都落进一份**只追加的日志**；每一次尝试都留着退出码和完整的工作进程输出。这是为审计和崩溃恢复设计的，不是为了指引下一个想法。",
        q: "42 号任务昨晚发生了什么？",
        a: "`claimed → crashed → reclaimed → completed`，还带着每次尝试的日志可以翻。",
      },
      note: "筛选过的记忆让智能体下一次更聪明；审计日志让过去可以被还原。谁也替代不了谁。",
    },
    autonomy: {
      heading: { eyebrow: "自主程度", title: "该给智能体多大的自主权？" },
      lead: "Hermes Kanban 承诺的是**“丢一句话，然后走人”**，完全自主。ai4kanban 是**智能体辅助**，而且起点比 plan mode 还早：你把一个半成形的想法存进看板，`refine` 把它变成具体的需求，你批准之后才会写下第一行代码。",
      stops: {
        traditional: {
          level: "无自主",
          term: "人来驱动",
          heading: "传统看板",
          detail: "每个任务都得你自己想出来、自己拆开，Trello 或 Jira 只负责记下来。",
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
        "**丢完就忘：**早期一个小小的误解，长成一整棵错误的任务树，而且都做出来了，token 也花掉了。",
      worstCaseOurs:
        "**智能体辅助：**一张写错的 Markdown 卡，在你审阅时就被抓住，什么都还没开始做。",
      note: "一次 refine 会补上缺失的步骤、把顺带冒出来的想法拆成独立的卡、把已经落地的待办打上勾，再把需要品味判断的留成问题给你。等问题都没了，这张卡就翻成**ready**：读一遍，然后开工。",
    },
    gui: {
      heading: { eyebrow: "两个仪表盘", title: "看板图形界面" },
      lead: "两边都带网页看板，但扮演的角色不同。技能的看板是**你操控智能体的控制面**，卡片上的操作会发起运行。Hermes 的看板是**通向调度器的实时窗口**，它显示整个机队此刻在干什么。",
      ours: {
        heading: "AI4Kanban — 本地看板",
        body: "架在 Markdown 文件之上的本地网页看板。卡片上的操作（*实现、审查、归档*）会把活交给智能体，你能看着它的日志流回来，中间还能人工介入。",
        alt: "ai4kanban 的本地网页看板：浅色界面，带 Blockers、UI、Skill、Docs、Distribution 各列和一个 Create task 按钮。",
      },
      theirs: {
        heading: "Hermes Kanban — 调度器实时视图",
        body: "一个实时追踪事件日志的看板：可以在列之间拖拽，侧边抽屉里有运行历史和退出状态徽章，同一块看板还能从 Discord、Slack 或短信里操控。",
        alt: "Hermes Agent 的看板仪表盘：深色界面，带 Triage、Todo、Scheduled、Ready 各列和一条编排工具栏。",
      },
    },
    wins: {
      heading: { eyebrow: "取舍", title: "各自赢在哪里" },
      lead: "谁也不是绝对更好。ai4kanban 优化的是一块自己不带任何基础设施的轻量文件式看板；Hermes Kanban 优化的是一条持久共享的工作队列，让许多智能体无人值守地跑。运行环境本身的能力，比如并行运行、编排、仪表盘，两边都有，所以这里就不列了。",
      oursHeading: "AI4Kanban",
      theirsHeading: "Hermes Kanban",
      ours: {
        noInfra: {
          title: "自己不带任何基础设施",
          body: "没有数据库，没有网关，没有守护进程。除了你本来就在跑的智能体，看板就是几个 Markdown 文件，不用额外安装，也不用一直开着，在飞机上照样用。",
        },
        diffable: {
          title: "能 diff、能版本化的文件",
          body: "看板住在仓库里、跟着仓库走，用你自己那套版本管理就行。每一次任务和方案的改动都是一个可评审的 diff：项目之外没有 SQLite，没有要查询的事件日志，也不会被绑死在某一套智能体技术栈上。",
        },
        selfPruning: {
          title: "会自我精简的记忆",
          body: "它记下某个想法为什么被否、什么已经交付，让智能体往前提，而不是把死掉的活又端出来。它只留下会影响下一个任务的东西，而不是一份完整的审计日志。",
        },
        onePrompt: {
          title: "一句话就装好",
          body: "一个技能文件加一个小脚本，没有 profile 要配，没有调度器要调。它会长在任何能读文件的智能体已经站着的地方，Hermes 也算。",
        },
      },
      theirs: {
        manyAgents: {
          title: "一块看板，许多具名智能体",
          body: "一块持久的看板，多个具名智能体，还有人，在上面领取任务、交接工作。调度器轮询就绪任务，为每个任务拉起指定的智能体。技能的看板则由你当下所在的那一个运行环境驱动。",
        },
        selfHealing: {
          title: "会自愈的任务队列",
          body: "队列会跨越崩溃盯住每个任务：领取 TTL、心跳、过期领取回收、重试和熔断。一个工作进程可以中途挂掉，看板会把任务收回并重试。技能的文件也是持久的，但挂掉的运行只能等下一次定时。",
        },
        autoDecompose: {
          title: "自动拆解任务",
          body: "丢进一个粗略的任务，调度器的 LLM 拆解器就把它展开成一张子任务图，每个子任务分派给专职智能体，不用手工拆。技能则是把一张卡拆成待办项和一张需要手工照料的任务图。",
        },
        fleetReach: {
          title: "机队规模与触达",
          body: "为跨多块看板的许多智能体而生，多租户，可从 Discord、Telegram、Slack、邮件和短信控制。技能则是一块留在你仓库和终端里的精简单人看板。",
        },
      },
    },
    decision: {
      heading: { eyebrow: "怎么选", title: "你该用哪一个？" },
      oursHeading: "这些情况选 ai4kanban",
      theirsHeading: "这些情况选 Hermes Kanban",
      ours: [
        "你想要一块文件式看板，每一次任务和方案的改动都是一个可评审的 diff。",
        "你不想让它自带基础设施：纯文件、能离线、能带走、不锁定。",
        "你想让它跟智能体无关：Claude Code、Cursor，甚至 Hermes 自己。",
        "你一个人干，比起打包好的引擎更看重一块精简的看板。",
      ],
      theirs: [
        "你已经在深度使用 Hermes，profile、网关和聊天端控制都配好了。",
        "你想要一块持久看板，让许多具名智能体，还有人，一起共享。",
        "你想要一条能跨崩溃自动接管进行中任务的队列。",
        "你想让调度器自动拆解任务并分派给专职智能体。",
        "你要在多块看板和多个聊天平台上跑机队级的工作量。",
      ],
      verdict:
        "它们的重叠比名字看上去多得多，两者都是智能体看板。分歧在于打包了什么：ai4kanban 是一块**把自动化交给你的运行环境的文件式看板**；Hermes Agent Kanban 是同一块看板**外面裹了一条持久共享的工作队列**。如果你想要一块许多智能体共享、还能扛住崩溃的看板，用 Hermes。如果你想要一块待在仓库里、需要时才扩展的精简看板，用 ai4kanban。",
      note: "它们甚至可以并排放着：技能当那个在 git 里做规划和取舍的轻量地方，Hermes 当那条在你想清楚之后跑重活、跑共享工作的持久队列。",
    },
  },

  vsVibe: {
    meta: {
      title: "AI4Kanban vs. Vibe Kanban — 规划看板 vs. 智能体驾驶舱",
      socialTitle: "AI4Kanban vs. Vibe Kanban",
      description:
        "随着 Bloop 在 2026 年 4 月关停，Vibe Kanban 也停摆了。ai4kanban 的文件式看板比起来如何：一块待在你仓库里的轻量规划看板，对上一个并行跑许多编码智能体的驾驶舱，以及有哪些东西能延续下来。",
      social:
        "Vibe Kanban 背后的公司关停了。一块待在仓库里的规划看板，对上一个智能体编排驾驶舱：诚实的差别，以及有哪些东西能延续下来。",
    },
    hero: {
      badge: "对比",
      title: "AI4Kanban vs.\nVibe Kanban",
      lead: "Vibe Kanban 是一个并行跑许多编码智能体的驾驶舱，而它背后的公司 Bloop 已在 2026 年 4 月关停。ai4kanban 是一块规划看板，你的智能体把它当成仓库里的纯文件来编辑。两者解决的是不同的瓶颈。下面是诚实的差别，以及真正能延续下来的东西。",
      ours: {
        name: "AI4Kanban",
        body: "你仓库里的纯 Markdown。一块由你的智能体编辑的规划看板。",
      },
      theirs: {
        name: "Vibe Kanban",
        body: "一个本地网页应用。一个并行跑许多智能体的驾驶舱。",
      },
    },
    summary: {
      heading: {
        eyebrow: "长话短说",
        title: "Vibe Kanban 停摆了，接下来去哪？",
      },
      lead: "Vibe Kanban 背后的公司 Bloop 在 2026 年 4 月关停。付费计划被取消并退款，云端功能下线，项目彻底转为本地运行。它以 Apache-2.0 开源留了下来，但原仓库自 2026 年 4 月底就再没有新提交，所以它的未来现在压在社区 fork 上，而不是当初做出它的那支团队。",
      panel:
        "如果你在 Vibe Kanban 里看重的是那块**看板**，一个能安静地把工作排好、打磨清楚再交给编码智能体的地方，ai4kanban 会以 git 里的纯文件把它给你，没有会关停的公司，也没有要一直开着的服务。如果你看重的是那台**并行跑许多智能体的引擎**，先说清楚：ai4kanban 不是那个东西，我们宁可现在就告诉你，也不想让你读到第三节才发现。",
    },
    comparison: {
      heading: { eyebrow: "正面对比", title: "AI4Kanban vs. Vibe Kanban" },
      lead: "十个维度。{check} 表示明确胜出；**横杠**表示这是一处有意的取舍，只看你需要什么。ai4kanban 拿下**轻量与规划**那几行；Vibe Kanban 拿下**并行智能体与代码评审**那几行，那是它真正的强项，我们直说。",
      ourLabel: "AI4Kanban",
      theirLabel: "Vibe Kanban",
      rows: {
        whatFor: {
          dimension: "用来干什么",
          kanban: "一块由你的智能体在仓库里编辑的规划看板，把工作排好、打磨清楚。",
          vibe: "一个驾驶舱，用来并行跑许多编码智能体并审查它们产出的东西。",
        },
        orchestration: {
          dimension: "并行智能体编排",
          kanban: "没有，你驱动一个智能体；看板本身不跑智能体。",
          vibe: "它的核心强项：许多智能体同时跑，各自待在隔离的 git worktree 里。",
        },
        review: {
          dimension: "智能体产出的评审",
          kanban: "不归它管，diff 由你的运行环境显示。",
          vibe: "内置：行内 diff 评审、实时预览，还能处理 pull request。",
        },
        planning: {
          dimension: "规划与细化",
          kanban: "一个 refine 循环把粗略的想法变成一个可以开工的具体任务。",
          vibe: "很弱，看板主要是排队和跟踪智能体的运行。",
        },
        onDisk: {
          dimension: "在磁盘上是什么",
          kanban: "你仓库里的纯 Markdown，存在 git 里。",
          vibe: "配置目录里的一个本地 SQLite 数据库。",
        },
        runsAs: {
          dimension: "以什么形式运行",
          kanban: "就是文件，没有服务，也没有什么要一直开着。",
          vibe: "一个你启动后要一直开着的本地网页应用（Rust 后端 + 网页界面）。",
        },
        setup: {
          dimension: "上手成本",
          kanban: "一句话：一个技能文件加一个小脚本。",
          vibe: "npx vibe-kanban，外加每个智能体 CLI 都要装好并登录。",
        },
        whichAgents: {
          dimension: "哪些智能体能跑",
          kanban: "任何能读文件的智能体：Claude Code、Codex、Cursor，还有更多。",
          vibe: "它接好的那些智能体 CLI：Claude Code、Codex、Gemini 等。",
        },
        lockIn: {
          dimension: "厂商锁定",
          kanban: "没有，看板就是跟着仓库走的文件。",
          vibe: "Apache-2.0 且可自托管，关停前还发了一版数据导出。",
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
      lead: "这两件工具处在循环里的不同位置。一个是你决定**做什么**的地方；另一个是你**跑那些去做的智能体**的地方。把其中一个当成另一个，就是失望的由来，所以这里直说。",
      ours: {
        name: "AI4Kanban — 计划",
        is: "一块你的智能体在仓库里当纯 Markdown 来读写的看板。你存下一个粗略的想法，一个 refine 循环把它打磨成一个可以开工的任务，你批准之后才会写代码。工作内容就住在 git 里，紧挨着它要改的代码。",
        isnt: "它不跑智能体、不开 worktree、也不 diff 它们的产出，那是你的运行环境的活。它是地图，不是引擎。",
      },
      theirs: {
        name: "Vibe Kanban — 引擎",
        is: "一个本地网页应用，同时跑许多编码智能体，各自隔离在自己的 git worktree 里，然后让你在一个地方审查它们的 diff、预览应用。它的价值在于并行智能体运行带来的吞吐量。",
        isnt: "它不是为了把半成形的想法打磨成方案而造的，看板主要是排队和跟踪运行。细化的能力很弱。",
      },
      note: "不少人用 Vibe Kanban 只是为了那块看板。如果你就是这样，ai4kanban 是它更轻的一个家：git 里的文件，没有什么要一直开着。如果你用它是为了并行驱动智能体，那就盯着社区 fork；ai4kanban 不会替代那台引擎。",
    },
    wins: {
      heading: { eyebrow: "取舍", title: "各自赢在哪里" },
      lead: "谁也不是绝对更好。ai4kanban 优化的是一块比任何工具都活得久的轻量文件式看板；Vibe Kanban 优化的是同时跑并审查许多智能体。",
      oursHeading: "AI4Kanban",
      theirsHeading: "Vibe Kanban",
      ours: {
        nothingRunning: {
          title: "没有什么要一直开着",
          body: "看板就是你仓库里的纯 Markdown：没有网页应用，没有数据库，没有服务。除了你本来就在跑的智能体，什么都不用装，也没有什么会掉线。",
        },
        planning: {
          title: "是规划，不只是排队",
          body: "一个 refine 循环会挖出缺失的部分，把粗略的想法变成一张你先批准、再写代码的具体卡片。Vibe Kanban 的看板主要是给智能体运行排队。",
        },
        outlives: {
          title: "比任何公司活得久",
          body: "没有 SaaS，没有打包进来的运行时，也没有会停滞的仓库。看板就是 git 里的文件，克隆一下仓库它就跟着你走。Bloop 关停，正是这件事要躲开的风险。",
        },
        anyAgent: {
          title: "任何智能体，随时可换",
          body: "它就是文件，所以任何能读文件的智能体都能驱动它：Claude Code、Codex、Cursor，以及你下一个会换到的任何东西。你不会被绑在某个工具支持的 CLI 清单上。",
        },
      },
      theirs: {
        parallel: {
          title: "同时跑许多智能体",
          body: "这就是它存在的全部理由：把工作扇出给好几个编码智能体并行做，每个都隔离在自己的 git 分支和 worktree 里，绝不互相踩踏。ai4kanban 压根不跑智能体。",
        },
        reviewInPlace: {
          title: "执行和评审在同一个地方",
          body: "行内 diff 评审、内置浏览器预览应用，还有 pull request 处理，全在驾驶舱里。你不用离开看板就能盯住并引导智能体的产出。",
        },
        boardUi: {
          title: "一个真正的看板界面",
          body: "一块为驱动智能体运行而造的网页看板：起一个任务、看着它干活、在工作区之间切换。它是为编排量身打造的，不是一个你去 grep 的普通文件。",
        },
        support: {
          title: "广泛的智能体支持",
          body: "多智能体编排的首发者，开箱就接好了许多智能体 CLI：Claude Code、Codex、Gemini 等等。",
        },
      },
    },
    decision: {
      heading: { eyebrow: "怎么选", title: "你该用哪一个？" },
      oursHeading: "这些情况选 ai4kanban",
      theirsHeading: "这些情况选 Vibe Kanban",
      ours: [
        "你想要一块由智能体直接在仓库里编辑的规划看板。",
        "你想要零基础设施：git 里的文件，没有什么要跑、要一直开着。",
        "你不太想把自己的看板拴在一个可能关停的产品上。",
        "你一次只驱动一个智能体，比起并行更看重一份清楚的计划。",
      ],
      theirs: [
        "你想并行跑许多编码智能体，各自隔离。",
        "你想在一个驾驶舱里做行内 diff 评审和实时预览。",
        "编排和审查智能体运行才是你真正的瓶颈。",
        "Bloop 关停之后，你能接受依赖一个社区 fork。",
      ],
      verdict:
        "它们解决的是不同的瓶颈。Vibe Kanban 是一个跑许多智能体的**编排驾驶舱**；ai4kanban 是一块由一个智能体在你仓库里编辑的**规划看板**。如果你爱的是 Vibe Kanban 那块用来排活的看板，这个技能会以比任何公司都活得久的纯文件形式给你。如果你爱的是它那台并行智能体引擎，这个技能不是，我们宁可直说。",
      note: "Bloop 关停之后，那块看板才是值得不带任何公司继续往前带的部分，而 ai4kanban 正是这个东西。",
    },
  },
};

export default zh;
