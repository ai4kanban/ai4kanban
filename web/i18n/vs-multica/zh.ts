import type { VsMulticaCopy } from "./types";

const zh: VsMulticaCopy = {
  meta: {
    title: "AI4Kanban vs. Multica：如何用 AI 智能体推进项目？",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "了解 AI4Kanban 与 Multica 分别替你解决了什么问题，省去哪些工作，以及两者的方案有什么不同。",
    social:
      "两者都能创建并组织多组 AI 智能体并行工作。AI4Kanban 提供开箱即用的智能体、工作流和记忆管理方案，减少团队架构设计、Prompt 调优等配置工作。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nMultica",
    lead: "AI4Kanban 内置专业智能体和工作流，开箱即用，10 分钟即可交付你的第一项工作；多智能体并行，通过草稿系统精准把控交付质量，持续学习进化。",
    sharedLabel: "两者都支持",
    setup: {
      heading: "开箱即用，少做团队配置",
      verdict: "专业角色和流程已配好，第一天就能交任务。",
      ours: "内置多种专业智能体和配套工作流，覆盖软件开发、博客、社交轮播、演示文稿和产品视频。",
      theirs: "除协调智能体 Mika 外，每个专业智能体都要你自己创建",
      art: {
        ours: ["UI 设计", "Prompt", "文案"],
        theirs: {
          title: "新建智能体",
          fields: ["名称", "Instructions", "Skills"],
          slot: "由你创建",
        },
      },
      shared: [
        {
          title: "自定义智能体",
          body: [
            "AI4Kanban 可以修改内置角色，也可以添加自己的智能体。",
            "Multica 的 Agent Builder 协助创建角色，再为其配置 Instructions 和 Skills。",
          ],
        },
        {
          title: "多智能体并行",
          body: [
            "AI4Kanban 同时推进多张卡片，可选 Claude Code、Codex 等编码工具执行。",
            "Multica 并行运行多个智能体，并提供排队、重试和成本统计。",
          ],
        },
      ],
    },
    drafts: {
      heading: "担心 AI 自由发挥？先看草稿，再批准执行",
      verdict: "方向在执行前确认，不必跑完再返工。",
      ours: "所有你担心 AI 过度自由发挥的部分，都可以先让草稿系统提供预览，审批后再执行交付。AI4Kanban 支持图片、图表、HTML/TSX、diff 和 storyboard 草稿。",
      theirs: "先审草稿的流程要你自己搭建",
      art: {
        ours: ["草稿", "确认", "执行任务"],
        theirs: {
          title: "草稿审批流程",
          fields: ["谁准备草稿", "何时等待确认", "怎样交给下一步"],
          slot: "由你搭建",
        },
      },
      shared: [
        {
          title: "预览成果",
          body: [
            "AI4Kanban 在卡片中展示图片、图表、HTML/TSX、diff 和 storyboard 草稿。",
            "Multica 可以预览 HTML、添加批注和比较版本。",
          ],
        },
        {
          title: "任务讨论",
          body: [
            "AI4Kanban 在卡片对话里讨论并修改计划。",
            "Multica 在 issue 评论里与智能体讨论。",
          ],
        },
      ],
    },
    memory: {
      heading: "下次还要再解释一遍吗？",
      verdict: "偏好和决定按任务记住，不必每次重讲。",
      ours: "每个智能体都有针对自身场景单独设计的记忆配方，学习你对特定任务的偏好和决策，而非通用经验。多智能体之间也能共享记忆。",
      theirs: "长期记忆取决于所用的 Agent 工具，要你自己检查和设置",
      art: {
        ours: {
          agents: ["UI 设计", "文案"],
          notes: ["设计偏好", "用词决定"],
          shared: "共享 · 项目背景",
        },
        theirs: {
          title: "长期记忆",
          fields: ["用哪个工具", "记在哪里", "何时再读"],
          slot: "由你设置",
        },
      },
      shared: [
        {
          title: "保存做事方法",
          body: [
            "AI4Kanban 的每个智能体都有可编辑的角色规则。",
            "Multica 用 Instructions 和 Skills 保存做事方法。",
          ],
        },
        {
          title: "保留任务历史",
          body: [
            "AI4Kanban 的卡片保留计划、对话和运行记录。",
            "Multica 保留评论和运行历史。",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: { eyebrow: "关键对比", title: "逐项比较" },
    lead: "{check} 标出每一项更强的一方。",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "内置智能体与工作流",
        kanban: "内置多种专业智能体及配套工作流，可修改或添加自己的角色。",
        kanbanTip:
          "软件开发工作流免费；博客、社交轮播、演示文稿和产品视频工作流需 Pro。",
        multica:
          "已有协调智能体 Mika；你自己或通过 Agent Builder 创建专业角色，再配置 Instructions 和 Skills。",
      },
      refinement: {
        dimension: "执行前审阅草稿",
        kanban:
          "所有你担心 AI 过度自由发挥的部分，都可以先让草稿系统提供预览，审批后再执行交付。AI4Kanban 支持图片、图表、HTML/TSX、diff 和 storyboard 草稿。",
        multica:
          "可以预览 HTML、批注成果和比较版本；由你指定谁准备草稿，以及何时必须确认才能开始执行。",
      },
      memory: {
        dimension: "记住修改和决定",
        kanban:
          "每个智能体都有针对自身场景单独设计的记忆配方，它们学习用户对特定任务的偏好、决策，而非通用经验。多智能体之间也能共享记忆。",
        multica:
          "长期记忆取决于所用的 Agent 工具。使用 Hermes 的智能体各自在本机保留跨任务记忆；这份记忆不会自动跨机器同步。指令和任务历史也会保存。",
      },
      backlog: {
        dimension: "交付之后",
        kanban:
          "在你完成一项主线工作后，智能体自主提出跟进项，帮你补缺补漏。",
        multica:
          "要让智能体提出跟进项，需在任务指令中要求；Autopilot 需先配置任务指令、执行者及定时或 webhook 触发器，再自动运行。",
      },
      license: {
        dimension: "许可证",
        kanban: "Apache-2.0，允许商业使用、托管和嵌入。",
        multica: "源码可见；托管服务和商业嵌入受 Multica License 限制。",
      },
      execution: {
        dimension: "执行管理",
        kanban:
          "可用 Claude Code、Codex、Cursor、OpenCode、DeepSeek Harness、ZCode 或 Grok Build 执行卡片，同时推进多张卡片。",
        multica:
          "可以并行运行多个智能体，并提供排队、重试、重放、成本统计、评审门禁，以及 PR 和 CI 关联。",
      },
      teams: {
        dimension: "团队协作",
        kanban:
          "面向在同一个仓库中组织任务的个人和小团队，智能体和工作流均可自定义。",
        multica: "提供多人工作区、角色、Squad、评论、权限和通知。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "选择建议", title: "如何选择？" },
    oursHeading: "选择 AI4Kanban，如果你",
    theirsHeading: "选择 Multica，如果你",
    ours: [
      "想直接使用多种专业智能体和配套工作流，无需从头配置；部分工作流需 Pro。",
      "想在执行前审阅关键部分的草稿。",
      "想让有用的修改和决定被记住，换编码工具后也能继续参考。",
      "希望已有规划和后续建议，也能自行调整工作流。",
    ],
    theirs: [
      "需要多人工作区、权限和通知，让整个团队在共享 issue 上协作。",
      "需要排队、重试、重放、成本统计，以及 PR 和 CI 关联等执行管理功能。",
      "愿意配置 Autopilot 的任务指令、执行者和触发器，让重复工作按定时或外部事件自动启动。",
    ],
    verdict:
      "**想让专业智能体直接开工、在执行前确认关键草稿、并记住你的决定**，选 AI4Kanban。只有当你**明确需要 Multica 的多人工作区或执行管理功能**时，再选 Multica。",
    note: "",
  },
};

export default zh;
