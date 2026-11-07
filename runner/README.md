# wildcrane-runner

WildCrane's Local Runner. It connects this computer to WildCrane and runs the tasks WildCrane
sends on your local Claude Code, Codex, OpenCode or Cursor.

支持 macOS、Windows 和 Linux，通过终端运行。桌面端 App 已暂停支持。

```sh
npm install -g wildcrane-runner
wildcrane-runner
```

首次启动会打开浏览器登录。独立 Runner 与插件内的 Runner 每分钟检查云端指定版本，
下载成功后自动保存进度、停止执行并重启，随后恢复任务与对话。下载失败继续使用当前版本，
新版无法启动则自动回退。已有 Runner 需要先手动更新一次，才能获得自动更新能力。

更新交接的作业保留 7 天，期间断网会等待重连。已完成的结果直接回写；操作结果不明或
连接器无法提供恢复依据时，任务会提示检查后续跑，避免重复执行。

- **看板与技能**：通过插件连接云端项目；插件自带 kanban 技能，无需手动安装。Runner 为其他 Agent 准备项目技能并维护提交保护，保留用户文件和已有钩子。

- **Node**: 22 or newer.
- **代理**：宿主未传入代理时，在 `~/.wildcrane/proxy.env` 写入 `HTTPS_PROXY=...` 等代理变量并重启 Runner。支持 HTTP、HTTPS、ALL 和 NO_PROXY 的大小写形式。
- **One computer per account**: a second computer is refused while the first is connected.
- **Folders**: tasks run in `~/.wildcrane/work/`, or in a project folder listed in
  `~/.wildcrane/projects.json` (`{ "projects": ["/path/to/project"] }`). Any other folder is
  refused. 在插件中添加项目文件夹，或手动维护该列表。
- **Task folders**: a task's jobs share its board, `<project>/.akb/kanban` (kept out of git),
  or for a project with no folder here its own one, `~/.wildcrane/cache/<project>/.akb/kanban`
  (a git repository). They run one at a time and sync the card, memory and assets with
  WildCrane before and after each job.
- **Cache**: what a project keeps here is rebuilt from WildCrane by its next job. At start and
  once a day the Runner removes a project unused for 7 days or no longer in your account — its
  whole `cache/<project>/`, or only a linked folder's `.akb/` — unless a job runs there, a
  delivery is paused there, or its last sync failed.
- **Runner files**: `~/.wildcrane/bin/` holds the downloaded versions and the `akb` shims.
- **Periodic agents**: in each project folder it also runs the board's own agents (reflect,
  describe-project, review-dismissals, prune-memory) and each workflow's scheduled agents, when
  due by this computer's clock — on your runtime, so they use its quota.
- **akb**: tasks started from WildCrane run akb's workflows, on whichever of those the task's
  runtime names, with the version WildCrane names, else the copy the Runner carries (`dist/akb/`).
  Each registration may name a new one: it downloads from npm in the background to
  `~/.wildcrane/bin/akb/<version>/`, and takes over at the next task step once its contract matches
  and it answers `--version`. One that fails is never tried again (`bin/akb/state.json`); a version
  not chosen for 7 days is removed. No npmjs access means staying on the version in use.

## Development

`npm install` here (it builds `dist/`), `npm test`, `npm run lint`. The Runner bundles the CLI's
harness, session and Realtime code from `../cli/src`, and the CLI itself into `dist/akb/`, so
`cli/` needs its own `npm install`.
Releasing: [`docs/deploy.md`](../docs/deploy.md).

## 插件目标草稿

Codex 使用 `wildcrane_draft_read({ path?, discussionId? })`，Claude 使用 `wildcrane_draft_read({ discussionId?, sessionId? })`。返回 version、workflows、goals 和同值 ideas，以及讨论 url 和各目标 url；已开始目标链接任务。

`wildcrane_draft_save({ discussionId, expectedVersion, goals })` 保存全部开放目标，最多 10 个，遗漏的开放目标会丢弃，保存不会开始任务。旧 ideas 入参继续可用，缺少或同传两者均返回 bad_request。冲突返回最新 version、goals 和 ideas，供合并后重试。两个宿主的保存结果都含目标网页链接。Claude 面板只管理项目、任务和 Agent，目标从网页管理和开始。`wildcrane_status().recent[]` 提供 goals 计数及兼容 ideas 计数。

Runner（含启动器的更新与下载、它启动的看板命令）与其启动的 Agent 优先继承 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 及其小写变量。缺少这些变量时，macOS 上使用系统已启用的手动 HTTP、HTTPS、SOCKS 代理与绕过列表，每分钟及每个任务前重新读取，开关或修改代理无需重启；不执行 PAC。其他平台通过启动 Runner 的环境配置代理。无代理配置时保持直连。连接恢复后以最终执行结果收尾；可选 MCP 错误保留在日志中，不单独使任务失败。

## 共享本机设置

运行 `wildcrane-runner --settings`，或在 Claude Code、Codex 中要求打开 WildCrane 设置，即可登录、查看工具状态、选择项目文件夹和解除绑定。Claude 面板提供“运行电脑设置”入口；旧的登录和添加目录工具继续可用。

选择文件夹后仍需确认才会授权。新项目可直接选择所属空间；绑定仅指定任务目录，不提供文件系统隔离。界面随 Runner 和两种插件打包，无需联网下载页面资源。

设置服务仅在前台宿主运行期间可用，同一配置目录共用一个入口；关闭宿主后，从其他插件重新打开即可。终端复用已有入口时正常退出，承载服务时保持前台运行。本机运行过更新的 Runner 时，设置页由它提供，无需更新插件；旧版 Runner 不带设置页时使用宿主自带的。无法自动打开浏览器时，可在同一电脑手动访问输出的临时地址。

先发布支持协议 14 的 Runner 与插件，再发布云端设置引导。云端仍接受现有协议，不提高最低版本；旧插件显示更新提示。回退保留原会话和兼容目录清单。

本机设置的“接受 Alpha 版本更新”默认关闭，Alpha 风险较高，不建议日常使用。
开启一次后持续接收团队验证版本；关闭后保留当前版本，等待正式版追上，不会因关闭选项自动降级。
运维主动撤回版本仍可触发回滚。同版本晋级不重启。

偏好独立保存在 `runnerHome()/preferences.json`（默认 `~/.wildcrane/preferences.json`）的
`acceptAlphaUpdates` 布尔字段；断网可保存，重启和退出登录保留，不随账号同步。
同一目录的终端和插件共用设置。旧安装必须手动更新一次安装包或插件以升级外层启动器；
只自动更新子进程不能获得 Alpha 支持。此选项只控制 Runner，不影响 akb 或插件自身的更新渠道。
