import type { DraftFirstCopy } from "./types";

const zh: DraftFirstCopy = {
  meta: {
    title: "draft-first：AI 先出草稿，确认后再构建",
    description: "编码 agent 先出界面、Prompt 和文案的草稿。你看过、改好、确认，它再按稿实现，减少返工。",
  },
  schema:
    "draft-first 是编码 agent 的技能，支持 Claude Code、Codex、Cursor、OpenCode 等工具。它先提供界面、Prompt 与样例输出、文案、配图、技术选型和竞品对比供你审阅。你修改并确认后，agent 按选定的界面、文字和方案实现，减少构建时重新猜测造成的偏差。",
  hero: {
    title: ["先看草稿", "再往下做"],
    lead: "编码 agent 先出界面、Prompt 和文案的草稿。你看过、改好、确认，它再照着做。",
    update: "再次运行即可更新。",
    worksWith: "支持",
    alt: "draft-first 审阅页：删除一份草稿，给另一份写批注，然后确认。",
  },
  drafts: {
    title: "只为重点，先出草稿",
    lead: "AI 总是把细节做偏？先看关键部分的草稿，改好、确认，再让 agent 照着做。",
    kinds: [
      ["界面", "先看页面长什么样。"],
      ["Prompt", "先看提示词和样例输出。"],
      ["文案", "先读一遍 AI 写的文字。"],
      ["配图", "先看图片，再决定用哪张。"],
    ],
    more: "技术选型、竞品对比也能先出草稿。",
    closing: "非重点的部分，放权给 agent。",
  },
  review: {
    title: "修改满意，再照着做",
    actions: [
      ["删除", "去掉不要的方案。"],
      ["批注", "在草稿上写修改意见。"],
      ["确认", "保存 agent 接下来要照着做的版本。"],
    ],
    export: "可导出图片或单个 HTML 文件分享。HTML 文件在浏览器里就能打开，内容不会上传。",
    workflow: ["这些草稿背后的工作方式，见", "draft-first development", "（英文）。"],
  },
  helpers: {
    title: "需要草稿的地方，你来定",
    lead: "内置 6 个草稿 agent。想让 AI 做视频前先列分镜？添加 .draft-first/helpers/分镜.md，写清每个场景的画面和旁白。",
    example: "示例：添加视频分镜 agent",
    file: ".draft-first/helpers/分镜.md",
    description: "新建或修改视频。",
    body: "按顺序列出每个场景，一行写画面，一行写旁白。",
  },
  upgrade: {
    title: "任务太多？交给 AI4Kanban",
    lead: "把草稿放进 AI4Kanban 看板，在同一个地方规划、审阅和执行多项任务。",
    cards: [
      ["记住你的偏好", "agent 沿用你的偏好和决定，下次少些重复说明。"],
      ["多项任务一起做", "互不依赖的任务同时跑；需要前一项结果的，等结果出来再做。"],
      ["接着补齐后续工作", "完成任务后，agent 提出还需要做的跟进项。"],
    ],
    explore: "了解 AI4Kanban",
    download: "下载 AI4Kanban",
  },
  faq: {
    title: "常见问题",
    items: [
      ["草稿存在哪里？", "保存在项目的 .draft-first/ 目录里。确认后的草稿和批注也留在这里，agent 继续做时会读取。"],
      ["支持哪些智能体？", "支持读取 .claude/skills/ 或 .agents/skills/ 中技能的编码 agent。"],
      [
        "如何卸载？",
        "删除 .claude/skills/ 与 .agents/skills/ 下的 draft-first 目录。若也要清理项目草稿，先备份需要保留的内容，再删除该项目的 .draft-first/。",
      ],
    ],
  },
};

export default zh;
