import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { BlogMdx } from "@/components/blog/BlogMdx";
import { TocBlock, TocRail } from "@/components/blog/BlogToc";
import { BUILDER_PATH } from "@/components/social";
import { getCopy } from "@/i18n";
import { AUTHOR, extractToc } from "@/lib/blog";
import {
  APP_ID,
  jsonLd,
  pageUrl,
  softwareApplication,
  webPage,
} from "@/lib/schema";

export const PATH = "/kanban-for-codex";
export const TITLE = "Kanban for Codex: Plan Before Execution | AI4Kanban";
export const DESCRIPTION =
  "Turn rough ideas into Codex-ready tasks, preserve product decisions across sessions, and keep parallel work moving without watching every agent run.";
export const SCHEMA_DESCRIPTION =
  "AI4Kanban is a kanban for Codex that turns rough product ideas into implementation-ready tasks, preserves decisions and rejected options as project memory, coordinates dependencies and isolated worktrees, and asks for human attention only when product judgment or delivery approval is required.";

const faqs = [
  {
    question: "Does it work with a ChatGPT subscription, or do I need an API key?",
    answer:
      "Both work. AI4Kanban can use the ChatGPT login already held by your local Codex CLI, an OpenAI API key, or a gateway that supports the OpenAI Responses API. The provider is explicit, so a saved API key does not silently replace your subscription login.",
  },
  {
    question: "Can I choose the Codex model and reasoning effort for each kind of work?",
    answer:
      "Yes. Create named runtimes, bind each one to Codex, choose its model and reasoning effort, then assign runtimes to flows such as refine, implement, review, or a specialist agent. Leaving a field empty keeps the Codex default.",
  },
  {
    question: "Can I set a token or cost limit before starting a Codex run?",
    answer:
      "Not as a board-level hard cap today. AI4Kanban records the token counts Codex reports and estimates cost when it knows the model rate. You can control spend with the provider, model, and reasoning effort, but the board does not stop a run at a number you enter.",
  },
  {
    question: "Can AI4Kanban run several Codex tasks at once?",
    answer:
      "Yes. Independent, unblocked cards can build concurrently. Each automatic delivery gets its own branch and Git worktree, while the board serializes landing so finished changes reach your target branch one at a time.",
  },
  {
    question: "Can Codex work in my main checkout instead of a new worktree?",
    answer:
      "Yes. Turn off automatic Git commits globally or disable the branch option for one delivery. Codex then works in your current checkout, one delivery at a time, and you make the commit after review passes.",
  },
  {
    question: "How are .env files and dependencies handled inside worktrees?",
    answer:
      "A fresh worktree contains tracked project files, not ignored local files or installed dependencies. Add a repository-specific implement rule telling Codex how to install dependencies and seed local configuration. Agent API keys live separately in docs/kanban/.env, are kept out of Git, and are passed only to the run that needs them.",
  },
  {
    question: "Will Codex ever commit, merge, or push without my approval?",
    answer:
      "Automatic mode lets the delivery create focused commits and land one squash commit on the branch you selected. Enable diff approval if every tree must wait for you before landing, or use manual commit mode. AI4Kanban never pushes.",
  },
  {
    question: "What happens when Codex fails or reaches its usage limit?",
    answer:
      "The card keeps its delivery and worktree. Codex does not report a distinct rate-limit exit to the board, so it may wait until capacity returns; you can stop it, or let the configurable silence timeout end the run. Resume continues the saved Codex conversation after the interruption.",
  },
  {
    question: "Can I resume the same Codex session after restarting a task?",
    answer:
      "Yes. Resume calls Codex with its saved thread ID, so the next run continues the same conversation and everything it had already read. AI4Kanban records that continuation as a fresh run without discarding the delivery.",
  },
] as const;

const faqBody = faqs
  .map(
    ({ question, answer }) =>
      `<FAQItem question=${JSON.stringify(question)}>\n\n${answer}\n\n</FAQItem>`,
  )
  .join("\n\n");

