import type { VsMulticaCopy } from "./types";

const zh: VsMulticaCopy = {
  meta: {
    title: "WildCrane vs. Multica：专业 agent 与工作流开箱即用",
    socialTitle: "WildCrane vs. Multica",
    description:
      "对比 WildCrane 与 Multica 的专业 agent、工作流配置、草稿审阅、偏好记忆与团队协作。",
    social:
      "对比 WildCrane 与 Multica 的专业 agent、工作流配置、草稿审阅、偏好记忆与团队协作。",
  },
  hero: {
    badge: "对比",
    title: "WildCrane vs.\nMultica",
    lead: "对比 WildCrane 与 Multica 的专业 agent、工作流配置、草稿审阅、偏好记忆与团队协作。",
    sharedLabel: "两者都支持",
    setup: {
      heading: "开箱即用，少做团队配置",
      verdict: "用内置工作流推进开发与营销，不用逐项安排交接。",
      ours: "内置专业 agent 和工作流覆盖产品开发与营销内容。按任务使用对应工作流，不用自己设计团队分工。你也可以创建自定义 agent 和工作流。",
      theirs: "除协调 agent Mika 外，每个专业 agent 都要你自己创建",
      art: {
        ours: ["UI 设计", "Prompt", "文案"],
        theirs: {
          title: "新建 agent",
          fields: ["名称", "Instructions", "Skills"],
          slot: "由你创建",
        },
      },
      shared: [
        {
          title: "自定义 agent",
          body: [
            "WildCrane 可以修改内置角色，也可以添加自己的 agent。",
            "Multica 的 Agent Builder 协助创建角色，再为其配置 Instructions 和 Skills。",
          ],
        },
        {
          title: "多 agent 并行",
          body: [
            "WildCrane 同时推进多张卡片，可选 Claude Code、Codex 等编码工具执行。",
            "Multica 并行运行多个 agent，并提供排队、重试和成本统计。",
          ],
        },
      ],
    },
    drafts: {
      heading: "先审关键草稿再让 agent 继续",
      verdict: "在草稿里改好关键部分，减少实现后的返工。",
      ours: "需要你判断的部分先出草稿。你在卡片上审阅、修改，agent 按确认的版本继续，在约定范围内完成其余细节。关键部分提前改好，减少后续返工。",
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
            "WildCrane 在卡片中展示图片、图表、HTML/TSX、diff 和 storyboard 草稿。",
            "Multica 可以预览 HTML、添加批注和比较版本。",
          ],
        },
        {
          title: "任务讨论",
          body: [
            "WildCrane 在卡片对话里讨论并修改计划。",
            "Multica 在 issue 评论里与 agent 讨论。",
          ],
        },
      ],
    },
    memory: {
      heading: "下次还要再解释一遍吗？",
      verdict: "后续任务沿用已经明确的项目背景、偏好和决策。",
      ours: "每个 agent 记住与自身工作相关的偏好和决策，也能与其他 agent 共享项目背景。后续任务从已有共识继续，减少重复解释。",
      theirs: "长期记忆取决于所用的 agent 工具，要你自己检查和设置",
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
            "WildCrane 的每个 agent 都有可编辑的角色规则。",
            "Multica 用 Instructions 和 Skills 保存做事方法。",
          ],
        },
        {
          title: "保留任务历史",
          body: [
            "WildCrane 的卡片保留计划、对话和运行记录。",
            "Multica 保留评论和运行历史。",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: { eyebrow: "关键对比", title: "逐项比较" },
    lead: "{check} 标出每一项更强的一方。",
    ourLabel: "WildCrane",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "内置 agent 与工作流",
        kanban: "内置多种专业 agent 及配套工作流，可修改或添加自己的角色。",
        kanbanTip:
          "所有内置和自建工作流均可免费使用。",
        multica:
          "已有协调 agent Mika；你自己或通过 Agent Builder 创建专业角色，再配置 Instructions 和 Skills。",
      },
      refinement: {
        dimension: "执行前审阅草稿",
        kanban:
          "所有你担心 AI 过度自由发挥的部分，都可以先让草稿系统提供预览，审批后再执行交付。WildCrane 支持图片、图表、HTML/TSX、diff 和 storyboard 草稿。",
        multica:
          "可以预览 HTML、批注成果和比较版本；由你指定谁准备草稿，以及何时必须确认才能开始执行。",
      },
      memory: {
        dimension: "记住修改和决定",
        kanban:
          "每个 agent 都有针对自身场景单独设计的记忆配方，它们学习用户对特定任务的偏好、决策，而非通用经验。多 agent 之间也能共享记忆。",
        multica:
          "长期记忆取决于所用的 agent 工具。使用 Hermes 的 agent 各自在本机保留跨任务记忆；这份记忆不会自动跨机器同步。指令和任务历史也会保存。",
      },
      backlog: {
        dimension: "交付之后",
        kanban:
          "在你完成一项主线工作后，agent 自主提出跟进项，帮你补缺补漏。",
        multica:
          "要让 agent 提出跟进项，需在任务指令中要求；Autopilot 需先配置任务指令、执行者及定时或 webhook 触发器，再自动运行。",
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
          "可以并行运行多个 agent，并提供排队、重试、重放、成本统计、评审门禁，以及 PR 和 CI 关联。",
      },
      teams: {
        dimension: "团队协作",
        kanban:
          "面向在同一个仓库中组织任务的个人和小团队，agent 和工作流均可自定义。",
        multica: "提供多人工作区、角色、Squad、评论、权限和通知。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "选择建议", title: "如何选择？" },
    oursHeading: "选择 WildCrane，如果你",
    theirsHeading: "选择 Multica，如果你",
    ours: [
      "希望用现成的专业 agent 和工作流推进自己的产品开发与营销。",
      "希望需要自己判断的部分先审草稿，再让 agent 继续。",
      "希望后续任务沿用项目背景、偏好和决策。",
      "希望独立任务并行推进，交付后获得跟进建议。",
    ],
    theirs: [
      "需要多人工作区、权限和通知，让整个团队在共享 issue 上协作。",
      "需要排队、重试、重放、成本统计，以及 PR 和 CI 关联等执行管理功能。",
      "愿意配置 Autopilot 的任务指令、执行者和触发器，让重复工作按定时或外部事件自动启动。",
    ],
    verdict:
      "希望用**现成工作流推进自己的产品开发与营销**，先审关键草稿，让偏好延续到后续任务，选 WildCrane。只有当你**明确需要 Multica 的多人工作区或执行管理功能**时，再选 Multica。",
    note: "",
  },
};

export default zh;
