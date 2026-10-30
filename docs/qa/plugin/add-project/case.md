# 在插件里把文件夹变成项目

## Setup

- 同 [安装 Claude Code 插件并登录](../install-and-sign-in/case.md)，已登录 alice，这台电脑是账号当前的 Runner。
- `/tmp` 下的文件夹算系统目录，所以项目放在 `/Users/Shared` 下的两个 git 文件夹 `proj`、`second`。
  账号已有另一个项目 `shop`，没绑定这台电脑。
- 第 5、6 步用 50 行的终端，其余 34 行。

## Steps

1. 在 `proj` 里启动 Claude Code，运行 `/wildcrane`。
   预期：Ideas 写着这个文件夹还不是项目，有 **Create project proj**。
   证据：[01-not-a-project-yet.png](01-not-a-project-yet.png)
2. 按 Create project proj。
   预期：提示变成「No ideas yet」，底部出现账号和 Sign out。
   证据：[02-project-created.png](02-project-created.png)
3. 按 `2` 打开 Projects。
   预期：`proj` 标着 Current 和路径，有 Board ↗、Unbind 和 **+ New project**。
   证据：[03-projects-tab.png](03-projects-tab.png)
4. 在 `/tmp` 下的文件夹里打开面板。
   预期：写着这是系统目录，要在项目目录里打开 Claude Code。
   证据：[04-system-folder.png](04-system-folder.png)
5. 在 `second` 里打开面板。
   预期：除 Create project second 外，下面列出 `shop` 和 **Bind**。
   证据：[05-bind-offered.png](05-bind-offered.png)
6. 按 Tab 移到 Bind，按 Enter，再打开 Projects。
   预期：`shop` 标着 Current 和 `second` 的路径，`proj` 还在。
   证据：[06-bound.png](06-bound.png)

## Feedback

一个按钮就建好项目，名字也取自文件夹，几乎不用想。绑定已有项目同样直接。
不足：面板只有终端高度的三成，34 行时 `Or bind an existing project` 下面的项目和 Sign out 都被切掉，
也没有滚动提示，要按 Tab 才会滚出来。系统目录的提示下面仍摆着 Create project，看起来能按。这台电脑不是
账号当前的 Runner 时，创建只说 `Couldn't do that. Try again.`，其实重试没用，要先释放另一台。