const BODY = `
<TLDR title="The short answer">

Codex executes tasks. AI4Kanban is the planning layer above those tasks: it clarifies what should be built, keeps product decisions consistent across sessions, coordinates dependencies, and asks for human judgment only when project evidence cannot supply the answer.

</TLDR>

Codex already gives you parallel tasks, reusable project instructions, skills, MCP servers, and resumable threads. A kanban should not duplicate those features. Its useful job begins earlier: deciding whether a task is ready for Codex and preserving the product context that should constrain every task after it.

This guide explains that division of responsibility and the practical details of running Codex through AI4Kanban.

## Why use a kanban when Codex already supports parallel tasks?

Parallel execution answers **how many tasks can run at once**. It does not decide whether those tasks are the right work, whether they depend on one another, or whether ten sessions are making ten incompatible product assumptions.

AI4Kanban treats the board as a planning system rather than a terminal dashboard. A card becomes ready because its outcome and constraints are clear, not merely because a Codex slot is available.

| Layer | What it owns |
| --- | --- |
| You | Product direction, taste, business judgment, major risk, and acceptance |
| AI4Kanban | Requirement clarification, task boundaries, dependencies, project memory, and delivery state |
| Codex | Implementation, tests, review fixes, and the technical work inside an approved card |

This separation matters more as concurrency grows. Independent cards can start together. Blocked cards wait for their dependencies. A large goal can split into smaller cards that fit inside separate context windows without losing the parent outcome.

## Can Codex clarify requirements before coding?

AI4Kanban runs a clarification loop before implementation. It does not send every uncertainty to you.

1. It inspects the card, current code, relevant documentation, and project memory.
2. It resolves technical facts and reversible choices from that evidence.
3. It challenges the proposed scope, acceptance criteria, dependencies, and edge cases.
4. It leaves open only the decisions that materially affect the product and require human judgment.

An open question should arrive with a concise explanation, distinct options, and a recommendation. After you answer, the board merges the choice into the card instead of leaving it buried in a transcript.

<KeyTakeaways title="What should reach you">

- Taste and product direction
- Business constraints or market knowledge the repository cannot contain
- Expensive or difficult-to-reverse tradeoffs
- Delivery approval and checks that require your machine, data, or eye

</KeyTakeaways>

## How does project memory keep Codex aligned?

Codex can resume one thread, but a project lasts across many threads, context compactions, models, and tasks. Chat history is chronological; project memory is organized around the work.

AI4Kanban stores that memory as Markdown:

~~~text
docs/kanban/
├── memory/
│   ├── readme.md      — shipped behavior
│   ├── decisions.md   — settled product calls
│   ├── rejected.md    — paths not to repeat
│   └── redesign.md    — corrections and design lessons
└── todo/              — current cards
~~~

The codebase tells Codex what exists. These files add why it exists, which alternative was rejected, what a previous review corrected, and what future planning should treat as a default.

Each run reads the memory relevant to its card rather than replaying every conversation. As the files grow, the board can prune them into concise, planning-useful summaries. The goal is not to preserve every word; it is to preserve decisions that should still change future work.

For the broader reasoning, read [why project decisions become the bottleneck](/blog/project-decisions-are-the-bottleneck).

## How will I know when Codex genuinely needs me?

The board distinguishes the reason work stopped so you do not have to open every log to find out.

| Signal | What it means | What you do |
| --- | --- | --- |
| Product question | Project evidence cannot settle a consequential choice | Choose an option or provide the missing judgment |
| Codex sandbox refusal | The run attempted an operation outside its current permission boundary | Revise the task or deliberately widen the Codex command |
| Implementation blocker | The run recorded the failed step, cause, and unblock action | Resolve that condition, then resume |
| Delivery review | The code is ready for acceptance or a manual check | Approve the diff or verify the result |

Questions and approval requests appear in the app's notification center and can be sent to Slack. An optional diff-approval setting holds the exact reviewed tree before it lands. Other deliveries keep moving while one waits for you.

<Callout type="info" title="The board is not another log viewer">

Live logs remain available when you need them. The normal interface is the smaller brief: what needs a decision, why it needs one, and what happens next.

</Callout>

## How does AI4Kanban fit an existing Codex setup?

AI4Kanban runs your installed official Codex CLI locally. It does not fork Codex or replace its configuration.

Because the board launches Codex in the project, Codex continues to use:

- your ChatGPT subscription login, OpenAI API key, or Responses-API gateway;
- your selected model and reasoning effort;
- the project's AGENTS.md instructions;
- installed Codex skills and configured MCP servers; and
- the same Codex thread when a failed or stopped run resumes.

AI4Kanban adds the requirement lifecycle, project memory, dependencies, worktrees, run status, token reporting, estimated cost, and delivery controls around that existing setup. Named runtimes let different flows use different Codex models or effort levels—for example, a cheaper refine runtime and a more careful review runtime.

The exact connector matrix is maintained in [What each coding agent can do](/docs/connectors).

## Can AI4Kanban run Codex safely without hiding what it is doing?

### Worktrees isolate concurrent deliveries

Automatic deliveries build on separate branches in separate Git worktrees under .akb/worktrees/. Codex tasks do not write over one another or mix with edits in your main checkout. Finished deliveries land on the target branch one at a time.

You can disable automatic commits globally or turn off the branch option for one delivery. In that manual mode, Codex works in your current checkout, only one delivery runs at once, and you commit after review passes.

### Codex keeps its sandbox

Board runs use Codex's workspace-write sandbox. Network access is enabled so ordinary installs and Git fetches can work, but writes remain fenced to the project unless you explicitly customize the Codex command.

### The run remains inspectable and interruptible

The board streams the live log and records status, duration, model, token counts, and estimated cost when the model rate is known. You can stop an active run, keep its worktree, and resume the same Codex thread later.

After review, automatic mode creates one squash commit on the branch you selected. Diff approval can hold the tree first. AI4Kanban never pushes.

<FAQ title="Frequently asked questions">

${faqBody}

</FAQ>

## Where to go next

Use the [download page](/download) for installation, [the daily loop](/docs/daily-loop) for the complete card lifecycle, and [the connector guide](/docs/connectors) for current Codex capabilities and settings.

AI4Kanban is open source on [GitHub](https://github.com/ai4kanban/ai4kanban).
`;

