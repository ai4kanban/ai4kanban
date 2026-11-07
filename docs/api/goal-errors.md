# 目标错误（英文 message/reason；调用方按现有错误码处理）

PUT /v1/discussions/{id}/draft：输入 expectedVersion 与 goals 或兼容 ideas；成功返回讨论，冲突返回 409/version_conflict 和最新 discussion。
POST /v1/discussions/{id}/goals/{goal}/start（兼容 /ideas/{idea}/start）：输入 project?、expectedVersion?、skip_plan?、machine?；成功返回任务，保留外部讨论重复调用返回原任务的行为。
wildcrane_draft_save({discussionId, expectedVersion, goals?, ideas?})：二选一传目标数组；成功返回 saved:true，冲突返回 saved:false、最新 version/goals/ideas/url，参数错误保持 isError:true。
akb raw goal <new|save|drop|start> [--id <goal>] [--title <title>] [--body-file <file>] [--workflow <id>] [--previews <agents>]（兼容 idea）：编辑目标及审阅要点，成功结果增加 previews，文件校验失败沿用现有退出行为。

`akb previews --triggers [--workflow <id>] [--workspace <id>] [--json]` 查询已启用要点；[完整接口与兼容语义](goal-previews.md)。

| 场景 | 英文文字 |
| --- | --- |
| HTTP 草稿双传，400/bad_request | Send either goals or ideas, not both. |
| HTTP 草稿缺失或非数组，400/bad_request | goals must be an array. |
| HTTP 保存冲突，409/version_conflict | The goals have changed. Read them again before saving. |
| HTTP 目标不存在，404/not_found | No goal has this id. |
| HTTP 已开始，409/conflict | This goal has already been started. |
| 数据库工作流变化，409/conflict | This goal's workflow has changed. |
| MCP 缺失或双传，bad_request | Provide exactly one of goals or ideas. |
| MCP 保存冲突，saved:false 的 reason | The goals have changed. Merge your changes with the latest goals and save again. |
| CLI/Runner/Web 两字段不一致 | goals and ideas do not match. |
| CLI/Runner/Web 缺少数组 | The goals array is missing or invalid. |

调用例：PUT /v1/discussions/dsc_1/draft，JSON 为 {"expectedVersion":2,"goals":[]}；POST /v1/discussions/dsc_1/goals/idea_1/start，JSON 为 {"expectedVersion":2}。
插件例：wildcrane_draft_save({"discussionId":"dsc_1","expectedVersion":2,"goals":[]})。
CLI 例：akb raw goal save --id idea_1 --title "Ship the report"。

- **发布**：先部署数据库迁移，再部署 Cloud；Runner、CLI 和 Web 可独立更新。回滚仅恢复旧文案，不回滚数据。
- **网页**：保留现有中英文错误展示及恢复操作，按错误码处理响应。
