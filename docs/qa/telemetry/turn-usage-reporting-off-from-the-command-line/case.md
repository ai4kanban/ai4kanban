# 在命令行关掉、再打开用量上报

## Setup

- **`akb`**：已装好的 `akb`（取证时用本仓库构建的 `cli/dist/kanban.mjs`，经 PATH 上的 `akb` shim 运行）。
- **本机状态**：一个从没设置过上报的 `AI4KANBAN_HOME`（取证用的是空的临时目录）。

## Steps

1. 运行 `akb telemetry status`。
   第一行「Usage reporting is on.」，下面是本机的 install id、关闭用的命令 `akb telemetry off`，和隐私页地址。
   [01-status-on.log](01-status-on.log)（install id 已替换成 `<install-id>`）

2. 运行 `akb telemetry off`。
   回答「Usage reporting is off.」，并说明不再发送、排队中的会丢掉、install id 被忘掉。
   [02-off.log](02-off.log)

3. 再运行 `akb telemetry status`，看一眼 `AI4KANBAN_HOME`。
   状态是 off，不再显示 install id，提示用 `akb telemetry on` 打开；目录里只剩 `settings.json`，写着 `"usageReporting": false`。
   [03-status-off.log](03-status-off.log)

4. 运行 `akb telemetry on`。
   回答「Usage reporting is on.」，并说第一次排队事件时会拿到新的 install id。
   [04-on.log](04-on.log)

5. 再运行 `akb telemetry status`。
   又是 on，install id 和第 1 步的不同。
   [05-status-on-again.log](05-status-on-again.log)，[06-new-install-id.log](06-new-install-id.log)

## Feedback

- **一条命令就够**：开、关、查都在 `akb telemetry` 下，回答一两行，每次都给出反向命令和隐私页，不用翻文档。
- **关掉就真的忘了**：install id 跟着删除，再打开换新的，旧数据和新数据连不起来，这点让人放心。
- **默认是开的，命令行不会问**：只装命令行的人不跑 `status` 就不知道在上报；`--help` 里写了，但第一次运行时没有提示。
- **「首次排队时才有新 id」不太准**：第 4 步这么说，但第 5 步一查 `status` 就已经有了新 id，读起来像两件事。
