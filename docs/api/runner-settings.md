# 本机设置入口

- **MCP**: `wildcrane_open_settings({ path?: string, project?: string })`，Claude Code 与 Codex 均可在登录前调用。参数仅预填当前目录和项目，不授权或创建绑定。
- **返回值**: `{ opened: boolean, url: string }`；`opened` 表示已发起浏览器打开操作，临时 `url` 可在同一电脑手动访问。启动失败返回 `{ error: "settings_unavailable", message: string }` 并标记 MCP 错误。
- **终端**: `wildcrane-runner --settings` 启动或复用设置服务并输出地址；复用时退出，承载服务时保持前台。失败返回非零退出码。
- **兼容**: `wildcrane_status`、`wildcrane_sign_in`、`wildcrane_add_folder` 保留签名和授权语义，复用共享登录与目录逻辑；不带参数的终端启动方式不变。
- **本机访问**: 服务仅监听 `127.0.0.1` 随机端口，一次性入口换取服务会话并移除地址凭据；不向页面返回登录令牌。宿主关闭后从插件或终端重新打开。
- **云端刷新**: 绑定和解除沿用目录接口，通过现有事件流发送 `project.folders.updated` 刷新提示，仅包含空间与项目编号，不包含本地路径，也不改变事件游标。项目设置可见时补读状态。
- **发布顺序**: 先发布协议 14 的本机支持，再上线云端引导；旧插件提示更新，最低 Runner 协议保持不变。
