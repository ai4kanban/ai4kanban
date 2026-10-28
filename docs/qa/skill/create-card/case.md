# 用一句话建卡

## Setup

- 已装好看板和 skill（见 [让编码代理能驱动看板](../install-agent-skill/case.md)），本机
  `claude` 已登录；项目里有一个 README 和 `notes.js`，已提交。未登录 Cloud。

## Steps

1. 执行 `akb create "add a delete command that removes a note by its number"`。
   预期：立刻返回一个运行 id，并给出跟随日志和停止它的命令。
   证据：[01-create.log](01-create.log)
2. 执行 `akb run list`。
   预期：这次 `create` 运行显示为 running，带上用户原话。
   证据：[02-run-list.log](02-run-list.log)
3. 运行结束后执行 `akb run list` 和 `akb run log <id>`。
   预期：运行显示 done、用时、模型和花费；日志里能看到代理做了什么。
   证据：[03-run-done-and-log.log](03-run-done-and-log.log)
4. 查看 `docs/kanban/todo/`。
   预期：多出一张标题为删除笔记的新卡。
   实际：没有新卡。代理先补完 setup，建卡时被拒（"a card's number comes from Cloud"），
   运行却仍显示 done。已入 triage `local-create-makes-no-card`。
   证据：[04-no-card.log](04-no-card.log)

## Feedback

前三步体验好：一句话就起了后台运行，`run list` 能看到进度、花费，日志可读。但结果令人失望：
花了约 0.5 美元、1 分钟，没有卡，状态却是 ✓ done，只有读完日志才知道失败；代理还顺手改了
`config.md`、`modules.md` 等未提交文件。未连 Cloud 的本地看板目前没有建卡的路，`akb create`
应该一开始就说明这一点。
