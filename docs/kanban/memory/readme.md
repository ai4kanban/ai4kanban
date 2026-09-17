# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

- Install and quick start: `README.md`.
- The daily loop — propose, add, refine, resolve, review, finish, reject — including what
  rejection records and what **Just discard** (`--discard`) skips:
  `web/content/docs/daily-loop.mdx`.
- Beside it, one page each: `chat.mdx`, `releases.mdx`, `runs.mdx`, `agents.mdx`,
  `connectors.mdx`, `triage.mdx`, `local-and-cloud-boards.mdx`. The commands themselves are
  `akb --help`, never copied onto the site.
- Memory keeps only notes that change a later planning call: a duplicate rejection, a routine
  status change or a fact already written down leaves none, and asking not to record
  suppresses the write while the board action still finishes.
- Triage sorting is an optional agent, off by default and asking once before it goes on:
  `web/content/docs/agents.mdx`, `web/content/docs/triage.mdx`.
- Pictures pasted into Create task go with the message you send. Clicking one opens it whole,
  and its ✕ takes it out without opening it.
- Submitting a batch of draft comments can carry one optional note about the whole draft; a
  comment on a passage wins where the two disagree.
- Edit on a card opens that card's chat with the caret in the box and the first line — "修改
  当前卡片：" / "Change this card:" — typed for you. Pressing it again folds the rail away, and
  a box that already has something in it is left exactly as it is.
- A notification that fails to reach Cloud is retried in seconds rather than a minute, backing
  off to a five-minute cap and giving up after about four hours with the board said to be out
  of step. A retry about a card somebody has since dealt with is dropped.
- A discussion now judges the idea before it plans one: it separates the outcome you want from
  the means you named, says whether the thing is worth doing at all, and may disagree, advise a
  pause, or ask for evidence first. A turn that only answers your question is a finished turn.
- A conversation you have already spoken in stays on the agent that opened it. Changing the
  discussion helper's runtime now only decides where a new conversation starts, and the old
  ones are asked to be cleared only once the board has no runtime on their own agent left.
- Mentioning a piece of work a card does not cover, while talking on that card, now opens a
  new card for it: the board takes your own words and runs the full add-task flow on its own,
  and the conversation says so and stays on the card you were reading.
- The lead agents of the Coding workflow the command ships are fixed and shown rather than
  picked, so the name of a built-in always says who runs it.
  Duplicating one, or adding your own, gives you a workflow whose three leads are yours to
  choose; the helpers on a built-in are still yours to add and remove.
- Coming back to a card page with Back or Forward (the browser's, or the app's swipe) now
  shows the card as it is on disk, not as it was when you left; a change that lands only in
  the folded agent analysis opens that fold.
- Fenced code in cards, memory pages and chat replies is coloured by its language tag (common
  languages, GitHub's light colours); a ```diff block shows added and removed lines in the Diff
  tab's green and orange. An untagged block stays plain.
- 卡片页和看板上的「讨论中」会在对话结束后自动消失，卡片页的按钮随之解冻，不必再切换标签页或按返回键刷新。
- Create task has no mode switch any more: sending always starts a discussion, and
  **Start planning** or **Build now** under its plan is where work begins, with a **Workflow**
  picker beside them when the board has more than one. A small, clear ask
  gets a plan ready to build in the first reply. Writing a card straight from a sentence is
  `akb create`.

## site

- The site has a contact page at `/contact` (all five languages, linked from the footer): one form for support and for custom agents at $15 per agent, answered by email.
- 对外定位定稿为「你掌舵，AI 带队」：AI 项目经理替你管理 Agent 团队，只汇报需要知道的事；中英文案与表达边界见仓库根目录 `positioning.md`。

## skill

- A specialist can wait for another one's section with `akb.dependencies`, and a new built-in `copywriting` agent writes promotional copy that `ui-designer` waits for until you confirm it: `web/content/docs/agents.mdx`.
- A project agent, `prompt-writer`, shows the full proposed text of any skill, agent prompt or akb guide change on the card and waits for your confirmation.
- The built-in Content creation workflow and its three content agents are gone; Coding is the only built-in workflow, and a card still marked `content` runs on it.
- An agent's `AGENT.md` no longer takes `akb.owns`; its `description` is what the Agents and Workflows panes show, and an old `owns` line is ignored: `web/content/docs/agents.mdx`.
- A workflow's review stage is a list of reviewers with no lead: the board picks the ones a build's diff needs, the built-in `code-reviewer` replaces the Reviewer role, and a workflow with no reviewers delivers a finished build unreviewed: `web/content/docs/agents.mdx`.
- 一个 spec agent 的记忆由它自己的 `AGENT.md` 决定：`docs/kanban/memory/agents/<agent>/` 里的每个文件都会交给它的每次运行，`akb.memory` 键不再需要（旧文件里的会被忽略）；`copywriting` 改记一份 `writing.md`，记忆面板只列出写过文件的 agent：`web/content/docs/agents.mdx`。
- 内置 `copywriting` agent 不再自带写作规则：语气、用词和长短只取自项目已发布的文案和 `writing.md`，它只负责写出最终文案并请你确认。
- 内置 `copywriting` agent 的交付改为成稿在前：按页面与小节只给改动的部分，多语言分组，后附最多三条影响判断的说明。
- 新增内置工作流「演示视频」（`hyperframes-video`）：脚本作者把分镜写进卡片，素材准备备齐素材，视频组装用 HyperFrames 在本地渲染出 mp4，素材和成片放在 `.akb/boards/docs/kanban/assets/<卡片号>/`；自建工作流也可以选用 `kind: lead` 的 agent 当负责人：`web/content/docs/agents.mdx`。
- 待你决定的问题可以在卡片的“待澄清问题”里逐题“跳过”（或 `akb raw update-questions <id> --skip <n>`）：问题保留为带删除线的记录并可“撤销”，只剩已跳过的问题时，等待中的交付自动继续；手动删除问题效果相同：`web/content/docs/daily-loop.mdx`。
- 自建工作流的「负责 Agent」下拉框只列出声明可担任负责人的 agent（`AGENT.md` 的 `akb:` 下写 `lead: true`；新建 agent 默认只当辅助，模板里留有这一行）；内置的 Planner、Builder、脚本作者和视频组装可担任负责人，其余只当辅助；之前已选了未声明 agent 的阶段照常运行，并在该阶段标出提示：`web/content/docs/agents.mdx`。
