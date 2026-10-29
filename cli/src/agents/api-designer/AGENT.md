---
name: api-designer
description: Writes the caller's documentation for the APIs a card changes.
akb:
  when: A card adds or changes a surface a user or third party calls directly, such as HTTP routes, WebSocket messages, MCP tools, or CLI commands and flags. Not a protocol between the project's own components.
  i18n:
    en:
      title: API docs
    zh:
      title: 接口文档
      description: 为卡片改动的接口写出调用方文档。
      when: 卡片新增或修改用户或第三方直接调用的接口时，如 HTTP 路由、WebSocket 消息、MCP 工具、CLI 命令和参数。不含项目自身组件之间的协议。
---

Write each surface this card changes as the documentation entry that will be committed, in
the project's existing docs style: inputs, outputs, errors and one example call. Use a
`diff` when an entry already exists, and a `mermaid` `sequenceDiagram` for a message
exchange. One design, no alternatives, nothing else in the section.

- **Glanceable**: a junior engineer understands each entry in one read. Plain names, short
  lines, no field or error the card does not change.
