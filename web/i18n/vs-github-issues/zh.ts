// 简体中文 — the GitHub Issues comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsGithubCopy } from "./types";

const zh: VsGithubCopy = {
  meta: {
    title: "AI4Kanban 与 GitHub Issues 对比：本地智能体看板与团队协作平台",
    socialTitle: "AI4Kanban vs. GitHub Issues",
    description:
      "对比 AI4Kanban 与 GitHub Issues 在数据存储、智能体操作成本、团队协作、历史记录和外部参与等方面的差异。",
    social:
      "AI4Kanban 侧重开发者与智能体在本地直接推进任务，GitHub Issues 侧重团队或社区之间的协作。",
  },
  hero: {
    badge: "对比",
    title: "AI4Kanban vs.\nGitHub Issues",
    lead: "AI4Kanban 与 GitHub Issues 解决的是不同的协作问题。AI4Kanban 把看板放在代码仓库中，便于开发者和智能体直接管理任务；GitHub Issues 则为团队或社区提供共享的任务记录和讨论空间。选择时，应考虑日常工作更依赖本地效率，还是多人协作。",
    ours: {
      name: "AI4Kanban",
      body: "看板以 Markdown 文件保存在代码仓库中，智能体可以直接读取和更新。",
    },
    theirs: {
      name: "GitHub Issues",
      body: "由 GitHub 托管，适合团队或社区共享任务、讨论进展和同步状态。",
    },
  },
  comparison: {
    heading: { eyebrow: "核心对比", title: "本地工作区与共享服务有何不同" },
    lead: "两者最根本的区别，是看板保存在本地工作区，还是由在线服务统一管理。这个选择会进一步影响智能体的操作成本、多人协作、历史记录和外部参与方式。",
    ourLabel: "AI4Kanban",
    theirLabel: "GitHub Issues",
    rows: {
      storage: {
        dimension: "数据存放与访问",
        kanban: "看板以 Markdown 文件保存在代码仓库中，智能体可直接读写，也可离线使用。",
        issues: "任务数据托管在 GitHub 上，智能体需要联网，并通过 `gh` CLI 或 MCP 访问。",
      },
      tokenCost: {
        dimension: "智能体的操作成本",
        kanban: "本地搜索可以只返回相关文本，占用的上下文较少，响应也更快。",
        issues: "远程操作还需要处理工具定义、JSON 响应和网络往返，通常会消耗更多 Token。",
      },
      concurrency: {
        dimension: "多人同时操作",
        kanban: "没有负责协调的服务端，两个人可能创建相同编号的任务并产生冲突。",
        issues: "由服务端统一分配编号和同步更新，可以安全地支持团队成员同时操作。",
      },
      history: {
        dimension: "保留哪些历史信息",
        kanban: "保留会影响后续工作的决定和结果，较早的详细信息会被整理为摘要。",
        issues: "完整保留评论、编辑、关联链接和其他活动记录。",
      },
      contributors: {
        dimension: "外部参与",
        kanban: "参与者需要具备仓库访问权限，并通过修改 Markdown 文件来协作。",
        issues: "在公开仓库中，任何人都可以创建 Issue、发表评论或使用表情回应，无需提交代码。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "如何选择", title: "哪一种工具更适合你的工作方式？" },
    oursHeading: "以下情况更适合 AI4Kanban",
    theirsHeading: "以下情况更适合 GitHub Issues",
    ours: [
      "你以独立开发为主，或只与一两位固定协作者共同工作。",
      "你主要在终端中使用智能体推进任务。",
      "相比保留完整的活动记录，你更重视快速推进任务，并只保留必要的决策信息。",
      "你希望看板保存在 Git 中，可以离线使用，也便于随仓库迁移。",
    ],
    theirs: [
      "多个人需要同时分配、更新和跟踪任务。",
      "项目需要公开推进，而且工作过程的透明度很重要。",
      "你的工作流依赖 PR、CI、项目、里程碑或自动化。",
      "你希望外部贡献者能够提交问题并参与讨论。",
    ],
    verdict:
      "这两种工具并不是简单的替代关系。GitHub Issues 是供团队使用的**共享任务系统**，AI4Kanban 则是智能体可以直接操作的**本地工作看板**。如果团队协调是主要瓶颈，GitHub Issues 更合适；如果你更需要提高自己与智能体推进任务的效率，AI4Kanban 会更顺手。",
    note: "两者也可以配合使用：用 GitHub Issues 面向团队或社区管理问题，用 AI4Kanban 作为智能体的本地工作区。",
  },
};

export default zh;
