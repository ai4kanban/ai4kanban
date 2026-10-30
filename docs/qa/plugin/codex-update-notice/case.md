# 在 Codex 里问状态时得知新版本

## Setup

- 真实 Codex 0.159（`/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex`），`CODEX_HOME`
  指向临时目录，用 `codex exec` 提问，`--dangerously-bypass-approvals-and-sandbox` 跳过工具批准。
- 把 `.agents` 和 `codex` 放进同一文件夹，等同解压 `wildcrane-codex.zip`，`plugin.json` 改成 0.1.0 后
  `codex plugin marketplace add`、`codex plugin add`。
- Codex 不把 `WILDCRANE_HOME`、`AI4KANBAN_*` 传给插件服务：写进临时副本 `mcp.json` 的 `env`，指向假
  Cloud 和假登录，否则会用上本机真实账号。
- 线上发布清单是 0.1.4，新版本号是真实查询得到的。

## Steps

1. 已登录时问「我的 WildCrane 状态怎么样？」。
   预期：Codex 回复里说插件是 0.1.0、有 0.1.4、任务仍可运行，并给出发布页链接和
   `codex plugin remove`、`add` 两条命令。
   证据：[01-newer-release.log](01-newer-release.log)
2. 在同一对话里再问一次状态。
   预期：不再重复更新步骤。
   证据：[02-same-conversation.log](02-same-conversation.log)
3. 按回复的步骤，用 0.1.4 覆盖旧副本，运行那两条命令。
   预期：插件装到 0.1.4。
   证据：[03-update-commands.log](03-update-commands.log)
4. 开新对话问状态。
   预期：显示 0.1.4，不提更新。
   证据：[04-after-update.log](04-after-update.log)
5. 换回 0.1.0，假 Cloud 拒绝 Runner（`runner_outdated`），问状态。
   预期：Codex 说这台电脑已无法运行任务，给出过旧的更新步骤，而不是「任务仍可运行」。
   证据：[05-outdated-first.log](05-outdated-first.log)
6. 未登录时问状态。
   预期：只说未登录，不提新版本。
   证据：[06-signed-out.log](06-signed-out.log)

## Feedback

回复自然，步骤能照着做，版本号只在用户关心时出现，也不纠缠。不足：用户不问状态就永远不知道；未登录的
用户也看不到。检查在后台进行，服务刚启动就问时答复里还没有 `latest`：直接调用工具 0 毫秒时为空、4 秒
后才有；一次真实 Codex 运行也没带提示（那次用的是本机真实账号，未查明原因），之后五次都正常。更新步骤
要手动下载解压，比 Claude Code 麻烦得多，而且「解压覆盖旧副本」要用户自己记得旧副本在哪里。
