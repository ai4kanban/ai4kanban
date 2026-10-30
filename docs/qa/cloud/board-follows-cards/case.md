# 在命令行改了卡片，网页上的任务跟着变

## Setup

- 已登录的账号，Runner 已连接并放了一个项目，项目里有几个等审核的任务。
- 未部署前用本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 web 一条）；本机命令行的改动由
  替身 Runner 按真实格式推送（`POST /v1/projects/{id}/board/commits`，运行之外不带 `job`）。

## Steps

1. Runner 空闲时，本机拒绝一张卡（`akb raw reject <id> --reason …`），Runner 推送。
   预期：推送被接受；任务变为 `cancelled`，原因出现在 `GET /v1/rejections` 里。
   证据：[01-reject.log](01-reject.log)
2. 本机归档另一张卡（`akb raw archive <id>`）。
   预期：任务变为 `done`。
   证据：[02-archive.log](02-archive.log)
3. 本机把第三张卡的工作流改成 `blog-post`。
   预期：任务的工作流变为「Blog post」，仍在等审核。
   证据：[03-workflow.log](03-workflow.log)
4. 任务正在运行时在网页点「移除」（`POST /v1/tasks/{id}/cancel`）。
   预期：不再报「任务正在运行」；任务立即 `cancelled`，`run.stopping` 为 true；Runner 停下后
   `run` 为 null，状态不变。
   证据：[04-remove-running.log](04-remove-running.log)
5. 运行中智能体拒绝了这张卡，Runner 随即推送，运行随后以 done 结束。
   预期：任务变为 `cancelled` 并开始停止；运行结束后仍是 `cancelled`，不会被设回等审核。
   证据：[05-reject-in-run.log](05-reject-in-run.log)

## Feedback

命令行和网页按钮终于是一回事：拒绝的原因进了被拒记录，运行结束也不再把已移除的任务拉回等审核。
摩擦点：第 5 步里智能体拒绝自己正在做的卡，会让云端去停它自己的这次运行，日志里看着像被用户打断；
运行中移除会直接丢掉进行中的工作，没有二次确认。真实 Runner 的监听与先推后拉、`card approve`
交给云端，属于 runner 和 skill 模块，本用例未覆盖；线上 Cloud 还没部署这次改动，以上全部来自本地栈。
