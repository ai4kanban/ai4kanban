# 用 DO_NOT_TRACK 关掉用量上报

## Setup

- 一个全新的 `AI4KANBAN_HOME`，`akb telemetry` 显示上报开启。
- `AI4KANBAN_USAGE_URL` 指向本地接收器，用来数收到的请求。

## Steps

1. 执行 `DO_NOT_TRACK=1 akb telemetry`。
   预期：设置仍显示 `Usage reporting is on.`，没有安装 id；本机目录是空的，没有排队事件，接收器 0 个请求。
   证据：[01-do-not-track.log](01-do-not-track.log)
2. 执行 `DO_NOT_TRACK=0 akb telemetry`。
   预期：`0` 等于没设，生成安装 id，排队 `app_day`、`app_open`。
   证据：[02-zero-is-not-set.log](02-zero-is-not-set.log)
3. 把这些事件改成昨天未发出的（下一条命令本该立刻发送），再执行 `DO_NOT_TRACK=1 akb telemetry`。
   预期：队列原样保留，接收器 0 个请求。
   证据：[03-queued-stays.log](03-queued-stays.log)
4. 去掉该变量，执行 `akb telemetry`。
   预期：接收器收到 1 个请求，带上排队的事件，队列清空。
   证据：[04-unset-sends.log](04-unset-sends.log)

## Feedback

- **通行约定，一设就生效**：不改设置，也不留痕迹，适合 CI 和测试机。
- **状态显示有误导**：设了变量后 `akb telemetry` 仍说 `Usage reporting is on.`，用户无从确认它已生效；命令输出里也没提到这个开关。
- **恢复后会补发**：设变量期间留在队列里的旧事件，去掉变量后照常发出，用户可能以为它们已作废。
- **桌面应用未取证**：本用例只跑了 `akb` 命令；看板内的计数和桌面应用走同样的判断，但没有实际验证。
