// 简体中文 — the Linear comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsLinearCopy } from "./types";

const zh: VsLinearCopy = {
  meta: {
    title: "AI4Kanban vs. Linear — 仓库内规划还是团队协作",
    socialTitle: "AI4Kanban vs. Linear",
    description:
      "比较 AI4Kanban 与 Linear：一个是面向编码智能体、与仓库融为一体的规划系统，另一个是供团队与智能体协作的产品研发平台。",
    social:
      "Linear 负责协调组织内的工作，AI4Kanban 则在仓库里把粗略需求变成可实施的计划。看看哪种模式更适合你的工作方式。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nLinear",
    lead: "Linear 为团队提供统一的产品规划与交付平台，AI4Kanban 则把编码智能体所需的规划系统放进仓库。前者协调整个组织，后者让计划紧贴代码，把尚不完整的需求梳理成可直接实施的工作。",
    ours: {
      name: "AI4Kanban",
      body: "仓库里的 Markdown 看板，以智能体主导的需求细化为核心。",
    },
    theirs: {
      name: "Linear",
      body: "托管式团队工作区，供人和智能体共同协调产品研发。",
    },
  },
  summary: {
    heading: {
      eyebrow: "简单说",
      title: "两者都支持智能体，但解决的是不同层级的问题",
    },
    lead: "Linear 是一套完整的产品研发平台。它的智能体可以使用工作区上下文，任务可以委派给编码智能体，外部智能体也能通过 MCP 接入；Coding Sessions 还可运行 Claude Code 或 Codex，并提交 pull request 供团队评审。",
    panel:
      "AI4Kanban 面向的是一个更聚焦的需求：**在仓库里与编码智能体共同完成规划**。它把不完整的需求整理成明确的问题、决策、依赖关系和可实施的卡片，计划及其历史则以可审查的 Markdown 留在代码旁边。",
  },
  comparison: {
    heading: { eyebrow: "正面对比", title: "AI4Kanban vs. Linear" },
    lead: "{check} 表示某一需求更适合哪一方，**横线**则表示答案取决于你的工作方式。Linear 更擅长**团队协作、产品组合规划、系统集成和托管式智能体执行**；AI4Kanban 更擅长**仓库内需求细化、可移植性，以及保存在 git 中的规划历史**。",
    ourLabel: "AI4Kanban",
    theirLabel: "Linear",
    rows: {
      bestFit: {
        dimension: "最适合谁",
        kanban: "通过编码智能体规划并交付工作的独立开发者和小团队。",
        linear: "需要协调成员、项目与智能体的产品和工程组织。",
      },
      sourceOfTruth: {
        dimension: "计划存放在哪里",
        kanban: "项目仓库中的 Markdown，与代码一起纳入版本控制。",
        linear: "共享的 Linear 工作区，可通过应用、API 和 MCP server 访问。",
      },
      refinement: {
        dimension: "从粗略想法到可开工任务",
        kanban: "引导式细化循环会调查需求、记录决策，直到卡片足够具体、可以实施。",
        linear: "Linear Agent 可以起草、总结、更新并帮助界定任务；编码结果仍取决于任务描述的质量。",
      },
      agentModel: {
        dimension: "智能体模式",
        kanban: "由你选择的编码运行环境读写看板；目前已支持 Claude Code 和 Codex。",
        linear: "提供 Linear Agent、可安装的 app user、任务委派、智能体指南和托管的 MCP server。",
      },
      execution: {
        dimension: "编码与评审",
        kanban: "由你选择的运行环境实施已经就绪的卡片，评审仍在现有的 git 工作流中完成。",
        linear: "Coding Sessions 在云端运行 Claude Code 或 Codex、创建 pull request，并把 diff 与评审带入 Linear。",
      },
      collaboration: {
        dimension: "人类协作",
        kanban: "适合小团队通过 git 协作，但并非为多人同时编辑看板而设计。",
        linear: "实时工作区，内置负责人、评论、私有团队、访客、通知与权限控制。",
      },
      portfolio: {
        dimension: "规划广度",
        kanban: "卡片、依赖关系、优先级、ROI、release 和模块级规划记忆。",
        linear: "问题、项目、cycle、initiative、milestone、timeline、triage、insight 与客户请求。",
      },
      setup: {
        dimension: "开始使用",
        kanban: "通过一条 prompt 安装到仓库；看板本身不需要账号、数据库或托管服务。",
        linear: "创建工作区、邀请团队成员，再按需配置系统集成和智能体权限。",
      },
      portability: {
        dimension: "可移植性",
        kanban: "克隆仓库时，看板、决策和历史会一并带走；规划界面也可离线使用。",
        linear: "数据存放在 Linear；管理员可以将任务数据导出为 CSV，或通过 API 获取。",
      },
      pricing: {
        dimension: "价格",
        kanban: "采用 Apache-2.0 许可证的开源软件；你只需为所选的编码智能体工具付费。",
        linear: "Free 包含 250 个问题和 2 个团队。Basic 年付价格为每人每月 $10，Business 为 $16；Coding Sessions 还会消耗 AI credits。",
      },
    },
  },
  model: {
    heading: { eyebrow: "核心差异", title: "仓库上下文 vs. 组织上下文" },
    lead: "关键不在于产品是否支持智能体，而在于**规划上下文应该存放在哪里**：与代码一起留在仓库，还是进入整个组织共享的工作区。",
    ours: {
      name: "AI4Kanban — 让计划紧贴代码",
      is: "修改计划前，智能体会先阅读代码、既往决策、未采用的方案和已经完成的工作，并持续细化需求，直到所有待定问题都得到解决或明确交由你决定。",
      isnt: "它并非面向整个组织的协作套件。它的价值在于把持久的规划上下文与代码一起提交，让每次克隆都能完整获得。",
    },
    theirs: {
      name: "Linear — 为组织提供统一工作区",
      is: "问题归属团队，项目可以跨越多个团队；cycle、initiative、timeline、文档、评论和客户请求共同构成共享上下文。智能体也在这套有权限控制的工作区中协作。",
      isnt: "如果独立开发者面临的主要问题只是把粗略需求转化为可靠的实施计划，这样的广度可能并无必要。",
    },
    note: "两者可以并用，但任务状态必须以其中一套系统为准。对独立开发者而言，在两个地方维护同一项工作，通常只会增加流程负担。",
  },
  wins: {
    heading: { eyebrow: "取舍", title: "各自赢在哪里" },
    lead: "Linear 提供更广的规划能力、团队协作和托管式执行；AI4Kanban 则让智能体主导的规划紧贴代码、便于检查，并能跨会话持续保留。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Linear",
    ours: {
      roughToReady: {
        title: "把粗略需求细化成可实施的工作",
        body: "智能体会先调查、提问、记录决策并拆分工作，再把卡片视为可执行的实施计划。",
      },
      repoMemory: {
        title: "把规划历史留在代码旁边",
        body: "决策、未采用的方案、依赖关系和卡片都是纯文本、可 diff 的文件，下一次智能体会话可以直接读取。",
      },
      anyHarness: {
        title: "兼容你选择的编码运行环境",
        body: "看板不绑定专有的智能体运行时。目前已支持 Claude Code 和 Codex，开放的文件格式也能适配其他运行环境。",
      },
      noSaas: {
        title: "无需额外的项目管理服务",
        body: "看板本身没有工作区、席位、身份验证、数据库或同步层需要维护；它只是仓库的一部分。",
      },
    },
    theirs: {
      teamSystem: {
        title: "为团队协作而设计",
        body: "多人同时编辑、明确归属、权限控制、评论、私有团队、访客、通知和成熟界面均已内置。",
      },
      agentPlatform: {
        title: "提供托管式智能体与执行能力",
        body: "Linear Agent、app user、MCP、任务委派、Coding Sessions、diff 与 pull request 评审共享同一套工作区上下文。",
      },
      planningDepth: {
        title: "支持规模化产品规划",
        body: "项目、cycle、initiative、milestone、timeline、triage、insight 和客户请求，能够支持远超单个仓库范围的规划。",
      },
      integrations: {
        title: "连接组织内的各项工作",
        body: "GitHub、GitLab、Slack、Teams、客服工具、API、webhook 与工作区搜索，把规划连接到组织内的其他工作。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "如何选择", title: "哪一个更适合你的工作方式？" },
    oursHeading: "这些情况选择 AI4Kanban",
    theirsHeading: "这些情况选择 Linear",
    ours: [
      "独立开发者或小团队通过编码智能体规划并交付工作。",
      "需求往往并不完整，而把它们转化为可靠计划才是真正的瓶颈。",
      "你希望任务、决策和规划历史与代码一起纳入版本控制。",
      "你希望自行选择编码运行环境，而不是采用项目工具自带的运行时。",
    ],
    theirs: [
      "多人需要同时创建、分配、讨论和更新工作。",
      "你的规划依赖 cycle、initiative、timeline、triage、客户请求或报表。",
      "你希望在项目工作区内使用托管的云端编码会话并评审 diff。",
      "你需要覆盖整个组织的系统集成、权限、安全控制和支持。",
    ],
    verdict:
      "如果难点在于协调组织内的人员、项目和智能体，请选择 Linear；如果难点在于为编码智能体提供持久、充分的上下文，让它把不完整的需求转化为可靠的工作，请选择 AI4Kanban。决定因素不是功能清单的长短，而是你的规划流程应该发生在哪里。",
    note: "AI4Kanban 提供的是另一种规划模式，并非对 Linear 的逐项功能替代。",
  },
};

export default zh;
