# QA 管理员（或它的子运行）报出的条目，直接建成 Coding 卡

## Setup

- **看板**：一次性 git 项目（`user.name` 设为 `qa`），`akb install` 新装，删掉 `setup-checklist.md`，连同下面的配置一起提交。Coding 自带定时 Agent `qa-manager`。
- **Agent**：用本目录的 [stand-in.mjs](stand-in.mjs) 顶替真实的 Agent（不需要账号）——在 `<project>/.akb/boards/docs/kanban/ui.config.json` 写 `{"harness":"claude-code","harnessSettings":{"claude-code":{"command":"node <路径>/stand-in.mjs"}}}`。定时运行时它用 `akb triage add` 报一条 `Settings page has no QA case`，再 `akb run start` 起一个子运行查暗色模式、`akb run wait` 等它；子运行报一条 `Dark mode toggle does nothing`。运行 id 都由看板自己的 `run` 命令生成。
- **Cloud（Pro）**：起 `node endpoint.mjs 4710`（本目录的 [endpoint.mjs](endpoint.mjs)），说账号是 Pro，并按条目标题回答判断的问题：两条 QA 条目分别答 `none` 和 `blog-post`，另两条无 agent 的条目分别答 `blog-post` 和 `none`，其余问题一律「值得做、不用问人」。`AI4KANBAN_CLOUD_URL=http://127.0.0.1:4710`，再在 `AI4KANBAN_HOME` 下手写一个 `session.json`（`supabaseUrl` 为默认项目，`accessToken` / `refreshToken` / `subject` 随便填，`expiresAt` 设到很远）。
- **终端**：zsh，`akb` 是一个 shim，执行这次构建出的命令，放在 `PATH` 最前面（Agent 也靠它调 `akb`）；`<project>` 是项目目录。

## Steps

1. 执行 `akb workflow schedule coding --run qa-manager`，十几秒后看 `akb run list --all`。
   一次 `scheduled qa-manager` 运行，下面挂着它的子运行 `sub`（`Check dark mode …`）；之后自动跑了两次 `triage` 筛选，全部 `done`。
   [01-scheduled-pass.log](01-scheduled-pass.log)

2. 依次 `akb run log` 这四次运行。
   定时运行报出 `settings-page-has-no-qa-case.md` 并起了子运行；子运行报出 `dark-mode-toggle-does-nothing.md`；两次筛选各建了一张卡：`#2 Settings page has no QA case`、`#3 Dark mode toggle does nothing`。
   [02-run-logs.log](02-run-logs.log)

3. 看归档的两条待筛选条目、Cloud 收到的判断请求、两张新卡的 frontmatter。
   两条都有 `agent: qa-manager`（子运行报的那条也有），`card_id` 指向新卡。判断给的工作流是 `none` 和 `blog-post`，但两张卡都没有 `workflow:` 行，即看板默认的 Coding；判断为 `none` 的那条也没被忽略。
   [03-items-and-cards.log](03-items-and-cards.log)

4. 在终端里 `akb triage add` 两条无 agent 的条目：`Export loses card order`、`Translate the docs into French`，看筛选结果和文件。
   这两条照判断走：前者成了 `#4`，带 `workflow: blog-post`；后者 `ignored: … — no workflow does it`，移到 `triage/dismissed/`。两条文件里都没有 `agent:`。
   [04-no-agent-items.log](04-no-agent-items.log)

5. 依次执行 `akb card implement 2 --print`、`3`、`4`。
   #2、#3 打印出实现的开场白（`Implement task …`），可以开工；#4 被拒绝（退出码 1）：`#4 is finished during planning, so it is archived rather than built.`
   [05-which-can-be-built.log](05-which-can-be-built.log)

## Feedback

- **QA 的发现不会再落到博客里**：子运行报的条目也署了 `qa-manager`，判断选错工作流甚至说「没有工作流能做」，卡照样进 Coding，可以直接实现。
- **全程不用动手**：`triage add` 写完就自动起筛选，定时运行结束时卡已经在看板上了。
- **看不出是谁定的工作流**：卡片和筛选日志都不说「按 qa-manager 的工作流建卡」；条目里仍记着判断的 `verdict` 等，没有一处提到判断的工作流被改掉。出问题时只能靠读代码推断。
- **Coding 卡没有 `workflow:` 行**：默认工作流靠「没写」来表示，在文件里看不出它和判断没选时的回退有什么区别。
- **非 Coding 卡的拒绝语难懂**：博客卡 `implement` 的回答是「finished during planning, so it is archived」，没说它属于博客文章工作流、该走哪个入口。
- **没有跑到的**：真实的 qa-manager（Claude Code）；真实 Cloud 和 Jev；Coding 以外的工作流里的定时 Agent；子运行的父运行记录已被清掉时退回子运行自己的 `specAgent`；界面上的卡片按钮（只用命令行看了能不能实现）。
