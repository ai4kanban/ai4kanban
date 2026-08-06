// 简体中文 — the GitHub Issues comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsGithubCopy } from "./types";

const zh: VsGithubCopy = {
  meta: {
    title: "AI4Kanban vs. GitHub Issues——不同的工作，适合不同的工具",
    socialTitle: "AI4Kanban vs. GitHub Issues",
    description:
      "AI4Kanban 的文件式看板与 GitHub Issues 有何不同：本地 Markdown 与远程 API、Token 开销、智能体使用体验、团队协作能力，以及各自适用的场景。",
    social:
      "AI4Kanban 并不是 GitHub Issues 的替代品，两者解决的瓶颈不同。围绕速度、Token、智能体与团队的逐项对比。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nGitHub Issues",
    lead: "AI4Kanban 并不是 GitHub Issues 的替代品。两者解决的瓶颈不同：GitHub Issues 是团队共享、长期保存且便于公开访问的统一事实来源；AI4Kanban 则是私有、本地、可由智能体直接操作的工作区。选择哪一个，取决于真正拖慢你的是什么。",
    ours: {
      name: "AI4Kanban",
      body: "存放在仓库中的纯 Markdown，是智能体可以快速读写的本地看板。",
    },
    theirs: {
      name: "GitHub Issues",
      body: "通过 API 访问的托管数据库，是团队共享、便于公开协作的事实来源。",
    },
  },
  summary: {
    heading: { eyebrow: "简单说", title: "为什么不直接用 GitHub Issues？" },
    lead: "当然可以。AI4Kanban 能做的事情，几乎都可以通过 GitHub Issues 配合 `gh` CLI 或 GitHub MCP 服务完成。真正的差别在于完成这些操作需要付出多少成本。",
    panel:
      "让智能体通过 GitHub Issues 完成同一项任务，通常会引入**更多无关信息**、**更多工具调用**、**更多 Token**、**更高延迟**，也需要**更明确的提示**，智能体才会主动使用远程工具。AI4Kanban 不追求 GitHub 那样广泛的协作能力，而是把重点放在本地操作速度上。对主要与智能体协作的独立开发者而言，速度往往才是最稀缺的资源。",
  },
  comparison: {
    heading: { eyebrow: "逐项对比", title: "AI4Kanban vs. GitHub Issues" },
    lead: "下面从十四个维度进行比较。{check} 表示明确胜出，**横杠**表示这是一处有意的取舍，取决于你需要什么。AI4Kanban 的优势集中在**速度与本地操作**，GitHub Issues 的优势集中在**规模与协作**。",
    ourLabel: "AI4Kanban",
    theirLabel: "GitHub Issues",
    rows: {
      storage: {
        dimension: "存储方式",
        kanban: "以纯 Markdown 文件存放在仓库中，由 Git 管理。",
        issues: "数据存放在 GitHub，通过 API 访问。",
      },
      offline: {
        dimension: "离线使用",
        kanban: "可以，本质上就是磁盘中的文件。",
        issues: "不可以，需要网络连接和身份验证。",
      },
      agentReads: {
        dimension: "智能体读取方式",
        kanban: "直接使用 Read、Grep、Glob 等文件系统工具。",
        issues: "通过 `gh` CLI 或 MCP 进行远程调用。",
      },
      tokenCost: {
        dimension: "单次查询的 Token 开销",
        kanban: "较低，`grep` 只返回匹配内容。",
        issues: "较高，需要处理 JSON 响应和工具定义。",
      },
      latency: {
        dimension: "延迟",
        kanban: "直接读取本地磁盘，几乎即时完成。",
        issues: "每次调用都需要等待网络响应。",
      },
      setup: {
        dimension: "上手成本",
        kanban: "一条提示词即可安装，核心只包含一个技能文件和一个小型脚本。",
        issues: "需要 GitHub 账号、身份验证令牌和 MCP 配置。",
      },
      lockIn: {
        dimension: "平台依赖",
        kanban: "没有，看板会随仓库一起迁移。",
        issues: "数据托管在 GitHub。",
      },
      metadata: {
        dimension: "元数据",
        kanban: "有意保持精简，只保留优先级和工作量等独立开发所需的信息。",
        issues: "提供标签、里程碑、负责人和项目等丰富字段，适合团队协调。",
      },
      concurrency: {
        dimension: "并发操作",
        kanban:
          "没有并发控制；两个人同时新增任务时，可能生成相同的编号，例如 #1894。",
        issues: "编号由服务端分配，能够安全支持多人操作。",
      },
      history: {
        dimension: "决策记录",
        kanban:
          "只保留会影响后续工作的关键信息，例如方案为何被否决、哪些内容已经交付，帮助智能体避免重复处理已完成或已放弃的工作。",
        issues: "完整保留评论、编辑和其他活动记录。",
      },
      closing: {
        dimension: "任务收尾",
        kanban: "所有任务项完成后，将卡片归档。",
        issues: "可通过关联 PR 和自动化流程关闭 Issue。",
      },
      search: {
        dimension: "大规模搜索",
        kanban: "小型看板可以用 `grep` 快速搜索；内容增多后，管理成本会随之上升。",
        issues: "提供带索引的全文搜索和可保存的筛选条件。",
      },
      contributors: {
        dimension: "外部贡献者",
        kanban: "可以通过提交 Markdown 参与，但缺少轻量的任务提交入口。",
        issues:
          "在公开仓库中，任何人都可以提交 Issue、评论或添加表情回应，无需提交代码。",
      },
      transparency: {
        dimension: "透明度",
        kanban: "每张卡片都保留在仓库中，只有记忆中枢会被精简为关键信息。",
        issues: "适合公开访问和分享链接，也是开源项目常用的协作方式。",
      },
    },
  },
  wins: {
    heading: { eyebrow: "取舍", title: "各自的优势" },
    lead: "两者没有绝对的高下之分。AI4Kanban 优先考虑开发者与智能体高效推进工作的体验；GitHub Issues 更注重让多人长期保持信息同步。",
    oursHeading: "AI4Kanban",
    theirsHeading: "GitHub Issues",
    ours: {
      tokenLight: {
        title: "Token 开销低，响应快",
        body: "无需 MCP，也不依赖网络。智能体搜索的是本地 Markdown，不必逐页读取远程 API 的返回结果，因此占用的上下文更少、延迟更低，也不会在任务中途遇到身份验证过期的问题。",
      },
      agentsUseIt: {
        title: "符合智能体的默认操作方式",
        body: "智能体通常会优先使用文件系统工具，而不是主动检索 GitHub Issues。Markdown 看板就在它熟悉的工作环境中，因此需要的提示更少，也更不容易凭空推断任务状态。",
      },
      offline: {
        title: "支持离线，也真正归你所有",
        body: "看板只是 Git 中的一组文件，在飞机上或 GitHub 暂时不可用时仍能正常工作。它不依赖 SaaS，也不存在平台锁定；克隆仓库时，整块看板会一并带走。",
      },
      memory: {
        title: "只保留能推动下一步的记忆",
        body: "AI4Kanban 记录的是会影响后续工作的决定：某个方案为何被否决、哪些内容已经交付，以及距离目标还缺什么。智能体因此能够继续向前推进，而不是重做已经完成的工作，或再次提出已经放弃的方案。",
      },
    },
    theirs: {
      teams: {
        title: "专为团队协作设计",
        body: "编号由服务端统一分配，支持多人并发操作，也可以明确指定负责人。AI4Kanban 没有数据库，两个人可能同时创建编号为 #1894 的任务并产生冲突。",
      },
      transparency: {
        title: "便于公开协作",
        body: "Issue 可以公开访问和分享链接，外部贡献者也能提交问题、参与评论或添加表情回应。如果开放参与比单纯追求速度更重要，GitHub Issues 更合适。",
      },
      fullContext: {
        title: "完整保留上下文",
        body: "AI4Kanban 会有意压缩历史信息，归档卡片最终会精简为一行摘要。GitHub Issues 则会保留每条评论、每次编辑以及关联链接。",
      },
      integration: {
        title: "集成能力成熟",
        body: "GitHub Issues 支持通过 PR 自动关闭、关联提交、项目看板、标签和里程碑，并拥有完整的第三方工具生态和适合大规模使用的索引搜索。",
      },
    },
  },
  ergonomics: {
    heading: { eyebrow: "关键差异", title: "为什么智能体更容易使用文件" },
    lead: "真正的差异，会在智能体实际执行任务时显现。同样是**“找出高优先级且尚未完成的任务”**，两种工具的操作路径截然不同。",
    issues: {
      title: "你 › 智能体 + GitHub MCP",
      chip: "多次调用",
      lines: [
        "找出高优先级且尚未关闭的 Issue",
        "list_issues(state:open, labels:high)",
        "4.2 KB JSON——18 个 Issue，包含所有字段",
        "翻页、筛选、汇总……",
        "刷新身份验证 · 处理限流响应头 · 重试",
      ],
      footer: "多次工具调用 · 数 KB JSON · 每次都需要网络",
    },
    kanban: {
      title: "你 › 智能体 + AI4Kanban",
      chip: "一次调用",
      lines: [
        "找出高优先级且尚未完成的任务",
        'grep -rl "Priority: high" docs/kanban/todo',
        "返回三个文件路径",
        "完成：一次调用，无需网络",
      ],
      footer: "一次工具调用 · 几个文件路径 · 全部在本地",
    },
    note: "这些额外开销会在日常使用中不断累积。无论是询问“接下来做什么”、归档任务，还是检查看板，使用 GitHub Issues 都要重复进行远程调用。实际使用中，只要可以选择，模型往往会优先使用本地文件，而不是调用远程工具。",
  },
  decision: {
    heading: { eyebrow: "如何选择", title: "哪个更适合你？" },
    oursHeading: "以下情况适合 AI4Kanban",
    theirsHeading: "以下情况适合 GitHub Issues",
    ours: [
      "你独立开发，或只与一两位长期合作、彼此信任的伙伴协作。",
      "你主要在终端中通过智能体推进工作。",
      "与完整留档相比，你更看重持续推进。",
      "你希望看板保存在 Git 中，既能离线使用，也方便迁移。",
    ],
    theirs: [
      "你以公开方式开发，重视过程透明。",
      "多个人需要同时维护待办事项。",
      "你高度依赖 PR/CI 关联、项目看板和里程碑。",
      "你希望外部贡献者能够提交问题并参与讨论。",
    ],
    verdict:
      "严格来说，两者并不是直接竞争关系。GitHub Issues 是**团队共享的统一事实来源**；AI4Kanban 是**智能体可以直接操作的快速本地看板**。如果瓶颈在于团队成员之间的协调，选择 GitHub Issues；如果瓶颈在于你与智能体协作的推进效率，选择 AI4Kanban。",
    note: "许多独立开发者也会同时使用两者：以 GitHub Issues 作为公开的问题跟踪系统，以 AI4Kanban 作为智能体日常操作的私有工作区。",
  },
};

export default zh;
