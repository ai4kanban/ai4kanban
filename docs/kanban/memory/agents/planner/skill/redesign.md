# Redesign

Design mistakes to avoid when writing a card: the mistake, then the design we want.

## Card format

- ❌ **Card state kept outside the card** → ✅ every fact is a frontmatter field the command writes, stamped as an optional field the moment it becomes true.
- ❌ **One feature split into sibling top-level cards** → ✅ one group task; a goal an open group already carries gets a subtask, not a second group.
- ❌ **Scope restating behavior the product already has** → ✅ list only what this task changes.
- ❌ **A user-facing answer planned as a command only** → ✅ say where it shows in the UI; if existing commands already return the data, ship a printed flow and build nothing.
- ❌ **用成对自定义标签给卡片内容分区** → ✅ 用普通 Markdown 标题由界面折叠；模型常漏写结束标签。
- ❌ **为一项选择在卡片上加持久控件（如 MDX 选择器）** → ✅ 用 frontmatter、`[user]` 问题、对话与审批；MDX 组件存不下答案。

## Planning a card

- ❌ **Every test as "check by hand"** → ✅ agent-executable checks in `## Todo`; `verify:` only for a reproducible human plan, with its fixtures.
- ❌ **An agent-proposed material change hidden in the folded half** → ✅ keep accepted behavior by default and raise every new user-facing scope choice as a `[user]` question.
- ❌ **A run doing its own follow-up in its own session** → ✅ each step is its own run the user can see, read and stop.
- ❌ **Inferring unblocked cards after every run** → ✅ a card saves a one-shot refine when it first becomes blocked; finishing the blocker only makes it eligible.
- ❌ **Scoping a chain of runs by its happy path** → ✅ say what a stopped run, a failed run and an empty report do to the chain.
- ❌ **Folding a structure layer the user did not name into a call they settled** → ✅ dropping or merging it is a `[user]` question.
- ❌ **Asking users to pick an unverified protection mechanism** → ✅ verify feasibility and bypasses first; an agent-guide contract plus an ownership check in the writing command is a real constraint, not a reason to escalate to a sandbox.

## Idea intake

- ❌ **An article or complaint sent straight to add-task** → ✅ extract the user problems and check them against shipped, planned, rejected and remembered work first.
- ❌ **A plan split that adds a limit nobody asked for and parks the rest in a recurring card** → ✅ batching splits the work, never the result.
- ❌ **A discussion plan leaving proposable decisions open** → ✅ choose and justify; ask only for indispensable user input, with a recommendation.
- ❌ **Making users locate a session before reporting a bad result** → ✅ start from their complaint and linked card and find the evidence.
- ❌ **Truncating shared evidence to size caps** → ✅ keep conversations whole and let the feedback assistant select.

## Agents and workflows

- ❌ **Exposing hypothetical hook support** → ✅ expose only supported stages.
- ❌ **Fixing a long agent output by changing its format** → ✅ distil the content: final copy first, then only notes that affect the user's call.
- ❌ **A service token as a required user connection step** → ✅ the integration owns authorization; connector management stays separate from collection.
- ❌ **A screen assuming an agent wrote every field** → ✅ structured output with a full example and a validator naming the failing field; invalid output returns to its session and blocks approval.

## The command and its guides

- ❌ **Finding the board from the command's own file location** → ✅ find it from the working directory.
- ❌ **Publishing bookkeeping verbs as the typed command** → ✅ publish the UI's actions; a published verb is a contract forever.
- ❌ **One word meaning different things at different layers** → ✅ one meaning per word and one name per level (delivery, run, session); never reuse a coding agent's own word.
- ❌ **Flows copied into each project as reference pages** → ✅ the command prints the flow with that project's modules and paths.
- ❌ **Routing card body edits through a command** → ✅ flows edit bodies with file tools; only frontmatter goes through the command.
- ❌ **A second mode without a rule for picking it** → ✅ state the rule and where the agent reads it.
- ❌ **`npx <short name>` or `command -v <short name>` unchecked** → ✅ check npm first; prove a tool with its own subcommand.
- ❌ **Guide text about storage no agent acts on** → ✅ the guide carries only what agents act on, once and short.

## Memory and retirement

- ❌ **Seeding a file with a paragraph about what belongs in it** → ✅ start empty; explain where the user is asked.
- ❌ **Parking agent judgement in a proposal for the user to accept** → ✅ the agent decides and writes; the log is the record, undo is asking it back.
- ❌ **Another bookkeeping call to collect a measurement** → ✅ add the evidence to a call the flow already makes.
- ❌ **Keeping a retired feature's record because other code touches it** → ✅ trace every reader and writer; if all feed the retired feature, the file goes too.

## Deliveries

- ❌ **Treating text differences as changed requirements** → ✅ the agent applying an answer judges it; delivery control consumes that.
- ❌ **Turning a detail found in review into a card** → ✅ review fixes in-scope mistakes and drops the rest; discovery is planning's job.
- ❌ **Keeping a review verdict after a conflict rebase** → ✅ review the composed tree, so the reviewed tree is the one that lands.

## UI design

- ❌ **A screen planned in prose and called ready** → ✅ it carries a drawing before leaving planning.
- ❌ **Building what the mockup shows against the card's scope** → ✅ scope wins; a redrawn mockup replaces it only when the card says so.

## Connectors

- ❌ **Pinning one exercised version and checking every connector** → ✅ only version-sensitive connectors declare a range; mature ones declare nothing.
- ❌ **Standalone CLI paths taken as Desktop coverage** → ✅ scan the Desktop cache paths too, hashed folders included.
- ❌ **Scoping by an assumed harness format limit** → ✅ the agent reads the file itself; surface a read failure as a gap rather than a per-harness parser.
- ❌ **A second handled-ID list beside retained results** → ✅ scan the files once; limit the UI range without deleting dedup evidence.
