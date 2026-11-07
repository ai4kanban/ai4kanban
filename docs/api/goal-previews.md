# 目标审阅要点接口

## CLI

```sh
akb raw goal new --workflow coding --previews ui,api --title "Review goal previews" --body-file /tmp/goal.md
akb raw goal save --id idea_1 --previews ""
```

`raw goal new/save` 新增可选的 `--previews <agents>`，逗号分隔。`ui` 和 `api` 分别表示 `ui-designer` 和 `api-designer`，其余使用现有规范名称与历史别名。规范化后按工作流顺序去重。

创建时省略为 `[]`。修改时省略保留同一工作流的选择，`--previews ""` 清空。更换工作流时省略则清空，显式传入则按新工作流校验。

成功沿用现有保存结果并增加 `previews`。非讨论上下文、未知工作流、未知或停用 agent 沿用 CLI 的失败退出行为，失败不写入草稿。未知 agent 的文字为 `Preview agent <name> is not enabled in workflow <id>.`。

## 查询已启用 Preview Agent 的触发条件

```sh
akb previews --triggers --workflow coding --workspace ws_1
akb previews --triggers --workflow coding --json
```

`akb previews --triggers` 新增 `--workflow <id>` 与 `--workspace <id>`。带 `--workflow` 时只列该工作流已启用的 agent，按工作流顺序；目标讨论中省略 `--workspace` 即用讨论所属工作空间。不带 `--workflow` 时保持 #397 的全目录输出。

输出沿用 #397：agent 名称与完整原始 `when`，未配置显示 `Not configured`；JSON 为标准响应外层及 `agents: {name,when}[]`、`problems`、`output`。工作流没有启用的 agent 时 `agents: []`。查询只读。

未知工作流或工作空间、讨论外省略 `--workspace`、讨论元数据缺少预览目录时非零退出，后者提示 `Preview agents are unavailable; update Runner and try again.`。非法参数组合沿用 #397 的 `invalid-usage`。

## 可选审阅要点

`GET /v1/workflows?workspace=<id>` 在每个工作流对象新增 `previews` 数组，保持原分页方式。仅包含已启用的 preview agent，按工作流顺序返回。

```json
{
  "id": "wf_builtin_coding",
  "previews": [
    {
      "agent": "ui-designer",
      "title": {"en": "UI design", "zh": "界面设计"},
      "when": "A card designs or changes a user-facing feature..."
    }
  ]
}
```

`agent` 为规范名称。`title` 允许缺少一种语言，均缺少时调用方展示 `agent`。`when` 为 agent 的原始触发条件，空字符串表示总是适用。内置与自定义工作流使用同一结构。现有工作流读取错误沿用原处理。

```sh
curl "$API/v1/workflows?workspace=$WORKSPACE" -H "Authorization: Bearer $TOKEN"
```

## 目标读取与保存

`GET /v1/discussions/{id}` 每个目标增加 `previews: string[]`。`goals` 与兼容 `ideas` 的同一目标返回相同配置。

`PUT /v1/discussions/{id}/draft` 的目标对象新增可选 `previews: string[]`。传规范 agent 名称，最多 50 项，去重后按工作流顺序保存。省略、清空和更换工作流的语义与 CLI 一致。非法类型、未知或停用 agent 返回 `400/bad_request`，整个保存不生效。

```sh
curl -X PUT "$API/v1/discussions/dsc_1/draft" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"expectedVersion":2,"goals":[{"id":"idea_1","title":"目标预览","outcome":"保存审阅要点","acceptance":["刷新后仍显示"],"workflow":"wf_builtin_coding","previews":["ui-designer","api-designer"]}]}'
```

成功返回更新后的 discussion。版本冲突继续返回 `409/version_conflict` 和最新 discussion。旧客户端对同一目标省略 `previews` 时，服务端保留选择。已开始目标按原规则保持原状。

## 切换工作流

`PATCH /v1/discussions/{id}/goals/{goal}` 继续接收 `{workflow}`，成功返回的目标 `previews` 清空。兼容 `/ideas/{idea}`。

```sh
curl -X PATCH "$API/v1/discussions/dsc_1/goals/idea_1" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"workflow":"wf_builtin_coding"}'
```

重复指定同一工作流保留选择。工作流改变与配置清空在同一事务内完成。

## 开始目标

`POST /v1/discussions/{id}/goals/{goal}/start` 保持现有输入 `project?`、`expectedVersion?`、`skip_plan?`、`machine?` 与返回任务结构。兼容 `/ideas/{idea}/start`。

```sh
curl -X POST "$API/v1/discussions/dsc_1/goals/idea_1/start" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"expectedVersion":3}'
```

任务与卡片继承目标的 `previews`，含 `[]`。网页只有「立即开始」传 `skip_plan:true`，「细化目标」沿用规划入口。省略 `skip_plan` 的外部调用继续使用原有规划行为。创建时直接去掉工作流已删除或停用的选择，不报错。外部讨论重复开始仍返回原任务。

## Codex、Claude Code 中的讨论

插件技能直接调用插件自带的 `akb`，命令与网页讨论相同：

```sh
akb workflow list
akb previews --triggers --workflow coding
akb raw goal new --workflow coding --previews ui,api --title "Review goal previews" --body-file /tmp/goal.md
```

不在网页讨论中时，akb 读取 `CLAUDE_CODE_SESSION_ID` 或 `CODEX_THREAD_ID`，找到本会话的讨论，首次使用时在当前目录所属项目中新建；目录不属于任何项目时目标归入 General。未登录时非零退出并提示登录。成功结果附讨论网页链接。

`wildcrane_draft_read`、`wildcrane_draft_save` 保持现状，技能不再调用。

