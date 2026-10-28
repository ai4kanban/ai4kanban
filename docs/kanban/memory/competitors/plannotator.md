---
last_read: 2026-10-13
---

## Features

- [ ] **计划自动审阅**：通过各 agent 的 plan mode 钩子（Claude Code 为 `ExitPlanMode`），agent 每出一份计划就在浏览器打开审阅页。
- [ ] **批注与打回**：可评论、划删、加标签；批准则 agent 继续，打回则把结构化反馈发给 agent，修改后显示计划差异再审 (#1632)。
- [ ] **任意文档批注**：`/plannotator-annotate` 可批注 Markdown、文件夹、URL 和 HTML 页面；`/plannotator-last` 批注 agent 上一条消息。
- [ ] **代码审阅**：`/plannotator-review` 以并排 diff 审阅未提交改动、GitHub PR、GitLab MR 或 GitButler 工作区，可暂存文件、请 AI 给审阅建议，评论回传给 agent。
- [ ] **链接分享**：小内容压进 URL 片段，大内容与 HTML 经 AES-256-GCM 加密上传短链；旧式链接分享已弃用；团队协作转向托管的 Workspaces（仍为候补名单）。
- [ ] **多 agent 支持**：Claude Code、Codex、Copilot CLI、Gemini CLI、OpenCode、Kiro、Droid、Amp、Pi；一条 curl 命令安装，开源免费。
- [ ] **VS Code 集成**：在编辑器内查看 diff，从行号栏添加批注。
- [ ] **本地留存**：历史、草稿与设置存于 `~/.plannotator`，可同步到 Obsidian、Bear。

## Sources

- Plannotator README: https://github.com/backnotprop/plannotator
- Plannotator 官网: https://plannotator.ai
