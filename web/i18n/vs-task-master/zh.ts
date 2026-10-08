// 中文 — the Taskmaster comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsTaskMasterCopy } from "./types";

const zh: VsTaskMasterCopy = {
  meta: {
    title: "AI4Kanban vs. Taskmaster：如何减少指导 AI 和返工的精力？",
    socialTitle: "AI4Kanban vs. Taskmaster",
    description: "相比 Taskmaster，AI4Kanban 在任务管理之外，还内置专业工作流、关键草稿审批和偏好记忆，帮你提前确认方向，减少返工和重复解释。",
    social: "AI4Kanban 能拆分和管理任务，还能让你先审阅 UI、Prompt 或文案草稿，再执行，并让后续任务复用你的偏好和决策。Taskmaster 没有内置这套草稿审批和偏好记忆。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nTaskmaster",
    lead: "内置专业工作流、草稿审批和偏好记忆，减少指导智能体的精力和返工。",
    sharedLabel: "两者都支持",
    setup: {
      heading: "专业智能体和工作流，开箱即用",
      ours: "内置智能体和工作流覆盖软件开发、博客、社交轮播、演示文稿和产品视频；你也可以创建自定义智能体和工作流。",
      theirs: "围绕编码任务推进；没有内置 UI 设计、文案或内容制作的专业智能体及配套工作流。",
      art: {
        ours: [
          "UI 设计",
          "Prompt",
          "文案",
        ],
        theirs: {
          title: "专业工作流",
          fields: [
            "UI 设计",
            "文案",
            "内容制作",
          ],
          slot: "未内置",
        },
      },
      shared: [
        {
          title: "任务拆解与依赖管理",
          body: [
            "AI4Kanban 把工作拆成卡片和子任务，用依赖关系安排执行顺序。",
            "Taskmaster 可从 PRD 生成任务和子任务，并管理依赖关系。",
          ],
        },
        {
          title: "CLI 接入",
          body: [
            "AI4Kanban 提供 CLI，可由编码智能体调用；没有 MCP 服务。",
            "Taskmaster 同时提供 CLI 和 MCP 服务。",
          ],
        },
      ],
    },
    drafts: {
      heading: "关键草稿，先审阅再实现",
      ours: "选择你要审阅的 UI、Prompt、文案等关键部分；智能体先准备可预览、可修改的草稿，再按你确认的内容执行。",
      theirs: "能审阅任务描述、实现细节和测试策略；没有关键成果草稿的内置预览与执行前审批流程。",
      art: {
        ours: [
          "关键草稿",
          "确认方向",
          "执行任务",
        ],
        theirs: {
          title: "任务详情",
          fields: [
            "需求描述",
            "实现细节",
            "测试策略",
          ],
          slot: "文字任务详情",
        },
      },
      shared: [
      ],
    },
    memory: {
      heading: "让后续任务复用你的偏好",
      ours: "设计智能体记住你的设计偏好，文案智能体记住你的用词选择；智能体之间也能共享项目背景。",
      theirs: "能保存规则和任务笔记；没有从用户修改和否决中自动积累偏好、供后续任务复用的记忆系统。",
      art: {
        ours: {
          agents: [
            "UI 设计",
            "文案",
          ],
          notes: [
            "设计偏好",
            "用词决定",
          ],
          shared: "共享项目背景",
        },
        theirs: {
          title: "规则与任务笔记",
          fields: [
            "项目约束",
            "进度记录",
            "补充上下文",
          ],
          slot: "仅保存规则和笔记",
        },
      },
      shared: [
        {
          title: "可编辑的规则",
          body: [
            "AI4Kanban 的专业智能体有可编辑的角色规则。",
            "Taskmaster 提供面向不同编辑器的规则文件。",
          ],
        },
        {
          title: "保留工作上下文",
          body: [
            "AI4Kanban 的卡片保留计划、对话和运行记录。",
            "Taskmaster 的任务保留描述、实现细节和子任务笔记。",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: {
      eyebrow: "关键对比",
      title: "逐项比较",
    },
    lead: "从专业工作流、草稿审批到工具接入，看看哪些功能已经内置。",
    ourLabel: "AI4Kanban",
    theirLabel: "Taskmaster",
    rows: {
      startingPoint: {
        dimension: "内置智能体与工作流",
        kanban: "内置开发、内容等专业智能体和工作流，也可创建自定义智能体和工作流；内容工作流需 Pro。",
        taskMaster: "内置任务执行、测试和代码清理等编码流程；没有设计、文案或内容制作的专业智能体及配套工作流。",
      },
      planning: {
        dimension: "任务拆解与依赖管理",
        kanban: "AI4Kanban 把工作拆成卡片和子任务，用依赖关系安排执行顺序。",
        taskMaster: "Taskmaster 可从 PRD 生成任务和子任务，并管理依赖关系。",
      },
      drafts: {
        dimension: "执行前审阅关键草稿",
        kanban: "支持图片、图表、HTML/TSX、diff 和 storyboard 草稿；你确认的关键内容进入后续执行依据。",
        taskMaster: "能审阅任务描述、实现细节和测试策略；没有关键成果草稿的内置预览与执行前审批流程。",
      },
      discussion: {
        dimension: "任务内对话",
        kanban: "在卡片内与智能体讨论需求、修改计划；对话随卡片保留。",
        taskMaster: "没有内置任务聊天界面；需要在 Cursor 等工具的智能体聊天中讨论任务。",
      },
      memory: {
        dimension: "偏好记忆",
        kanban: "智能体记住你的设计偏好、用词选择等决策，也能共享项目背景。",
        taskMaster: "能保存规则和任务笔记；没有从用户修改和否决中自动积累偏好、供后续任务复用的记忆系统。",
      },
      followUps: {
        dimension: "交付后的建议",
        kanban: "主线工作完成后，智能体提出后续工作，由你接受、修改或否决。",
        taskMaster: "next 只能选择已有任务；没有交付后自动提出新跟进项的流程。",
      },
      interface: {
        dimension: "看板与操作界面",
        kanban: "独立桌面看板，集中查看卡片、草稿、对话和运行状态。",
        taskMaster: "官方可视化看板是 VS Code 扩展；核心任务管理也可通过 CLI/MCP 使用。",
      },
      execution: {
        dimension: "执行与验证",
        kanban: "独立卡片可在后台并行执行，也可通过依赖关系按顺序执行；开发任务用 git worktree 隔离，并运行必要检查。",
        taskMaster: "loop 每轮启动新的 Claude Code 会话，逐项完成任务，并运行测试和类型检查。",
      },
      testFirst: {
        dimension: "内置测试先行流程",
        kanban: "开发任务运行必要检查；没有内置 RED → GREEN → COMMIT 流程。",
        taskMaster: "autopilot 引导每个子任务先写失败测试，再实现到测试通过，最后提交；跟踪阶段并检查上报的测试结果。",
      },
      research: {
        dimension: "调研",
        kanban: "智能体可用 Claude Code、Codex 等执行工具提供的能力做调研；没有独立调研命令或调研模型设置。",
        taskMaster: "research 可带入任务和文件上下文，使用单独配置的调研模型，并将结果保存到任务或调研文件。",
      },
      reach: {
        dimension: "CLI 与 MCP",
        kanban: "提供 CLI，可由 Claude Code、Codex 等编码工具调用；没有 MCP 服务。",
        taskMaster: "同时提供 CLI 和 MCP 服务，可在兼容 MCP 的编辑器或编码智能体中使用。",
      },
      license: {
        dimension: "许可证",
        kanban: "Apache-2.0，允许商业使用、托管和嵌入。",
        taskMaster: "MIT + Commons Clause，限制出售 Taskmaster 本身及提供托管服务。",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "选择建议",
      title: "如何选择？",
    },
    oursHeading: "选择 AI4Kanban，如果你",
    theirsHeading: "选择 Taskmaster，如果你",
    ours: [
      "希望直接使用专业智能体和工作流，也能创建自己的。",
      "希望在完整执行前确认 UI、Prompt 或文案等关键草稿。",
      "希望后续任务复用偏好，并收到值得考虑的跟进建议。",
    ],
    theirs: [
      "希望通过 MCP 在现有编辑器或编码智能体中管理任务。",
      "希望用独立调研命令，带入任务背景并单独配置调研模型。",
      "希望用内置流程引导编码：先写失败测试，再实现到通过，最后提交。",
    ],
    verdict: "需要**专业工作流、草稿审批和偏好记忆**，选 AI4Kanban；需要 **MCP 接入、独立调研命令和内置测试先行编码流程**，选 Taskmaster。",
    note: "本页比较开源 Taskmaster。Hamster 是同团队的托管产品，其团队功能不计入本页对比。",
  },
};

export default zh;
