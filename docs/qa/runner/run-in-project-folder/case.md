# 让 Runner 在本机项目文件夹里干活

## Setup

- Runner 已登录并在运行（见 [第一次启动 Runner 并登录](../sign-in-and-connect/case.md)）。
- 本机有一个 git 项目 `demo-app`（只有一个 README），另有一个 git 项目 `other-app`。
- 本地云端栈取证；网页端发任务这一步用 `POST /v1/runner/jobs` 代替。证据里的 `~` 是取证用的
  临时目录。

## Steps

1. 把 `demo-app` 写进 `~/.wildcrane/projects.json`，并把它作为项目放到这台电脑上。
   预期：Cloud 记下项目和它在本机的路径。
   证据：[01-place-folder.log](01-place-folder.log)
2. 给这个项目发一个任务：「读 README，用一句话说这是什么项目」。
   预期：Runner 领走任务，终端显示 `Running 1 task`，做完回到 `waiting for tasks`。
   证据：[02-dispatch.log](02-dispatch.log)
3. 查看任务结果和项目文件夹。
   预期：任务 `done`，回复是根据 README 写的一句话，带花费和 token 用量；项目里多出的
   `.akb/`、`.claude/`、`.agents/` 不出现在 `git status` 里。
   证据：[03-reply.log](03-reply.log)
4. 把 `other-app` 也放到这台电脑上，但不写进 `projects.json`，再给它发一个任务。
   预期：任务失败，原因写明 Runner 不允许在这个文件夹工作；文件夹里什么都没写。
   证据：[04-refused-folder.log](04-refused-folder.log)

## Feedback

任务在本机项目里跑、结果带回 Cloud，项目的 git 状态保持干净，这些都可靠。主要摩擦在第 4 步：
Cloud 允许把文件夹放到电脑上，Runner 却按另一份 `projects.json` 拒绝，用户要等任务失败才知道；
没有桌面端时，用户得自己手写这个 JSON。终端只说 `Running 1 task`，不说是哪个项目、哪个任务；
第 2 步中途还显示过 `Running 2 tasks`：Runner 顺手在新项目上跑了看板自带的项目描述 agent（写出
`.akb/kanban/memory/project.md`），用的是用户自己的额度，事先没有任何提示。
