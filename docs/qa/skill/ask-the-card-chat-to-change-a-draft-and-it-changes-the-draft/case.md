# 在卡片对话里要求改草稿，草稿当轮就改好；第二轮改卡也不再重读一遍

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉自带的 #1 和 `setup-checklist.md`；`src/index.html` 是一个只有标题的首页。
- **卡片**：#2「Add a sign-up banner to the home page」，`status: ready`，Scope 和一条待办都写好；``## By `ui-designer` agent`` 下是 `<Asset src=".assets/2/banner.html" … />`，草稿是一条横幅：标题「Get paid faster」、副标题「Send your first invoice in two minutes.」、按钮「Start」。整个项目提交过。
- **Agent**：真实 Claude Code（看板默认运行时），走本机登录；`AI4KANBAN_HOME` 指向临时目录，PATH 最前是这次构建出的 `akb`。

## Steps

1. 看草稿原样。
   深蓝横幅，「Get paid faster」「Send your first invoice in two minutes.」，黄色按钮「Start」。
   ![对话前的草稿](01-draft-before.png)

2. 执行 `akb chat 2 "In the banner draft, change the button to \"Start free trial\" and the subtitle to \"No credit card needed.\""`。
   一轮回复里就改完：「I've updated the "Home page sign-up banner" draft with your new text」，说明标题、布局、配色没动，卡片仍是 ready，卡片校验通过；没有「本轮不改草稿」之类的推托。
   [02-chat.log](02-chat.log)

3. 再看草稿。
   副标题和按钮已是新文字，其余不变。
   ![对话后的草稿](03-draft-after.png)

4. 对比草稿文件，看 `git status` 和卡片。
   `banner.html` 只改了那两行；`src/index.html` 和卡片都没动——改草稿不等于开始实现。
   [04-what-changed.log](04-what-changed.log)

5. 接着执行 `akb chat 2 "Make the headline \"Get paid this week\", and have the button link to /trial instead of /signup."`。
   一轮改完两处：草稿标题和按钮链接已改；卡片 Scope 里的 `/signup` 也改成 `/trial`，开头那句「sign-up button」保留并说明理由；卡片校验通过。
   [05-second-turn.log](05-second-turn.log)

6. 翻这次会话里 agent 敲的命令和看板记下的每轮费用。
   第 1 轮读了 card-chat 指南、`card revise --print`、`spec ui-designer --print` 和 ui-designer 的参考，再用一条命令改文件并 `akb raw validate 2`；第 2 轮这次也改了卡片，却只有一条命令：同时改草稿和卡片、校验，没再打印 `card revise`、指南或整张卡。第 1 轮约 0.35 美元，第 2 轮约 0.06 美元。
   [06-commands.log](06-commands.log)

## Feedback

- **说改就改**：在对话里提一句，草稿当场变，不用再等一次规划；第 1 轮卡片和项目代码都没被顺手改掉，边界清楚。
- **续聊改卡也省**：第二轮既改草稿又改卡片 Scope，agent 照第一轮已打印的修改流程直接动手，一条命令、几美分，体验接近直接编辑。
- **主动对齐卡片**：换链接时它发现 Scope 写着 `/signup`，顺手改成 `/trial` 并在回复里说明；没说清的「sign-up button」措辞留着，也讲了为什么。
- **第一轮还是先找错了地方**：agent 先去 `docs/kanban/todo/.assets/2/` 找草稿，扑空后用 `find` 才找到 `.akb/boards/docs/kanban/assets/2/`；用户只看到多等了几秒。
- **没在浏览器里看**：两轮都只跑了 `akb raw validate 2`，没看改后的样子；纯文字改动无妨，改布局时可能漏掉溢出。
- **没有跑到的**：改另一张卡或换动作（回答问题、开始构建）时是否照常重新打印流程；演示文稿（`deck-planner`）这类领头 Agent 自己的草稿；Codex 运行时下的同一流程。
