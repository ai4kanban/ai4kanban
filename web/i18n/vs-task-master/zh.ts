// 中文 — the Task Master comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsTaskMasterCopy } from "./types";

const zh: VsTaskMasterCopy = {
  meta: {
    title: "AI4Kanban vs. Task Master：需求是你写，还是它问出来",
    socialTitle: "AI4Kanban vs. Task Master",
    description:
      "对比 AI4Kanban 与 Task Master（Taskmaster）。Task Master 把你写好的 PRD 拆成有依赖顺序的任务；AI4Kanban 从一句模糊的想法开始，一路追问到卡片可以直接开工。",
    social:
      "Task Master 需要你先写好 PRD 才能开始；AI4Kanban 只要你说一句话，剩下的它来问。看看哪种起点更贴合你的实际工作方式。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nTask Master",
    lead: "两者都用任务列表代替聊天窗，把活交给 coding agent。Task Master 接收你写好的需求文档，把它拆成有依赖顺序的任务。AI4Kanban 从更前面一步开始：你只说一句粗略的话，它不断提问，直到问出一个值得开工的需求。",
    ours: {
      name: "AI4Kanban",
      body: "仓库里的 Markdown 看板。智能体自主提出任务，遇到定不了的就问你，做完则归档。",
    },
    theirs: {
      name: "Task Master",
      body: "面向各类 AI 编辑器的任务引擎。解析 PRD，展开为子任务，再逐个消化待办。",
    },
    oursDiagramAlt:
      "一句粗略的话交给 AI4Kanban，它把自己回答不了的问题抛回给你，然后交出一张写完整的卡片。",
    theirsDiagramAlt:
      "一份写好的需求文档交给 Task Master，返回的是按依赖顺序编号的任务列表。",
    oursDiagramTop: "输入：一句粗略的话",
    oursDiagramBottom: "它先追问，再写出卡片",
    theirsDiagramTop: "输入：你已写好的文档",
    theirsDiagramBottom: "输出：按依赖顺序编号的任务",
  },
  summary: {
    heading: {
      eyebrow: "简要结论",
      title: "区别在于：你必须先拿出什么。",
    },
    lead: "Task Master（官方文档写作 `Taskmaster`）是面向 coding agent 最知名的任务管理工具，也确实称职：读入一份产品需求文档，拆成带依赖关系的任务，为每个任务的复杂度打分，把重的展开成子任务，再把下一个没有阻塞的任务交给你。如果你本来就会写需求文档，这基本够用了。",
    panel:
      "AI4Kanban 假设你还没有需求文档。你只给一句话，它去读代码和项目记忆，能自己定的就自己定，只把真正悬而未决的问题抛回给你，如此反复，直到卡片具体到可以开工。**提问本身就是产品。**看板则是答案留存的地方。",
    note: "2026 年 8 月 10 日核实：Task Master 最新版本是 0.43.1（2026 年 3 月 31 日），`main` 分支最后一次提交在 2026 年 4 月 23 日，同一团队正在开发托管产品 Hamster。它每月仍有约 78,000 次安装——这是一个使用广泛、但仓库趋于安静的工具，而不是一个已被废弃的项目。",
  },
  start: {
    heading: {
      eyebrow: "起点",
      title: "在两者能帮上忙之前，你得先拿出什么",
    },
    lead: "目标是一样的：产出一个 coding agent 不用猜就能做完的任务。区别在于起步时各自要求你先准备什么——这几乎就是全部差异。",
    ours: {
      label: "AI4Kanban",
      title: "一句话就够",
      steps: [
        "说出粗略的想法。不限格式，不用文档，也没有模板。",
        "智能体读代码、读项目过往的决策，能定的自己定，只把仍然悬而未决的问题拿来问你。",
        "它写出卡片，按价值和依赖关系排进看板，并把你的答案留给下一次。",
      ],
    },
    theirs: {
      label: "Task Master",
      title: "先写好一份文档",
      steps: [
        "先写需求文档。官方指南建议先和聊天模型一起把它写出来，再保存为 `.taskmaster/docs/prd.txt`。",
        "`parse-prd` 把它拆成带依赖关系的任务，`expand` 展开为子任务，`analyze-complexity` 打分找出还需要继续拆的部分。",
        "`next` 把当前没有阻塞、优先级最高的任务交给你。",
      ],
    },
    note: "两条路都不难。但如果文档本身含糊，Task Master 拆出来的也是含糊的任务——你当然可以用 `update-task` 补充上下文，research 模型也能去查资料，但整个流程里没有一步会主动问你到底想要什么。",
  },
  comparison: {
    heading: { eyebrow: "逐项对比", title: "AI4Kanban vs. Task Master" },
    lead: "{check} 表示这一项更适合谁；**横杠**表示取决于你的工作方式。Task Master 更强的是**覆盖面、批量执行和联网调研**；AI4Kanban 更强的是**把模糊想法变成真正的需求，并把已经定下的结论留住**。",
    ourLabel: "AI4Kanban",
    theirLabel: "Task Master",
    rows: {
      startingPoint: {
        dimension: "任务从哪里来",
        kanban:
          "你的一句粗略描述；也可以是智能体读过代码和看板之后自己提出的提案。",
        taskMaster:
          "你先写好的需求文档，解析成任务；也可以用一段提示逐个新增任务。",
      },
      vagueRequest: {
        dimension: "需求含糊时",
        kanban:
          "澄清循环先用记忆和代码回答能回答的，剩下的问你；只要还有问题悬着，卡片就不算就绪。",
        taskMaster:
          "文档有多具体，任务就有多具体。你可以更新任务、展开任务，或让 research 模型去查资料。",
      },
      board: {
        dimension: "看板在磁盘上的样子",
        kanban:
          "`docs/kanban/` 下一张卡片一个 Markdown 文件，外加纯文本的记忆文件。diff 读起来就是人话。",
        taskMaster:
          "一个 `.taskmaster/tasks/tasks.json` 装下全部任务和子任务；`generate` 还能为每个任务另写一份文本文件。",
      },
      setup: {
        dimension: "需要配置什么",
        kanban:
          "一条 prompt。不需要 MCP 服务，不需要 API key，也不需要配置模型——思考由你的 coding agent 自己的模型完成。",
        taskMaster:
          "MCP 服务或 CLI，外加 main、research、fallback 三个模型角色。Claude Code 和 Codex 这两个 provider 不需要额外的 key，其余大多需要。",
      },
      execution: {
        dimension: "谁来跑这些活",
        kanban:
          "由你的智能体实现卡片并归档。没有批量执行器，也不强制某一种测试流程。",
        taskMaster:
          "`loop` 会连续开启全新的 Claude Code 会话，自带测试、lint、去重等预设；`autopilot` 在独立分支上跑 red-green-commit 的 TDD 循环。",
      },
      memory: {
        dimension: "什么会沉淀下来",
        kanban:
          "按模块保存的记忆：决策、被否决的想法、设计纠偏和已交付的工作。下次提案前先读一遍，所以否决过的不会再被提出来。",
        taskMaster:
          "追加到子任务上的带时间戳的笔记、保存下来的调研文件，以及用 tag 区隔的多份任务列表。",
      },
      reach: {
        dimension: "能在哪里用",
        kanban:
          "目前是 Claude Code、Codex、Cursor、OpenCode、DeepSeek Harness、ZCode 和 Grok Build。看板就是纯文件，换一个 harness 不需要新格式，只需要接上。",
        taskMaster:
          "Cursor、Windsurf、VS Code、Claude Code、Codex、Kiro、Amazon Q 等，通过 MCP 或 CLI 接入，支持十五种以上的模型 provider。",
      },
      teams: {
        dimension: "多人协作",
        kanban:
          "协作方式就是 git：开分支、在 pull request 里评审计划、合并。没有实时同步。",
        taskMaster:
          "开源版同样是本地的，但同一团队还提供托管产品 Hamster，含共享 brief 与同步，每位 creator 每月 40 美元起。",
      },
      license: {
        dimension: "许可证",
        kanban:
          "Apache-2.0。可以使用、可以 fork，也可以拿它做出来的东西去卖，没有附加条件。",
        taskMaster:
          "MIT 附带 Commons Clause：个人、商业和学术使用均免费，但不得出售 Task Master 本身，也不得把它作为托管服务对外提供。",
      },
    },
  },
  boardShape: {
    heading: {
      eyebrow: "落到磁盘上",
      title: "一个 JSON 文件，还是一张卡片一个文件",
    },
    lead: "两块看板都放在仓库里，都随代码一起进版本管理。区别在于 diff 给人看到的是什么。",
    oursLabel: "AI4Kanban",
    theirsLabel: "Task Master",
    oursCaption:
      "一张卡片一个 Markdown 文件。pull request 里看到的是计划本身在变，是你能读、也能反驳的文字。",
    theirsCaption:
      "一个文件装下整个待办列表。diff 里是 JSON——准确，但本来就不是写给人读的。",
    note: "Task Master 在 0.42.0 加入了跨进程文件锁，避免两个进程同时写入导致数据丢失。分成多个文件就没有这种争用：只有两次运行改到同一张卡片时才会撞上。",
  },
  wins: {
    heading: { eyebrow: "取舍", title: "各自的长处" },
    lead: "Task Master 覆盖更广、能在无人值守下跑更久，还能联网查资料。AI4Kanban 刻意更窄：它要赢的是「还没有任务之前」的那一段。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Task Master",
    ours: {
      asksFirst: {
        title: "先问，再动手",
        body: "智能体把一句粗略的话变成一串问题，能从代码和过往决策里找到答案的自己解决，只把别人替不了的交给你。",
      },
      diffablePlan: {
        title: "计划就是能读的文字",
        body: "每张卡片都是一个 Markdown 文件。评审计划和评审代码一样——在 diff 里、用文字、在写下第一行代码之前。",
      },
      moduleMemory: {
        title: "它记得你否决过什么",
        body: "决策、被否决的想法和设计纠偏按模块保存，下次提案前先读，所以看板不会把同一件事提第二遍。",
      },
      nothingToWire: {
        title: "没有东西需要搭",
        body: "不用 MCP 服务，不用 API key，不用配置模型角色，也不会在每次对话里塞进一堆工具定义。一条 prompt 就装进仓库。",
      },
    },
    theirs: {
      everywhere: {
        title: "几乎在哪都能跑",
        body: "Cursor、Windsurf、VS Code、Claude Code、Codex、Kiro 等，通过 MCP 或 CLI 接入，支持十五种以上的模型 provider，含本地模型。",
      },
      research: {
        title: "自带联网调研",
        body: "独立的 research 角色可以在写任务或展开任务时引入最新资料，并把查到的内容保存在任务旁边。",
      },
      batchRuns: {
        title: "你睡觉时它也能干活",
        body: "`loop` 为每个任务开启全新的智能体会话，自带测试、lint、去重和坏味道等预设；`autopilot` 在独立分支上跑严格的 TDD 循环。",
      },
      proven: {
        title: "大家已经在用的那一个",
        body: "约 28,000 个 GitHub star，每月约 78,000 次 npm 安装，还有文档、Discord 和多年沉淀下来、可以照抄的工作流。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "怎么选", title: "哪一个更适合你？" },
    oursHeading: "选 AI4Kanban，如果",
    theirsHeading: "选 Task Master，如果",
    ours: [
      "你的想法往往只有一句话，卡住你的正是把需求写清楚这一步。",
      "你希望计划和它背后的理由都能在 diff 里评审，就放在代码旁边。",
      "你希望看板记住已有的决策和否决，别再来回问同样的问题。",
      "你不想再多跑一个 MCP 服务、多管一批 API key、多配一套模型。",
    ],
    theirs: [
      "你本来就会写需求文档，只想把它拆好、排好顺序。",
      "你在 Cursor、Windsurf、VS Code 或 Kiro 里工作，希望看板就在编辑器里。",
      "你需要开箱即用的批量无人值守执行，或者严格的测试先行流程。",
      "你希望规划过程自带联网调研，或者要用我们尚未支持的某个模型 provider。",
    ],
    verdict:
      "Task Master 从你的需求文档写完的地方开始；AI4Kanban 从它之前开始——它要做的就是从一个模糊想法到一个值得交给智能体的任务这一段。如果你文档写得好，Task Master 今天就能帮你多做完一些事；如果那份文档永远也写不出来，那这一段才是该先补上的。",
    note: "两者并不互斥：拿一张打磨好的 AI4Kanban 卡片去写 PRD，解析起来一样顺。但任务状态必须由其中一块看板说了算，否则你就得同时维护两块。",
  },
};

export default zh;