const toc = extractToc(BODY);

const schema = jsonLd(
  {
    ...webPage(PATH, TITLE, SCHEMA_DESCRIPTION),
    mainEntity: { "@id": APP_ID },
  },
  softwareApplication({
    id: APP_ID,
    name: "AI4Kanban",
    description: SCHEMA_DESCRIPTION,
    url: pageUrl(""),
    free: true,
  }),
);

export function KanbanForCodexPage() {
  const c = getCopy("en");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <Header c={c} locale="en" />
      <main className="mx-auto max-w-4xl px-6 pb-8">
        <article>
          <header className="mt-10 border-b-2 border-border pb-10 lg:mt-16">
            <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-accent-deep">
              Codex workflow guide · 8 min read
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl">
              Kanban for Codex: planning before parallel execution
            </h1>
            <p className="mt-5 text-lg text-muted">
              How AI4Kanban clarifies requirements, preserves product decisions across Codex
              tasks, and tells you when a run genuinely needs human attention.
            </p>
            <a
              href={BUILDER_PATH}
              rel="author"
              className="mt-6 inline-block text-sm text-muted transition-colors hover:text-ink"
            >
              <span className="font-semibold text-ink">{AUTHOR.name}</span> · {AUTHOR.role}
            </a>
          </header>

          <div className="mt-12 lg:grid lg:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] lg:gap-10">
            <TocRail items={toc} />
            <div className="min-w-0">
              <TocBlock items={toc} />
              <BlogMdx source={BODY} />
            </div>
          </div>
        </article>
      </main>
      <SiteFooter c={c} locale="en" path={PATH} />
    </>
  );
}
