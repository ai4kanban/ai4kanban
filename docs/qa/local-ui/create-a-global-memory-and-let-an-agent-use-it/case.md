# 新建一个全局记忆，让 Agent 接入它

## Setup

- **看板**：用本目录的 `seed.sh` 建一个一次性项目：新装看板，一张卡 #2「写 1.2 版的发布说明」，一个项目自建的 Agent `release-notes`（中文名「发布说明」，规划助手），它的 `AGENT.md` 还没有接入任何全局记忆。
- **界面**：浏览器打开看板 UI（`kanban-ui`），窗口 1440×900，界面语言中文。
- **命令行**：第 5 步用 `akb spec <agent> <id> --print` 打印 Agent 会收到的提示，不真的运行 Agent。

## Steps

1. 点右上角的「配置」，再点左栏「定制」下的「全局记忆」。
   列表里只有一项「竞品」，右边标着「内置」，已经选中。右侧是它的页面：简介「竞品有哪些功能、如何设计，每个竞品一个文件。」，文件夹 `docs/kanban/memory/competitors/`（带复制按钮），「使用它的 Agent」是「竞品调研」，下面是灰底的约定原文，最下一行「内置约定随版本更新，不能修改。」。约定不是输入框，页面上除了「复制路径」没有别的按钮，没有「保存」和「删除」。
   ![内置的竞品](01-built-in-competitors.png)
   [内置记忆只读](02-built-in-is-read-only.log)

2. 点列表标题行右端的「+」（「新建全局记忆」），在「名称」里输入 `competitors`。
   右侧换成「新建全局记忆」表单：名称、简介、约定三项，右下「取消」「创建」。名称框变成橙红色边框，下面一行「已有同名的全局记忆」，「创建」不能点。
   ![名称重复](03-name-taken.png)

3. 把名称改成 `customer-interviews`，简介填「用户访谈的要点，每次访谈一个文件。」，约定写三条（索引怎么写、每次访谈一个文件、超过半年要重新核实）。
   名称下的提示变回灰色「小写英文，用 - 连接，例如 customer-interviews」，「创建」可以点。
   ![填好的表单](04-new-memory-filled.png)

4. 点「创建」。
   列表里多出 `customer-interviews` 并被选中（自建记忆没有译名，直接显示名称，也没有「内置」字样）。右侧是它的页面：简介、文件夹 `docs/kanban/memory/customer-interviews/`、「使用它的 Agent」写着「还没有 Agent 使用它。」，约定是可编辑的输入框，右上有「删除」。项目里多了这个文件夹和其中的 `MEMORY.md`。
   ![创建好的记忆](05-created.png)

5. 在约定末尾加一行「- **受访者**: 只写化名，不写真实姓名和公司。」，点「保存」。
   「保存」左边出现「已保存」，按钮变回不可点；`MEMORY.md` 里多了这一行。
   ![约定已保存](06-rules-saved.png)
   [保存后的 MEMORY.md](06b-memory-file.log)

6. 点左栏「工作流」，在「规划助手」里点「发布说明」，在右侧 `AGENT.md` 的 `hook: plan` 下面加一行 `memory: [customer-interviews]`，点输入框外面让它保存；关掉「配置」再打开，回到「发布说明」。
   「运行时」下面多出一行「全局记忆」，里面是带书本图标的 `customer-interviews` 链接。
   ![Agent 接入了记忆](07-agent-uses-memory.png)

7. 点这个 `customer-interviews` 链接。
   切到「全局记忆」，打开的就是 `customer-interviews`；「使用它的 Agent」里是「发布说明」和它的头像。
   ![链接打开的记忆](08-link-opens-competitors.png)
   ![记忆页列出使用它的 Agent](09-memory-lists-agent.png)

8. 在命令行运行 `akb spec release-notes 2 --print`。
   打印出的提示在「what you remember」之后有一节「global memories」，列出 `customer-interviews`、它的简介、文件夹的绝对路径，并说约定在那个文件夹的 `MEMORY.md` 里。
   [提示里的全局记忆](10-prompt-carries-memory.log)

9. 先在文件夹里放一份索引 `README.md` 和一份访谈记录（就像 Agent 已经写过），再回到 `customer-interviews` 的页面点「删除」。
   右上弹出确认框「删除「customer-interviews」？」「它的文件夹和其中的所有文件一并删除，1 个 Agent 不再读到它。」，下面「取消」和红色的「删除」。
   ![删除确认](11-confirm-delete.png)

10. 点确认框里的「删除」。
    列表里只剩「竞品」并被选中；`docs/kanban/memory/customer-interviews/` 整个文件夹连同三个文件都没了。
    ![删除之后](12-deleted.png)
    [文件夹已删除](13-folder-gone.log)

11. 回到「工作流」点「发布说明」，再运行一次第 8 步的命令。
    「发布说明」这一行右端有一个橙红色的感叹号，页面顶部一条提示「找不到全局记忆「customer-interviews」，这个助手运行时读不到它。」；打印出的提示里不再有「global memories」这一节。
    ![Agent 提示记忆不见了](14-agent-warns-memory-gone.png)
    [删除后的提示](15-prompt-after-delete.log)

## Feedback

- **入口好找**：「全局记忆」就在「工作流」下面，列表加详情的布局和工作流页一样，内置和自建一眼分得出。
- **第 7 步打开错了记忆**：从「发布说明」页点 `customer-interviews` 链接，切到「全局记忆」后选中的却是列表第一项「竞品」，连试三次都一样；要自己再在列表里点一次。截图 08 是实际看到的样子。
- **接入只能手写 YAML**：界面上没有给 Agent 选全局记忆的地方，要在 `AGENT.md` 里自己写 `memory: [<名称>]`；全局记忆页也只能看到谁在用，不能从这里加。不熟 YAML 的人会卡在这一步。
- **改完 `AGENT.md` 页面不更新**：保存后「全局记忆」这一行不会出现，切换到别的 Agent 再切回来也不行，要关掉「配置」再打开；删掉那一行时，过期的警告也会一直留着，直到重新打开。
- **删除说清了后果**：确认框写明连文件一并删除、有几个 Agent 会受影响；删除后 Agent 的感叹号和顶部提示把断掉的引用指出来了。但 `AGENT.md` 里的 `memory:` 那一行不会跟着删，要自己去改。
- **内置约定是英文**：「竞品」的约定在中文界面里整段是英文，而且是 Markdown 原文（`**`、反引号都露在外面），看起来像源码。
- **简介只能新建时填**：建好后页面上只能改约定，想改简介得去编辑 `MEMORY.md`；页面上也没有任何提示。
- **新建的文件夹只有 `MEMORY.md`**：约定里写的索引 `README.md` 不会自动建，要等 Agent 第一次写。
- **没有跑到的**：真正运行一次 Agent、看它按约定写入文件；英文界面；手机宽度；名称格式不对（如大写或空格）的提示；把内置「竞品」的文件夹建出来之后的样子。
