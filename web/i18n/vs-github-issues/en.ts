// English copy for the GitHub Issues comparison — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { VsGithubCopy } from "./types";

const en: VsGithubCopy = {
  meta: {
    title:
      "AI4Kanban vs. GitHub Issues — Different work calls for different tools",
    socialTitle: "AI4Kanban vs. GitHub Issues",
    description:
      "A practical comparison of AI4Kanban's file-based board and GitHub Issues, including local Markdown vs. a remote API, token usage, how easily agents can use each tool, team collaboration, and the situations where each works best.",
    social:
      "AI4Kanban is not designed to replace GitHub Issues — the two tools address different bottlenecks. A practical comparison across speed, tokens, agents, and teams.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nGitHub Issues",
    lead: "AI4Kanban is not designed to replace GitHub Issues. The two tools address different bottlenecks. GitHub Issues is a shared, durable system of record that supports public collaboration; AI4Kanban is a private, local workspace that an agent can operate directly. The right choice depends on what is slowing you down.",
    ours: {
      name: "AI4Kanban",
      body: "Plain Markdown stored in your repository, giving agents a fast local board they can read and update directly.",
    },
    theirs: {
      name: "GitHub Issues",
      body: "A hosted database accessed through an API, designed to serve as a shared system of record for a team or community.",
    },
  },
  summary: {
    heading: {
      eyebrow: "The short version",
      title: "Why not just use GitHub Issues?",
    },
    lead: "You can. Nearly everything AI4Kanban does can also be accomplished with GitHub Issues and the `gh` CLI or a GitHub MCP server. The meaningful difference is the operational cost.",
    panel:
      "For an agent, completing the same task through GitHub Issues usually involves **more data**, **more tool calls**, **greater token usage**, and **additional network latency**. It may also require **more explicit prompting** before the agent reaches for a remote tool. AI4Kanban does not offer GitHub's breadth of collaboration and integrations; instead, it prioritizes direct, fast local access. For a solo developer who works primarily with an agent, that speed can be the more valuable resource.",
  },
  comparison: {
    heading: {
      eyebrow: "Head to head",
      title: "AI4Kanban vs. GitHub Issues",
    },
    lead: "The table below compares the two tools across fourteen dimensions. A {check} marks a clear win; a **dash** marks a trade-off that comes down to what you need. AI4Kanban is strongest in **speed and local access**, while GitHub Issues is better suited to **scale and multi-person collaboration**.",
    ourLabel: "AI4Kanban",
    theirLabel: "GitHub Issues",
    rows: {
      storage: {
        dimension: "Storage",
        kanban: "Plain Markdown files in your repository, versioned with Git.",
        issues:
          "Hosted by GitHub and accessed through its interfaces and API.",
      },
      offline: {
        dimension: "Offline access",
        kanban: "Fully available because the board is stored on disk.",
        issues:
          "Issue data requires a network connection and authentication.",
      },
      agentReads: {
        dimension: "How an agent reads it",
        kanban:
          "Directly through filesystem tools such as Read, Grep, and Glob.",
        issues: "Through the `gh` CLI or remote MCP calls.",
      },
      tokenCost: {
        dimension: "Token usage per lookup",
        kanban:
          "Typically low because `grep` can return only the matching content.",
        issues:
          "Typically higher because the agent must process tool definitions and JSON responses.",
      },
      latency: {
        dimension: "Latency",
        kanban: "Local disk access is effectively immediate.",
        issues: "Each request must wait for a network response.",
      },
      setup: {
        dimension: "Setup",
        kanban:
          "Installed through a prompt; the core consists of a skill file and a small script.",
        issues:
          "Requires a GitHub account, authentication, and CLI or MCP configuration.",
      },
      lockIn: {
        dimension: "Platform dependency",
        kanban:
          "No hosted platform dependency; the board is plain text and travels with the repository.",
        issues: "Data remains in GitHub unless it is exported or migrated.",
      },
      metadata: {
        dimension: "Metadata",
        kanban:
          "Intentionally focused on essentials such as priority and effort.",
        issues:
          "Rich fields for labels, milestones, assignees, and projects.",
      },
      concurrency: {
        dimension: "Concurrent use",
        kanban:
          "No concurrency control; two people can create the same task number, such as #1894.",
        issues: "Server-assigned IDs safely support concurrent use.",
      },
      history: {
        dimension: "Decision history",
        kanban:
          "Retains the decisions that affect future work, such as why an idea was rejected and what has shipped.",
        issues:
          "Preserves the complete history of comments, edits, and activity.",
      },
      closing: {
        dimension: "Completing work",
        kanban: "A card is archived after all of its task items are complete.",
        issues:
          "Issues can close automatically through linked pull requests and workflows.",
      },
      search: {
        dimension: "Search at scale",
        kanban:
          "`grep` is fast on a small board but becomes less convenient as the board grows.",
        issues:
          "Indexed full-text search and saved filters are designed for larger datasets.",
      },
      contributors: {
        dimension: "External contributors",
        kanban:
          "Contributors can participate by committing Markdown, but there is no lightweight filing interface.",
        issues:
          "On public repositories, contributors can open issues, comment, and react without submitting code.",
      },
      transparency: {
        dimension: "Transparency",
        kanban:
          "Every card remains visible in the repository; only the memory hub is reduced to essential information.",
        issues:
          "Issues are easy to share and can support the public workflow expected by open-source communities.",
      },
    },
  },
  wins: {
    heading: { eyebrow: "Trade-offs", title: "Where each tool is stronger" },
    lead: "Neither tool is universally better. AI4Kanban is optimized for a developer and an agent moving work forward quickly. GitHub Issues is optimized for keeping many people and systems in sync.",
    oursHeading: "AI4Kanban",
    theirsHeading: "GitHub Issues",
    ours: {
      tokenLight: {
        title: "Efficient local access",
        body: "No MCP calls and no network dependency. The agent searches local Markdown instead of paging through a remote API, which reduces token usage and latency and avoids authentication interruptions during a task.",
      },
      agentsUseIt: {
        title: "Fits how agents already work",
        body: "Agents tend to use filesystem tools before searching a remote issue tracker. A Markdown board is available in the environment they already understand, so it requires less prompting and leaves less room for the agent to infer task state incorrectly.",
      },
      offline: {
        title: "Portable and available offline",
        body: "The board is a set of plain files in Git. It continues to work without a network connection or when GitHub is unavailable. There is no SaaS dependency or platform lock-in; cloning the repository brings the entire board with it.",
      },
      memory: {
        title: "Memory designed for the next decision",
        body: "AI4Kanban keeps the information that should guide future work: why an idea was rejected, what has shipped, and what remains between the current state and the goal. This helps the agent make useful forward-looking proposals instead of repeating completed or discarded work.",
      },
    },
    theirs: {
      teams: {
        title: "Designed for team coordination",
        body: "Server-assigned IDs, safe concurrent updates, and assignees make GitHub Issues suitable for multi-person workflows. AI4Kanban has no coordinating database, so two people can independently create task #1894 and produce a conflict.",
      },
      transparency: {
        title: "Accessible to a wider community",
        body: "Issues can be public and shared by URL, while external contributors can file reports, comment, and react. GitHub Issues is the better home when open participation matters more than local speed.",
      },
      fullContext: {
        title: "Complete activity history",
        body: "AI4Kanban deliberately compresses old information, reducing an archived card to a one-line summary. GitHub Issues retains comments, edits, and cross-references as part of the issue record.",
      },
      integration: {
        title: "Mature integrations",
        body: "GitHub Issues works with pull-request closing rules, commit links, projects, labels, milestones, indexed search, and a broad ecosystem of third-party tools.",
      },
    },
  },
  ergonomics: {
    heading: {
      eyebrow: "The key difference",
      title: "Why agents work well with files",
    },
    lead: 'The practical difference becomes clear when an agent performs the work. Ask it to **"find my high-priority open tasks"** and the two tools require substantially different paths.',
    issues: {
      title: "you › agent + GitHub MCP",
      chip: "multiple calls",
      lines: [
        "find my high-priority open issues",
        "list_issues(state:open, labels:high)",
        "4.2 KB JSON — 18 issues with every field",
        "paginate, filter, summarize…",
        "refresh authentication · process rate-limit headers · retry",
      ],
      footer: "several tool calls · kilobytes of JSON · network access each time",
    },
    kanban: {
      title: "you › agent + AI4Kanban",
      chip: "one call",
      lines: [
        "find my high-priority open tasks",
        'grep -rl "Priority: high" docs/kanban/todo',
        "three file paths",
        "done — one call, no network",
      ],
      footer: "one tool call · a few paths · entirely local",
    },
    note: "Those extra operations accumulate. Asking what to do next, archiving a task, and reviewing the board all require another remote interaction when the source is GitHub Issues. When both options are available, models also tend to choose familiar, low-friction filesystem tools unless they are explicitly directed to use the remote tracker.",
  },
  decision: {
    heading: {
      eyebrow: "Choosing between them",
      title: "Which tool should you use?",
    },
    oursHeading: "Use AI4Kanban when",
    theirsHeading: "Use GitHub Issues when",
    ours: [
      "You work alone or with one or two trusted collaborators.",
      "You primarily drive work through an agent in the terminal.",
      "You value forward progress and concise decision memory more than a complete activity log.",
      "You want the board to remain in Git, available offline and easy to move.",
    ],
    theirs: [
      "You are building in public and process transparency matters.",
      "Several people need to update the backlog concurrently.",
      "Your workflow depends on pull-request and CI integrations, projects, or milestones.",
      "You want external contributors to file issues and participate in discussions.",
    ],
    verdict:
      "AI4Kanban and GitHub Issues are not direct substitutes. GitHub Issues provides a **shared system of record**; AI4Kanban provides a **fast local board that an agent can operate directly**. If coordination between people is the bottleneck, use GitHub Issues. If the bottleneck is how efficiently you and an agent can move work forward, use AI4Kanban.",
    note: "Many solo developers use both: GitHub Issues as the public issue tracker and AI4Kanban as the private workspace their agent uses each day.",
  },
};

export default en;
