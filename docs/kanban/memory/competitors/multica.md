---
last_read: 2026-10-07
---

## Features

- [ ] **多台电脑共用一个工作区**：每台电脑运行一个 daemon，每个「电脑 + 编程工具」组合注册为一个 runtime。
- [ ] **智能体绑定 runtime**：智能体创建时选定一个 runtime，由它决定在哪台电脑、用哪个工具运行；不支持按任务选电脑 (#371)。
- [ ] **离线等待**：runtime 离线时排队中的运行会等待它恢复，超过重连宽限期才失败。
- [ ] **实时运行记录**：在网页上点 View transcript 可实时查看智能体的消息、工具调用和报错。
- [ ] **代码留在本机**：编程工具、其登录凭据和本地代码目录都留在接入的电脑上。

## Sources

- Daemon and runtimes: https://multica.ai/docs/daemon-runtimes
- Create and configure an agent: https://multica.ai/docs/agents-create
- Runs: https://multica.ai/docs/tasks
