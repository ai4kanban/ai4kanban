// 中文 — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const zh: VsHermesCopy = {
  meta: {
    title: "AI4Kanban vs. Hermes Agent Kanban：先审关键部分，再让智能体执行",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description: "已经在用 Claude Code 或 Codex，想在智能体动手前先看看界面、Prompt 或文案？AI4Kanban 更合适。已经在用 Hermes Agent，想在 Telegram 或 Slack 里管理任务？Hermes Kanban 更合适。逐项看两者各自强在哪里。",
    social: "Hermes Kanban 让你的 Hermes 智能体执行任务，可在聊天应用里随时操控；AI4Kanban 让 Claude Code、Codex 执行任务，并先把关键部分做成草稿给你看。哪个更适合你的工作方式？",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "内置专业工作流和草稿审批，把你的判断放在执行之前，事后返工更少。",
    sharedLabel: "两者都支持",
    setup: {
      heading: "专业智能体和工作流，开箱即用",
      ours: "内置智能体和工作流覆盖软件开发、博客、社交轮播、演示文稿和产品视频；你也可以创建自己的智能体和工作流。",
      theirs: "执行者是你自己配置模型和 skill 的 Hermes profile；没有内置 UI 设计、文案或内容制作的专业工作流。",
      art: {
        ours: [
          "UI 设计",
          "Prompt",
          "文案",
        ],
        theirs: {
          title: "执行者 profile",
          fields: [
            "名称",
            "模型",
            "Skill",
          ],
          slot: "需自行配置",
        },
      },
      shared: [
        {
          title: "任务拆解与依赖管理",
          body: [
            "AI4Kanban 把工作拆成卡片和子任务，用依赖关系安排执行顺序。",
            "Hermes Kanban 把一句话任务拆成子任务，父任务完成后再运行子任务。",
          ],
        },
        {
          title: "在 git worktree 中并行运行",
          body: [
            "AI4Kanban 让独立的卡片同时推进，每张在独立的 git worktree 中运行。",
            "Hermes Kanban 并行运行任务，每个任务一个 git worktree。",
          ],
        },
      ],
    },
    drafts: {
      heading: "关键草稿，先审阅再实现",
      ours: "选择你要审阅的 UI、Prompt、文案等关键部分；智能体先准备可预览、可修改的草稿，再按你确认的内容执行。",
      theirs: "任务从一份文字规格开始；文档中没有执行前预览和审批关键草稿的流程。",
      art: {
        ours: [
          "关键草稿",
          "确认方向",
          "执行任务",
        ],
        theirs: {
          title: "任务规格",
          fields: [
            "目标",
            "做法",
            "验收标准",
          ],
          slot: "只有文字",
        },
      },
      shared: [
        {
          title: "书面规格",
          body: [
            "AI4Kanban 的卡片写明范围和构建步骤。",
            "Hermes Kanban 可把任务改写成目标、做法和验收标准。",
          ],
        },
        {
          title: "任务修改",
          body: [
            "AI4Kanban 在卡片对话里接收你的修改，并随之更新计划。",
            "Hermes Kanban 在任务评论里把你的说明交给执行者。",
          ],
        },
      ],
    },
    questions: {
      heading: "先定交付要求，再放手执行",
      verdict: "少盯不等于降低质量：草稿审阅、问答澄清和要点提取，让结果不跑偏。",
      ours: "接到任务不盲目开工：先问清关键问题，把交付要求定下来再执行。你只审批要点，细节交给智能体，不用时刻盯着，一天也就能交付更多工作。",
      theirs: "规划轻、执行快：任务拆好就开工，交付标准边做边调，出了偏差就在 worktree 里改。这也是一种可行的工作方式，但需要你在执行中持续跟进，一天能交付的工作也就更少。",
      art: {
        ours: [
          "澄清问题",
          "审批要点",
          "开始执行",
        ],
        theirs: {
          title: "执行中的任务",
          fields: [
            "开工",
            "边做边调",
            "在 worktree 里修改",
          ],
          slot: "需要持续跟进",
        },
      },
      shared: [
        {
          title: "边做边学的智能体",
          body: [
            "AI4Kanban 的专业智能体会记下你退回或否决的草稿，完成的卡片还会被回顾，提炼决定和偏好。",
            "Hermes 的每个 profile 保留记忆笔记，并根据学到的经验（包括你的纠正）自己写 skill。",
          ],
        },
        {
          title: "任务记录",
          body: [
            "AI4Kanban 把计划、对话和运行记录保留在卡片上。",
            "Hermes Kanban 在任务上保留评论串和运行记录。",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: {
      eyebrow: "主要区别",
      title: "详细对比",
    },
    lead: "{check} 表示该行更强的一方。",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      startingPoint: {
        dimension: "内置智能体和工作流",
        kanban: "内置开发和内容方向的专业智能体与工作流，也可自建；内容工作流需要 Pro。",
        hermes: "通用的 Hermes profile 由你配置；没有内置 UI 设计、文案或内容制作的专业工作流。",
      },
      planning: {
        dimension: "开工之前",
        kanban: "规划先解决能自行判断的问题，再问你仍未确定的部分；你启动之前不会开始构建。",
        hermes: "由模型把任务拆成任务图，不会先问你；除非关闭该选项，子任务会自动开始。",
      },
      drafts: {
        dimension: "执行前审阅关键草稿",
        kanban: "支持图片、图表、HTML/TSX、diff 和分镜草稿；确认的内容成为执行要求的一部分。",
        hermes: "一份包含目标、做法和验收标准的文字规格；文档中没有执行前的草稿预览。",
      },
      questions: {
        dimension: "向你提问",
        kanban: "规划时和构建中都可提问，每个问题附带选项和推荐答案；只暂停依赖它的工作，回答后立即继续。",
        hermes: "执行者附上原因暂停整个任务；你评论并解除暂停后，执行者重新开始。",
      },
      memory: {
        dimension: "智能体记住什么",
        kanban: "每个专业智能体记下你退回或否决的草稿；完成的卡片会被回顾，提炼决定和偏好。",
        hermes: "每个 profile 保留记忆笔记，并根据学到的经验（包括你的纠正）自己写 skill。",
      },
      followUps: {
        dimension: "交付后的工作",
        kanban: "智能体回顾已交付的内容，提出后续工作并说明理由；质检智能体每天测试近期改动。建议先进入待分拣，由你决定。",
        hermes: "执行者会创建子任务来拆分进行中的工作；交付后的后续工作需要你自己新建任务。",
      },
      landing: {
        dimension: "合并并行的工作",
        kanban: "每次完成的构建依次变基并合并，冲突由智能体解决。",
        hermes: "任务完成后保留 worktree；文档没有说明如何合并回去，冲突需另建一个协调任务处理。",
      },
      recurring: {
        dimension: "周期性工作",
        kanban: "定时智能体按你设定的频率运行。",
        hermes: "支持一次性的定时启动；周期性工作需要你自己配置 cron。",
      },
      harness: {
        dimension: "使用 Claude Code 或 Codex",
        kanban: "Claude Code、Codex、Cursor、OpenCode 等编码智能体直接执行工作，使用你自己的订阅；每个智能体可单独选择。",
        hermes: "执行者是 Hermes 智能体；内置 skill 可让它在终端里调用 Claude Code 或 Codex。",
      },
      interface: {
        dimension: "看板与界面",
        kanban: "桌面端统一查看卡片、草稿、对话和运行状态。",
        hermes: "CLI、网页控制台和桌面端插件。",
      },
      review: {
        dimension: "检查成果",
        kanban: "Claude Code、Codex 构建时会运行测试、核对要求；AI4Kanban 不再额外加一轮审阅，避免过度测试。",
        hermes: "审阅 profile 逐条核对验收标准、运行测试，不通过就退回重做。",
      },
      chat: {
        dimension: "在聊天应用中操控",
        kanban: "通知、Slack 和飞书都依赖 Cloud，目前是邀请制预览。",
        hermes: "在 Telegram、Discord、Slack、WhatsApp、Signal 等应用中用 /kanban 管理看板，并接收任务通知。",
      },
      recovery: {
        dimension: "运行失败后的恢复",
        kanban: "模型服务出错时自动重试；已停止的运行需要你手动继续。",
        hermes: "通过心跳回收卡住的任务，反复失败的任务会被自动挂起。",
      },
      api: {
        dimension: "API 与扩展",
        kanban: "提供供编码智能体调用的 CLI；没有公开 API。",
        hermes: "提供 REST 和 WebSocket API，以及任务事件的插件钩子。",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "选择建议",
      title: "该选哪一个？",
    },
    oursHeading: "选择 AI4Kanban，如果你",
    theirsHeading: "选择 Hermes Kanban，如果你",
    ours: [
      "想要内置的专业智能体和工作流，或自己创建。",
      "想在完整执行前，先审批关键的 UI、Prompt 或文案草稿。",
      "希望每次交付后，智能体主动提出后续工作。",
    ],
    theirs: [
      "已经在用 Hermes Agent，希望看板就在其中。",
      "想在 Telegram、Slack、Discord 等聊天应用里管理任务。",
      "需要自动恢复卡住的任务，以及可二次开发的 API。",
    ],
    verdict: "需要**专业工作流、执行前的草稿审批和后续工作建议**，选 AI4Kanban；需要**聊天应用操控、自动恢复和 API**，选 Hermes Kanban。",
    note: "依据 Hermes Agent v0.21.6 文档对比，核对于 2026 年 10 月。",
  },
};

export default zh;
