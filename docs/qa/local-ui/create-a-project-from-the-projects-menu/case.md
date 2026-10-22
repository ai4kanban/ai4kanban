# 在桌面应用的项目菜单里新建一个项目

## Setup

- **应用**：从本次提交构建的桌面应用（`desktop/` 加 `kanban-ui` 的 standalone 构建），用单独的 `--user-data-dir`、`HOME` 和 `AI4KANBAN_HOME` 启动，界面语言中文，不碰这台电脑上正在用的应用。
- **项目**：已打开一个一次性 git 项目 `/tmp/qa-lu/proj`，项目列表里只有它。

## Steps

1. 点左上角的项目名「proj」。
   菜单列出「项目」和当前的 proj，下面依次是「＋ 新建项目…」和「打开文件夹…」（普通文件夹图标）。
   ![项目菜单](01-projects-menu.png)

2. 点「新建项目…」。
   当前窗口里弹出「新建项目」：「项目名称」输入框、存放位置（默认是上一个项目的上级目录 `/tmp/qa-lu`）、「取消」「创建」。
   ![新建项目弹窗](02-new-project-dialog.png)

3. 名称填「proj」，点「创建」。
   弹窗不关，在位置下方显示「/tmp/qa-lu/proj 已经存在，而应用绝不会写入已有的文件夹。请换个名字，或者换个存放位置。」
   ![文件夹已存在](03-folder-exists.png)

4. 点「取消」，重新打开弹窗，填「notes-app」，再点「取消」。
   弹窗关上，`/tmp/qa-lu` 下没有多出 notes-app。
   [取消后](04-cancel.log)

5. 再打开弹窗，填「notes-app」，点「创建」。
   当前窗口切到 notes-app：顶栏项目名变成「notes-app」，新看板从设置向导开始。
   ![切换到新项目](05-switched-to-new-project.png)

6. 在终端看新项目。
   `/tmp/qa-lu/notes-app` 是刚 `git init` 的仓库（还没有提交），里面有看板 `docs/`、`.akb/`，以及打开项目时写入的 `.claude/`、`.agents/`。
   [新项目](06-new-project.log)

7. 再点顶栏的项目名。
   菜单里有 notes-app 和 proj 两个项目。
   ![两个项目](07-both-projects-in-menu.png)

## Feedback

- **不用退回启动页**：在看板里就能建新项目，一步切过去，比先关项目或去 Finder 建文件夹顺得多。
- **出错就地说清**：重名时原句告诉你哪个文件夹已存在、该怎么办，弹窗保留已填的名字。
- **位置一行不像能点**：存放位置只是带文件夹图标的一行路径，看不出点它能改。
- **没有跑到的**：点存放位置用系统对话框改位置（headless 驱动不了系统对话框）；名称不合法时的提示；`git init` 失败时的警告；英文界面。
