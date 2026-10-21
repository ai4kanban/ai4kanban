# 不用 Git 工作树的卡片：规划待办被改了字，交付照样按 Output 那一行收尾

## Setup

- **项目**：`/tmp` 下一次性 git 项目，根目录有 `template.md`；`akb install` 新装，删掉初始卡 #1 和 `setup-checklist.md`。
- **工作流**：`akb workflow duplicate coding` 复制出 `wf-2`，再 `akb workflow worktree wf-2 off`：直接在项目里交付文件，不建分支。
- **卡片**：#2、#3 都用 [body.md](body.md)，唯一的规划待办是 ``Write `out/email/index.html` from `template.md` ``。
- **Agent**：[stand-in.mjs](stand-in.mjs) 顶替 Claude Code（看板 `ui.config.json` 的 `harnessSettings.claude-code.command`），照 #1910 那次构建的写法做事：先执行 `akb card implement <id> --print` 读流程，写出 `out/email/index.html`，勾上规划待办并在后面接一句带 `` `template.md` `` 的话；只在 #2 上另加一行 `` - [x] Output: `./out/email/` ``。
- **复现**：[run.sh](run.sh) 从头建项目并跑完全部步骤。

## Steps

1. 建好工作流和两张卡。
   `wf-2` 标着 `(no worktree)`；#2 的待办只有那一条未勾选的规划待办。
   [01-setup.log](01-setup.log)

2. 执行 `akb card implement 2`。
   起一次 `implement` 运行，属于一次新交付。
   [02-implement.log](02-implement.log)

3. 看运行里的 agent 读到的流程。
   收尾第 1、2 条是「add one ticked `## Todo` line naming where the output is, such as `` - [x] Output: `./out/email/` ``」和「tick the plan's todos without changing their text」。
   [03-flow.log](03-flow.log)

4. 运行结束后看 `akb run list`、卡片、交付状态和 git。
   运行 ✓ done；#2 已归档，待办里是改了字的规划待办加 `Output: ./out/email/` 一行；交付 `finished`，没有因为 `template.md` 不在 `out/` 而停下；git 没有新提交，只有 `main`。
   [04-archived.log](04-archived.log)

5. 对 #3 执行 `akb card implement 3`（同样改了字，但不加 Output 行），运行结束后再看。
   运行同样 ✓ done，但 #3 留在 `todo/`；交付停下，原因是 `the card records no output file`，`paths` 为空——改了字的规划待办只算进度，里面的 `template.md` 不再被当成缺失的产出。
   [05-no-output.log](05-no-output.log)

## Feedback

- **误报没了**：规划待办后面顺手写点说明不会再害交付卡住，#1910 那种「成品明明在、却报 `template.md` 不存在」的情况复现不出来了。
- **规则写得清楚**：收尾流程直接给了 `Output:` 一行的样例，照抄就能过检查。
- **命令行看不出停下了**：#3 的交付停了，`akb run list` 仍是绿色 ✓ done，卡片默默留在 `todo/`；停下的原因只在看板界面（`sessions.json`）里，只用命令行的人会以为做完了。
- **流程措辞对运行不准**：运行里读到的收尾标题是「no run is watching this one finish」，而这正是一次被看板盯着收尾的运行。
- **没有跑到的**：真实 Claude Code 是否照新流程写 Output 行；看板界面里停下的交付长什么样（属 local-ui 模块）。
