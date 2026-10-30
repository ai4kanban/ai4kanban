# 在 Claude Code 面板里看到新版本并升级

## Setup

- 取证用 `CLAUDE_CONFIG_DIR` 指向临时目录、占位的 `ANTHROPIC_API_KEY`（面板不调用模型），
  `WILDCRANE_HOME` 指向临时目录，未登录。
- 本地 marketplace 名为 `wildcrane`，插件条目用 `{"source":"url","url":"file:///…"}` 指向本地 git
  仓库，按版本缓存，和正式安装一样；`plugin.json` 改成 0.1.0 后安装。线上发布清单是 0.1.4，所以
  新版本号是真实查询得到的。升级时往本地仓库提交含 #127 的代码，版本号写 0.1.4；线上的 0.1.4 不含 #127。
- 用手动权限模式跑。第 1–4 步的 0.1.0 含 #127，第 5 步的 0.1.0 不含。

## Steps

1. 在 Claude Code 里运行 `/wildcrane`。
   预期：不弹权限询问；标题行显示 `v0.1.0`；顶部灰色边框的提示框写着 `Version 0.1.4 is available`，
   下面是两条升级命令和 /reload-plugins 步骤；面板其他内容照常。
   证据：[01-update-offered.png](01-update-offered.png)
2. 在终端执行提示框里的两条命令。
   预期：插件从 0.1.0 更新到 0.1.4。
   证据：[02-update-commands.log](02-update-commands.log)
3. 回到 Claude Code 运行 `/reload-plugins`，看着开着的面板。
   预期：不弹权限询问，提示框立即消失，版本号变为 `v0.1.4`。
   证据：[03-after-reload.png](03-after-reload.png)
4. 再运行一次 `/wildcrane`。
   预期：标题行显示 `v0.1.4`，没有提示框。
   证据：[04-after-reopen.png](04-after-reopen.png)
5. 换成不含 #127 的 0.1.0 重走一遍：运行 `/wildcrane`，在权限询问里选 Yes，执行两条命令，运行 `/reload-plugins`。
   预期：首次打开询问一次；reload 时不再询问，提示框立即消失，版本号变为 `v0.1.4`。这就是现有用户下次升级的路径。
   证据：[05-upgrade-from-older.png](05-upgrade-from-older.png)

## Feedback

版本号就在标题旁，不抢眼；提示框的命令能直接抄，灰色边框也不会被当成故障。reload 后面板当场换成新版本，
用户不用再想要不要重新打开，手动模式下也不再把内部用的 `key` 摆进权限询问；从旧版升上来时，这次升级本身就已不再询问。
还有两处摩擦：`claude plugin update` 打印 `Restart to apply changes`，而提示框说的是 /reload-plugins；
终端 113 列宽时提示框把命令从词中间折行（`wildc` / `rane`），抄的时候要拼回去。
