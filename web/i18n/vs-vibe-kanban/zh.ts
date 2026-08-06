// 简体中文 — the Vibe Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsVibeCopy } from "./types";

const zh: VsVibeCopy = {
  meta: {
    title: "AI4Kanban vs. Vibe Kanban：规划工作，还是并行运行智能体？",
    socialTitle: "AI4Kanban vs. Vibe Kanban",
    description:
      "Bloop 于 2026 年 4 月关闭，但 Vibe Kanban 仍由社区以开源项目的形式继续维护。对比它的多智能体工作区与 AI4Kanban 基于文件的任务规划流程。",
    social:
      "AI4Kanban 与 Vibe Kanban 解决的问题并不相同：一个在仓库中规划任务，另一个并行运行并审查多个编码智能体。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nVibe Kanban",
    lead: "Vibe Kanban 用于并行运行多个编码智能体，并集中审查它们的产出。AI4Kanban 则帮助一个智能体把想法整理成定义清晰的任务，并以纯 Markdown 的形式保存在仓库中。两者都提供看板，但服务于开发流程中的不同阶段。",
    ours: {
      name: "AI4Kanban",
      body: "基于文件的任务规划与细化流程，由智能体直接在仓库中维护。",
    },
    theirs: {
      name: "Vibe Kanban",
      body: "用于并行运行多个智能体并审查结果的本地应用。",
    },
  },
  summary: {
    heading: {
      eyebrow: "长话短说",
      title: "Bloop 已关闭，Vibe Kanban 仍在继续",
    },
    lead: "Vibe Kanban 背后的公司 Bloop 于 2026 年 4 月关闭。付费订阅随之终止，远程服务下线，产品转为完全本地运行。Vibe Kanban 仍以 Apache-2.0 许可证开放，并由社区继续维护。",
    panel:
      "如果你想要的是**任务规划看板**，但不希望额外维护数据库或常驻应用，可以选择 AI4Kanban。如果你需要**并行运行多个智能体**，并在同一界面中审查结果，Vibe Kanban 更合适。AI4Kanban 并不替代 Vibe Kanban 的编排能力。",
  },
  comparison: {
    heading: { eyebrow: "正面对比", title: "AI4Kanban vs. Vibe Kanban" },
    lead: "{check} 表示在特定需求上更有优势；**横杠**表示两者只是设计取向不同，并无绝对优劣。AI4Kanban 侧重**规划与可移植性**，Vibe Kanban 侧重**并行执行与集成式审查**。",
    ourLabel: "AI4Kanban",
    theirLabel: "Vibe Kanban",
    rows: {
      whatFor: {
        dimension: "核心用途",
        kanban:
          "由智能体直接在仓库中定义、细化并组织任务。",
        vibe: "并行运行多个编码智能体，并审查它们的产出。",
      },
      orchestration: {
        dimension: "多智能体编排",
        kanban: "不包含。任务由你现有的智能体或运行环境执行。",
        vibe: "核心能力之一，每个智能体都在独立的 git worktree 中运行。",
      },
      review: {
        dimension: "智能体产出的评审",
        kanban: "由智能体、开发环境或代码审查工具完成。",
        vibe: "内置行内 diff、实时预览与 pull request 工作流。",
      },
      planning: {
        dimension: "规划与细化",
        kanban: "通过引导式细化流程，把初步想法转化为可执行的任务。",
        vibe: "主要用于安排和跟踪执行过程，而非补全需求细节。",
      },
      onDisk: {
        dimension: "数据存储",
        kanban: "纯 Markdown，与代码一同保存在仓库并纳入版本控制。",
        vibe: "配置目录里的一个本地 SQLite 数据库。",
      },
      runsAs: {
        dimension: "运行方式",
        kanban: "看板只是文件，不需要服务或独立应用。",
        vibe: "带有 Rust 后端和网页界面的本地应用。",
      },
      setup: {
        dimension: "安装配置",
        kanban: "通过一条提示词安装技能文件和一个小型辅助脚本。",
        vibe: "运行 `npx vibe-kanban`，再安装并登录所需的智能体 CLI。",
      },
      whichAgents: {
        dimension: "智能体兼容性",
        kanban: "兼容任何能够读写仓库文件的智能体。",
        vibe: "支持 Claude Code、Codex、Gemini 等已集成的 CLI。",
      },
      lockIn: {
        dimension: "可移植性",
        kanban: "Markdown 看板随仓库一起迁移，无需额外导出。",
        vibe: "以 Apache-2.0 许可证开放，可自托管并支持数据导出。",
      },
      maintenance: {
        dimension: "维护方式",
        kanban: "在积极维护。",
        vibe: "Bloop 于 2026 年 4 月关闭后，转由社区维护。",
      },
    },
  },
  purpose: {
    heading: { eyebrow: "真正的差别", title: "规划任务，还是运行智能体" },
    lead: "两款产品服务于工作流中的不同阶段。AI4Kanban 帮助你明确**要做什么**并准备好任务；Vibe Kanban 则负责**让多个智能体执行任务**并集中审查结果。",
    ours: {
      name: "AI4Kanban — 规划与细化",
      is: "智能体直接读写仓库中的 Markdown 看板。细化流程会把初步想法补充成具体、可审阅的任务，并在开始实现前交由你确认。",
      isnt: "它不会启动智能体、创建 worktree 或提供 diff 查看器；这些工作仍由你的智能体或开发环境承担。",
    },
    theirs: {
      name: "Vibe Kanban — 执行与审查",
      is: "一个本地应用，可在独立的 git worktree 中并行运行多个编码智能体，并把任务执行、diff 审查与实时预览集中到同一个工作区。",
      isnt: "它的重点是管理智能体运行，而不是把尚未成形的想法完善为详细的实施计划。",
    },
    note: "如果你主要用 Vibe Kanban 来整理任务，AI4Kanban 提供了更简单、与仓库融为一体的选择。如果你更看重并行执行和集成式审查，Vibe Kanban 仍然更符合需求。",
  },
  wins: {
    heading: { eyebrow: "取舍", title: "各自赢在哪里" },
    lead: "两者没有绝对的高下之分。AI4Kanban 优先考虑轻量、可移植的规划流程；Vibe Kanban 优先考虑多个智能体的协同执行与审查。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Vibe Kanban",
    ours: {
      nothingRunning: {
        title: "无需维护服务",
        body: "看板就是仓库中的纯 Markdown，不需要网页应用、数据库或后台服务。",
      },
      planning: {
        title: "结构化的任务细化",
        body: "细化流程会找出缺失信息，把粗略想法补充为具体任务，并在实现前交由你确认。",
      },
      outlives: {
        title: "从设计上保证可移植",
        body: "规划内容与代码一同保存在 git 中。克隆仓库即可带走看板，无需迁移或导出。",
      },
      anyAgent: {
        title: "兼容任何文件型智能体",
        body: "任何能够处理仓库文件的智能体都能使用这块看板，包括 Claude Code、Codex、Cursor 以及未来的工具。",
      },
    },
    theirs: {
      parallel: {
        title: "同时运行许多智能体",
        body: "Vibe Kanban 将任务分配给多个编码智能体，并让每次运行都隔离在独立的 git 分支和 worktree 中。",
      },
      reviewInPlace: {
        title: "在同一处执行与审查",
        body: "行内 diff、应用实时预览与 pull request 工作流，让你无需离开工作区即可检查智能体的产出。",
      },
      boardUi: {
        title: "专门设计的可视化界面",
        body: "网页界面专为启动任务、监控进度以及在智能体运行期间切换工作区而设计。",
      },
      support: {
        title: "丰富的智能体集成",
        body: "开箱即支持多个智能体 CLI，包括 Claude Code、Codex、Gemini 等。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "怎么选", title: "你该用哪一个？" },
    oursHeading: "这些情况选 AI4Kanban",
    theirsHeading: "这些情况选 Vibe Kanban",
    ours: [
      "你希望智能体直接在仓库中规划并细化任务。",
      "相比独立应用和数据库，你更偏好 git 中的 Markdown。",
      "你希望看板兼容任何能够处理文件的编码智能体。",
      "比起并行执行，你更看重明确、完整的任务要求。",
    ],
    theirs: [
      "你希望在隔离的 worktree 中并行运行多个编码智能体。",
      "你需要在同一界面中完成行内 diff 审查与实时预览。",
      "协调和审查智能体运行是你当前的主要瓶颈。",
      "你愿意使用由社区维护的开源项目。",
    ],
    verdict:
      "需要一套**与仓库融为一体的规划流程**，且不想维护独立运行环境，就选 AI4Kanban；需要**多智能体并行执行与集成式审查**，就选 Vibe Kanban。真正决定选择的，是任务规划与执行协调之中，哪一项更制约你的工作。",
    note: "Bloop 的关闭改变了 Vibe Kanban 的维护方式，但没有改变两款产品之间的根本差异。",
  },
};

export default zh;
