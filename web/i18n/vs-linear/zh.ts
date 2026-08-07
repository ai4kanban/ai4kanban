// 简体中文 — the Linear comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsLinearCopy } from "./types";

const zh: VsLinearCopy = {
  meta: {
    title: "AI4Kanban vs. Linear — 仓库内规划，还是团队协作",
    socialTitle: "AI4Kanban vs. Linear",
    description:
      "比较 AI4Kanban 与 Linear：一个在仓库内帮助编码智能体把需求细化为实施计划，一个为团队提供完整的产品研发工作区。",
    social:
      "需要协调团队与项目，还是让编码智能体把需求规划清楚？用关键差异判断 AI4Kanban 与 Linear 哪一个更适合你。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nLinear",
    lead: "Linear 用共享工作区协调团队、项目与智能体；AI4Kanban 在仓库内帮助编码智能体把不完整的需求细化为可实施的计划。",
    ours: {
      name: "AI4Kanban",
      body: "与代码一起版本化的 Markdown 看板，专注需求细化与实施准备。",
    },
    theirs: {
      name: "Linear",
      body: "供团队与智能体共同规划、分配和推进产品工作的托管平台。",
    },
  },
  summary: {
    heading: {
      eyebrow: "先看本质",
      title: "你要协调团队，还是把需求规划清楚？",
    },
    lead: "Linear 管理组织内的产品工作：谁负责、何时交付、项目如何推进，以及人和智能体如何协作。",
    panel:
      "AI4Kanban 解决更聚焦的问题：**让编码智能体在动手前，把模糊需求梳理成可靠计划**。需求、决策与历史都留在仓库中。",
  },
  comparison: {
    heading: { eyebrow: "关键对比", title: "只看影响选择的六件事" },
    lead: "{check} 表示该需求更适合哪一方；**横线**表示没有绝对优劣，取决于你的工作方式。",
    ourLabel: "AI4Kanban",
    theirLabel: "Linear",
    rows: {
      bestFit: {
        dimension: "适用场景",
        kanban: "独立开发者和小团队，主要通过编码智能体规划与交付。",
        linear: "需要协调多人、多个项目和智能体的产品研发团队。",
      },
      sourceOfTruth: {
        dimension: "工作依据",
        kanban: "计划是仓库中的 Markdown，与代码一起版本化、审查和迁移。",
        linear: "计划位于共享工作区，通过应用、API 与 MCP server 使用。",
      },
      refinement: {
        dimension: "需求细化",
        kanban: "智能体调查需求、澄清问题并记录决策，直到卡片可以直接实施。",
        linear: "智能体可起草、总结和更新任务，但实施质量仍取决于任务描述。",
      },
      agentModel: {
        dimension: "智能体模式",
        kanban: "由你选择的编码运行环境读写看板，目前支持 Claude Code 和 Codex。",
        linear: "提供 Linear Agent、任务委派、app user 与托管的 MCP server。",
      },
      execution: {
        dimension: "执行与评审",
        kanban: "使用现有编码环境实施卡片，并在原有 git 流程中评审。",
        linear: "Coding Sessions 可在云端编码、创建 pull request，并在 Linear 中查看 diff。",
      },
      collaboration: {
        dimension: "团队协作",
        kanban: "适合小团队通过 git 协作，不强调多人实时编辑。",
        linear: "内置负责人、评论、通知、访客、私有团队与权限控制。",
      },
      portfolio: {
        dimension: "规划广度",
        kanban: "围绕单个仓库管理卡片、依赖、优先级、release 与规划记忆。",
        linear: "支持跨团队的项目、cycle、initiative、timeline、triage 与客户请求。",
      },
      setup: {
        dimension: "开始使用",
        kanban: "安装到仓库即可使用，无需账号、数据库或托管服务。",
        linear: "创建工作区并邀请成员，再配置所需的集成与智能体权限。",
      },
      portability: {
        dimension: "可移植性",
        kanban: "克隆仓库即可带走看板、决策与历史，也可离线规划。",
        linear: "数据保存在 Linear，可导出 CSV 或通过 API 获取。",
      },
      pricing: {
        dimension: "价格",
        kanban: "Apache-2.0 开源；成本主要来自你选择的编码智能体。",
        linear: "按套餐和席位收费；Coding Sessions 还会消耗 AI credits。",
      },
    },
  },
  model: {
    heading: { eyebrow: "核心差异", title: "仓库上下文 vs. 组织上下文" },
    lead: "真正的差异是**规划上下文放在哪里**：代码仓库，还是组织共享的工作区。",
    ours: {
      name: "AI4Kanban — 上下文跟随代码",
      is: "智能体读取代码、既往决策和已完成工作，再细化下一项需求。",
      isnt: "它不是组织级协作套件，而是仓库内的持久规划层。",
    },
    theirs: {
      name: "Linear — 上下文服务整个组织",
      is: "团队、项目、文档、评论和客户请求共同构成有权限控制的工作区。",
      isnt: "对只需把需求转成实施计划的个人而言，这套能力可能过重。",
    },
    note: "两者可以并用，但任务状态应明确以其中一套系统为准。",
  },
  wins: {
    heading: { eyebrow: "取舍", title: "各自擅长什么" },
    lead: "AI4Kanban 深入仓库内规划；Linear 覆盖团队与组织协作。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Linear",
    ours: {
      roughToReady: {
        title: "把需求细化到可以实施",
        body: "先调查、澄清和记录决策，再形成实施卡片。",
      },
      repoMemory: {
        title: "规划历史跟随代码",
        body: "卡片与决策都是可 diff、可继续读取的纯文本。",
      },
      anyHarness: {
        title: "自行选择编码环境",
        body: "目前支持 Claude Code 和 Codex，不绑定专有运行时。",
      },
      noSaas: {
        title: "无需额外服务",
        body: "没有工作区、席位、数据库或同步层需要维护。",
      },
    },
    theirs: {
      teamSystem: {
        title: "成熟的团队协作",
        body: "内置任务归属、评论、通知、权限与实时编辑。",
      },
      agentPlatform: {
        title: "托管式智能体执行",
        body: "任务委派、Coding Sessions 与评审共享工作区上下文。",
      },
      planningDepth: {
        title: "跨团队产品规划",
        body: "项目、cycle、initiative 与 timeline 覆盖更大范围。",
      },
      integrations: {
        title: "广泛的系统集成",
        body: "连接代码托管、沟通、客服工具、API 与 webhook。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "做出选择", title: "按你的主要瓶颈来选" },
    oursHeading: "选择 AI4Kanban，如果你",
    theirsHeading: "选择 Linear，如果你",
    ours: [
      "主要通过编码智能体规划和交付软件。",
      "经常需要把不完整的需求细化为可靠计划。",
      "希望任务、决策与历史随代码一起版本化。",
    ],
    theirs: [
      "需要多人实时分配、讨论和推进工作。",
      "需要跨项目规划、报表、权限和组织级集成。",
      "希望在同一工作区使用托管编码会话并评审结果。",
    ],
    verdict:
      "主要瓶颈是**团队协调**，选择 Linear；主要瓶颈是**让编码智能体把需求规划清楚**，选择 AI4Kanban。",
    note: "两者可以并用，但任务状态最好只保留一个权威来源。",
  },
};

export default zh;
