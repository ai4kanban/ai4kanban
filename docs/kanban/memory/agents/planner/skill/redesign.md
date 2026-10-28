# Redesign

Design mistakes to avoid when writing a card: the mistake, then the design we want.

## Card format

- ❌ **Card state kept outside the card** → ✅ every fact is an optional frontmatter field the command writes the moment it becomes true.
- ❌ **A second group for a goal an open group already carries** → ✅ add a subtask to that group.
- ❌ **Scope restating behavior the product already has** → ✅ list only what this task changes.
- ❌ **A user-facing answer planned as a command only** → ✅ say where it shows in the UI; if existing commands already return the data, ship a printed flow and build nothing.

## Planning a card

- ❌ **Every test as "check by hand"** → ✅ agent-executable checks in `## Todo`; user-visible cases belong to the QA manager, and a card carries no human checks.
- ❌ **An agent-proposed material change hidden in the folded half** → ✅ keep accepted behavior by default and raise every new user-facing scope choice as a `[user]` question.
- ❌ **Folding a structure layer the user did not name into a call they settled** → ✅ dropping or merging it is a `[user]` question.
- ❌ **Asking users to pick an unverified protection mechanism** → ✅ verify feasibility and bypasses first; an agent-guide contract plus an ownership check in the writing command is a real constraint, not a reason to escalate to a sandbox.
- ❌ **A run doing its own follow-up in its own session** → ✅ each step is its own run the user can see, read and stop.
- ❌ **Inferring unblocked cards after every run** → ✅ a card saves a one-shot refine when it first becomes blocked; finishing the blocker only makes it eligible.
- ❌ **Planning out everything a build might miss** → ✅ build the card; what it missed becomes follow-up cards after archive.
- ❌ **Building what the mockup shows against the card's scope** → ✅ scope wins; a redrawn mockup replaces it only when the card says so.
- ❌ **Treating text differences as changed requirements** → ✅ the agent applying an answer judges it; delivery control consumes that.
- ❌ **规则或 agent 产出了错的数据，只在界面或检查里兼容（如待办全勾也显示「执行」、只放宽交付检查）** → ✅ 改产出数据的源头，包括给 agent 的提示，下游逻辑保持简单。
- ❌ **规划者自己在卡里写提示词改动** → ✅ 提示词改动交给 prompt-writer，写在它自己的一节。

## Idea intake

- ❌ **A plan split that adds a limit nobody asked for and parks the rest in a recurring card** → ✅ batching splits the work, never the result.
- ❌ **Making users locate a session before reporting a bad result** → ✅ start from their complaint and linked card and find the evidence.
- ❌ **Truncating shared evidence to size caps** → ✅ keep conversations whole and let the feedback assistant select.
- ❌ **Checking for an invalid request at every downstream step** → ✅ disallow it where it is produced.

## Agents and workflows

- ❌ **为绕开某个约束另加一个新 agent，推翻已定由谁负责** → ✅ 规则留在已定的负责者那里，缺的那一层给它补上。
- ❌ **拆出助手 agent，却仍让主导者替它定细节、读它的产物、写它的记忆** → ✅ 主导者只说要证明什么并读回报，其余细节和记忆都归助手。
- ❌ **给工作流记忆加需要持续维护的索引或清单** → ✅ 每次从源头现读，记忆只存推不出来的偏好。
- ❌ **把产品行为或 agent 不据以行动的存储细节写进提示词和 guide** → ✅ 只写 agent 要做的事，一次、简短；产品行为由程序处理。
- ❌ **Fixing a long agent output by changing its format** → ✅ distil the content: final copy first, then only notes that affect the user's call.
- ❌ **A service token as a required user connection step** → ✅ the integration owns authorization; connector management stays separate from collection.
- ❌ **A screen assuming an agent wrote every field** → ✅ structured output with a full example and a validator naming the failing field; invalid output returns to its session and blocks approval.
- ❌ **agent 要生成媒体时让用户本地装模型** → ✅ 走 `akb cloud` 托管接口，非 Pro 时留空或降级。
- ❌ **Parking agent judgement in a proposal for the user to accept** → ✅ the agent decides and writes; the log is the record, undo is asking it back.

## The command and its guides

- ❌ **界面报错嵌入命令行的英文原句、写成一大段** → ✅ 一句话给出修法；面向用户的文字默认走中英文翻译。
- ❌ **改名只改文件名，或职责变宽了名称还停在旧职责** → ✅ 名称跟着职责走，所有指向它的名称一起改。
- ❌ **One word meaning different things at different layers** → ✅ one meaning per word and one name per level (delivery, run, session); never reuse a coding agent's own word.
- ❌ **Finding the board from the command's own file location** → ✅ find it from the working directory.
- ❌ **Publishing bookkeeping verbs as the typed command** → ✅ publish the UI's actions; a published verb is a contract forever.
- ❌ **Flows copied into each project as reference pages** → ✅ the command prints the flow with that project's modules and paths.
- ❌ **A second mode without a rule for picking it** → ✅ state the rule and where the agent reads it.
- ❌ **`npx <short name>` or `command -v <short name>` unchecked** → ✅ check npm first; prove a tool with its own subcommand.
- ❌ **由程序现算文件清单或把共享记忆全文塞进运行的提示** → ✅ 有文件可指的，guide 直接写路径（可带通配）、记忆各给一行名称和路径，让 agent 自己读；只有无文件可指的才由程序算。
- ❌ **Another bookkeeping call to collect a measurement** → ✅ add the evidence to a call the flow already makes.

## Memory and retirement

- ❌ **Seeding a file with a paragraph about what belongs in it** → ✅ start empty; explain where the user is asked.
- ❌ **Keeping a retired feature's record because other code touches it** → ✅ trace every reader and writer; if all feed the retired feature, the file goes too.

## Connectors

- ❌ **Pinning one exercised version and checking every connector** → ✅ only version-sensitive connectors declare a range; mature ones declare nothing.
- ❌ **Scoping by an assumed harness format limit** → ✅ the agent reads the file itself; surface a read failure as a gap rather than a per-harness parser.

## Templates

- ❌ **把验证复用用的品牌示例和预览随模板保存** → ✅ 模板包只含可复用源码、参数和必要依赖；示例与预览留在卡片资源，目录展示图单独存。
- ❌ **规划入库类流程时把命名、标签、存储位置、预览留到以后细化** → ✅ 规划时就闭合生产→审阅→发布的约定：工作流归属、命名、标签、存放位置和预览。
- ❌ **只用自制的中性样例验证复刻与发布** → ✅ 每种产出（UI、视频）至少有一个真实复刻的首个样例走完全链路。
