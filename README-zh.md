<div align="center">

# AI4Kanban

### 越用越懂你的 AI 项目管理。

给它一个模糊的想法。Agent 把它拆开，能自己想明白的就自己定，<br>
剩下的来问你，然后在后台一直推进，<br>
直到每个细节都清楚到可以开工。

[English](README.md) · **简体中文**

[官网](https://ai4kanban.dev) · [快速开始](#快速开始) · [路线图](#路线图)

<img src="https://cdn.ai4kanban.dev/og-image-v2.jpg" alt="AI4Kanban——越用越懂你的 AI 项目管理" width="720">

</div>

## 它能做什么

下面打勾的部分都已经做好，现在就能用。

- [x] **拆解工作。** Agent 读一个想法，把它拆成子任务。里面要是夹带了不相干的诉求，
  会被单独拎出来另立一张卡片。
- [x] **循环澄清。** Agent 先对想法本身发问。凭记忆和常识能定的，它自己定；定不了的
  才来问你。这个循环一直转，直到再也提不出问题。
- [x] **全天候运转。** 拆解和澄清在后台持续进行，直到想法沉淀成一份清晰的方案。
- [x] **每个决定都有据可查。** 一份方案是怎么一步步成形的，随时可以回溯。
- [x] **自己提任务。** Agent 会翻各个模块的记忆，主动提出可以做的功能。你否掉一个，
  这次否决就被记下来，同类的想法它不会再提第二次。
- [x] **自我进化。** 你每一次介入都会被记下来，成为它之后判断的依据。记忆按项目模块
  分开存放。
- [x] **排定优先级。** 它不只是把任务拆开，还会理清依赖关系、权衡投入和收益，让该先做
  的先做。
- [x] **从头管到尾。** 方案清楚了也不算完。一张任务从提出、澄清、开发到归档，整条链路
  都归它管，所以看板上呈现的永远是项目的真实状态。

AI4Kanban 是为小团队做的。把工作交给看板，你就能从实现细节里抽身，把精力花在判断每张
任务对用户的价值上，而不是盯着编码 Agent 怎么执行。今天的编码 Agent 已经能把清晰的方案
变成可运行的代码；但你给它一个模糊的想法，它就会在错误的假设上做出错误的东西。
AI4Kanban 记得你过去的每个决定，并用它们把同样模糊的想法打磨成一份足以开工的方案。

## 实现方式

- [ ] **不挑 harness。** 设计上不绑定任何 harness（运行 Agent 的工具），Claude Code、
  Codex、Cursor 都行。目前只接通了 Claude Code，其余在路线图上。
- [x] **本地优先。** 卡片默认就是 Markdown 文件，不走 MCP，不用数据库，省 token。所有
  内容都是 git 里的纯文本，能 review、能 diff、能回滚。
- [x] **开箱即用。** 一句 prompt 就能安装或更新。AI4Kanban 只做项目管理这一件事，几乎
  没有需要配置的地方。
- [x] **两种操作方式。** 在命令行里通过 skill 操作看板，或者打开本地 UI 点选操作。

人类项目经理用看板管事，Agent 也应该这样。AI4Kanban 不待在聊天窗口里，看板就是它的界面。

## 快速开始

在项目根目录下，对 Claude Code（或者任何能执行 shell 命令的编码 Agent）说：

```
Set up ai4kanban for this project. Read
https://ai4kanban.dev/INSTALL_PROMPT.txt and follow it.
```

Agent 会把 skill 装进你的项目，读一遍代码库把配置填好，在 `docs/kanban/` 下搭起看板，
并提出头三个任务。配置和看板都在 `docs/kanban/` 里，skill 目录下只有通用代码。装完之后，
你只管跟看板对话。

更喜欢用插件？先 `/plugin marketplace add dist0com/ai4kanban`，再
`/plugin install kanban@kanban`，skill 就可用了；之后执行 `kanban init` 并填好
`docs/kanban/config.md`，安装就结束了，不用往项目里复制任何文件。上面那段安装 prompt
两条路都覆盖。

如果你的 Agent 打不开网址，直接打开 [`INSTALL_PROMPT.txt`](web/public/INSTALL_PROMPT.txt)
把内容贴给它，效果一样。唯一的前置要求是 Node.js 18+；脚本零依赖，没有别的东西要装。

## 使用 skill

用大白话驱动它，下面这些说法都能触发：

| 你说 | Agent 做什么 |
| --- | --- |
| "propose new tasks" | 挑一个重点方向走查一遍，把没人规划过的工作起草成新卡片 |
| "add a task: …" | 先审一遍这个想法，再写成卡片并登记进索引 |
| "refine #4" | 复查 4 号卡片，把它再细化一步 |
| "resolve #4" | 和你一起把 4 号卡片上的未决问题逐个敲定 |
| "review the board" | 逐张检查卡片：是否清楚、是否重复、是不是其实已经做完 |
| "#4 is done" | 更新这次改动涉及的文档，并把卡片从看板上移除 |

上面列的是原始触发语，说中文一样管用。

这个仓库自己就在用这个 skill：`docs/kanban/` 是一块真实运转的看板，记录着 skill 自身的
开发，可以直接拿它当填好的样例来看。

### Web UI（可选）

同一批 Markdown 文件的本地看板视图：完整读一张卡片，点一下就能操作，不必再敲 prompt。

```bash
npx ai4kanban-ui        # http://localhost:7420
```

![Web UI 的看板视图](https://cdn.ai4kanban.dev/kanban-skill-ui-v2.jpg)

![Web UI 的卡片详情页](https://cdn.ai4kanban.dev/kanban-skill-ui-detail-v2.jpg)

只在 localhost 上跑，不用部署，不用登录。更多选项见 [kanban-ui/](kanban-ui/README.md)。

## 路线图

- [ ] **可插拔存储**（即将）：把看板放进 Obsidian、Notion 或 GitHub Issues。
- [ ] **可插拔 harness**（即将）：把任务交给 Claude Code、Codex 或 Cursor 去执行。
- [ ] **Git worktrees**（即将）：多个任务并行，各占一个 worktree，互不干扰。
- [ ] **定时任务与 webhook**（即将）：按时间或通过 webhook 从外部接收请求。
- [ ] **阻塞任务处理**（即将）：对积压太久的任务不再放任，拆开、重写，或者直接否掉。
- [ ] **团队协作**（以后）

## 更新

一句 prompt 就够。更新指南随 skill 一起发布，不用先去下载什么：

```
Update ai4kanban in this project. Read
.claude/skills/kanban/references/update.md and follow it.
```

更新只覆盖通用的 skill 目录（`SKILL.md`、`kanban.mjs` 以及 references）。你的配置和看板
都在 `docs/kanban/` 里，不会被碰到。

## 许可证

[Apache License 2.0](LICENSE)。可自由使用、修改和再分发，欢迎贡献。
